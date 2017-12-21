// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// Syntax highlighting.

use std::collections::HashMap;
use std::fmt::Display;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;

use rustdoc_highlight::{self as highlight, Class, Classifier};
use span;
use syntax::parse;
use syntax::parse::lexer::{self, TokenAndSpan};
use syntax::codemap::{CodeMap, FilePathMapping, Loc};
use syntax_pos::FileName;

use analysis::AnalysisHost;
use analysis::DefKind;

type Span = span::Span<span::ZeroIndexed>;

pub fn highlight<'a>(
    analysis: &'a AnalysisHost,
    project_path: &'a Path,
    file_name: String,
    file_text: String,
) -> String {
    debug!("highlight `{}` in `{}`", file_text, file_name);
    let sess = parse::ParseSess::new(FilePathMapping::empty());
    let fm = sess.codemap().new_filemap(FileName::Real(PathBuf::from(&file_name)), file_text);

    let mut out = Highlighter::new(analysis, project_path, sess.codemap());

    let t_start = Instant::now();

    let mut classifier = Classifier::new(lexer::StringReader::new(&sess, fm), sess.codemap());
    classifier.write_source(&mut out).unwrap();

    let time = t_start.elapsed();
    info!(
        "Highlighting {} in {:.3}s",
        file_name,
        time.as_secs() as f64 + time.subsec_nanos() as f64 / 1_000_000_000.0
    );

    String::from_utf8_lossy(&out.buf).into_owned()
}

struct Highlighter<'a> {
    buf: Vec<u8>,
    analysis: &'a AnalysisHost,
    codemap: &'a CodeMap,
    project_path: &'a Path,
}

impl<'a> Highlighter<'a> {
    fn new(
        analysis: &'a AnalysisHost,
        project_path: &'a Path,
        codemap: &'a CodeMap,
    ) -> Highlighter<'a> {
        Highlighter {
            buf: vec![],
            analysis: analysis,
            codemap: codemap,
            project_path: project_path,
        }
    }

    fn get_link(&self, span: &Span) -> Option<String> {
        self.analysis
            .goto_def(span)
            .ok()
            .and_then(|def_span| if span == &def_span {
                None
            } else {
                Some(loc_for_span(&def_span, self.project_path))
            })
    }

    fn span_from_locs(&mut self, lo: &Loc, hi: &Loc) -> Span {
        Span::new(
            span::Row::new_one_indexed(lo.line as u32).zero_indexed(),
            span::Row::new_one_indexed(hi.line as u32).zero_indexed(),
            span::Column::new_zero_indexed(lo.col.0 as u32),
            span::Column::new_zero_indexed(hi.col.0 as u32),
            file_path_for_loc(lo),
        )
    }
}

fn file_path_for_loc(loc: &Loc) -> PathBuf {
    match loc.file.name {
        FileName::Real(ref path) => path.canonicalize().unwrap(),
        ref f => panic!("Expected real path, found {:?}", f),
    }
}

