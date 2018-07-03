// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use config::Config;

use cargo_metadata;
use std::collections::HashMap;
use std::fs::{read_dir, remove_file};
use std::path::Path;
use std::process::Command;
use std::sync::Arc;

// FIXME use `join` not `/`
const TARGET_DIR: &str = "target/rls";

#[derive(Clone)]
pub struct Builder {
    config: Arc<Config>,
    build_args: BuildArgs,
}

#[derive(Clone, Debug)]
pub struct BuildArgs {
    pub program: String,
    pub args: Vec<String>,
    pub workspace_root: String,
}

impl Builder {
    pub fn new(
        config: Arc<Config>,
        build_args: BuildArgs,
    ) -> Builder {
        Builder { config, build_args }
    }

    fn init_cmd(&self) -> Command {
        let mut cmd = Command::new(&self.build_args.program);
        cmd.arg("check");
        cmd.args(&self.build_args.args);
        // FIXME(#170) configure save-analysis
        cmd.env("RUSTFLAGS", "-Zunstable-options -Zsave-analysis");
        cmd.env("CARGO_TARGET_DIR", TARGET_DIR);
        cmd.env("RUST_LOG", "");

        cmd
    }

    pub fn build(&self) -> Option<i32> {
        let mut cmd = self.init_cmd();
        let status = cmd.status().expect("Running build failed");
        let result = status.code();
        self.clean_analysis();
        result
    }

    // Remove any old or duplicate json files.
    fn clean_analysis(&self) {
        let crate_names = crate_names()
            .map(|name| name.replace("-", "_"))
            .collect::<Vec<_>>();

        let analysis_dir = Path::new(&TARGET_DIR)
            .join("debug")
            .join("deps")
            .join("save-analysis");

        if let Ok(dir_contents) = read_dir(&analysis_dir) {
            // We're going to put all files for the same crate in one bucket, then delete duplicates.
            let mut buckets = HashMap::new();
            for entry in dir_contents {
                let entry = entry.expect("unexpected error reading save-analysis directory");
                let name = entry.file_name();
                let mut name = name.to_str().unwrap();

                if !name.ends_with("json") {
                    continue;
                }

                let hyphen = name.find('-');
                let hyphen = match hyphen {
                    Some(h) => h,
                    None => continue,
                };
                let name = &name[..hyphen];
                let match_name = if name.starts_with("lib") {
                    &name[3..]
                } else {
                    &name
                };
                // The JSON file does not correspond with any crate from `cargo
                // metadata`, so it is presumably an old dep that has been removed.
                // So, we should delete it.
                if !crate_names.iter().any(|name| name == match_name) {
                    info!("deleting {:?}", entry.path());
                    if let Err(e) = remove_file(entry.path()) {
                        debug!("Error deleting file, {:?}: {}", entry.file_name(), e);
                    }

                    continue;
                }

                buckets
                    .entry(name.to_owned())
                    .or_insert_with(|| vec![])
                    .push((
                        entry.path(),
                        entry
                            .metadata()
                            .expect("no file metadata")
                            .modified()
                            .expect("no modified time"),
                    ))
            }

            for bucket in buckets.values_mut() {
                if bucket.len() <= 1 {
                    continue;
                }

                // Sort by date created (JSON files are effectively read only)
                bucket.sort_by(|a, b| b.1.cmp(&a.1));
                // And delete all but the newest file.
                for &(ref path, _) in &bucket[1..] {
                    info!("deleting {:?}", path);
                    if let Err(e) = remove_file(path) {
                        debug!("Error deleting file, {:?}: {}", path, e);
                    }
                }
            }
        }
    }
}

fn crate_names() -> impl Iterator<Item = String> {
    let get_name = |p: cargo_metadata::Package| p.name;

    let metadata = match cargo_metadata::metadata_deps(None, true) {
        Ok(metadata) => metadata,
        Err(_) => return Vec::new().into_iter().map(get_name),
    };

    metadata.packages.into_iter().map(get_name)
}
