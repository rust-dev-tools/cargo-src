// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

pub mod errors;

use config::Config;
use server::BuildUpdateHandler;

use std::io::{Read, BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

pub struct Builder {
    config: Arc<Config>,
    build_update_handler: Arc<Mutex<Option<BuildUpdateHandler>>>,
}

#[derive(Clone, Debug)]
pub struct BuildResult {
    pub status: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

// TODO
// In file_cache, add our own stuff (deglob/type on hover)

impl Builder {
    pub fn from_config(config: Arc<Config>, build_update_handler: Arc<Mutex<Option<BuildUpdateHandler>>>) -> Builder {
        Builder {
            config: config,
            build_update_handler: build_update_handler,
        }
    }

    pub fn build(&self) -> Result<BuildResult, ()> {
        let mut build_split = self.config.build_command.split(' ');
        let mut cmd = if let Some(cmd) = build_split.next() {
            Command::new(cmd)
        } else {
            debug!("build error - no build command");
            return Err(());
        };

        for arg in build_split {
            cmd.arg(arg);
        }

        let mut flags = "-Zunstable-options --error-format json".to_owned();
        if self.config.save_analysis {
            flags.push_str(" -Zsave-analysis");
        }
        if self.config.no_trans {
            flags.push_str(" -Zno-trans");
        }
        cmd.env("RUSTFLAGS", &flags);
        cmd.env("CARGO_TARGET_DIR", "target/rls");

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // TODO execute async
        // TODO record compile time

        info!("building...");

        let mut child = cmd.spawn().unwrap();
        let mut stderr = BufReader::new(child.stderr.take().unwrap());

        // Any output not sent to the update handler.
        let mut err_buf = String::new();
        loop {
            let mut buf = String::new();
            match stderr.read_line(&mut buf) {
                Ok(0) | Err(_) => {
                    let mut build_update_handler = self.build_update_handler.lock().unwrap();
                    if let Some(ref mut build_update_handler) = *build_update_handler {
                        build_update_handler.push_updates(&[], true);
                    }
                    break;
                }
                Ok(_) => {
                    let mut build_update_handler = self.build_update_handler.lock().unwrap();
                    match *build_update_handler {
                        Some(ref mut build_update_handler) => {
                            build_update_handler.push_updates(&[&buf], false);
                        }
                        None => {
                            err_buf.push_str(&buf);
                        }
                    }
                }
            }
        }

        let mut buf = vec![];
        stderr.read_to_end(&mut buf).unwrap();
        err_buf.push_str(&String::from_utf8(buf).unwrap());

        let output = match child.wait_with_output() {
            Ok(o) => {
                info!("done");
                o
            }
            Err(e) => {
                // TODO could handle this error more nicely.
                debug!("build error: `{}`; command: `{}`", e, self.config.build_command);
                return Err(());
            }
        };

        //println!("stdout: `{}`", String::from_utf8(output.stdout).unwrap());
        assert!(output.stdout.is_empty());
        assert!(output.stderr.is_empty());
        let result = BuildResult {
            status: output.status.code(),
            stdout: String::new(),
            stderr: err_buf,
        };

        trace!("Build output: {:?}", result);

        Ok(result)
    }
}

impl BuildResult {
    pub fn test_result() -> BuildResult {
        BuildResult {
            status: Some(0),
            stdout: "   Compiling zero v0.1.2   \nCompiling xmas-elf v0.2.0 (file:///home/ncameron/dwarf/xmas-elf)\n".to_owned(),
            stderr:
r#"{"message":"use of deprecated item: use raw accessors/constructors in `slice` module, #[warn(deprecated)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/sections.rs","byte_start":25644,"byte_end":25653,"line_start":484,"line_end":484,"column_start":38,"column_end":47,"text":[{"text":"            let slice = raw::Slice { data: ptr, len: self.desc_size as usize };","highlight_start":38,"highlight_end":47}]}],"children":[]}
{"message":"use of deprecated item: use raw accessors/constructors in `slice` module, #[warn(deprecated)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/sections.rs","byte_start":25655,"byte_end":25683,"line_start":484,"line_end":484,"column_start":49,"column_end":77,"text":[{"text":"            let slice = raw::Slice { data: ptr, len: self.desc_size as usize };","highlight_start":49,"highlight_end":77}]}],"children":[]}
{"message":"use of deprecated item: use raw accessors/constructors in `slice` module, #[warn(deprecated)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/sections.rs","byte_start":25631,"byte_end":25641,"line_start":484,"line_end":484,"column_start":25,"column_end":35,"text":[{"text":"            let slice = raw::Slice { data: ptr, len: self.desc_size as usize };","highlight_start":25,"highlight_end":35}]}],"children":[]}
{"message":"unused variable: `file`, #[warn(unused_variables)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/sections.rs","byte_start":25791,"byte_end":25795,"line_start":490,"line_end":490,"column_start":52,"column_end":56,"text":[{"text":"pub fn sanity_check<'a>(header: SectionHeader<'a>, file: &ElfFile<'a>) -> Result<(), &'static str> {","highlight_start":52,"highlight_end":56}]}],"children":[]}
{"message":"unused variable: `name`, #[warn(unused_variables)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/hash.rs","byte_start":45976,"byte_end":45980,"line_start":43,"line_end":43,"column_start":36,"column_end":40,"text":[{"text":"    pub fn lookup<'a, F>(&'a self, name: &str, f: F) -> &'a Entry","highlight_start":36,"highlight_end":40}]}],"children":[]}
{"message":"unused variable: `f`, #[warn(unused_variables)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/hash.rs","byte_start":45988,"byte_end":45989,"line_start":43,"line_end":43,"column_start":48,"column_end":49,"text":[{"text":"    pub fn lookup<'a, F>(&'a self, name: &str, f: F) -> &'a Entry","highlight_start":48,"highlight_end":49}]}],"children":[]}
{"message":"unused import, #[warn(unused_imports)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/bin/main.rs","byte_start":108,"byte_end":114,"line_start":4,"line_end":4,"column_start":32,"column_end":38,"text":[{"text":"use xmas_elf::sections::{self, ShType};","highlight_start":32,"highlight_end":38}]}],"children":[]}
"#.to_owned(),
        }
    }
}
