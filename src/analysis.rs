// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use build;

use std::collections::HashMap;
use syntax::codemap::Loc;

#[derive(Debug)]
pub struct Analysis {
    // This only has fixed titles, not ones which use a ref.
    titles: HashMap<Span, String>,
}

#[derive(Debug, Clone, Hash, Ord, PartialOrd, Eq, PartialEq)]
struct Span {
    file_name: String,
    line_start: usize,
    column_start: usize,
    line_end: usize,
    column_end: usize,
}

impl Analysis {
    pub fn new() -> Analysis {
        Analysis {
            titles: HashMap::new(),
        }
    }

    pub fn from_build(build: Vec<build::Analysis>) -> Analysis {
        if build.is_empty() {
            return Analysis::new();
        }

        let mut titles = HashMap::new();

        // TODO multi-crate
        let mut build = build;
        let imports = build.remove(0).imports;
        for i in imports {
            titles.insert(Span::from_build(i.span), i.value);
        }

        Analysis {
            titles: titles,
        }
    }

    pub fn get_title(&self, lo: Loc, hi: Loc) -> Option<&str> {
        let span = Span {
            file_name: lo.file.name.clone(),
            line_start: lo.line as usize,
            column_start: lo.col.0 as usize + 1,
            line_end: hi.line as usize,
            column_end: hi.col.0 as usize + 1,            
        };
        self.titles.get(&span).map(|s| &**s)
    }
}

impl Span {
    pub fn from_build(build: build::SpanData) -> Span {
        Span {
            file_name: build.file_name,
            line_start: build.line_start,
            column_start: build.column_start,
            line_end: build.line_end,
            column_end: build.column_end,
        }
    }
}