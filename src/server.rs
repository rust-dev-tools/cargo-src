// Copyright 2016-2018 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use analysis;
use build::{self, BuildArgs};
use build::errors::{self, Diagnostic};
use config::Config;
use file_cache::Cache;
use listings::DirectoryListing;
use reprocess;
use futures;

use std::collections::HashMap;
use std::fmt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::str::FromStr;
use std::sync::{Arc, Mutex, atomic::{AtomicU32, Ordering}};
use std::thread::{self, sleep};
use std::time;

use hyper::header::ContentType;
use hyper::server::Request;
use hyper::server::Response;
use hyper::StatusCode;
use hyper::server::Service;
use hyper::error::Error;
use hyper::Body;
use hyper::Chunk;
use futures::sync::mpsc::Sender;
use serde_json;
use span;
use url::parse_path;

/// This module handles the server responsibilities - it routes incoming requests
/// and dispatches them. It also handles pushing events to the client during
/// builds and making pull-able data available to the client post-build.


/// An instance of the server. Runs a session of rustw.
pub struct Server {
    builder: build::Builder,
    pub config: Arc<Config>,
    file_cache: Arc<Cache>,
    // Data which is produced by a post-build pass (see reprocess.rs).
    pending_pull_data: Arc<Mutex<HashMap<String, Option<String>>>>,
    status: Status
}

#[derive(Clone)]
pub struct Instance {
    server: Arc<Mutex<Server>>,
}

impl Server {
    pub(super) fn new(config: Config, build_args: BuildArgs) -> Server {
        let config = Arc::new(config);

        let mut instance = Server {
            builder: build::Builder::new(config.clone(), build_args),
            config: config,
            file_cache: Arc::new(Cache::new()),
            // FIXME(#58) a rebuild should cancel all pending tasks.
            pending_pull_data: Arc::new(Mutex::new(HashMap::new())),
            status: Status::new(),
        };

        instance.run_analysis();

        instance
    }

    fn run_analysis(&mut self) {
        let file_cache = self.file_cache.clone();
        let status = self.status.clone();
        let builder = self.builder.clone();

        thread::spawn(move || {
            println!("Building...");
            status.start_build();
            builder.build(None).unwrap();
            status.finish_build();

            status.start_analysis();
            file_cache.update_analysis();
            status.finish_analysis();
        });
    }
}

impl Instance {
    pub fn new(server: Server) -> Instance {
        Instance {
            server: Arc::new(Mutex::new(server)),
        }
    }
}

impl Service for Instance {
    type Request = Request;
    type Response = Response;
    type Error = Error;
    type Future = Box<futures::future::Future<Item=Self::Response, Error=Self::Error>>;

    fn call(&self, req: Request) -> Self::Future {
        let uri = req.uri().clone();
        return Box::new(futures::future::ok(self.server.lock().unwrap().route(uri.path(), req)));
    }
}

struct Status_ {
    build: AtomicU32,
    analysis: AtomicU32,
}

#[derive(Clone)]
pub struct Status {
    internal: Arc<Status_>,
}

impl Status {
    fn new() -> Status {
        Status {
            internal: Arc::new(Status_ {
                build: AtomicU32::new(0),
                analysis: AtomicU32::new(0),
            })
        }
    }

    fn start_build(&self) {
        self.internal.build.fetch_add(1, Ordering::SeqCst);
    }
    fn start_analysis(&self) {
        self.internal.analysis.fetch_add(1, Ordering::SeqCst);
    }
    fn finish_build(&self) {
        self.internal.build.fetch_sub(1, Ordering::SeqCst);
    }
    fn finish_analysis(&self) {
        self.internal.analysis.fetch_sub(1, Ordering::SeqCst);
    }
}

impl fmt::Display for Status {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        if self.internal.build.load(Ordering::SeqCst) > 0 {
            write!(f, "Building")
        } else if self.internal.analysis.load(Ordering::SeqCst) > 0 {
            write!(f, "Analysis")
        } else {
            write!(f, "Done")
        }
    }
}

// Diagnostics are streamed to the client. This struct is an interface for
// the build module to relay messages as an event stream.
pub struct DiagnosticEventHandler {
    lowering_ctxt: errors::LoweringContext,
    tx: Sender<Result<Chunk, Error>>,
    diagnostics: Vec<Diagnostic>,
}

