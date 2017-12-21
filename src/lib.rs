// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

#![feature(const_fn)]
#![feature(custom_derive, plugin)]
#![feature(type_ascription)]
// For libsyntax, which is just a hack to get around rustdoc.
#![feature(rustc_private)]
#![feature(proc_macro)]

#[macro_use]
extern crate derive_new;
extern crate hyper;
#[macro_use]
extern crate log;
extern crate rls_analysis as analysis;
extern crate rls_span as span;
extern crate rls_vfs as vfs;
extern crate rustdoc_highlight;
extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;
extern crate syntax;
extern crate syntax_pos;
extern crate toml;
extern crate url;

use config::Config;
use hyper::Server;
use std::fs::File;
use std::io::Read;

mod build;
pub mod config;
mod reprocess;
mod file_cache;
mod listings;
mod highlight;
mod server;

pub fn run_src_server(ip: Option<String>) {
    run_server_internal(ip, Mode::Src);
}

pub fn run_server(ip: Option<String>) {
    run_server_internal(ip, Mode::Rustw);
}

fn run_server_internal(ip: Option<String>, mode: Mode) {
    let config_file = File::open("rustw.toml");
    let mut toml = String::new();
    if let Ok(mut f) = config_file {
        f.read_to_string(&mut toml).unwrap();
    }
    let mut config = Config::from_toml(&toml);
    if mode == Mode::Src {
        config.build_on_load = false;
    }
    let port = config.port;

    let server = server::Instance::new(config, mode);

    let ip = ip.unwrap_or("127.0.0.1".to_owned());
    println!("server running on http://{}:{}", ip, port);
    Server::http(&*format!("{}:{}", ip, port))
        .unwrap()
        .handle(server)
        .unwrap();
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Mode {
    Src,
    Rustw,
}
