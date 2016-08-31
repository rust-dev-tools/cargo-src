// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// Syntax highlighting.

use std::fmt::Display;
use std::io::{self, Write};
use std::str;

use rustdoc::html::highlight::{self, Classifier, Class};
use syntax::parse;
use syntax::parse::lexer::{self, TokenAndSpan};
use syntax::codemap::CodeMap;

use rls::analysis::Analysis;

pub fn highlight(analysis: &Analysis, file_name: String, file_text: String) -> String {
    let sess = parse::ParseSess::new();
    let fm = sess.codemap().new_filemap(file_name, None, file_text);

    let mut out = Highlighter::new(analysis, sess.codemap());
    let mut classifier = Classifier::new(lexer::StringReader::new(&sess.span_diagnostic, fm),
                                         sess.codemap());
    classifier.write_source(&mut out).unwrap();

    String::from_utf8_lossy(&out.buf).into_owned()
}

struct Highlighter<'a> {
    buf: Vec<u8>,
    analysis: &'a Analysis,
    codemap: &'a CodeMap,
}

impl<'a> Highlighter<'a> {
    fn new(analysis: &'a Analysis, codemap: &'a CodeMap) -> Highlighter<'a> {
        Highlighter {
            buf: vec![],
            analysis: analysis,
            codemap: codemap,
        }
    }

    fn write_span(buf: &mut Vec<u8>,
                  klass: Class,
                  text: String,
                  title: Option<&str>,
                  extra_class: Option<String>,
                  link: Option<String>,
                  extra: Option<String>)
                  -> io::Result<()> {
        write!(buf, "<span class='{}", klass.rustdoc_class())?;
        if let Some(s) = extra_class {
            write!(buf, "{}", s)?;
        }
        if let Some(_) = link {
            write!(buf, " src_link")?;
        }
        write!(buf, "'")?;
        if let Some(s) = title {
            write!(buf, " title='")?;
            for c in s.chars() {
                push_char(buf, c)?;
            }
            write!(buf, "'")?;
        }
        if let Some(s) = link {
            write!(buf, " link='{}'", s)?;
        }
        if let Some(s) = extra {
            write!(buf, " {}", s)?;
        }
        write!(buf, ">{}</span>", text)
    }
}

fn push_char(buf: &mut Vec<u8>, c: char) -> io::Result<()> {
    match c {
        '>' => write!(buf, "&gt;"),
        '<' => write!(buf, "&lt;"),
        '&' => write!(buf, "&amp;"),
        '\'' => write!(buf, "&#39;"),
        '"' => write!(buf, "&quot;"),
        '\n' => write!(buf, "<br>"),
        _ => write!(buf, "{}", c),
    }
}

impl<'a> highlight::Writer for Highlighter<'a> {
    fn enter_span(&mut self, klass: Class) -> io::Result<()> {
        write!(self.buf, "<span class='{}'>", klass.rustdoc_class())
    }

    fn exit_span(&mut self) -> io::Result<()> {
        write!(self.buf, "</span>")
    }

    fn string<T: Display>(&mut self, text: T, klass: Class, tas: Option<&TokenAndSpan>) -> io::Result<()> {
        let text = text.to_string();

        match klass {
            Class::None => write!(self.buf, "{}", text),
            Class::Ident => {
                let (title, css_class, link) = match tas {
                    Some(t) => {
                        let lo = self.codemap.lookup_char_pos(t.sp.lo);
                        let hi = self.codemap.lookup_char_pos(t.sp.hi);
                        let title = self.analysis.get_title(&lo, &hi);
                        let link = self.analysis.get_link(&lo, &hi);

                        let css_class = match self.analysis.get_class_id(&lo, &hi) {
                            Some(i) => Some(format!(" class_id class_id_{}", i)),
                            None => None,
                        };

                        (title, css_class, link)
                    }
                    None => (None, None, None),
                };

                Highlighter::write_span(&mut self.buf, Class::Ident, text, title, css_class, link, None)
            }
            Class::Op if text == "*" => {
                match tas {
                    Some(t) => {
                        let lo = self.codemap.lookup_char_pos(t.sp.lo);
                        let hi = self.codemap.lookup_char_pos(t.sp.hi);
                        let title = self.analysis.get_title(&lo, &hi);
                        let location = Some(format!("location='{}:{}''", lo.line, lo.col.0 + 1));
                        let css_class = Some(" glob".to_owned());

                        Highlighter::write_span(&mut self.buf, Class::Op, text, title, css_class, None, location)
                    }
                    None => Highlighter::write_span(&mut self.buf, Class::Op, text, None, None, None, None)
                }
            }
            klass => Highlighter::write_span(&mut self.buf, klass, text, None, None, None, None),
        }
    }
}
