
use web::{router, templates};
use build::{self, errors};
use config;

use std::sync::Mutex;

use hyper::server::request::Request;
use hyper::server::response::Response;
use hyper::net::Fresh;
use hyper::uri::RequestUri;

/// An instance of the server. Something of a God Class. Runs a session of
/// rustw.
pub struct Instance {
    router: router::Router,
    template_engine: Mutex<templates::Engine>,
    builder: build::Builder,
    pub config: config::Config,
}

impl Instance {
    pub fn new() -> Instance {
        let config = config::new();
        Instance {
            router: router::Router::new(),
            template_engine: Mutex::new(templates::Engine::new()),
            builder: build::Builder::from_build_command(&config.build_cmd),
            config: config,
        }
    }

    pub fn build(&self) -> String {
        let build_result = self.builder.build().unwrap();
        // TODO exit status?
        let err_template = self.router.get_template_text(&["errors.html".to_owned()]).unwrap();
        let errs = errors::parse_errors(&build_result.stderr);
        // TODO parse and pass build results
        let mut extra = templates::Extra::new();
        extra.extra_values.insert("messages", &build_result.stdout);
        extra.extra_lists.insert("errors", errs.iter().map(|e| format!("{:?}", e)).collect());
        let mut engine = self.template_engine.lock().unwrap();
        engine.expand(&err_template, self, &extra)
    }
}

impl ::hyper::server::Handler for Instance {
    fn handle<'a, 'k>(&'a self, req: Request<'a, 'k>, mut res: Response<'a, Fresh>) {
        if let RequestUri::AbsolutePath(ref s) = req.uri {
            let action = self.router.route(s);
            //println!("{:?}", action);
            match action {
                router::Action::Static(ref text) => {
                    res.send(text.as_bytes()).unwrap();
                }
                router::Action::Template(ref text) => {
                    let mut engine = self.template_engine.lock().unwrap();
                    let text = engine.expand(text, self, &templates::Extra::new());
                    res.send(text.as_bytes()).unwrap();
                }
                router::Action::Build => {
                    // TODO would be nice to do this async, but waiting for async Hyper.
                    // Then, need to think about 'queueing', async build, timeouts, etc.
                    let text = self.build();
                    // TODO should this be JSON? Should we include data other than the HTML? build command, etc.?
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
