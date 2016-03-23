#![feature(question_mark)]
#![feature(custom_derive, plugin)]
#![feature(type_ascription)]
#![plugin(serde_macros)]

extern crate hyper;
extern crate url;
extern crate getopts;
extern crate serde;
extern crate serde_json;

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
// time

// TODO interface
// main page
//   build command
//     pause
//     rebuild
//   errors


// TODO next
// Get errors to the main page
// Control flow
//   on server
//   on page
// rebuild command

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
