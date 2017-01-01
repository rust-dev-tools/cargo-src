// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::{Write, BufWriter};
use std::str;

use analysis::{AnalysisHost, Target};
use rustdoc::html::markdown;
use span;
use vfs::Vfs;

use super::highlight;

// TODO maximum size and evication policy
// TODO keep timestamps and check on every read. Then don't empty on build.

pub struct Cache {
    files: Vfs<VfsUserData>,
    summaries: HashMap<u32, DefSummary>,
    analysis: AnalysisHost,
    project_dir: PathBuf,
}

type Span = span::Span<span::ZeroIndexed>;

#[derive(Serialize, Debug, Clone)]
pub struct SearchResult {
    pub defs: Vec<FileResult>,
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
}

impl LineResult {
    fn new(span: &Span, line: String) -> LineResult {
        LineResult {
            line_start: span.range.row_start.one_indexed().0,
            column_start: span.range.col_start.one_indexed().0,
            column_end: span.range.col_end.one_indexed().0,
            line: line,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct DefSummary {
    id: u32,
    bread_crumbs: Vec<String>,
    signature: String,
    doc_summary: String,
    doc_rest: String,
    parent: u32,
    children: Vec<DefChild>,
}

#[derive(Serialize, Debug, Clone)]
pub struct DefChild {
    id: u32,
    signature: String,
    doc_summary: String,
}

// struct FileCache {
//     files: HashMap<PathBuf, CachedFile>,
// }

// struct CachedFile {
//     plain_text: Vec<u8>,
//     highlighted_lines: Vec<String>,
//     new_lines: Vec<usize>,
// }

// Our data which we attach to files in the VFS.
struct VfsUserData {
    highlighted_lines: Vec<String>,
    new_lines: Vec<usize>,
}

impl VfsUserData {
    fn new() -> VfsUserData {
        VfsUserData {
            highlighted_lines: vec![],
            new_lines: vec![],
        }
    }
}

impl Cache {
    pub fn new() -> Cache {
        Cache {
            files: Vfs::new(),
            summaries: HashMap::new(),
            analysis: AnalysisHost::new(Target::Debug),
            project_dir: env::current_dir().unwrap(),
        }
    }

    pub fn reset(&mut self) {
        self.files.clear();
        self.summaries = HashMap::new();
    }

    pub fn reset_file(&self, path: &Path) {
        self.files.flush_file(&path.canonicalize().unwrap()).unwrap();
    }

    pub fn get_text(&self, path: &Path) -> Result<String, String> {
        self.files.load_file(path).map_err(|e| e.into())
    }

    pub fn get_line_count(&self, path: &Path) -> Result<usize, String> {
        self.ensure_new_lines_then(path, |_, u| Ok(u.new_lines.len()))
    }

    pub fn get_lines(&self, path: &Path, line_start: usize, line_end: usize) -> Result<String, String> {
        self.ensure_new_lines_then(path, |f, u| {
            let line_start = u.new_lines[line_start];
            let line_end = u.new_lines[line_end] - 1;
            Ok(f[line_start..line_end].to_owned())
        })
    }

    fn ensure_new_lines_then<F, T>(&self, path: &Path, f: F) -> Result<T, String>
        where F: FnOnce(&str, &VfsUserData) -> Result<T, ::vfs::Error>
    {
        let r: Result<(), String> = self.files.ensure_user_data(path, |_| Ok(VfsUserData::new())).map_err(|e| e.into());
        r?;
        self.files.with_user_data(path, |u| {
            let (text, u) = u?;
            if u.new_lines.is_empty() {
                u.new_lines = compute_new_lines(text)
            }

            f(text, u)
        }).map_err(|e| e.into())
    }

    pub fn summary(&mut self, id: u32) -> Result<&DefSummary, String> {
        if !self.summaries.contains_key(&id) {
            // TODO catch this error and make a "no summary available" page
            let summary = self.make_summary(id)?;
            self.summaries.insert(id, summary);
        }
        Ok(&self.summaries[&id])
    }

    // TODO handle non-rs files by returning plain text lines
    pub fn get_highlighted(&self, path: &Path) -> Result<Vec<String>, String> {
        let r: Result<(), String> = self.files.ensure_user_data(path, |_| Ok(VfsUserData::new())).map_err(|e| e.into());
        r?;
        self.files.with_user_data(path, |u| {
            let (text, u) = u?;
            if u.highlighted_lines.is_empty() {
                let highlighted = highlight::highlight(&self.analysis,
                                                       &self.project_dir,
                                                       path.to_str().unwrap().to_owned(),
                                                       text.to_owned());

                let mut highlighted_lines = vec![];
                for line in highlighted.lines() {
                    highlighted_lines.push(line.replace("<br>", "\n"));
                }
                if text.ends_with('\n') {
                    highlighted_lines.push(String::new());
                }
                u.highlighted_lines = highlighted_lines;
            }

            Ok(u.highlighted_lines.clone())
        }).map_err(|e| e.into())
    }

    pub fn get_highlighted_line(&self, file_name: &Path, line: span::Row<span::ZeroIndexed>) -> Result<String, String> {
        let lines = self.get_highlighted(Path::new(file_name))?;
        Ok(lines[line.0 as usize].clone())
    }

    pub fn update_analysis(&mut self) {
        // FIXME Possibly extreme, could invalidate by crate or by file. Also, only
        // need to invalidate Rust files.
        self.files.clear();

        info!("Processing analysis...");
        // TODO if this is a test run, we should mock the analysis, rather than trying to read it in.
        self.project_dir = env::current_dir().unwrap();
        self.analysis.reload(&self.project_dir, true).unwrap();
        info!("done");
    }

    pub fn id_search(&mut self, id: u32) -> Result<SearchResult, String> {
        self.ids_search(vec![id])
    }

    pub fn ident_search(&mut self, needle: &str) -> Result<SearchResult, String> {
        // First see if the needle corresponds to any definitions, if it does, get a list of the
        // ids, otherwise, return an empty search result.
        let ids = match self.analysis.search_for_id(needle) {
            Ok(ids) => ids.to_owned(),
            Err(_) => {
                return Ok(SearchResult {
                    defs: vec![],
                    refs: vec![],
                });
            }
        };

        self.ids_search(ids)
    }

    pub fn replace_str_for_id(&mut self, id: u32, new_text: &str) -> Result<(), String> {
        // TODO do better than unwrap

        let new_bytes = new_text.as_bytes();
        let mut spans = self.analysis.find_all_refs_by_id(id).unwrap_or(vec![]);
        spans.sort();

        let by_file = partition(&spans, |a, b| a.file == b.file);
        for file_bucket in by_file {
            let file_name = &file_bucket[0].file;
            let file_path = &Path::new(file_name);

            self.ensure_new_lines_then(file_path, |file_str, user_data| {
                // TODO should do a two-step file write here.
                let out_file = File::create(&file_name).unwrap();
                let mut writer = BufWriter::new(out_file);

                let mut last = 0;
                let mut next_index = 0;
                // TODO off by one error for line number
                let mut next_line = file_bucket[next_index].range.row_start.0 as usize;

                for (i, &line_end) in user_data.new_lines.iter().enumerate().skip(1) {
                    // For convenience elsewhere (ha!), new_lines has an extra entry at the end beyond
                    // the end of the file, we have to catch that and run away crying.
                    if line_end > file_str.len() {
                        break;
                    }
                    let line_str = &file_str[last..line_end];

                    if i == next_line {
                        // Need to replace one or more spans on the line.
                        let mut last_char = 0;
                        while next_line == i {
                            assert!(file_bucket[next_index].range.row_end == file_bucket[next_index].range.row_start, "Can't handle multi-line idents for replacement");
                            // TODO WRONG using char offsets for byte offsets
                            writer.write(line_str[last_char..(file_bucket[next_index].range.col_start.0 as usize - 1)].as_bytes()).unwrap();
                            writer.write(new_bytes).unwrap();

                            last_char = file_bucket[next_index].range.col_end.0 as usize - 1;
                            next_index += 1;
                            if next_index >= file_bucket.len() {
                                next_line = 0;
                                break;
                            }
                            next_line = file_bucket[next_index].range.row_start.0 as usize;
                        }
                        writer.write(line_str[last_char..].as_bytes()).unwrap();
                    } else {
                        // Nothing to replace.
                        writer.write(line_str.as_bytes()).unwrap();
                    }

                    last = line_end;
                }
                Ok(())
            })?;

            self.reset_file(file_path);
        }

        Ok(())
    }

    fn ids_search(&mut self, ids: Vec<u32>) -> Result<SearchResult, String> {
        // For each of the ids, push a search result to the appropriate list - one def and
        // potentially many refs. We store these in buckets per file name.
        let mut defs = HashMap::new();
        let mut refs = HashMap::new();

        for id in ids {
            // If all_refs.len() > 0, the first entry will be the def.
            let all_refs = self.analysis.find_all_refs_by_id(id);
            let mut all_refs = match all_refs {
                Err(_) => return Err("Error finding references".to_owned()),
                Ok(ref all_refs) if all_refs.is_empty() => continue,
                Ok(all_refs) => all_refs.into_iter(),
            };

            let def_span = all_refs.next().unwrap();
            let project_dir = self.project_dir.clone();
            let file_path = &def_span.file;
            let file_path = file_path.strip_prefix(&project_dir).unwrap_or(file_path);
            let def_text = self.get_highlighted_line(&file_path, def_span.range.row_start)?;
            let def_line = LineResult::new(&def_span, def_text);
            defs.entry(file_path.display().to_string()).or_insert_with(|| vec![]).push(def_line);

            for ref_span in all_refs {
                let project_dir = self.project_dir.clone();
                let file_path = Path::new(&ref_span.file);
                let file_path = file_path.strip_prefix(&project_dir).unwrap_or(file_path);
                let text = self.get_highlighted_line(&file_path, ref_span.range.row_start)?;
                let line = LineResult::new(&ref_span, text);
                refs.entry(file_path.display().to_string()).or_insert_with(|| vec![]).push(line);
            }
        }

        // TODO need to save the span for highlighting
        // We then save each bucket of defs/refs as a vec, and put it together to return.
        return Ok(SearchResult {
            defs: make_file_results(defs),
            refs: make_file_results(refs),
        });

        fn make_file_results(bucket: HashMap<String, Vec<LineResult>>) -> Vec<FileResult> {
            let mut list = vec![];
            for (file_path, mut lines) in bucket.into_iter() {
                lines.sort();
                let per_file = FileResult {
                    file_name: file_path,
                    lines: lines,
                };
                list.push(per_file);
            }
            list.sort();
            list
        }
    }

    fn make_summary(&self, id: u32) -> Result<DefSummary, String> {
        fn render_markdown(input: &str) -> String {
            format!("{}", markdown::Markdown(input))
        }

        // FIXME needs crate bread-crumb - needs a change to save-analysis to emit a top-level module: https://github.com/rust-lang/rust/issues/37818
        let bread_crumbs = self.analysis.def_parents(id).unwrap_or(vec![]).into_iter().map(|(id, name)| {
            use rustdoc::html::highlight::Class;

            let mut buf = vec![];
            let mut extra = HashMap::new();
            extra.insert("link".to_owned(), format!("summary:{}", id));
            extra.insert("id".to_owned(), format!("breadcrumb_{}", id));
            highlight::write_span(&mut buf,
                                  Class::None,
                                  Some("link_breadcrumb".to_owned()),
                                  name,
                                  true,
                                  extra).unwrap();
            String::from_utf8(buf).unwrap()
        }).collect();

        let def = self.analysis.get_def(id).map_err(|_| format!("No def for {}", id))?;

        trace!("def: {:?}", def);

        let docs = def.docs;
        let (doc_summary, doc_rest) = match docs.find("\n\n") {
            Some(index) => (docs[..index].to_owned(), docs[index + 2..].to_owned()),
            _ => (docs, String::new()),
        };

        let sig = match def.sig {
            Some(sig) => {
                let mut h = highlight::BasicHighlighter::new();
                h.span(sig.ident_start as u32, sig.ident_end as u32, "summary_ident".to_owned(), format!("def_{}", id), Some(def.span.clone()));
                highlight::custom_highlight(def.span.file.to_str().unwrap().to_owned(), sig.text, &mut h)
            }
            None => def.name,
        };

        let children = self.analysis.for_each_child_def(id, |id, def| {
            trace!("child def: {:?}", def);
            let docs = def.docs.to_owned();
            let sig = def.sig.as_ref().map(|s| {
                let mut h = highlight::BasicHighlighter::new();
                h.span(s.ident_start as u32, s.ident_end as u32, "summary_ident".to_owned(), format!("def_{}", id), Some(def.span.clone()));
                highlight::custom_highlight(def.span.file.to_str().unwrap().to_owned(), s.text.clone(), &mut h)
            }).expect("No signature for def");
            let docs = render_markdown(&match docs.find("\n\n") {
                Some(index) => docs[..index].to_owned(),
                _ => docs,
            });
            DefChild {
                id: id,
                signature: sig,
                doc_summary: docs,
            }
        }).map_err(|_| format!("No children for {}", id))?;

        Ok(DefSummary {
            id: id,
            bread_crumbs: bread_crumbs,
            signature: sig,
            doc_summary: render_markdown(&doc_summary),
            doc_rest: render_markdown(&doc_rest),
            parent: def.parent.unwrap_or(0),
            children: children,
        })
    }
}

fn compute_new_lines(plain_text: &str) -> Vec<usize> {
    let bytes = plain_text.as_bytes();
    let mut new_lines = vec![];
    new_lines.push(0);
    for (i, c) in bytes.iter().enumerate() {
        if *c == '\n' as u8 {
            new_lines.push(i + 1);
        }
    }
    new_lines.push(bytes.len() + 1);
    new_lines
}

fn partition<T, F>(input: &[T], f: F) -> Vec<&[T]>
    where F: Fn(&T, &T) -> bool
{
    if input.len() <= 1 {
        return vec![input];
    }

    let mut result = vec![];
    let mut last = &input[0];
    let mut last_index = 0;
    for (i, x) in input[1..].iter().enumerate() {
        if !f(last, x) {
            result.push(&input[last_index..(i+1)]);
            last = x;
            last_index = i + 1;
        }
    }
    if last_index < input.len() {
        result.push(&input[last_index..input.len()]);
    }
    result
}

#[cfg(test)]
mod test {
    use super:: partition;

    #[test]
    fn test_partition() {
        let input: Vec<i32> = vec![];
        let result = partition(&input, |a, b| a == b);
        assert!(result == vec![&[]]);

        let input: Vec<i32> = vec![1, 1, 1];
        let result = partition(&input, |a, b| a == b);
        assert!(result == vec![&[1, 1, 1]]);

        let input: Vec<i32> = vec![1, 1, 1, 2, 5, 5];
        let result = partition(&input, |a, b| a == b);
        let a: &[_] = &[1, 1, 1];
        let b: &[_] = &[2];
        let c: &[_] = &[5, 5];
        assert!(result == vec![a, b, c]);
    }
}
