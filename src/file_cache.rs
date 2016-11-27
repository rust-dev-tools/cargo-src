// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::env;
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::{Read, Write, BufWriter};
use std::str;

use analysis::{AnalysisHost, Span, Target};
use rustdoc::html::markdown;

use super::highlight;

// TODO maximum size and evication policy
// TODO keep timestamps and check on every read. Then don't empty on build.

pub struct Cache {
    files: FileCache,
    summaries: HashMap<u32, DefSummary>,
    analysis: AnalysisHost,
    project_dir: PathBuf,
}

struct FileCache {
    files: HashMap<PathBuf, CachedFile>,
}

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
    pub line_start: usize,
    pub column_start: usize,
    pub column_end: usize,
    pub line: String,
}

impl LineResult {
    fn new(span: &Span, line: String) -> LineResult {
        LineResult {
            line_start: span.line_start + 1,
            column_start: span.column_start + 1,
            column_end: span.column_end + 1,
            line: line,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct DefSummary {
    id: u32,
    bread_crumbs: Vec<BreadCrumb>,
    signature: String,
    doc_summary: String,
    doc_rest: String,
    children: Vec<DefChild>,
}

#[derive(Serialize, Debug, Clone)]
pub struct BreadCrumb {
    id: u32,
    name: String,
}

impl From<(u32, String)> for BreadCrumb {
    fn from((id, name): (u32, String)) -> BreadCrumb {
        BreadCrumb {
            id: id,
            name: name,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct DefChild {
    id: u32,
    signature: String,
    doc_summary: String,
}

struct CachedFile {
    plain_text: Vec<u8>,
    highlighted_lines: Vec<String>,
    new_lines: Vec<usize>,
}

impl Cache {
    pub fn new() -> Cache {
        Cache {
            files: FileCache::new(),
            summaries: HashMap::new(),
            analysis: AnalysisHost::new(Target::Debug),
            project_dir: env::current_dir().unwrap(),
        }
    }

    pub fn reset(&mut self) {
        self.files.reset();
        self.summaries = HashMap::new();
    }

    pub fn reset_file(&mut self, path: &Path) {
        self.files.reset_file(path);
    }

    pub fn get_text(&mut self, path: &Path) -> Result<&[u8], String> {
        Ok(&self.files.get(path)?.plain_text)
    }

    pub fn get_line_count(&mut self, path: &Path) -> Result<usize, String> {
        let file = self.files.get(path)?;
        if file.new_lines.is_empty() {
            FileCache::compute_new_lines(file);
        }

        Ok(file.new_lines.len())
    }

    pub fn get_lines(&mut self, path: &Path, line_start: usize, line_end: usize) -> Result<&str, String> {
        let file = self.files.get(path)?;
        if file.new_lines.is_empty() {
            FileCache::compute_new_lines(file);
        }

        let line_start = file.new_lines[line_start];
        let line_end = file.new_lines[line_end] - 1;
        let text = FileCache::get_string(file);
        Ok(&text[line_start..line_end])
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
    pub fn get_highlighted(&mut self, path: &Path) -> Result<&[String], String> {
        let file_name = path.to_str().unwrap().to_owned();
        let file = self.files.get(path)?;
        if file.highlighted_lines.is_empty() {
            let highlighted = highlight::highlight(&self.analysis, &self.project_dir, file_name, FileCache::get_string(file).to_owned());

            for line in highlighted.lines() {
                file.highlighted_lines.push(line.replace("<br>", "\n"));
            }
            if file.plain_text.ends_with(&['\n' as u8]) {
                file.highlighted_lines.push(String::new());
            }
        }
        Ok(&file.highlighted_lines)
    }

    // line is 0-indexed
    pub fn get_highlighted_line(&mut self, file_name: &Path, line: usize) -> Result<String, String> {
        let lines = self.get_highlighted(Path::new(file_name))?;
        Ok(lines[line].clone())
    }

    pub fn update_analysis(&mut self) {
        // FIXME Possibly extreme, could invalidate by crate or by file. Also, only
        // need to invalidate Rust files.
        self.files.reset();

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

        let by_file = partition(&spans, |a, b| a.file_name == b.file_name);
        for file_bucket in by_file {
            let file_name = &file_bucket[0].file_name;
            let file_path = &Path::new(file_name);
            {
                let file = self.files.get(file_path)?;
                if file.new_lines.is_empty() {
                    FileCache::compute_new_lines(file);
                }
                let file_str = str::from_utf8(&file.plain_text).unwrap();

                // TODO should do a two-step file write here.
                let out_file = File::create(&file_name).unwrap();
                let mut writer = BufWriter::new(out_file);

                let mut last = 0;
                let mut next_index = 0;
                // TODO off by one error for line number
                let mut next_line = file_bucket[next_index].line_start;
                for (i, &line_end) in file.new_lines.iter().enumerate().skip(1) {
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
                            assert!(file_bucket[next_index].line_end == file_bucket[next_index].line_start, "Can't handle multi-line idents for replacement");
                            // TODO WRONG using char offsets for byte offsets
                            writer.write(line_str[last_char..(file_bucket[next_index].column_start - 1)].as_bytes()).unwrap();
                            writer.write(new_bytes).unwrap();

                            last_char = file_bucket[next_index].column_end - 1;
                            next_index += 1;
                            if next_index >= file_bucket.len() {
                                next_line = 0;
                                break;
                            }
                            next_line = file_bucket[next_index].line_start;
                        }
                        writer.write(line_str[last_char..].as_bytes()).unwrap();
                    } else {
                        // Nothing to replace.
                        writer.write(line_str.as_bytes()).unwrap();
                    }

                    last = line_end;
                }
            }

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
            let file_path = Path::new(&def_span.file_name);
            let file_path = file_path.strip_prefix(&project_dir).unwrap_or(file_path);
            let def_text = self.get_highlighted_line(&file_path, def_span.line_start)?;
            let def_line = LineResult::new(&def_span, def_text);
            defs.entry(file_path.display().to_string()).or_insert_with(|| vec![]).push(def_line);

            for ref_span in all_refs {
                let project_dir = self.project_dir.clone();
                let file_path = Path::new(&ref_span.file_name);
                let file_path = file_path.strip_prefix(&project_dir).unwrap_or(file_path);
                let text = self.get_highlighted_line(&file_path, ref_span.line_start)?;
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

        // TODO (also see rustw.js)
        // signature for fields - refs
        // ident (frontend)/defs/refs for sigs
        // signatures for everything else

        let def = self.analysis.get_def(id).map_err(|_| format!("No def for {}", id))?;

        let docs = def.docs;
        let (doc_summary, doc_rest) = match docs.find("\n\n") {
            Some(index) => (docs[..index].to_owned(), docs[index + 2..].to_owned()),
            _ => (docs, String::new()),
        };

        let sig = match def.sig {
            Some(sig) => {
                let mut h = highlight::BasicHighlighter::new();
                h.span(sig.ident_start, sig.ident_end, "summary_def".to_owned(), format!("def_{}", id));
                highlight::custom_highlight(def.span.file_name.to_str().unwrap().to_owned(), sig.text, &mut h)
            }
            None => def.name,
        };

        let children = self.analysis.for_each_child_def(id, |id, def| {
            let docs = def.docs.to_owned();
            let sig = def.sig.as_ref().map(|s| {
                let mut h = highlight::BasicHighlighter::new();
                highlight::custom_highlight(def.span.file_name.to_str().unwrap().to_owned(), s.text.clone(), &mut h)
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
            // FIXME needs crate bread-crumb - needs a change to save-analysis to emit a top-level module: https://github.com/rust-lang/rust/issues/37818
            bread_crumbs: self.analysis.def_parents(id).unwrap_or(vec![]).into_iter().map(BreadCrumb::from).collect(),
            signature: sig,
            doc_summary: render_markdown(&doc_summary),
            doc_rest: render_markdown(&doc_rest),
            children: children,
        })
    }
}

impl FileCache {
    fn new() -> FileCache {
        FileCache {
            files: HashMap::new(),
        }
    }

    fn reset(&mut self) {
        self.files = HashMap::new();
    }

    fn reset_file(&mut self, path: &Path) {
        self.files.remove(&path.canonicalize().unwrap());
    }

    fn get_string(file: &mut CachedFile) -> &str {
        str::from_utf8(&file.plain_text).unwrap()
    }

    fn compute_new_lines(file: &mut CachedFile) {
        assert!(file.new_lines.is_empty());

        let mut new_lines = vec![];
        new_lines.push(0);
        for (i, c) in file.plain_text.iter().enumerate() {
            if *c == '\n' as u8 {
                new_lines.push(i + 1);
            }
        }
        new_lines.push(file.plain_text.len() + 1);
        file.new_lines = new_lines;
    }

    fn get(&mut self, path: &Path) -> Result<&mut CachedFile, String> {
        // Annoying that we have to clone here :-(
        match self.files.entry(path.canonicalize().expect(&format!("Bad path?: {}", path.display()))) {
            Entry::Occupied(oe) => {
                Ok(oe.into_mut())
            }
            Entry::Vacant(ve) => {
                let text = FileCache::read_file(path)?;
                if text.is_empty() {
                    Err(format!("Empty file {}", path.display()))
                } else {
                    Ok(ve.insert(CachedFile::new(text)))
                }
            }
        }
    }

    fn read_file(path: &Path) -> Result<Vec<u8>, String> {
        match File::open(path) {
            Ok(mut file) => {
                let mut buf = Vec::new();
                file.read_to_end(&mut buf).unwrap();
                Ok(buf)
            }
            Err(msg) => {
                Err(format!("Error opening file: `{}`; {}", path.to_str().unwrap(), msg))
            }
        }
    }
}

impl CachedFile {
    fn new(text: Vec<u8>) -> CachedFile {
        CachedFile {
            plain_text: text,
            highlighted_lines: vec![],
            new_lines: vec![],
        }
    }
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