impl DiagnosticEventHandler {
    fn new(tx: Sender<Result<Chunk, Error>>) -> DiagnosticEventHandler {
        DiagnosticEventHandler {
            lowering_ctxt: errors::LoweringContext::new(),
            tx: tx,
            diagnostics: vec![],
        }
    }

    pub fn handle_msg(&mut self, msg: &str) {
        let parsed = errors::parse_error(&msg, &mut self.lowering_ctxt);
        match parsed {
            errors::ParsedError::Diagnostic(d) => {
                let text = serde_json::to_string(&d).unwrap();
                self.tx
                    .try_send(Ok(Chunk::from(format!("event: error\ndata: {}\n\n", text))))
                    .unwrap();
                self.diagnostics.push(d);
            }
            errors::ParsedError::Message(s) => {
                let text = serde_json::to_string(&s).unwrap();
                self.tx
                    .try_send(Ok(Chunk::from(format!(
                        "event: message\ndata: {}\n\n",
                        text
                    ))))
                    .unwrap();
            }
            errors::ParsedError::Error => {}
        }
    }

    fn complete(mut self, result: &BuildResult) -> Vec<Diagnostic> {
        let text = serde_json::to_string(&result).unwrap();

        self.tx
            .try_send(Ok(Chunk::from(format!("event: close\ndata: {}\n\n", text))))
            .unwrap();

        self.diagnostics
    }
}

impl Server {
    fn route(
        &self,
        uri_path: &str,
        req: Request,
    ) -> Response {
        let (path, query, _) = parse_path(uri_path).unwrap();

        trace!("route: path: {:?}, query: {:?}", path, query);
        if path.is_empty() || (path.len() == 1 && (path[0] == "index.html" || path[0] == "")) {
            return self.handle_index(req);
        }

        if path[0] == GET_STATUS {
            return self.handle_status(req);
        }

        if path[0] == STATIC_REQUEST {
            return self.handle_static(req, &path[1..]);
        }

        if path[0] == CONFIG_REQUEST {
            return self.handle_config(req);
        }

        if path[0] == PULL_REQUEST {
            return self.handle_pull(req, query);
        }

        if path[0] == SOURCE_REQUEST {
            let path = &path[1..];
            // Because a URL ending in "/." is normalised to "/", we miss out on "." as a source path.
            // We try to correct for that here.
            if path.len() == 1 && path[0] == "" {
                return self.handle_src(req, &[".".to_owned()]);
            } else {
                return self.handle_src(req, path);
            }
        }

        if path[0] == PLAIN_TEXT {
            return self.handle_plain_text(req, query);
        }

        if path[0] == SEARCH_REQUEST {
            return self.handle_search(req, query);
        }

        if path[0] == FIND_REQUEST {
            return self.handle_find(req, query);
        }

        if !self.config.demo_mode {
            if path[0] == BUILD_REQUEST {
                return self.handle_build(req);
            }

            if path[0] == EDIT_REQUEST {
                return self.handle_edit(req, query);
            }
        }

        self.handle_error(
            req,
            StatusCode::NotFound,
            format!("Unexpected path: `/{}`", path.join("/")),
        )
    }

    fn handle_error(
        &self,
        _req: Request,
        status: StatusCode,
        msg: String,
    ) -> Response {
        debug!("ERROR: {} ({})", msg, status);

        Response::new().with_status(status).with_body(msg)
    }

    fn handle_status(
        &self,
        _req: Request,
    )  -> Response {
        let mut res = Response::new();
        res.headers_mut().set(ContentType::plaintext());
        res.with_body(format!("{{\"status\":\"{}\"}}", self.status))
    }

    fn handle_index(
        &self,
        _req: Request,
    ) -> Response {
        let mut path_buf = static_path();
        path_buf.push("index.html");

        let msg = match self.file_cache.get_text(&path_buf) {
            Ok(data) => {
                let mut res = Response::new();
                res.headers_mut().set(ContentType::html());
                return res.with_body(data);
            }
            Err(s) => s,
        };

        self.handle_error(_req, StatusCode::InternalServerError, msg)
    }

