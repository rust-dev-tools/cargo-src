// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

extern crate log;
extern crate env_logger;
extern crate rustw;
extern crate getopts;
extern crate serde_json;
extern crate rls_analysis as analysis;

use rustw::config::Config;

use getopts::Options;

use std::env;

fn main() {
    env_logger::init().unwrap();

    let args: Vec<String> = env::args().collect();
    let mut opts = Options::new();
    opts.optflag("h", "help", "print this help menu");
    opts.optopt("i", "ip", "set the ip address for the server", "");
    // opts.optopt("g", "goto", "goto def <span>", "");
    // opts.optopt("f", "find", "find ident <name>", "");
    // opts.optopt("t", "type", "show type <span>", "");

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
    // } else if let Some(ref s) = matches.opt_str("g") {
    //     let span: analysis::Span = match serde_json::from_str(s) {
    //         Ok(s) => s,
    //         Err(e) => {
    //             println!("Error reading span: {}, `{}`", e, s);
    //             return;
    //         }
    //     };

    //     let host = analysis::AnalysisHost::new(".", analysis::Target::Debug);
    //     host.reload().unwrap();
    //     if let Ok(s) = host.goto_def(&span) {
    //         println!("Goto: {:?}", s);
    //     } else {
    //         println!("Error looking up span {:?}", span);
    //     }
    //     return;
    // } else if let Some(ref s) = matches.opt_str("t") {
    //     let span: analysis::Span = match serde_json::from_str(s) {
    //         Ok(s) => s,
    //         Err(e) => {
    //             println!("Error reading span: {}, `{}`", e, s);
    //             return;
    //         }
    //     };

    //     let host = analysis::AnalysisHost::new(".", analysis::Target::Debug);
    //     host.reload().unwrap();
    //     if let Ok(t) = host.show_type(&span) {
    //         println!("Type: {:?}", t);
    //     } else {
    //         println!("Error looking up span {:?}", span);
    //     }
    //     return;
    // } else if let Some(ref s) = matches.opt_str("f") {
    //     let host = analysis::AnalysisHost::new(".", analysis::Target::Debug);
    //     host.reload().unwrap();
    //     if let Ok(results) = host.search(s) {
    //         println!("Find {}: {:?}", s, results);
    //     } else {
    //         println!("Error finding ident {}", s);
    //     }
    //     return;
    }

    let mut ip = None;
    if let Some(ref s) = matches.opt_str("i") {
        ip = Some(s.to_owned());
    }

    rustw::run_server(ip);
}
