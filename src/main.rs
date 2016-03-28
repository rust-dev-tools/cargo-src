#![feature(question_mark)]
#![feature(custom_derive, plugin)]
#![feature(type_ascription)]
#![feature(rustdoc)]
// For libsyntax, which is just a hack to get around rustdoc.
#![feature(rustc_private)]
#![plugin(serde_macros)]

extern crate hyper;
extern crate url;
extern crate getopts;
// TODO merge changes back to rustdoc
extern crate rustdoc;
extern crate serde;
extern crate serde_json;
extern crate syntax;

mod build;
mod config;
mod server;
mod web;

use getopts::Options;

use hyper::Server;

use std::env;

// TODO build
// read command line
//   configuration?
//   cargo default
// incremental results
// time

// TODO interface
// main page
//   build command
//     cancel
// options
//     show/hide all source
//     show/hide all children
//     show/hide warnings
//     show/hide notes/help/suggestions
//     show build command, time
//     context for error source
// build on load, f5 to rebuild

// TODO next
// edit link
// paths to data
// options
// push changes to rustdoc highlighting
// context for errors
// line numbers in error code

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut opts = Options::new();
    opts.optflag("h", "help", "print this help menu");

    let matches = match opts.parse(&args[1..]) {
        Ok(m) => m,
        Err(f) => {
            panic!(f.to_owned());
        }
    };    

    // TODO look at options

    let server = server::Instance::new();

    println!("server running on 127.0.0.1:3000");
    Server::http("127.0.0.1:3000").unwrap().handle(server).unwrap();
}
