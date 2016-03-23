
use server::Instance;

use std::collections::BTreeMap;
use std::fmt::Write;

pub struct Engine {
    foo: bool
}

pub struct Extra<'a> {
    pub extra_values: BTreeMap<&'static str, &'a str>,
    pub extra_lists: BTreeMap<&'static str, Vec<String>>,
}

impl<'a> Extra<'a> {
    pub fn new() -> Extra<'a> {
        Extra {
            extra_values: BTreeMap::new(),
            extra_lists: BTreeMap::new(),
        }
    }
}

impl Engine {
    pub fn new() -> Engine {
        Engine {
            foo: true,
        }
    }

    pub fn expand(&mut self, source: &str, instance: &Instance, extra: &Extra) -> String {
        let mut result = String::new();

        let mut found_open_brace = false;
        let mut found_close_brace = false;
        let mut brace_buf: Option<String> = None;
        for c in source.chars() {
            match c {
                '{' => {
                    assert!(brace_buf.is_none(), "Opening brace inside template");
                    if found_open_brace {
                        brace_buf = Some(String::new());
                        found_open_brace = false;
                    } else {
                        found_open_brace = true;
                    }
                }
                '}' if brace_buf.is_some() => {
                    if found_close_brace {
                        found_close_brace = false;
                        let braced = brace_buf.unwrap();
                        let braced = braced.trim();
                        if braced.starts_with('#') {
                            self.open(&braced[1..]);
                        } else if braced.starts_with('/') {
                            self.close(&braced[1..]);
                        } else {
                            self.write_value(&mut result, braced, instance, extra);
                        }
                        brace_buf = None;
                    } else {
                        found_close_brace = true;
                    }
                }
                _ => {
                    if found_close_brace && brace_buf.is_some() {
                        panic!("Single closing brace inside template");
                    }

                    if let Some(ref mut buf) = brace_buf {
                        buf.push(c);
                    } else {
                        result.push(c);
                    }
                }
            }
        }

        result
    }

    fn open(&mut self, cmd: &str) {
        match cmd {
            "each" => {

            }
            _ => {
                println!("ERROR: unknown helper `{}`", cmd);
            }
        }
        // TODO
    }

    fn close(&mut self, cmd: &str) {
        // TODO        
        match cmd {
            "each" => {

            }
            _ => {
                println!("ERROR: unknown helper `{}`", cmd);
            }
        }
    }

    fn write_value(&self, buf: &mut String, key: &str, instance: &Instance, extra: &Extra) {
        match key {
            "this" => {
                // TODO
            }
            "build_cmd" => {
                buf.push_str(&instance.config.build_cmd);
            }
            _ => {
                match extra.extra_values.get(key) {
                    Some(&s) => {
                        escape_and_write(buf, s);
                    }
                    None => {
                        println!("ERROR: unknown key in template: `{}`", key);
                    }
                }
            }
        }
    }
}

// Escape input for HTML and write it to buf.
// Replaces &, <, >, ', ", and newlines with <br>
fn escape_and_write(buf: &mut String, input: &str) {
    let mut last = 0;
    for (i, ch) in input.bytes().enumerate() {
        match ch as char {
            '<' | '>' | '&' | '\'' | '"' | '\n' => {
                buf.write_str(&input[last.. i]).unwrap();
                let s = match ch as char {
                    '>' => "&gt;",
                    '<' => "&lt;",
                    '&' => "&amp;",
                    '\'' => "&#39;",
                    '"' => "&quot;",
                    '\n' => "<br>",
                    _ => unreachable!()
                };
                buf.write_str(s).unwrap();
                last = i + 1;
            }
            _ => {}
        }
    }

    if last < input.len() {
        buf.write_str(&input[last..]).unwrap();
    }
}