    fn handle_static(
        &self,
        req: Request,
        path: &[String],
    ) -> Response {
        let mut path_buf = static_path();
        for p in path {
            path_buf.push(p);
        }
        trace!("handle_static: requesting `{}`", path_buf.to_str().unwrap());

        let content_type = match path_buf.extension() {
            Some(s) if s.to_str().unwrap() == "html" => ContentType::html(),
            Some(s) if s.to_str().unwrap() == "css" => ContentType("text/css".parse().unwrap()),
            Some(s) if s.to_str().unwrap() == "json" => ContentType::json(),
            _ => ContentType("application/octet-stream".parse().unwrap()),
        };

        let file_contents = self.file_cache.get_bytes(&path_buf);
        if let Ok(bytes) = file_contents {
            trace!(
                "handle_static: serving `{}`. {} bytes, {}",
                path_buf.to_str().unwrap(),
                bytes.len(),
                content_type
            );
            let mut res = Response::new();
            res.headers_mut().set(content_type);
            return res.with_body(bytes);
        }

        trace!("404 {:?}", file_contents);
        self.handle_error(req, StatusCode::NotFound, "Page not found".to_owned())
    }

    fn handle_src(
        &self,
        _req: Request,
        mut path: &[String],
    ) -> Response {
        for p in path {
            // In demo mode this might reveal the contents of the server outside
            // the source directory (really, rustw should run in a sandbox, but
            // hey, FIXME).
            if p.contains("..") || p == "/" {
                return self.handle_error(
                    _req,
                    StatusCode::InternalServerError,
                    "Bad path, found `..`".to_owned(),
                );
            }
        }

        let mut path_buf = PathBuf::new();
        if path[0].is_empty() {
            path_buf.push("/");
            path = &path[1..];
        }
        for p in path {
            path_buf.push(p);
        }

        // TODO should cache directory listings too
        if path_buf.is_dir() {
            match DirectoryListing::from_path(&path_buf) {
                Ok(listing) => {
                    let mut res = Response::new();
                    res.headers_mut().set(ContentType::json());
                    return res.with_body(
                        serde_json::to_string(&SourceResult::Directory(listing))
                            .unwrap()
                    );
                }
                Err(msg) => self.handle_error(_req, StatusCode::InternalServerError, msg),
            }
        } else {
            match self.file_cache.get_highlighted(&path_buf) {
                Ok(ref lines) => {
                    let mut res = Response::new();
                    res.headers_mut().set(ContentType::json());
                    let path = path_buf
                        .components()
                        .map(|c| c.as_os_str().to_str().unwrap().to_owned())
                        .collect();
                    let result = SourceResult::Source {
                        path,
                        lines: lines,
                    };
                    return res.with_body(serde_json::to_string(&result).unwrap());
                }
                Err(msg) => self.handle_error(_req, StatusCode::InternalServerError, msg),
            }
        }
    }

    fn handle_config(
        &self,
        _req: Request,
    ) -> Response {
        let text = serde_json::to_string(&*self.config).unwrap();
        let mut res = Response::new();
        res.headers_mut().set(ContentType::json());
        return res.with_body(text);
    }

    fn handle_build(
        &self,
        _req: Request,
    ) -> Response {
        assert!(
            !self.config.demo_mode,
            "Build shouldn't happen in demo mode"
        );

        {
            self.file_cache.reset();
        }

        let mut res = Response::new();
        res.headers_mut()
            .set(ContentType("text/event-stream".parse().unwrap()));

        let (tx, body) = Body::pair();
        res.set_body(body);
        self.spawn_build(tx);

        res
    }

    fn spawn_build(
        &self,
        res: Sender<Result<Chunk, Error>>) {
        let pending_pull_data = self.pending_pull_data.clone();
        let file_cache = self.file_cache.clone();
        let config = self.config.clone();
        let status = self.status.clone();
        let builder = self.builder.clone();

        thread::spawn(move || {
            status.start_build();
            let mut diagnostic_event_handler = DiagnosticEventHandler::new(res);
            let build_result = builder.build(Some(&mut diagnostic_event_handler)).unwrap();
            status.finish_build();
            let key = reprocess::make_key();
            let result = BuildResult::from_build(&build_result, key.clone());
            pending_pull_data.lock().unwrap().insert(key, None);
            let diagnostics = diagnostic_event_handler.complete(&result);
            reprocess::reprocess_snippets(
                result.pull_data_key,
                diagnostics,
                pending_pull_data,
                file_cache,
                config,
            )
        });
    }

