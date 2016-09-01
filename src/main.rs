// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

#![feature(question_mark)]
#![feature(const_fn)]
#![feature(custom_derive, plugin)]
#![feature(type_ascription)]
#![feature(rustdoc)]
// For libsyntax, which is just a hack to get around rustdoc.
#![feature(rustc_private)]
#![plugin(serde_macros)]

extern crate hyper;
extern crate url;
extern crate getopts;
extern crate rustc_serialize;
extern crate rustdoc;
extern crate serde;
extern crate serde_json;
extern crate syntax;
extern crate toml;

mod analysis;
mod build;
mod config;
mod reprocess;
mod file_cache;
mod listings;
mod highlight;
mod server;

use config::Config;

use getopts::Options;
use hyper::Server;

use std::env;
use std::fs::File;
use std::io::Read;

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut opts = Options::new();
    opts.optflag("h", "help", "print this help menu");
    opts.optopt("g", "goto", "goto def <span>", "");
    opts.optopt("f", "find", "find ident <name>", "");
    opts.optopt("t", "type", "show type <span>", "");

    // Look at matches to actually see command line options.
    let matches = match opts.parse(&args[1..]) {
        Ok(m) => m,
        Err(f) => {
            panic!(f.to_owned());
        }
    };

    if matches.opt_present("h") {
        let brief = "Usage: rustw [options]".to_owned();
        println!("{}", opts.usage(&brief));

        Config::print_docs();

        return;
    } else if let Some(ref s) = matches.opt_str("g") {
        let span: analysis::Span = match serde_json::from_str(s) {
            Ok(s) => s,
            Err(e) => {
                println!("Error reading span: {}, `{}`", e, s);
                return;
            }
        };

        let host = analysis::AnalysisHost::new();
        host.reload().unwrap();
        if let Ok(s) = host.goto_def(&span) {
            println!("Goto: {:?}", s);
        } else {
            println!("Error looking up span {:?}", span);
        }
        return;
    } else if let Some(ref s) = matches.opt_str("t") {
        let span: analysis::Span = match serde_json::from_str(s) {
            Ok(s) => s,
            Err(e) => {
                println!("Error reading span: {}, `{}`", e, s);
                return;
            }
        };

        let host = analysis::AnalysisHost::new();
        host.reload().unwrap();
        if let Ok(t) = host.show_type(&span) {
            println!("Type: {:?}", t);
        } else {
            println!("Error looking up span {:?}", span);
        }
        return;
    } else if let Some(ref s) = matches.opt_str("f") {
        let host = analysis::AnalysisHost::new();
        host.reload().unwrap();
        if let Ok(results) = host.search(s) {
            println!("Find {}: {:?}", s, results);
        } else {
            println!("Error finding ident {}", s);
        }
        return;
    }

    let config_file = File::open("rustw.toml");
    let mut toml = String::new();
    if let Ok(mut f) = config_file {
        f.read_to_string(&mut toml).unwrap();
    }
    let config = Config::from_toml(&toml);
    let port = config.port;

    let server = server::Instance::new(config);

    println!("server running on http://127.0.0.1:{}", port);
    Server::http(&*format!("127.0.0.1:{}", port)).unwrap().handle(server).unwrap();
}
