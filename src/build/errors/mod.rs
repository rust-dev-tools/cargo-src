// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use serde_json;

use std::cmp::{Ordering, Ord, PartialOrd};

mod rustc_errors;

pub fn parse_errors(stderr: &str, stdout: &str) -> (Vec<Diagnostic>, Vec<String>) {
    let mut errs: Vec<rustc_errors::Diagnostic> = vec![];
    let mut msgs: Vec<String> = stdout.split('\n').map(|s| s.to_owned()).collect();
    for i in stderr.split('\n') {
        if i.trim().is_empty() {
            continue;
        }
        if !i.starts_with('{') {
            msgs.push(i.to_owned());
            continue;
        }
        match serde_json::from_str(i) {
            Ok(x) => {
                errs.push(x);
            }
            Err(e) => {
                println!("ERROR parsing compiler output: {}", e);
                println!("input: `{}`", i);
            }
        }
    }

    let mut lowering_ctxt = rustc_errors::LoweringContext::new();
    (errs.into_iter().map(|d| d.lower(&mut lowering_ctxt)).collect(), msgs)
}

#[derive(Serialize, Debug)]
pub struct Diagnostic {
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

        next.line_start - self.line_end <= max_lines
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

#[cfg(test)]
mod test {
    use super::parse_errors;

    #[test]
    fn test_parse() {
        let input = r#"{"message":"unused variable: `matches`, #[warn(unused_variables)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/main.rs","byte_start":771,"byte_end":778,"line_start":49,"line_end":49,"column_start":9,"column_end":16}],"children":[]}"#;
        let _result = parse_errors(input);
    }
}
