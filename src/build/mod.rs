pub mod errors;

use config::Config;

use std::process::{Command, Output};

pub struct Builder {
    build_command: String,
}

pub struct BuildResult {
    pub status: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

impl Builder {
    pub fn from_config(config: &Config) -> Builder {
        Builder {
            build_command: config.build_command.clone(),
        }
    }

    pub fn build(&self) -> Result<BuildResult, ()> {
        let mut build_split = self.build_command.split(' ');
        let mut cmd = if let Some(cmd) = build_split.next() {
            Command::new(cmd)
        } else {
            println!("build error - no build command");
            return Err(());
        };

        for arg in build_split.next() {
            cmd.arg(arg);
        }

        cmd.env("RUSTFLAGS", "-Zunstable-options --error-format json");

        // TODO execute async

        // TODO record compile time

        // TODO log, not println
        println!("building...");

        let output = match cmd.output() {
            Ok(o) => {
                println!("done");
                o
            }
            Err(e) => {
                // TODO could handle this error more nicely.
                println!("error: `{}`; command: `{}`", e, self.build_command);
                return Err(());
            }
        };

        let result = BuildResult::from_process_output(output);

        Ok(result)
    }
}

impl BuildResult {
    fn from_process_output(output: Output) -> BuildResult {
        BuildResult {
            status: output.status.code(),
            stdout: String::from_utf8(output.stdout).unwrap(),
            stderr: String::from_utf8(output.stderr).unwrap(),
        }
    }

    // FIXME(#54) demo mode should create a BuildResult and go from there,
    // this is kind of how we should do that (maybe want some stdout too).
    // fn from_stderr(stderr: &str) -> BuildResult {
    //     BuildResult {
    //         status: Some(0),
    //         stdout: String::new(),
    //         stderr: stderr.to_owned(),
    //     }
    // }
}
