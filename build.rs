// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

extern crate walkdir;
use walkdir::WalkDir;
use std::{env, fs};
use std::path::Path;

fn main() {
    // Copy from $CARGO_MANIFEST_DIR to $CARGO_MANIFEST_DIR/target/$PROFILE.
    let from = env::var("CARGO_MANIFEST_DIR").unwrap();
    let from = Path::new(&from);
    let to = {
        let mut buf = from.to_owned();
        buf.push("target");
        buf.push(env::var("PROFILE").unwrap());
        buf
    };

    // Don't rerun on every build, but do rebuild if the build script changes
    // or something changes in the static directory.
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=static");

    // Copy the "static" dir and all its contents.
    for entry in WalkDir::new(from.join("static"))
                         .into_iter()
                         .filter_map(|e| e.ok()) {
        let mut target = to.clone();
        let relative = entry.path().strip_prefix(from).unwrap();
        println!("cargo:rerun-if-changed={}", relative.display());
        target.push(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(target).unwrap();
        } else {
            fs::copy(entry.path(), target).unwrap();
        }
    }
}

