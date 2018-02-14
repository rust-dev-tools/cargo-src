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

use std::collections::HashMap;
use std::fmt;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::str::FromStr;
use std::sync::{Arc, Mutex, atomic::{AtomicU32, Ordering}};
use std::thread::{self, sleep};
use std::time;

use hyper::header::ContentType;
use hyper::net::{Fresh, Streaming};
use hyper::server::request::Request;
use hyper::server::response::Response;
use hyper::status::StatusCode;
use hyper::uri::RequestUri;
use serde_json;
use span;
use url::parse_path;

/// This module handles the server responsibilities - it routes incoming requests
/// and dispatches them. It also handles pushing events to the client during
/// builds and making pull-able data available to the client post-build.


/// An instance of the server. Runs a session of rustw.
pub struct Instance {
    builder: build::Builder,
    pub config: Arc<Config>,
    file_cache: Arc<Cache>,
    // Data which is produced by a post-build pass (see reprocess.rs).
    pending_pull_data: Arc<Mutex<HashMap<String, Option<String>>>>,
    status: Status
}

impl Instance {
    pub(super) fn new(config: Config, build_args: BuildArgs) -> Instance {
        let config = Arc::new(config);

        let mut instance = Instance {
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

impl ::hyper::server::Handler for Instance {
    fn handle<'a, 'k>(&'a self, req: Request<'a, 'k>, res: Response<'a, Fresh>) {
        let uri = req.uri.clone();
        if let RequestUri::AbsolutePath(ref s) = uri {
            self.route(s, req, res);
        } else {
            // TODO log this and ignore it.
            panic!("Unexpected uri");
        }
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
pub struct DiagnosticEventHandler<'b> {
    lowering_ctxt: errors::LoweringContext,
    res: Response<'b, Streaming>,
    diagnostics: Vec<Diagnostic>,
}

impl<'b> DiagnosticEventHandler<'b> {
    fn new(res: Response<'b, Streaming>) -> DiagnosticEventHandler<'b> {
        DiagnosticEventHandler {
            lowering_ctxt: errors::LoweringContext::new(),
            res,
            diagnostics: vec![],
        }
    }

    pub fn handle_msg(&mut self, msg: &str) {
        let parsed = errors::parse_error(&msg, &mut self.lowering_ctxt);
        match parsed {
            errors::ParsedError::Diagnostic(d) => {
                let text = serde_json::to_string(&d).unwrap();
                self.res.write_all(format!("event: error\ndata: {}\n\n", text).as_bytes())
                    .unwrap();
                self.res.flush().unwrap();
                self.diagnostics.push(d);
            }
            errors::ParsedError::Message(s) => {
                let text = serde_json::to_string(&s).unwrap();
                self.res.write_all(format!("event: message\ndata: {}\n\n", text).as_bytes())
                    .unwrap();
                self.res.flush().unwrap();
            }
            errors::ParsedError::Error => {}
        }
    }

    fn complete(mut self, result: &BuildResult) -> Vec<Diagnostic> {
        let text = serde_json::to_string(&result).unwrap();
        let event_str = format!("event: close\ndata: {}\n\n", text);

        self.res.write_all(event_str.as_bytes()).unwrap();
        self.res.end().unwrap();

        self.diagnostics
    }
}

impl Instance {
    fn route<'b, 'k>(
        &self,
        uri_path: &str,
        req: Request<'b, 'k>,
        res: Response<'b, Fresh>,
    ) {
        let (path, query, _) = parse_path(uri_path).unwrap();

        trace!("route: path: {:?}, query: {:?}", path, query);
        if path.is_empty() || (path.len() == 1 && (path[0] == "index.html" || path[0] == "")) {
            self.handle_index(req, res);
            return;
        }

        if path[0] == GET_STATUS {
            self.handle_status(req, res);
            return;
        }

        if path[0] == STATIC_REQUEST {
            self.handle_static(req, res, &path[1..]);
            return;
        }

        if path[0] == CONFIG_REQUEST {
            self.handle_config(req, res);
            return;
        }

        if path[0] == PULL_REQUEST {
            self.handle_pull(req, res, query);
            return;
        }

        if path[0] == SOURCE_REQUEST {
            let path = &path[1..];
            // Because a URL ending in "/." is normalised to "/", we miss out on "." as a source path.
            // We try to correct for that here.
            if path.len() == 1 && path[0] == "" {
                self.handle_src(req, res, &[".".to_owned()]);
            } else {
                self.handle_src(req, res, path);
            }
            return;
        }

        if path[0] == PLAIN_TEXT {
            self.handle_plain_text(req, res, query);
            return;
        }

        if path[0] == SEARCH_REQUEST {
            self.handle_search(req, res, query);
            return;
        }

        if path[0] == FIND_REQUEST {
            self.handle_find(req, res, query);
            return;
        }

        if !self.config.demo_mode {
            if path[0] == BUILD_REQUEST {
                self.handle_build(req, res);
                return;
            }

            if path[0] == EDIT_REQUEST {
                self.handle_edit(req, res, query);
                return;
            }
        }

        self.handle_error(
            req,
            res,
            StatusCode::NotFound,
            format!("Unexpected path: `/{}`", path.join("/")),
        );
    }

    fn handle_error<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
        status: StatusCode,
        msg: String,
    ) {
        debug!("ERROR: {} ({})", msg, status);

        *res.status_mut() = status;
        res.send(msg.as_bytes()).unwrap();
    }

    fn handle_status<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
    ) {
        res.headers_mut().set(ContentType::plaintext());
        res.send(format!("{{\"status\":\"{}\"}}", self.status).as_bytes()).unwrap();
    }

    fn handle_index<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
    ) {
        let mut path_buf = static_path();
        path_buf.push("index.html");

        let msg = match self.file_cache.get_text(&path_buf) {
            Ok(data) => {
                res.headers_mut().set(ContentType::html());
                res.send(data.as_bytes()).unwrap();
                return;
            }
            Err(s) => s,
        };

        self.handle_error(_req, res, StatusCode::InternalServerError, msg);
    }

    fn handle_static<'b, 'k>(
        &self,
        req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
        path: &[String],
    ) {
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
            res.headers_mut().set(content_type);
            res.send(&bytes).unwrap();
            return;
        }

        trace!("404 {:?}", file_contents);
        self.handle_error(req, res, StatusCode::NotFound, "Page not found".to_owned());
    }

    fn handle_src<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
        mut path: &[String],
    ) {
        for p in path {
            // In demo mode this might reveal the contents of the server outside
            // the source directory (really, rustw should run in a sandbox, but
            // hey, FIXME).
            if p.contains("..") || p == "/" {
                self.handle_error(
                    _req,
                    res,
                    StatusCode::InternalServerError,
                    "Bad path, found `..`".to_owned(),
                );
                return;
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
                    res.headers_mut().set(ContentType::json());
                    res.send(
                        serde_json::to_string(&SourceResult::Directory(listing))
                            .unwrap()
                            .as_bytes(),
                    ).unwrap();
                }
                Err(msg) => self.handle_error(_req, res, StatusCode::InternalServerError, msg),
            }
        } else {
            match self.file_cache.get_highlighted(&path_buf) {
                Ok(ref lines) => {
                    res.headers_mut().set(ContentType::json());
                    let result = SourceResult::Source {
                        path: path_buf
                            .components()
                            .map(|c| c.as_os_str().to_str().unwrap().to_owned())
                            .collect(),
                        lines: lines,
                    };
                    res.send(serde_json::to_string(&result).unwrap().as_bytes())
                        .unwrap();
                }
                Err(msg) => self.handle_error(_req, res, StatusCode::InternalServerError, msg),
            }
        }
    }

    fn handle_config<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
    ) {
        let text = serde_json::to_string(&*self.config).unwrap();

        res.headers_mut().set(ContentType::json());
        res.send(text.as_bytes()).unwrap();
    }

    fn handle_build<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
    ) {
        assert!(
            !self.config.demo_mode,
            "Build shouldn't happen in demo mode"
        );

        {
            self.file_cache.reset();
        }

        res.headers_mut()
            .set(ContentType("text/event-stream".parse().unwrap()));
        let mut diagnostic_event_handler = DiagnosticEventHandler::new(res.start().unwrap());

        self.status.start_build();
        let build_result = self.builder.build(Some(&mut diagnostic_event_handler)).unwrap();
        self.status.finish_build();
        let result = self.make_build_result(&build_result);
        let diagnostics = diagnostic_event_handler.complete(&result);

        self.reprocess_snippet_data(result, diagnostics);
    }

    fn make_build_result(&self, build_result: &build::BuildResult) -> BuildResult {
        let key = reprocess::make_key();
        let result = BuildResult::from_build(&build_result, key.clone());

        let mut pending_pull_data = self.pending_pull_data.lock().unwrap();
        pending_pull_data.insert(key, None);

        result
    }

    fn handle_edit<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
        query: Option<String>,
    ) {
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

                res.headers_mut().set(ContentType::json());
                res.send("{}".as_bytes()).unwrap();
            }
            None => {
                self.handle_error(
                    _req,
                    res,
                    StatusCode::InternalServerError,
                    format!("Bad query string: {:?}", query),
                );
            }
        }
    }

    fn handle_search<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
        query: Option<String>,
    ) {
        match (
            parse_query_value(&query, "needle="),
            parse_query_value(&query, "id="),
        ) {
            (Some(needle), None) => {
                // Identifier search.
                match self.file_cache.ident_search(&needle) {
                    Ok(data) => {
                        res.headers_mut().set(ContentType::json());
                        res.send(serde_json::to_string(&data).unwrap().as_bytes())
                            .unwrap();
                    }
                    Err(s) => {
                        self.handle_error(_req, res, StatusCode::InternalServerError, s);
                    }
                }
            }
            (None, Some(id)) => {
                // Search by id.
                let id = match u64::from_str(&id) {
                    Ok(l) => l,
                    Err(_) => {
                        self.handle_error(
                            _req,
                            res,
                            StatusCode::InternalServerError,
                            format!("Bad id: {}", id),
                        );
                        return;
                    }
                };
                match self.file_cache.id_search(analysis::Id::new(id)) {
                    Ok(data) => {
                        res.headers_mut().set(ContentType::json());
                        res.send(serde_json::to_string(&data).unwrap().as_bytes())
                            .unwrap();
                    }
                    Err(s) => {
                        self.handle_error(_req, res, StatusCode::InternalServerError, s);
                    }
                }
            }
            _ => {
                self.handle_error(
                    _req,
                    res,
                    StatusCode::InternalServerError,
                    "Bad search string".to_owned(),
                );
            }
        }
    }

    fn handle_find<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
        query: Option<String>,
    ) {
        match parse_query_value(&query, "impls=") {
            Some(id) => {
                let id = match u64::from_str(&id) {
                    Ok(l) => l,
                    Err(_) => {
                        self.handle_error(
                            _req,
                            res,
                            StatusCode::InternalServerError,
                            format!("Bad id: {}", id),
                        );
                        return;
                    }
                };
                match self.file_cache.find_impls(analysis::Id::new(id)) {
                    Ok(data) => {
                        res.headers_mut().set(ContentType::json());
                        res.send(serde_json::to_string(&data).unwrap().as_bytes())
                            .unwrap();
                    }
                    Err(s) => {
                        self.handle_error(_req, res, StatusCode::InternalServerError, s);
                    }
                }
            }
            _ => {
                self.handle_error(
                    _req,
                    res,
                    StatusCode::InternalServerError,
                    "Unknown argument to find".to_owned(),
                );
            }
        }
    }

    fn handle_plain_text<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
        query: Option<String>,
    ) {
        match (
            parse_query_value(&query, "file="),
            parse_query_value(&query, "line="),
        ) {
            (Some(file_name), Some(line)) => {
                let line = match usize::from_str(&line) {
                    Ok(l) => l,
                    Err(_) => {
                        self.handle_error(
                            _req,
                            res,
                            StatusCode::InternalServerError,
                            format!("Bad line number: {}", line),
                        );
                        return;
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
                        res.headers_mut().set(ContentType::json());
                        let result = TextResult {
                            text: lines,
                            file_name: file_name,
                            line_start: line_start + 1,
                            line_end: line_end,
                        };
                        res.send(serde_json::to_string(&result).unwrap().as_bytes())
                            .unwrap();
                    }
                    Err(msg) => {
                        self.handle_error(_req, res, StatusCode::InternalServerError, msg);
                    }
                }
            }
            _ => {
                self.handle_error(
                    _req,
                    res,
                    StatusCode::InternalServerError,
                    "Bad query string".to_owned(),
                );
            }
        }
    }

    fn handle_pull<'b, 'k>(
        &self,
        _req: Request<'b, 'k>,
        mut res: Response<'b, Fresh>,
        query: Option<String>,
    ) {
        match parse_query_value(&query, "key=") {
            Some(key) => {
                res.headers_mut().set(ContentType::json());

                loop {
                    {
                        let pending_pull_data = self.pending_pull_data.lock().unwrap();
                        match pending_pull_data.get(&key) {
                            Some(&Some(ref s)) => {
                                // Data is ready, return it.
                                res.send(s.as_bytes()).unwrap();
                                return;
                            }
                            Some(&None) => {
                                // Task is in progress, wait.
                            }
                            None => {
                                // No push task, return nothing.
                                res.send("{}".as_bytes()).unwrap();
                                return;
                            }
                        }
                    }
                    sleep(time::Duration::from_millis(200));
                }
            }
            None => {
                self.handle_error(
                    _req,
                    res,
                    StatusCode::InternalServerError,
                    "Bad query string".to_owned(),
                );
            }
        }
    }

    fn reprocess_snippet_data(&self, mut result: BuildResult, mut diagnostics: Vec<Diagnostic>) {
        diagnostics.extend(result.errors.drain(..));

        let pending_pull_data = self.pending_pull_data.clone();
        let file_cache = self.file_cache.clone();
        let config = self.config.clone();
        let status = self.status.clone();
        thread::spawn(move || {
            status.start_analysis();
            file_cache.update_analysis();
            status.finish_analysis();

            reprocess::reprocess_snippets(
                result.pull_data_key,
                diagnostics,
                pending_pull_data,
                file_cache,
                config,
            )
        });
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
