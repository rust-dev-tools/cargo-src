
pub struct Config {
    pub build_cmd: String,
}

// TODO replace with reading a config file.
pub fn new() -> Config {
    Config {
        build_cmd: "cargo build".to_owned()
    }
}
