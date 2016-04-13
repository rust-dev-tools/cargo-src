
use toml;

// Copy-pasta from rustfmt (but using Serde instead of rustc_decode).
macro_rules! impl_enum_decodable {
    ( $e:ident, $( $x:ident ),* ) => {
        impl ::serde::Deserialize for $e {
            fn decode<D: ::serde::Deserializer>(d: &mut D) -> Result<Self, D::Error> {
                use std::ascii::AsciiExt;
                let s = try!(d.read_str());
                $(
                    if stringify!($x).eq_ignore_ascii_case(&s) {
                      return Ok($e::$x);
                    }
                )*
                Err(d.error("Bad variant"))
            }
        }

        impl ::std::str::FromStr for $e {
            type Err = &'static str;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                use std::ascii::AsciiExt;
                $(
                    if stringify!($x).eq_ignore_ascii_case(s) {
                        return Ok($e::$x);
                    }
                )*
                Err("Bad variant")
            }
        }

        impl ::config::ConfigType for $e {
            fn get_variant_names() -> String {
                let mut variants = Vec::new();
                $(
                    variants.push(stringify!($x));
                )*
                format!("[{}]", variants.join("|"))
            }
        }
    };
}

macro_rules! configuration_option_enum {
    ($e:ident: $( $x:ident ),+ $(,)*) => {
        #[derive(Copy, Clone, Eq, PartialEq, Debug)]
        pub enum $e {
            $( $x ),+
        }

        impl_enum_decodable!($e, $( $x ),+);
    }
}

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

pub struct ConfigHelpItem {
    option_name: &'static str,
    doc_string: &'static str,
    variant_names: String,
    default: &'static str,
}

macro_rules! create_config {
    ($($i:ident: $ty:ty, $def:expr, $( $dstring:expr ),+ );+ $(;)*) => (
        #[derive(RustcDecodable, Clone)]
        pub struct Config {
            $(pub $i: $ty),+
        }

        // Just like the Config struct but with each property wrapped
        // as Option<T>. This is used to parse a rustfmt.toml that doesn't
        // specity all properties of `Config`.
        // We first parse into `ParsedConfig`, then create a default `Config`
        // and overwrite the properties with corresponding values from `ParsedConfig`
        #[derive(RustcDecodable, Clone)]
        pub struct ParsedConfig {
            $(pub $i: Option<$ty>),+
        }

        impl Config {

            fn fill_from_parsed_config(mut self, parsed: ParsedConfig) -> Config {
            $(
                if let Some(val) = parsed.$i {
                    self.$i = val;
                }
            )+
                self
            }

            pub fn from_toml(toml: &str) -> Config {
                let parsed = toml.parse().expect("Could not parse TOML");
                let parsed_config:ParsedConfig = match toml::decode(parsed) {
                    Some(decoded) => decoded,
                    None => {
                        println!("Decoding config file failed. Config:\n{}", toml);
                        let parsed: toml::Value = toml.parse().expect("Could not parse TOML");
                        println!("\n\nParsed:\n{:?}", parsed);
                        panic!();
                    }
                };
                Config::default().fill_from_parsed_config(parsed_config)
            }

            pub fn override_value(&mut self, key: &str, val: &str) {
                match key {
                    $(
                        stringify!($i) => {
                            self.$i = val.parse::<$ty>()
                                .expect(&format!("Failed to parse override for {} (\"{}\") as a {}",
                                                 stringify!($i),
                                                 val,
                                                 stringify!($ty)));
                        }
                    )+
                    _ => panic!("Unknown config key in override: {}", key)
                }
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
    build_command: String, "cargo build".to_owned(), "command to call to build";
    edit_command: String, String::new(), "command to call to edit; can use $file, $line, and $col.";
    port: usize, 7878, "port to run rustw on";
    demo_mode: bool, false, "run in demo mode";
    context_lines: usize, 2, "lines of context to show before and after code snippets";
}
