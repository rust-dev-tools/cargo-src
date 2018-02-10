extern crate log;
extern crate env_logger;
extern crate rustw;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

use std::env;
use std::process::Command;
use rustw::BuildArgs;

fn main() {
    env_logger::init().unwrap();

    let mut args = env::args();
    let prog = args.next().expect("No program name?");
    if prog == "cargo" || prog.ends_with("/cargo") {
        let src = args.next().expect("No `src` sub-command?");
        assert_eq!(src, "src", "No `src` sub-command?");
    } else if prog != "cargo-src" && !prog.ends_with("/cargo-src") {
        panic!("cargo-src started in some weird and unexpected way: `{}`", prog);
    }

    let workspace_root = workspace_root();
    
    let build_args = BuildArgs {
        program: env::var("CARGO").expect("Missing $CARGO var"),
        args: args.collect(),
        workspace_root,
    };

    rustw::run_server(Some(build_args));
}

fn workspace_root() -> String {
    let output = Command::new("cargo").args(&["metadata", "--format-version", "1"]).output();
    let stdout = String::from_utf8(output.expect("error executing `cargo metadata`").stdout).expect("unexpected output");
    let json: Metadata = serde_json::from_str(&stdout).expect("error parsing json from `cargo metadata`");
    json.workspace_root
}

#[derive(Deserialize)]
struct Metadata {
    workspace_root: String,
}
