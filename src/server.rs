
use build;
use build::errors::{self, Diagnostic};
use config::Config;
use file_cache::Cache;

use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write, BufRead};
use std::path::PathBuf;
use std::process::Command;
use std::str::FromStr;
use std::sync::Mutex;

use hyper::header::ContentType;
use hyper::net::Fresh;
use hyper::server::request::Request;
use hyper::server::response::Response;
use hyper::status::StatusCode;
use hyper::uri::RequestUri;
use serde_json;
use url::parse_path;

// TODO separate path from dir
// TODO need an 'absolute' path to static
const STATIC_DIR: &'static str = "static";

/// An instance of the server. Runs a session of rustw.
pub struct Instance {
    builder: build::Builder,
    pub config: Config,
    file_cache: Mutex<Cache>,
}

impl Instance {
    pub fn new(config: Config) -> Instance {
        Instance {
            builder: build::Builder::from_config(&config),
            config: config,
            file_cache: Mutex::new(Cache::new()),
        }
    }
}

impl ::hyper::server::Handler for Instance {
    fn handle<'a, 'k>(&'a self, req: Request<'a, 'k>, res: Response<'a, Fresh>) {
        let uri = req.uri.clone();
        if let RequestUri::AbsolutePath(ref s) = uri {
            let mut handler = Handler {
                config: &self.config,
                builder: &self.builder,
                file_cache: &mut self.file_cache.lock().unwrap(),
            };
            route(s, &mut handler, req, res);
        } else {
            // TODO log this and ignore it.
            panic!("Unexpected uri");
        }
    }
}

// Handles a single request.
struct Handler<'a> {
    pub config: &'a Config,
    builder: &'a build::Builder,
    file_cache: &'a mut Cache,
}

impl<'a> Handler<'a> {
    fn handle_error<'b: 'a, 'k: 'a>(&self,
                                    _req: Request<'b, 'k>,
                                    mut res: Response<'b, Fresh>,
                                    status: StatusCode,
                                    msg: String) {
        // TODO log it
        //println!("ERROR: {} ({})", msg, status);

        *res.status_mut() = status;
        res.send(msg.as_bytes()).unwrap();        
    }

    fn handle_index<'b: 'a, 'k: 'a>(&mut self,
                                    _req: Request<'b, 'k>,
                                    mut res: Response<'b, Fresh>) {
        let mut path_buf = PathBuf::from(STATIC_DIR);
        path_buf.push("index.html");

        let msg = match self.file_cache.get_text(&path_buf) {
            Ok(data) => {
                res.headers_mut().set(ContentType::html());
                let mut res = res.start().unwrap();

                res.write(data).unwrap();
                if self.config.demo_mode {
                    res.write("\n<script>DEMO_MODE=true; set_build_onclick();</script>\n".as_bytes()).unwrap();
                }
                res.end().unwrap();
                return;
            }
            Err(s) => s,
        };

        self.handle_error(_req, res, StatusCode::InternalServerError, msg);
    }

    fn handle_static<'b: 'a, 'k: 'a>(&mut self,
                                     _req: Request<'b, 'k>,
                                     mut res: Response<'b, Fresh>,
                                     path: &[String]) {
        let mut path_buf = PathBuf::from(STATIC_DIR);
        for p in path {
            path_buf.push(p);
        }
        //println!("requesting `{}`", path_buf.to_str().unwrap());

        let content_type = match path_buf.extension() {
            Some(s) if s.to_str().unwrap() == "html" => ContentType::html(),
            Some(s) if s.to_str().unwrap() == "css" => ContentType("text/css".parse().unwrap()),
            Some(s) if s.to_str().unwrap() == "json" => ContentType::json(),
            _ => ContentType("application/octet-stream".parse().unwrap()),
        };

        if let Ok(s) = self.file_cache.get_text(&path_buf) {
            //println!("serving `{}`. {} bytes, {}", path_buf.to_str().unwrap(), s.len(), content_type);
            res.headers_mut().set(content_type);
            res.send(s).unwrap();
            return;
        }        

        self.handle_error(_req, res, StatusCode::NotFound, "Page not found".to_owned());
    }

