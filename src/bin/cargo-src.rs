extern crate log;
extern crate env_logger;
extern crate cargo_src;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

use std::env;
use std::process::Command;
use cargo_src::BuildArgs;

fn main() {
    env_logger::init().unwrap();

    let mut args = env::args().peekable();
    let _prog = args.next().expect("No program name?");

    // Remove `src` from the args, if present.
    let mut has_src = false;
    if let Some(s) = args.peek() {
        if s == "src" {
            has_src = true;
        }
    }
    if has_src {
        args.next().unwrap();
    }

    let args: Vec<_> = args.collect();

    if args.contains(&"--help".to_owned()) {
        print_help();
        return;
    }

    let workspace_root = workspace_root();
    
    let build_args = BuildArgs {
        program: env::var("CARGO").expect("Missing $CARGO var"),
        args,
        workspace_root,
    };

    cargo_src::run_server(build_args);
}

fn print_help() {
    println!("cargo-src");
    println!("Browse a program's source code\n");
    println!("USAGE:");
    println!("    cargo src [OPTIONS]\n");
    println!("OPTIONS:");
    println!("    --help    show this message");
    println!("    --open    open the cargo-src frontend in your web browser");
    println!("\nOther options follow `cargo check`, see `cargo check --help` for more.");
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
