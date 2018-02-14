// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

pub mod errors;

use config::Config;
use server::DiagnosticEventHandler;

use std::io::{BufRead, BufReader, Read};
use std::process::{Command, Stdio, Child};
use std::sync::Arc;

#[derive(Clone)]
pub struct Builder {
    config: Arc<Config>,
    build_args: BuildArgs,
}

#[derive(Clone, Debug)]
pub struct BuildResult {
    pub status: Option<i32>,
    pub stderr: String,
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

    fn init_cmd(&self) -> Result<Command, ()> {
        let mut cmd = Command::new(&self.build_args.program);
        cmd.arg("check");
        cmd.args(&self.build_args.args);
        // FIXME(#170) configure save-analysis
        cmd.env("RUSTFLAGS", "-Zunstable-options -Zsave-analysis --error-format json");
        cmd.env("CARGO_TARGET_DIR", "target/rls");
        cmd.env("RUST_LOG", "");

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        Ok(cmd)
    }

    fn finish(&self, child: Child) -> Result<Option<i32>, ()> {
        let output = match child.wait_with_output() {
            Ok(o) => {
                info!("done");
                o
            }
            Err(e) => {
                // TODO could handle this error more nicely.
                debug!(
                    "build error: `{}`; command: `{}`",
                    e,
                    self.config.build_command
                );
                return Err(());
            }
        };

        if !output.stdout.is_empty() {
            println!("ERROR expected empty stdout");
            println!("stdout: `{}`", String::from_utf8(output.stdout).unwrap());
        }

        assert!(output.stderr.is_empty());

        Ok(output.status.code())
    }

    pub fn build(&self, mut ev_handler: Option<&mut DiagnosticEventHandler>) -> Result<BuildResult, ()> {
        let mut cmd = self.init_cmd()?;
        let mut child = cmd.spawn().unwrap();
        let mut stderr = BufReader::new(child.stderr.take().unwrap());

        loop {
            let mut buf = String::new();
            // TODO sometimes blocking here for a long time
            match stderr.read_line(&mut buf) {
                Ok(0) | Err(_) => {
                    break;
                }
                Ok(_) => {
                    // TODO there should be an option to suppress printing to stdout.
                    print!("{}", buf);
                    if let Some(ref mut ev_handler) = ev_handler {
                        ev_handler.handle_msg(&buf);
                    }
                }
            }
        }

        let mut buf = vec![];
        stderr.read_to_end(&mut buf).unwrap();
        assert!(buf.is_empty());

        let status = self.finish(child)?;
        Ok(BuildResult {
            status,
            stderr: String::new(),
        })
    }
}
