// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

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

    pub fn test_result() -> BuildResult {
        BuildResult {
            status: Some(0),
            stdout: "   Compiling quasi v0.8.0\n   Compiling httparse v1.1.1\n   Compiling semver v0.1.20\n   Compiling aster v0.14.0\n   Compiling num v0.1.31\n   Compiling getopts v0.2.14\n   Compiling language-tags v0.2.2\n   Compiling unicode-normalization v0.1.2\n   Compiling winapi v0.2.6\n   Compiling serde v0.7.0\n   Compiling rustc_version v0.1.7\n   Compiling traitobject v0.0.1\n   Compiling typeable v0.1.2\n   Compiling libc v0.2.8\n   Compiling winapi-build v0.1.1\n   Compiling matches v0.1.2\n   Compiling unicode-bidi v0.2.3\n   Compiling unicase v1.3.0\n   Compiling kernel32-sys v0.2.1\n   Compiling serde_codegen v0.7.1\n   Compiling rustc-serialize v0.3.18\n   Compiling log v0.3.5\n   Compiling time v0.1.34\n   Compiling rand v0.3.14\n   Compiling quasi_codegen v0.8.0\n   Compiling num_cpus v0.2.11\n   Compiling mime v0.2.0\n   Compiling hpack v0.2.0\n   Compiling solicit v0.4.4\n   Compiling quasi_macros v0.8.0\n   Compiling serde_json v0.7.0\n   Compiling uuid v0.1.18\n   Compiling toml v0.1.28\n   Compiling url v0.5.7\n   Compiling cookie v0.2.2\n   Compiling hyper v0.8.0\n   Compiling serde_macros v0.7.0\n   Compiling rustw v0.1.0 (file:///home/ncameron/rustw)\n".to_owned(),
            stderr:
r#"{"message":"cannot borrow `res` as mutable more than once at a time","code":{"code":"E0499","explanation":"\nA variable was borrowed as mutable more than once. Erroneous code example:\n\n```compile_fail\nlet mut i = 0;\nlet mut x = &mut i;\nlet mut a = &mut i;\n// error: cannot borrow `i` as mutable more than once at a time\n```\n\nPlease note that in rust, you can either have many immutable references, or one\nmutable reference. Take a look at\nhttps://doc.rust-lang.org/stable/book/references-and-borrowing.html for more\ninformation. Example:\n\n\n```\nlet mut i = 0;\nlet mut x = &mut i; // ok!\n\n// or:\nlet mut i = 0;\nlet a = &i; // ok!\nlet b = &i; // still ok!\nlet c = &i; // still ok!\n```\n"},"level":"error","spans":[{"file_name":"src/server.rs","byte_start":26968,"byte_end":26971,"line_start":88,"line_end":88,"column_start":21,"column_end":24,"text":[{"text":"                    res.headers_mut().set(ContentType::json());","highlight_start":21,"highlight_end":24}]}],"children":[{"message":"previous borrow of `res` occurs here; the mutable borrow prevents subsequent moves, borrows, or modification of `res` until the borrow ends","code":null,"level":"note","spans":[{"file_name":"src/server.rs","byte_start":26009,"byte_end":26012,"line_start":66,"line_end":66,"column_start":35,"column_end":38,"text":[{"text":"                    let r2 = &mut res;","highlight_start":35,"highlight_end":38}]}],"children":[]},{"message":"previous borrow ends here","code":null,"level":"note","spans":[{"file_name":"src/server.rs","byte_start":25973,"byte_end":27105,"line_start":0,"line_end":90,"column_start":0,"column_end":18,"text":[{"text":"                router::Action::Edit(ref args) => {","highlight_start":51,"highlight_end":52},{"text":"                    let r2 = &mut res;","highlight_start":1,"highlight_end":39},{"text":"                    ","highlight_start":1,"highlight_end":21},{"text":"                    let cmd_line = &self.config.edit_command;","highlight_start":1,"highlight_end":62},{"text":"                    if !cmd_line.is_empty() {","highlight_start":1,"highlight_end":46},{"text":"                        let cmd_line = cmd_line.replace(\"$file\", &args[0])","highlight_start":1,"highlight_end":75},{"text":"                                               .replace(\"$line\", &args[1])","highlight_start":1,"highlight_end":75},{"text":"                                               .replace(\"$col\", &args[2]);","highlight_start":1,"highlight_end":75},{"text":"","highlight_start":1,"highlight_end":1},{"text":"                        let mut splits = cmd_line.split(' ');","highlight_start":1,"highlight_end":62},{"text":"","highlight_start":1,"highlight_end":1},{"text":"                        let mut cmd = Command::new(splits.next().unwrap());","highlight_start":1,"highlight_end":76},{"text":"                        for arg in splits {","highlight_start":1,"highlight_end":44},{"text":"                            cmd.arg(arg);","highlight_start":1,"highlight_end":42},{"text":"                        }","highlight_start":1,"highlight_end":26},{"text":"","highlight_start":1,"highlight_end":1},{"text":"                        // TODO log, don't print","highlight_start":1,"highlight_end":49},{"text":"                        match cmd.spawn() {","highlight_start":1,"highlight_end":44},{"text":"                            Ok(_) => println!(\"edit, launched successfully\"),","highlight_start":1,"highlight_end":78},{"text":"                            Err(e) => println!(\"edit, launch failed: `{:?}`, command: `{}`\", e, cmd_line),","highlight_start":1,"highlight_end":107},{"text":"                        }","highlight_start":1,"highlight_end":26},{"text":"                    }","highlight_start":1,"highlight_end":22},{"text":"","highlight_start":1,"highlight_end":1},{"text":"                    res.headers_mut().set(ContentType::json());","highlight_start":1,"highlight_end":64},{"text":"                    res.send(\"{}\".as_bytes()).unwrap();                    ","highlight_start":1,"highlight_end":76},{"text":"                }","highlight_start":1,"highlight_end":18}]}],"children":[]}]}
{"message":"cannot move out of `res` because it is borrowed","code":{"code":"E0505","explanation":null},"level":"error","spans":[{"file_name":"src/server.rs","byte_start":27032,"byte_end":27035,"line_start":89,"line_end":89,"column_start":21,"column_end":24,"text":[{"text":"                    res.send(\"{}\".as_bytes()).unwrap();                    ","highlight_start":21,"highlight_end":24}]}],"children":[{"message":"borrow of `res` occurs here","code":null,"level":"note","spans":[{"file_name":"src/server.rs","byte_start":26009,"byte_end":26012,"line_start":66,"line_end":66,"column_start":35,"column_end":38,"text":[{"text":"                    let r2 = &mut res;","highlight_start":35,"highlight_end":38}]}],"children":[]}]}
{"message":"aborting due to 2 previous errors","code":null,"level":"error","spans":[],"children":[]}
error: Could not compile `rustw`.

To learn more, run the command again with --verbose.
"#.to_owned(),
        }
    }
}
