// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use super::Span;

// The number of lines before and after a result line to use as context.
pub const CONTEXT_SIZE: i32 = 3;

#[derive(Serialize, Debug, Clone)]
pub struct SearchResult {
    pub defs: Vec<DefResult>,
}

#[derive(Serialize, Debug, Clone)]
pub struct DefResult {
    pub file: String,
    pub line: LineResult,
    pub refs: Vec<FileResult>,
}

#[derive(Serialize, Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct FileResult {
    pub file_name: String,
    pub lines: Vec<LineResult>,
}

#[derive(Serialize, Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct LineResult {
    pub line_start: u32,
    pub column_start: u32,
    pub column_end: u32,
    pub line: String,
    pub pre_context: String,
    pub post_context: String,
}

impl LineResult {
    pub fn new(span: &Span, line: String, pre_context: String, post_context: String) -> LineResult {
        LineResult {
            line_start: span.range.row_start.one_indexed().0,
            column_start: span.range.col_start.one_indexed().0,
            column_end: span.range.col_end.one_indexed().0,
            line,
            pre_context,
            post_context,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct FindResult {
    pub results: Vec<FileResult>,
}

#[derive(Serialize, Debug, Clone)]
pub struct SymbolResult {
    pub id: String,
    pub name: String,
    pub file_name: String,
    pub line_start: u32,
}
