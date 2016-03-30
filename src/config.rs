
pub struct Config {
    pub build_cmd: String,
}

pub fn new() -> Config {
    Config {
        build_cmd: "cargo build".to_owned()
    }
}
