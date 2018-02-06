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
    build_args: Option<BuildArgs>,
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
}

impl Builder {
    pub fn new(
        config: Arc<Config>,
        build_args: Option<BuildArgs>,
    ) -> Builder {
        Builder { config, build_args }
    }

    fn init_cmd(&self) -> Result<Command, ()> {
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

        let flags = "-Zunstable-options --error-format json -Zsave-analysis".to_owned();
        cmd.env("RUSTFLAGS", &flags);
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

    fn cargo_src_build(build_args: &BuildArgs) -> Result<BuildResult, ()> {
        let mut cmd = Command::new(&build_args.program);
        cmd.arg("check");
        cmd.args(&build_args.args);
        // FIXME(#170) configure save-analysis
        cmd.env("RUSTFLAGS", "-Zunstable-options -Zsave-analysis");
        cmd.env("CARGO_TARGET_DIR", "target/rls");

        println!("Checking...");
        let status = match cmd.status() {
            Ok(s) => s.code(),
            Err(e) => {
                // TODO could handle this error more nicely.
                debug!(
                    "build error: `{}`; command: `{}`, args: {:?}",
                    e,
                    build_args.program,
                    build_args.args,
                );
                return Err(());
            }
        };
        Ok(BuildResult {
            status,
            stderr: String::new(),
        })
    }

    // precondition: self.build_args.is_some() || ev_handler.is_some()
    pub fn build(&self, ev_handler: Option<&mut DiagnosticEventHandler>) -> Result<BuildResult, ()> {
        // TODO execute async
        // TODO record compile time

        // cargo src build
        if let Some(ref build_args) = self.build_args {
            return Self::cargo_src_build(build_args);
        }

        // legacy build
        let ev_handler = ev_handler.expect("Legacy build with no diagnostic event handler");
        let mut cmd = self.init_cmd()?;

        info!("building...");
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
                    ev_handler.handle_msg(&buf);
                }
            }
        }

        let mut buf = vec![];
        stderr.read_to_end(&mut buf).unwrap();

        let status = self.finish(child)?;

        let result = BuildResult {
            status,
            stderr: String::from_utf8(buf).unwrap(),
        };

        trace!("Build output: {:?}", result);

        Ok(result)
    }
}
