// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

extern crate walkdir;
use std::env;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use walkdir::WalkDir;

/// This build script creates a function for looking up static data to be served
/// by the web server. The contents of the static directory are included in the
/// binary via `include_bytes` and exposed to the rest of the program by
/// `lookup_static_file`.
fn main() {
    let from = env::var("CARGO_MANIFEST_DIR").unwrap();
    let from = Path::new(&from);
    let from = from.join("static");

    let mut out_path = Path::new(&env::var("OUT_DIR").unwrap()).to_owned();
    out_path.push("lookup_static.rs");

    // Don't rerun on every build, but do rebuild if the build script changes
    // or something changes in the static directory.
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=static");

    let mut out_file = File::create(&out_path).unwrap();
    out_file.write(PREFIX.as_bytes()).unwrap();

    for entry in WalkDir::new(&from)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| !e.path_is_symlink() && e.file_type().is_file())
    {
        let relative = entry.path().strip_prefix(&from).unwrap();
        write!(
            out_file,
            "\nr#\"{}\"# => Ok(include_bytes!(r#\"{}\"#)),",
            relative.display(),
            entry.path().display()
        )
        .unwrap();
    }

    out_file.write(SUFFIX.as_bytes()).unwrap();
}

const PREFIX: &str = "
pub fn lookup_static_file(path: &str) -> Result<&'static [u8], ()> {
    match path {
";

const SUFFIX: &str = "
        _ => Err(()),
    }
}
";
