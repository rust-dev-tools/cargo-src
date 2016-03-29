// The router module parses URLs, decides on an action, and reads any data from
// disk to support that action.

use std::fs::File;
use std::path::{Path, PathBuf};
use std::io::Read;

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

#[derive(Debug)]
pub enum Action {
    Static(Vec<u8>, ContentType),
    Error(StatusCode, String),
    Build,
    CodeLines(String),
}

pub struct Router;

impl Router {
    pub fn new() -> Router {
        Router
    }

    pub fn route(&self, uri_path: &str) -> Action {
        let (path, _query, _) = parse_path(uri_path).unwrap();

        //println!("path: {:?}, query: {:?}", path, query);
        if path.is_empty() || (path.len() == 1 && (path[0] == "index.html" || path[0] == "")) {
            return self.action_index();
        }

        if path[0] == STATIC_DIR {
            return self.action_static(&path[1..]);
        }

        if path[0] == CODE_DIR {
            // TODO line number from query
            return self.action_src(&path[1..]);
        }

        if path[0] == TEST_REQUEST {
            // TODO also check HTTP method
            return self.action_static(&["test_data.json".to_owned()]);
        }

        if ::DEMO_MODE == false {
            if path[0] == BUILD_REQUEST {
                // TODO also check HTTP method
                return self.action_build();
            }
        }

        Action::Error(StatusCode::NotFound, format!("Unexpected path: `/{}`", path.join("/")))
    }

    fn action_index(&self) -> Action {
        let mut path_buf = PathBuf::from(STATIC_DIR);
        path_buf.push("index.html");

        match self.read_file(&path_buf) {
            Ok(mut s) => {
                if ::DEMO_MODE {
                    // TODO not good enough since we reset this elsewhere.
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

    fn action_build(&self) -> Action {
        Action::Build
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

    // TODO should be factored out into a module and add caching
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

#[cfg(test)]
mod test {

}