    fn handle_src<'b: 'a, 'k: 'a>(&mut self,
                                  _req: Request<'b, 'k>,
                                  mut res: Response<'b, Fresh>,
                                  mut path: &[String]) {
        let mut path_buf = PathBuf::new();
        if path[0].is_empty() {
            path_buf.push("/");
            path = &path[1..];
        }
        for p in path {
            path_buf.push(p);
        }

        let msg = match self.file_cache.get_highlighted(&path_buf) {
            Ok(ref lines) => {
                res.headers_mut().set(ContentType::json());
                res.send(serde_json::to_string(lines).unwrap().as_bytes()).unwrap();
                return;
            }
            Err(msg) => msg,
        };

        self.handle_error(_req, res, StatusCode::InternalServerError, msg);
    }

    fn handle_test<'b: 'a, 'k: 'a>(&mut self,
                                   _req: Request<'b, 'k>,
                                   mut res: Response<'b, Fresh>) {
        let build_result = build::BuildResult::test_result();
        let result = BuildResult::from_build(&build_result);
        let text = serde_json::to_string(&result).unwrap();

        res.headers_mut().set(ContentType::json());
        res.send(text.as_bytes()).unwrap();
    }

    fn handle_build<'b: 'a, 'k: 'a>(&mut self,
                                    _req: Request<'b, 'k>,
                                    mut res: Response<'b, Fresh>) {
        assert!(!self.config.demo_mode, "Build shouldn't happen in demo mode");

        self.file_cache.reset();
        res.headers_mut().set(ContentType::json());
        let build_result = self.builder.build().unwrap();
        let result = BuildResult::from_build(&build_result);

        let text = serde_json::to_string(&result).unwrap();
        res.send(text.as_bytes()).unwrap();
    }

    fn handle_quick_edit<'b: 'a, 'k: 'a>(&mut self,
                                         mut req: Request<'b, 'k>,
                                         mut res: Response<'b, Fresh>) {
        assert!(!self.config.demo_mode, "Quick edit shouldn't happen in demo mode");

        res.headers_mut().set(ContentType::json());

        let mut buf = String::new();
        req.read_to_string(&mut buf).unwrap();
        if let Err(msg) = quick_edit(serde_json::from_str(&buf).unwrap()) {
            *res.status_mut() = StatusCode::InternalServerError;
            res.send(format!("{{ \"message\": \"{}\" }}", msg).as_bytes()).unwrap();
            return;
        }

        res.send("{}".as_bytes()).unwrap();                    
    }

    fn handle_edit<'b: 'a, 'k: 'a>(&mut self,
                                   _req: Request<'b, 'k>,
                                   mut res: Response<'b, Fresh>,
                                   query: Option<String>) {
        // TODO factor out query logic
        match query {
            Some(ref q) => {
                // Extract the `file` value from the query string.
                let start = match q.find("file=") {
                    Some(i) => i + 5,  // 5 = "file=".len()
                    None => {
                        self.handle_error(_req, res, StatusCode::InternalServerError, format!("Bad query string: {:?}", query));
                        return;
                    }
                };
                let end = q[start..].find("&").unwrap_or(q.len());

                // Get the filename out of the query string, then split it on
                // colons for line and column numbers.
                let args = parse_location_string(&q[start..end]);

                let cmd_line = &self.config.edit_command;
                if !cmd_line.is_empty() {
                    let cmd_line = cmd_line.replace("$file", &args[0])
                                           .replace("$line", &args[1])
                                           .replace("$col", &args[2]);

                    let mut splits = cmd_line.split(' ');

                    let mut cmd = Command::new(splits.next().unwrap());
                    for arg in splits {
                        cmd.arg(arg);
                    }

                    // TODO log, don't print
                    match cmd.spawn() {
                        Ok(_) => println!("edit, launched successfully"),
                        Err(e) => println!("edit, launch failed: `{:?}`, command: `{}`", e, cmd_line),
                    }
                }

                res.headers_mut().set(ContentType::json());
                res.send("{}".as_bytes()).unwrap();
            }
            None => {
                self.handle_error(_req, res, StatusCode::InternalServerError, format!("Bad query string: {:?}", query));
            }
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
            messages: build.stdout.to_owned(),
            errors: errors::parse_errors(&build.stderr),
        }
    }
}