pub fn write_span(
    buf: &mut Vec<u8>,
    klass: Class,
    extra_class: Option<String>,
    text: String,
    src_link: bool,
    extra: HashMap<String, String>,
) -> io::Result<()> {
    write!(buf, "<span class='{}", klass.rustdoc_class())?;
    if let Some(s) = extra_class {
        write!(buf, " {}", s)?;
    }
    if src_link {
        write!(buf, " src_link")?;
    }
    write!(buf, "'")?;
    for (k, v) in &extra {
        // Some values need escaping.
        if k == "title" {
            write!(buf, " {}='", k)?;
            for c in v.chars() {
                push_char(buf, c)?;
            }
            write!(buf, "'")?;
        } else {
            write!(buf, " {}='{}'", k, v)?;
        }
    }
    write!(buf, ">{}</span>", text)
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

fn loc_for_span(span: &Span, project_path: &Path) -> String {
    let file_name = Path::new(&span.file)
        .strip_prefix(project_path)
        .ok()
        .unwrap_or(&span.file)
        .to_str()
        .unwrap();
    format!(
        "{}:{}:{}:{}:{}",
        file_name,
        span.range.row_start.one_indexed().0,
        span.range.col_start.one_indexed().0,
        span.range.row_end.one_indexed().0,
        span.range.col_end.one_indexed().0
    )
}


macro_rules! maybe_insert {
    ($h: expr, $k: expr, $v: expr) => {
        if let Some(v) = $v {
            $h.insert($k.to_owned(), v);
        }
    }
}

impl<'a> highlight::Writer for Highlighter<'a> {
    fn enter_span(&mut self, klass: Class) -> io::Result<()> {
        write!(self.buf, "<span class='{}'>", klass.rustdoc_class())
    }

    fn exit_span(&mut self) -> io::Result<()> {
        write!(self.buf, "</span>")
    }

    fn string<T: Display>(
        &mut self,
        text: T,
        klass: Class,
        tas: Option<&TokenAndSpan>,
    ) -> io::Result<()> {
        let text = text.to_string();

        match klass {
            Class::None => write!(self.buf, "{}", text),
            Class::Ident | Class::Self_ => {
                match tas {
                    Some(t) => {
                        let lo = self.codemap.lookup_char_pos(t.sp.lo());
                        let hi = self.codemap.lookup_char_pos(t.sp.hi());
                        // FIXME should be able to get all this info with a single query of analysis
                        let span = &self.span_from_locs(&lo, &hi);
                        let ty = self.analysis
                            .show_type(span)
                            .ok()
                            .and_then(|s| if s.is_empty() { None } else { Some(s) });
                        let docs = self.analysis
                            .docs(span)
                            .ok()
                            .and_then(|s| if s.is_empty() { None } else { Some(s) });
                        let title = match (ty, docs) {
                            (Some(t), Some(d)) => Some(format!("{}\n\n{}", t, d)),
                            (Some(t), _) => Some(t),
                            (_, Some(d)) => Some(d),
                            (None, None) => None,
                        };
                        let mut link = self.get_link(span);
                        let doc_link = self.analysis.doc_url(span).ok();
                        let src_link = self.analysis.src_url(span).ok();

                        let (css_class, impls) = match self.analysis.id(span) {
                            Ok(id) => {
                                if link.is_none() {
                                    link = Some(format!("search:{}", id));
                                }
                                let css_class = format!(" class_id class_id_{}", id);

                                let impls = match self.analysis.get_def(id) {
                                    Ok(def) => match def.kind {
                                        DefKind::Enum |
                                        DefKind::Struct |
                                        DefKind::Union |
                                        DefKind::Trait => self.analysis
                                            .find_impls(id)
                                            .map(|v| v.len())
                                            .unwrap_or(0),
                                        _ => 0,
                                    },
                                    Err(_) => 0,
                                };

                                (Some(css_class), impls)
                            }
                            Err(_) => (None, 0),
                        };

                        let has_link = doc_link.is_some() || link.is_some();

                        let mut extra = HashMap::new();
                        maybe_insert!(extra, "title", title);
                        maybe_insert!(extra, "data-link", link);
                        maybe_insert!(extra, "data-doc-link", doc_link);
                        maybe_insert!(extra, "data-src-link", src_link);
                        extra.insert("data-impls".to_owned(), impls.to_string());

                        write_span(
                            &mut self.buf,
                            Class::Ident,
                            css_class,
                            text,
                            has_link,
                            extra,
                        )
                    }
                    None => write_span(
                        &mut self.buf,
                        Class::Ident,
                        None,
                        text,
                        false,
                        HashMap::new(),
                    ),
                }
            }
            Class::RefKeyWord if text == "*" => match tas {
                Some(t) => {
                    let lo = self.codemap.lookup_char_pos(t.sp.lo());
                    let hi = self.codemap.lookup_char_pos(t.sp.hi());
                    let span = &self.span_from_locs(&lo, &hi);
                    let mut extra = HashMap::new();
                    extra.insert(
                        "data-location".to_owned(),
                        format!("{}:{}", lo.line, lo.col.0 + 1),
                    );
                    maybe_insert!(extra, "title", self.analysis.show_type(span).ok());
                    let css_class = Some(" glob".to_owned());

                    write_span(&mut self.buf, Class::Op, css_class, text, false, extra)
                }
                None => write_span(&mut self.buf, Class::Op, None, text, false, HashMap::new()),
            },
            klass => write_span(&mut self.buf, klass, None, text, false, HashMap::new()),
        }
    }
}

pub trait GetBuf {
    fn get_buf(&self) -> &[u8];
}
