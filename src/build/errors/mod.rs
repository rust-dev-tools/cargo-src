// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use serde_json;

use std::cmp::{Ordering, Ord, PartialOrd};

pub use self::rustc_errors::LoweringContext;

mod rustc_errors;

pub enum ParsedError {
    Diagnostic(Diagnostic),
    Message(String),
    Error,
}

pub fn parse_errors(stderr: &str, stdout: &str) -> (Vec<Diagnostic>, Vec<String>) {
    let mut lowering_ctxt = LoweringContext::new();
    let mut errs: Vec<Diagnostic> = vec![];
    let mut msgs: Vec<String> = stdout.split('\n').map(|s| s.to_owned()).collect();
    for i in stderr.split('\n') {
        if i.trim().is_empty() {
            continue;
        }
        match parse_error(i, &mut lowering_ctxt) {
            ParsedError::Diagnostic(d) => errs.push(d),
            ParsedError::Message(s) => msgs.push(s),
            ParsedError::Error => {}
        }
    }

    (errs, msgs)
}

pub fn parse_error(error: &str, lowering_ctxt: &mut LoweringContext) -> ParsedError {
    if !error.starts_with('{') {
        return ParsedError::Message(error.to_owned());
    }
    match serde_json::from_str(error) {
        Ok(x) => {
            ParsedError::Diagnostic((x: rustc_errors::Diagnostic).lower(lowering_ctxt))
        }
        Err(e) => {
            debug!("ERROR parsing compiler output: {}", e);
            debug!("input: `{}`", error);
            ParsedError::Error
        }
    }

}

#[derive(Serialize, Debug)]
pub struct Diagnostic {
    pub id: u32,
    /// The primary error message.
    pub message: String,
    pub code: Option<DiagnosticCode>,
    /// "error: internal compiler error", "error", "warning", "note", "help".
    pub level: String,
    pub spans: Vec<DiagnosticSpan>,
    /// Associated diagnostic messages.
    pub children: Vec<Diagnostic>,
}

#[derive(Serialize, Debug, Eq, PartialEq, Clone)]
pub struct DiagnosticSpan {
    pub id: u32,
    pub file_name: String,
    pub byte_start: u32,
    pub byte_end: u32,
    /// 1-based.
    pub line_start: usize,
    pub line_end: usize,
    /// 1-based, character offset.
    pub column_start: usize,
    pub column_end: usize,
    pub is_primary: bool,
    /// Source text from the start of line_start to the end of line_end.
    pub text: Vec<String>,
    pub plain_text: String,
    pub label: String,
}

#[derive(Serialize, Debug)]
pub struct DiagnosticCode {
    /// The code itself.
    code: String,
    /// An explanation for the code.
    explanation: Option<String>,
}

impl ::reprocess::Close for DiagnosticSpan {
    // Invariant: next comes after self, i.e., `other.line_start >= self.line_start`.
    fn is_close(&self, next: &DiagnosticSpan, max_lines: usize) -> bool {
        if self.file_name != next.file_name {
            return false;
        }

        if self.line_end < next.line_start {
            // The spans overlap.
            return true;
        }

        next.line_start <= max_lines + self.line_end
    }
}

impl PartialOrd for DiagnosticSpan {
    fn partial_cmp(&self, other: &DiagnosticSpan) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for DiagnosticSpan {
    fn cmp(&self, other: &DiagnosticSpan) -> Ordering {
        let file_ord = self.file_name.cmp(&other.file_name);
        match file_ord {
            Ordering::Less | Ordering::Greater => {
                return file_ord;
            }
            _ => self.file_name.cmp(&other.file_name),
        }
    }
}