    fn handle_edit(
        &self,
        _req: Request,
        query: Option<String>,
    ) -> Response {
        assert!(!self.config.demo_mode, "Edit shouldn't happen in demo mode");
        assert!(self.config.unstable_features, "Edit is unstable");

        match parse_query_value(&query, "file=") {
            Some(location) => {
                // Split the 'filename' on colons for line and column numbers.
                let args = parse_location_string(&location);

                let cmd_line = &self.config.edit_command;
                if !cmd_line.is_empty() {
                    let cmd_line = cmd_line
                        .replace("$file", &args[0])
                        .replace("$line", &args[1])
                        .replace("$col", &args[2]);

                    let mut splits = cmd_line.split(' ');

                    let mut cmd = Command::new(splits.next().unwrap());
                    for arg in splits {
                        cmd.arg(arg);
                    }

                    match cmd.spawn() {
                        Ok(_) => debug!("edit, launched successfully"),
                        Err(e) => debug!("edit, launch failed: `{:?}`, command: `{}`", e, cmd_line),
                    }
                }

                let mut res = Response::new();
                res.headers_mut().set(ContentType::json());
                return res.with_body("{}".as_bytes());
            }
            None => {
                return self.handle_error(
                    _req,
                    StatusCode::InternalServerError,
                    format!("Bad query string: {:?}", query),
                );
            }
        }
    }

    fn handle_search(
        &self,
        _req: Request,
        query: Option<String>,
    ) -> Response {
        match (
            parse_query_value(&query, "needle="),
            parse_query_value(&query, "id="),
        ) {
            (Some(needle), None) => {
                // Identifier search.
                match self.file_cache.ident_search(&needle) {
                    Ok(data) => {
                        let mut res = Response::new();
                        res.headers_mut().set(ContentType::json());
                        return res.with_body(serde_json::to_string(&data).unwrap());
                    }
                    Err(s) => {
                        return self.handle_error(_req, StatusCode::InternalServerError, s);
                    }
                }
            }
            (None, Some(id)) => {
                // Search by id.
                let id = match u64::from_str(&id) {
                    Ok(l) => l,
                    Err(_) => {
                        return self.handle_error(
                            _req,
                            StatusCode::InternalServerError,
                            format!("Bad id: {}", id),
                        );
                    }
                };
                match self.file_cache.id_search(analysis::Id::new(id)) {
                    Ok(data) => {
                        let mut res = Response::new();
                        res.headers_mut().set(ContentType::json());
                        return res.with_body(serde_json::to_string(&data).unwrap());
                    }
                    Err(s) => {
                        return self.handle_error(_req, StatusCode::InternalServerError, s);
                    }
                }
            }
            _ => {
                return self.handle_error(
                    _req,
                    StatusCode::InternalServerError,
                    "Bad search string".to_owned(),
                );
            }
        }
    }

    fn handle_find(
        &self,
        _req: Request,
        query: Option<String>,
    ) -> Response {
        match parse_query_value(&query, "impls=") {
            Some(id) => {
                let id = match u64::from_str(&id) {
                    Ok(l) => l,
                    Err(_) => {
                        return self.handle_error(
                            _req,
                            StatusCode::InternalServerError,
                            format!("Bad id: {}", id),
                        );
                    }
                };
                match self.file_cache.find_impls(analysis::Id::new(id)) {
                    Ok(data) => {
                        let mut res = Response::new();
                        res.headers_mut().set(ContentType::json());
                        return res.with_body(serde_json::to_string(&data).unwrap());
                    }
                    Err(s) => {
                        return self.handle_error(_req, StatusCode::InternalServerError, s);
                    }
                }
            }
            _ => {
                return self.handle_error(
                    _req,
                    StatusCode::InternalServerError,
                    "Unknown argument to find".to_owned(),
                );
            }
        }
    }

