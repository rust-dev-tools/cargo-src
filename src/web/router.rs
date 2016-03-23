// The router module parses URLs, decides on an action, and reads any data from
// disk to support that action.

use std::fs::File;
use std::path::{Path, PathBuf};
use std::io::Read;

use url::parse_path;
use hyper::status::StatusCode;


// TODO separate path from dir
// TODO need an 'absolute' path to static
const STATIC_DIR: &'static str = "static";
const TEMPLATE_DIR: &'static str = "templates";
// TODO shouldn't be const
const CODE_DIR: &'static str = "src";

const BUILD_REQUEST: &'static str = "build";

#[derive(Debug)]
pub enum Action {
    Static(String),
    // TODO remove
    //Template(String),
    Error(StatusCode, String),
    Build,
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

        if path[0] == BUILD_REQUEST {
            // TODO also check HTTP method
            return self.action_build();
        }

        Action::Error(StatusCode::NotFound, format!("Unexpected path: `/{}`", path.join("/")))
    }

    // TODO Not really sure this belongs in the router
    pub fn get_template_text(&self, path: &[String]) -> Result<String, String> {
        let mut path_buf = PathBuf::from(TEMPLATE_DIR);
        for p in path {
            path_buf.push(p);
        }
        self.read_file(&path_buf)
    }

    fn action_index(&self) -> Action {
        match self.get_template_text(&["index.html".to_owned()]) {
            Ok(s) => Action::Template(s),
            Err(s) => Action::Error(StatusCode::InternalServerError, s),
        }
    }

    fn action_static(&self, path: &[String]) -> Action {
        let mut path_buf = PathBuf::from(STATIC_DIR);
        for p in path {
            path_buf.push(p);
        }

        match self.read_file(&path_buf) {
            Ok(s) => Action::Static(s),
            Err(_) => Action::Error(StatusCode::NotFound, "Page not found".to_owned()),
        }
    }

    fn action_build(&self) -> Action {
        Action::Build
    }

    fn action_src(&self, path: &[String]) -> Action {
        let mut path_buf = PathBuf::from(CODE_DIR);
        for p in path {
            path_buf.push(p);
        }

        // TODO use a code template
        match self.read_file(&path_buf) {
            Ok(s) => Action::Static(s),
            Err(_) => Action::Error(StatusCode::NotFound, "Page not found".to_owned()),
        }
    }

    // TODO should be factored out into a module and add caching
    fn read_file(&self, path: &Path) -> Result<String, String> {
        match File::open(&path) {
            Ok(mut file) => {
                let mut buf = String::new();
                file.read_to_string(&mut buf).unwrap();
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
