// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// Reprocessing snippets after building.

use build::errors::{Diagnostic, DiagnosticSpan};
use config::Config;
use file_cache::Cache;

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time;

use serde_json;
use span;

pub fn make_key() -> String {
    // This is a pretty roundabout way to make a fairly unique string.
    let now = time::SystemTime::now();
    let now = now.duration_since(time::UNIX_EPOCH).unwrap();
    now.subsec_nanos().to_string()
}

// For any snippet in the build result, we syntax highlight the file, and return
// a new, syntax highlighted snippet.
// This function should be run in its own thread, the result is posted to
// pending_push_data.
pub fn reprocess_snippets(
    key: String,
    errors: Vec<Diagnostic>,
    pending_push_data: Arc<Mutex<HashMap<String, Option<String>>>>,
    use_analysis: bool,
    file_cache: Arc<Mutex<Cache>>,
    config: Arc<Config>,
) {
    if use_analysis {
        let mut file_cache = file_cache.lock().unwrap();
        file_cache.update_analysis();
    }

    let mut snippets = ReprocessedSnippets::new(key);
    for d in &errors {
        reprocess_diagnostic(d, None, &file_cache, &mut snippets, &config);
    }

    let mut pending_push_data = pending_push_data.lock().unwrap();
    let entry = pending_push_data.get_mut(&snippets.key).unwrap();
    assert!(entry.is_none());
    *entry = Some(serde_json::to_string(&snippets).unwrap());
}

fn reprocess_diagnostic(
    diagnostic: &Diagnostic,
    parent_id: Option<u32>,
    file_cache: &Mutex<Cache>,
    result: &mut ReprocessedSnippets,
    config: &Config,
) {
    // Lock the file_cache on every iteration because this thread should be
    // low priority, and we're happy to wait if someone else wants access to
    // the file_cache.
    {
        let file_cache = file_cache.lock().unwrap();
        let mut spans = diagnostic.spans.clone();
        spans.sort();
        let span_groups = partition(&spans, config.context_lines);

        for sg in &span_groups {
            if sg.is_empty() {
                continue;
            }

            let first = &sg[0];
            let last = &sg[sg.len() - 1];

            // Lines should be 1-indexed, account for that here.
            let mut line_start = if first.line_start == 0 {
                // TODO is this a SpanEnd which needs better handling?
                0
            } else {
                first.line_start - 1
            };
            // Add context lines.
            if line_start <= config.context_lines {
                line_start = 0;
            } else {
                line_start -= config.context_lines;
            }
            let mut line_end = last.line_end + config.context_lines;

            let path = &Path::new(&first.file_name);
            let text = match file_cache.get_highlighted(path) {
                Ok(file) => {
                    if line_end >= file.len() {
                        line_end = file.len();
                    }
                    file[line_start..line_end].to_owned()
                }
                Err(_) => Vec::new(),
            };

            let mut primary_span = None;
            for s in *sg {
                if s.is_primary {
                    primary_span = Some(Highlight::from_diagnostic_span(s));
                    break;
                }
            }
            let primary_span = primary_span.unwrap_or(Highlight::from_diagnostic_span(first));
            let lines = file_cache
                .get_lines(
                    path,
                    span::Row::new_zero_indexed(line_start as u32),
                    span::Row::new_zero_indexed(line_end as u32),
                )
                .unwrap_or(String::new());

            let snippet = Snippet::new(
                parent_id,
                diagnostic.id,
                sg.iter().map(|s| s.id).collect(),
                text,
                first.file_name.to_owned(),
                line_start + 1,
                line_end,
                sg.iter()
                    .map(|s| (Highlight::from_diagnostic_span(s), s.label.clone()))
                    .collect(),
                lines,
                primary_span,
            );
            result.snippets.push(snippet);
        }
    }

    for d in &diagnostic.children {
        reprocess_diagnostic(d, Some(diagnostic.id), file_cache, result, config);
    }
}

pub trait Close {
    fn is_close(&self, next: &Self, max_lines: usize) -> bool;
}

fn partition<T: Close>(input: &[T], max_lines: usize) -> Vec<&[T]> {
    let mut result = vec![];
    if input.is_empty() {
        return result;
    }

    let mut prev = &input[0];
    let mut cur_first = 0;
    let mut cur_last = 0;

    for (i, ds) in input.iter().enumerate().skip(1) {
        cur_last = i;
        if !prev.is_close(ds, max_lines) {
            result.push(&input[cur_first..cur_last]);
            cur_first = cur_last;
        }
        prev = ds;
    }
    if cur_last + 1 > cur_first {
        result.push(&input[cur_first..cur_last + 1]);
    }

    result
}

#[derive(Serialize, Debug)]
struct ReprocessedSnippets {
    snippets: Vec<Snippet>,
    key: String,
}

// TODO which lines are context.
#[derive(Serialize, Debug, new)]
struct Snippet {
    parent_id: Option<u32>,
    diagnostic_id: u32,
    span_ids: Vec<u32>,
    // TODO do we ever want to update the plain_text? Probably do to keep the
    // snippet up to date after a quick edit, etc.
    text: Vec<String>,
    file_name: String,
    /// 1-based.
    line_start: usize,
    line_end: usize,
    highlights: Vec<(Highlight, String)>,
    plain_text: String,
    primary_span: Highlight,
}

#[derive(Serialize, Debug)]
struct Highlight {
    /// 1-based.
    pub line_start: usize,
    pub line_end: usize,
    /// 1-based, character offset.
    pub column_start: usize,
    pub column_end: usize,
}

impl Highlight {
    fn from_diagnostic_span(span: &DiagnosticSpan) -> Highlight {
        Highlight {
            line_start: span.line_start,
            line_end: span.line_end,
            column_start: span.column_start,
            column_end: span.column_end,
        }
    }
}

impl<'a> ReprocessedSnippets {
    fn new(key: String) -> ReprocessedSnippets {
        ReprocessedSnippets {
            snippets: vec![],
            key: key,
        }
    }
}

#[cfg(test)]
mod test {
    use super::{partition, Close};

    impl Close for i32 {
        fn is_close(&self, next: &i32, max_lines: usize) -> bool {
            (next - self) as usize <= max_lines
        }
    }

    #[test]
    fn test_partition() {
        let input: &[i32] = &[];
        let result = partition(input, 2);
        let expected: Vec<&[i32]> = vec![];
        assert!(result == expected);

        let input: &[i32] = &[1, 2, 3];
        let result = partition(input, 2);
        assert!(result == vec![&[1, 2, 3]]);

        let input: &[i32] = &[1, 3, 15];
        let a: &[i32] = &[1, 3];
        let b: &[i32] = &[15];
        let result = partition(input, 2);
        assert!(result == vec![a, b]);
    }
}
