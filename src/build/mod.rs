pub mod errors;

use config::Config;

use std::process::{Command, ExitStatus, Output};

pub struct Builder {
    build_command: String,
}

pub struct BuildResult {
    pub status: ExitStatus,
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

        Ok(BuildResult::from_process_output(output))
    }
}

impl BuildResult {
    fn from_process_output(output: Output) -> BuildResult {
        BuildResult {
            status: output.status,
            stdout: String::from_utf8(output.stdout).unwrap(),
            stderr: String::from_utf8(output.stderr).unwrap(),
        }
    }
}
