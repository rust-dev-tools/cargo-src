extern crate rustw;

use std::env;
use std::process::Command;

fn main() {
    let mut args = env::args();
    let prog = args.next().expect("No program name?");
    if prog == "cargo" || prog.ends_with("/cargo") {
        let src = args.next().expect("No `src` sub-command?");
        assert_eq!(src, "src", "No `src` sub-command?");
    } else if prog != "cargo-src" && !prog.ends_with("/cargo-src") {
        panic!("cargo-src started in some weird and unexpected way: `{}`", prog);
    }
    
    let cargo = env::var("CARGO").expect("Missing $CARGO var");
    let mut cmd = Command::new(cargo);
    cmd.arg("check");
    cmd.args(args);
    // FIXME(#170) configure save-analysis
    cmd.env("RUSTFLAGS", "-Zunstable-options -Zsave-analysis");
    cmd.env("CARGO_TARGET_DIR", "target/rls");
    cmd.status().expect("Error trying to run `cargo check`");

    rustw::run_src_server(None);

}
