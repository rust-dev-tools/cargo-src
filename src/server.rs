
use web::router;
use build;
use build::errors::{self, Diagnostic};
use config;

use hyper::server::request::Request;
use hyper::server::response::Response;
use hyper::net::Fresh;
use hyper::uri::RequestUri;
use hyper::header::ContentType;
use serde_json;

/// An instance of the server. Something of a God Class. Runs a session of
/// rustw.
pub struct Instance {
    router: router::Router,
    builder: build::Builder,
    pub config: config::Config,
}

impl Instance {
    pub fn new() -> Instance {
        let config = config::new();
        Instance {
            router: router::Router::new(),
            builder: build::Builder::from_build_command(&config.build_cmd),
            config: config,
        }
    }

    pub fn build(&self) -> String {
        let build_result = self.builder.build().unwrap();
        let result = BuildResult::from_build(&build_result);
        // TODO need to do some processing of spans
        serde_json::to_string(&result).unwrap()
    }
}

impl ::hyper::server::Handler for Instance {
    fn handle<'a, 'k>(&'a self, req: Request<'a, 'k>, mut res: Response<'a, Fresh>) {
        if let RequestUri::AbsolutePath(ref s) = req.uri {
            let action = self.router.route(s);
            //println!("{:?}", action);
            match action {
                _ => panic!(),
                router::Action::Static(ref text) => {
                    res.send(text.as_bytes()).unwrap();
                }
                router::Action::Build => {
                    // TODO would be nice to do this async, but waiting for async Hyper.
                    // Then, need to think about 'queueing', async build, timeouts, etc.
                    let text = self.build();
                    // TODO should this be JSON? Should we include data other than the HTML? build command, etc.?
                    res.headers_mut().set(ContentType::json());
                    res.send(text.as_bytes()).unwrap();
                }
                router::Action::Error(status, ref msg) => {
                    // TODO log it
                    //println!("ERROR: {} ({})", msg, status);

                    *res.status_mut() = status;
                    res.send(msg.as_bytes()).unwrap();
                }
            }
        } else {
            // TODO log this and ignore it.
            panic!("Unexpected uri");
        }
    }
}

#[derive(Serialize, Debug)]
struct BuildResult {
    messages: String,
    errors: Vec<Diagnostic>,
    // build_command: String,
}

impl BuildResult {
    fn from_build(build: &build::BuildResult) -> BuildResult {
        BuildResult {
            messages: build.stdout.trim().to_owned(),
            errors: errors::parse_errors(&build.stderr),
        }
    }
}
