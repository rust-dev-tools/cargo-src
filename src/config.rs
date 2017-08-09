// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use toml;

// Copy-pasta from rustfmt.

// This trait and the following impl blocks are there so that we an use
// UCFS inside the get_docs() function on types for configs.
pub trait ConfigType {
    fn get_variant_names() -> String;
}

impl ConfigType for bool {
    fn get_variant_names() -> String {
        String::from("<boolean>")
    }
}

impl ConfigType for usize {
    fn get_variant_names() -> String {
        String::from("<unsigned integer>")
    }
}

impl ConfigType for String {
    fn get_variant_names() -> String {
        String::from("<string>")
    }
}

macro_rules! create_config {
    ($($i:ident: $ty:ty, $def:expr, $unstable:expr, $( $dstring:expr ),+ );+ $(;)*) => (
        #[derive(Serialize, Deserialize, Clone)]
        pub struct Config {
            $(pub $i: $ty),+
        }

        // Just like the Config struct but with each property wrapped
        // as Option<T>. This is used to parse a rustfmt.toml that doesn't
        // specity all properties of `Config`.
        // We first parse into `ParsedConfig`, then create a default `Config`
        // and overwrite the properties with corresponding values from `ParsedConfig`
        #[derive(Deserialize, Clone)]
        pub struct ParsedConfig {
            $(pub $i: Option<$ty>),+
        }

        impl Config {

            fn fill_from_parsed_config(mut self, parsed: ParsedConfig) -> Config {
            $(
                if let Some(val) = parsed.$i {
                    self.$i = val;
                    // TODO error out if unstable
                }
            )+
                self
            }

            pub fn from_toml(s: &str) -> Config {
                let parsed_config: ParsedConfig = toml::from_str(s).expect("Could not parse TOML");
                Config::default().fill_from_parsed_config(parsed_config)
            }

            pub fn print_docs() {
                use std::cmp;

                let max = 0;
                $( let max = cmp::max(max, stringify!($i).len()+1); )+
                let mut space_str = String::with_capacity(max);
                for _ in 0..max {
                    space_str.push(' ');
                }
                println!("Configuration Options:");
                $(
                    if !$unstable {
                        let name_raw = stringify!($i);
                        let mut name_out = String::with_capacity(max);
                        for _ in name_raw.len()..max-1 {
                            name_out.push(' ')
                        }
                        name_out.push_str(name_raw);
                        name_out.push(' ');
                        println!("{}{} Default: {:?}",
                                 name_out,
                                 <$ty>::get_variant_names(),
                                 $def);
                        $(
                            println!("{}{}", space_str, $dstring);
                        )+
                        println!("");
                    }
                )+
            }
        }

        // Template for the default configuration
        impl Default for Config {
            fn default() -> Config {
                Config {
                    $(
                        $i: $def,
                    )+
                }
            }
        }
    )
}

create_config! {
    build_command: String, "cargo check".to_owned(), false, "command to call to build";
    edit_command: String, String::new(), false,
        "command to call to edit; can use $file, $line, and $col.";
    unstable_features: bool, false, false, "Enable unstable features";
    port: usize, 7878, false, "port to run rustw on";
    demo_mode: bool, false, true, "run in demo mode";
    demo_mode_root_path: String, String::new(), true, "path to use in URLs in demo mode";
    context_lines: usize, 2, false, "lines of context to show before and after code snippets";
    build_on_load: bool, true, false, "build on page load and refresh";
    source_directory: String, "src".to_owned(), false, "root of the source directory";
    save_analysis: bool, true, false, "whether to run the save_analysis pass";
    vcs_link: String, String::new(), false, "link to use for VCS; should use $file and $line.";
}
