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
#![feature(integer_atomics)]

#[macro_use]
extern crate derive_new;
extern crate hyper;
extern crate futures;
#[macro_use]
extern crate log;
extern crate rls_analysis as analysis;
extern crate rls_blacklist as blacklist;
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
use hyper::server::Http;
use std::fs::File;
use std::io::Read;

pub use build::BuildArgs;

mod build;
pub mod config;
mod reprocess;
mod file_cache;
mod listings;
mod highlight;
mod server;

pub fn run_server(build_args: BuildArgs) {
    let config = load_config(&build_args);
    let ip = config.ip.clone();
    let port = config.port;

    println!("server running on http://{}:{}", ip, port);
    let addr = format!("{}:{}", ip, port).parse().unwrap();
    let server = server::Server::new(config.clone(), build_args.clone());
    let instance = server::Instance::new(server);
    Http::new().bind(&addr, move || Ok(instance.clone()))
        .unwrap()
        .run()
        .unwrap();
}

fn load_config(build_args: &BuildArgs) -> Config {
    let config_file = File::open("rustw.toml");
    let mut toml = String::new();
    if let Ok(mut f) = config_file {
        f.read_to_string(&mut toml).unwrap();
    }
    let mut config = Config::from_toml(&toml);

    if config.workspace_root.is_none() {
        config.workspace_root = Some(build_args.workspace_root.clone())
    }

    config
}
