pub mod errors;

use std::process::{Command, ExitStatus, Output};

pub struct Builder {
    build_str: String,
}

pub struct BuildResult {
    pub status: ExitStatus,
    pub stdout: String,
    pub stderr: String,
}

impl Builder {
    pub fn from_build_command(s: &str) -> Builder {
        Builder {
            build_str: s.to_owned(),
        }
    }

    pub fn build(&self) -> Result<BuildResult, ()> {
        // TODO ignores build_str
        let mut cmd = Command::new("cargo");
        cmd.arg("build");
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
                println!("error: {}", e);
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
