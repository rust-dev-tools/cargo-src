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

const DEMO_MODE: bool = false;
const PORT: u32 = 3000;

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut opts = Options::new();
    opts.optflag("h", "help", "print this help menu");

    // Look at matches to actually see command line options.
    let _matches = match opts.parse(&args[1..]) {
        Ok(m) => m,
        Err(f) => {
            panic!(f.to_owned());
        }
    };    

    let server = server::Instance::new();

    println!("server running on 127.0.0.1:{}", PORT);
    Server::http(&*format!("127.0.0.1:{}", PORT)).unwrap().handle(server).unwrap();
}
