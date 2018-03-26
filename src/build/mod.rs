// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use config::Config;

use std::process::Command;
use std::sync::Arc;

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
        cmd.env("CARGO_TARGET_DIR", "target/rls");
        cmd.env("RUST_LOG", "");

        cmd
    }

    pub fn build(&self) -> Option<i32> {
        let mut cmd = self.init_cmd();
        let status = cmd.status().expect("Running build failed");
        status.code()
    }
}