pub fn parse_location_string(input: &str) -> [String; 3] {
    let mut args = input.split(':').map(|s| s.to_owned());
    [args.next().unwrap(),
     args.next().unwrap_or(String::new()),
     args.next().unwrap_or(String::new())]
}

fn read_lines(file: &File) -> Result<Vec<String>, String> {
    let mut result = Vec::new();
    let mut reader = BufReader::new(file);

    loop {
        let mut buf = String::new();
        match reader.read_line(&mut buf) {
            Ok(0) => return Ok(result),
            Ok(_) => result.push(buf),
            Err(e) => return Err(e.to_string()),
        }
    }
}

#[derive(Deserialize, Debug)]
struct QuickEditData {
    location: String,
    text: String,
}

// FIXME there may well be a better place for this functionality.
fn quick_edit(data: QuickEditData) -> Result<(), String> {
    // TODO all these unwraps should return Err instead.

    let location = parse_location_string(&data.location);
    if location.iter().any(|s| s.is_empty()) {
        return Err(format!("Missing location information, found `{}`", data.location));
    }

    let edit_start = usize::from_str(&location[1]).unwrap();
    let edit_end = usize::from_str(&location[2]).unwrap();

    // TODO we should check that the file has not been modified since we read it,
    // otherwise the file line locations will be incorrect.

    // Scope is so we close file after reading.
    let lines = {
        let file = match File::open(&location[0]) {
            Ok(f) => f,
            Err(e) => return Err(e.to_string()),
        };

        read_lines(&file)?
    };

    assert!(edit_start < edit_end && edit_end <= lines.len());

    let file = File::create(&location[0]).unwrap();
    let mut writer = BufWriter::new(file);

    for i in 0..(edit_start - 1) {
        writer.write(lines[i].as_bytes()).unwrap();
    }
    writer.write(data.text.as_bytes()).unwrap();
    for i in edit_end..lines.len() {
        writer.write(lines[i].as_bytes()).unwrap();
    }

    writer.flush().unwrap();
    Ok(())
}

// TODO shouldn't be const
const CODE_DIR: &'static str = "src";

const BUILD_REQUEST: &'static str = "build";
const TEST_REQUEST: &'static str = "test";
const EDIT_REQUEST: &'static str = "edit";
const QUICK_EDIT_REQUEST: &'static str = "quick_edit";

fn route<'a, 'b: 'a, 'k: 'a>(uri_path: &str,
                             handler: &'a mut Handler<'a>,
                             req: Request<'b, 'k>,
                             res: Response<'b, Fresh>) {
    let (path, query, _) = parse_path(uri_path).unwrap();

    //println!("path: {:?}, query: {:?}", path, query);
    if path.is_empty() || (path.len() == 1 && (path[0] == "index.html" || path[0] == "")) {
        handler.handle_index(req, res);
        return;
    }

    if path[0] == STATIC_DIR {
        handler.handle_static(req, res, &path[1..]);
        return;
    }

    if path[0] == CODE_DIR {
        handler.handle_src(req, res, &path[1..]);
        return;
    }

    if path[0] == TEST_REQUEST {
        handler.handle_test(req, res);
        return;
    }

    if handler.config.demo_mode == false {
        if path[0] == BUILD_REQUEST {
            handler.handle_build(req, res);
            return;
        }

        if path[0] == EDIT_REQUEST {
            handler.handle_edit(req, res, query);
            return;
        }

        if path[0] == QUICK_EDIT_REQUEST {
            handler.handle_quick_edit(req, res);
            return;
        }
    }

    handler.handle_error(req, res, StatusCode::NotFound, format!("Unexpected path: `/{}`", path.join("/")));
}