    fn handle_plain_text(
        &self,
        _req: Request,
        query: Option<String>,
    ) -> Response {
        match (
            parse_query_value(&query, "file="),
            parse_query_value(&query, "line="),
        ) {
            (Some(file_name), Some(line)) => {
                let line = match usize::from_str(&line) {
                    Ok(l) => l,
                    Err(_) => {
                        return self.handle_error(
                            _req,
                            StatusCode::InternalServerError,
                            format!("Bad line number: {}", line),
                        )
                    }
                };

                // Hard-coded 2 lines of context before and after target line.
                let line_start = line.saturating_sub(3);
                let line_end = line + 2;

                match self.file_cache.get_lines(
                    &Path::new(&file_name),
                    span::Row::new_zero_indexed(line_start as u32),
                    span::Row::new_zero_indexed(line_end as u32),
                ) {
                    Ok(ref lines) => {
                        let mut res = Response::new();
                        res.headers_mut().set(ContentType::json());
                        let result = TextResult {
                            text: lines,
                            file_name: file_name,
                            line_start: line_start + 1,
                            line_end: line_end,
                        };
                        return res.with_body(serde_json::to_string(&result).unwrap());
                    }
                    Err(msg) => {
                        return self.handle_error(_req, StatusCode::InternalServerError, msg);
                    }
                }
            }
            _ => {
                return self.handle_error(
                    _req,
                    StatusCode::InternalServerError,
                    "Bad query string".to_owned(),
                );
            }
        }
    }

    fn handle_pull(
        &self,
        _req: Request,
        query: Option<String>,
    ) -> Response {
        match parse_query_value(&query, "key=") {
            Some(key) => {
                let mut res = Response::new();
                res.headers_mut().set(ContentType::json());

                loop {
                    let pending_pull_data = self.pending_pull_data.lock().unwrap();
                    match pending_pull_data.get(&key) {
                        Some(&Some(ref s)) => {
                            // Data is ready, return it.
                            return res.with_body(s.clone());
                        }
                        Some(&None) => {
                            // Task is in progress, wait.
                        }
                        None => {
                            // No push task, return nothing.
                            return res.with_body("{}");
                        }
                    }
                    sleep(time::Duration::from_millis(200));
                }
            }
            None => {
                self.handle_error(
                    _req,
                    StatusCode::InternalServerError,
                    "Bad query string".to_owned(),
                )
            }
        }
    }
}

// The below data types are used to pass data to the client.

#[derive(Serialize, Debug)]
pub enum SourceResult<'a> {
    Source {
        path: Vec<String>,
        lines: &'a [String],
    },
    Directory(DirectoryListing),
}

#[derive(Serialize, Debug)]
pub struct TextResult<'a> {
    text: &'a str,
    file_name: String,
    line_start: usize,
    line_end: usize,
}

#[derive(Serialize, Debug)]
pub struct BuildResult {
    pub messages: Vec<String>,
    pub errors: Vec<Diagnostic>,
    pub pull_data_key: String,
}

impl BuildResult {
    fn from_build(build: &build::BuildResult, key: String) -> BuildResult {
        let (errors, messages) = errors::parse_errors(&build.stderr);
        BuildResult {
            messages: messages,
            errors: errors,
            pull_data_key: key,
        }
    }
}

fn static_path() -> PathBuf {
    const STATIC_DIR: &'static str = "static";

    let mut result = ::std::env::current_exe().unwrap();
    assert!(result.pop());
    result.push(STATIC_DIR);
    result
}

pub fn parse_location_string(input: &str) -> [String; 5] {
    let mut args = input.split(':').map(|s| s.to_owned());
    [
        args.next().unwrap(),
        args.next().unwrap_or(String::new()),
        args.next().unwrap_or(String::new()),
        args.next().unwrap_or(String::new()),
        args.next().unwrap_or(String::new()),
    ]
}

// key should include `=` suffix.
fn parse_query_value(query: &Option<String>, key: &str) -> Option<String> {
    match *query {
        Some(ref q) => {
            let start = match q.find(key) {
                Some(i) => i + key.len(),
                None => {
                    return None;
                }
            };
            let end = q[start..].find("&").map(|e| e + start).unwrap_or(q.len());
            let value = &q[start..end];
            Some(value.to_owned())
        }
        None => None,
    }
}

const STATIC_REQUEST: &'static str = "static";
const SOURCE_REQUEST: &'static str = "src";
const PLAIN_TEXT: &'static str = "plain_text";
const CONFIG_REQUEST: &'static str = "config";
const BUILD_REQUEST: &'static str = "build";
const EDIT_REQUEST: &'static str = "edit";
const PULL_REQUEST: &'static str = "pull";
const SEARCH_REQUEST: &'static str = "search";
const FIND_REQUEST: &'static str = "find";
const GET_STATUS: &'static str = "status";
