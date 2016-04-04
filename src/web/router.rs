// The router module parses URLs, decides on an action, and reads any data from
// disk to support that action.

use config::Config;

use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use url::parse_path;
use hyper::status::StatusCode;
use hyper::header::ContentType;


// TODO separate path from dir
// TODO need an 'absolute' path to static
const STATIC_DIR: &'static str = "static";
// TODO shouldn't be const
const CODE_DIR: &'static str = "src";

const BUILD_REQUEST: &'static str = "build";
const TEST_REQUEST: &'static str = "test";
const EDIT_REQUEST: &'static str = "edit";
const QUICK_EDIT_REQUEST: &'static str = "quick_edit";

#[derive(Debug)]
pub enum Action {
    Static(Vec<u8>, ContentType),
    Test,
    Error(StatusCode, String),
    Build,
    CodeLines(String),
    Edit([String; 3]),
    QuickEdit,
}

pub struct Router;

impl Router {
    pub fn new() -> Router {
        Router
    }

    pub fn route(&self, uri_path: &str, config: &Config) -> Action {
        let (path, query, _) = parse_path(uri_path).unwrap();

        //println!("path: {:?}, query: {:?}", path, query);
        if path.is_empty() || (path.len() == 1 && (path[0] == "index.html" || path[0] == "")) {
            return self.action_index(config);
        }

        if path[0] == STATIC_DIR {
            return self.action_static(&path[1..]);
        }

        if path[0] == CODE_DIR {
            return self.action_src(&path[1..]);
        }

        if path[0] == TEST_REQUEST {
            return self.action_test();
        }

        if config.demo_mode == false {
            if path[0] == BUILD_REQUEST {
                return self.action_build();
            }

            if path[0] == EDIT_REQUEST {
                return self.action_edit(query);
            }

            if path[0] == QUICK_EDIT_REQUEST {
                return self.action_quick_edit();
            }
        }

        Action::Error(StatusCode::NotFound, format!("Unexpected path: `/{}`", path.join("/")))
    }

    fn action_index(&self, config: &Config) -> Action {
        let mut path_buf = PathBuf::from(STATIC_DIR);
        path_buf.push("index.html");

        match self.read_file(&path_buf) {
            Ok(mut s) => {
                if config.demo_mode {
                    s.extend_from_slice("\n<script>DEMO_MODE=true;set_build_onclick();</script>\n".as_bytes());
                }

                Action::Static(s, ContentType::html())
            }
            Err(s) => Action::Error(StatusCode::InternalServerError, s),
        }
    }

    fn action_static(&self, path: &[String]) -> Action {
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

        match self.read_file(&path_buf) {
            Ok(s) => {
                //println!("serving `{}`. {} bytes, {}", path_buf.to_str().unwrap(), s.len(), content_type);
                Action::Static(s, content_type)
            }
            Err(_) => Action::Error(StatusCode::NotFound, "Page not found".to_owned()),
        }
    }

    fn action_test(&self) -> Action {
        Action::Test
    }

    fn action_build(&self) -> Action {
        Action::Build
    }

    fn action_quick_edit(&self) -> Action {
        Action::QuickEdit
    }
    fn action_src(&self, mut path: &[String]) -> Action {
        let mut path_buf = PathBuf::new();
        if path[0].is_empty() {
            path_buf.push("/");
            path = &path[1..];
        }
        for p in path {
            path_buf.push(p);
        }

        match self.read_file(&path_buf) {
            Ok(s) => Action::CodeLines(String::from_utf8(s).unwrap()),
            Err(_) => Action::Error(StatusCode::NotFound, "Page not found".to_owned()),
        }
    }

    fn action_edit(&self, query: Option<String>) -> Action {
        // TODO log commented out printlns
        let error_out = || {
            //println!("no query string");
            Action::Error(StatusCode::InternalServerError, format!("Bad query string: {:?}", query))
        };

        // TODO factor out query logic
        match query {
            Some(ref q) => {
                //println!("edit: `{}`", q);
                // Extract the `file` value from the query string.
                let start = match q.find("file=") {
                    Some(i) => i + 5,  // 5 = "file=".len()
                    None => return error_out(),
                };
                let end = q[start..].find("&").unwrap_or(q.len());

                // Get the filename out of the query string, then split it on
                // colons for line and column numbers.
                Action::Edit(::server::parse_location_string(&q[start..end]))
            }
            None => {
                error_out()
            }
        }
    }

    fn read_file(&self, path: &Path) -> Result<Vec<u8>, String> {
        match File::open(&path) {
            Ok(mut file) => {
                let mut buf = Vec::new();
                file.read_to_end(&mut buf).unwrap();
                Ok(buf)
            }
            Err(msg) => {
                println!("Error opening file: `{}`; {}", path.to_str().unwrap(), msg);
                Err(format!("Error opening file: `{}`; {}", path.to_str().unwrap(), msg))
            }
        }
    }
}
