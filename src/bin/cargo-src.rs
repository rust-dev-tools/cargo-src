extern crate log;
extern crate env_logger;
extern crate rustw;

use std::env;
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
    
    let build_args = BuildArgs {
        program: env::var("CARGO").expect("Missing $CARGO var"),
        args: args.collect(),
    };

    rustw::run_server(Some(build_args));

}
