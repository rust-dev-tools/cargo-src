// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::path::{Path, PathBuf};
use std::fmt::Display;
use std::fs::File;
use std::io::{self, Read, Write, BufWriter};
use std::str;

use rustdoc::html::highlight::{self, Classifier, Class};
use syntax::parse;
use syntax::parse::lexer::{self, TokenAndSpan};
use syntax::codemap::CodeMap;

use analysis::{Analysis, Span};
use build;

// TODO maximum size and evication policy
// TODO keep timestamps and check on every read. Then don't empty on build.

pub struct Cache {
    files: FileCache,
    pub analysis: Analysis,
}

struct FileCache {
    files: HashMap<PathBuf, CachedFile>,
    size: usize,
}

#[derive(Serialize, Debug, Clone)]
pub struct DirectoryListing {
    pub path: Vec<String>,
    pub files: Vec<Listing>,
}

#[derive(Serialize, Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct Listing {
    pub kind: ListingKind,
    pub name: String,
}

#[derive(Serialize, Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub enum ListingKind {
    Directory,
    File,
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
            line_start: span.line_start,
            column_start: span.column_start,
            column_end: span.column_end,
            line: line,
        }
    }
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
            analysis: Analysis::new(),
        }
    }

    pub fn reset(&mut self) {
        self.files.reset();
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
        let text = FileCache::get_string(file)?;
        Ok(&text[line_start..line_end])
    }

    // TODO handle non-rs files by returning plain text lines
    pub fn get_highlighted(&mut self, path: &Path) -> Result<&[String], String> {
        let file_name = path.to_str().unwrap().to_owned();
        let file = self.files.get(path)?;
        if file.highlighted_lines.is_empty() {
            let highlighted = Cache::highlight(&self.analysis, file_name, FileCache::get_string(file)?.to_owned());

            for line in highlighted.lines() {
                file.highlighted_lines.push(line.replace("<br>", "\n"));
            }
            if file.plain_text.ends_with(&['\n' as u8]) {
                file.highlighted_lines.push(String::new());
            }
        }
        Ok(&file.highlighted_lines)
    }

    // line is 1-indexed
    pub fn get_highlighted_line(&mut self, file_name: &str, line: usize) -> Result<String, String> {
        let lines = self.get_highlighted(Path::new(file_name))?;
        Ok(lines[line - 1].clone())
    }

    pub fn update_analysis(&mut self, analysis: Vec<build::Analysis>) {
        // FIXME Possibly extreme, could invalidate by crate or by file. Also, only
        // need to invalidate Rust files.
        self.files.reset();

        println!("Processing analysis...");
        self.analysis = Analysis::from_build(analysis);
        println!("done");
    }

    pub fn id_search(&mut self, id: u32) -> Result<SearchResult, String> {
        self.ids_search(vec![id])
    }

    pub fn ident_search(&mut self, needle: &str) -> Result<SearchResult, String> {
        // First see if the needle corresponds to any definitions, if it does, get a list of the
        // ids, otherwise, return an empty search result.
        let ids = match self.analysis.lookup_def_ids(needle) {
            Some(ids) => ids.to_owned(),
            None => {
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
        let mut spans = self.analysis.get_spans(id);
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
            let span = self.analysis.lookup_def(id).span.clone();
            let text = self.get_highlighted_line(&span.file_name, span.line_start)?;
            let line = LineResult::new(&Span::from_build(&span), text);
            defs.entry(span.file_name).or_insert_with(|| vec![]).push(line);

            let rfs = self.analysis.lookup_refs(id).to_owned();
            for rf in rfs.into_iter() {
                let text = self.get_highlighted_line(&rf.file_name, rf.line_start)?;
                let line = LineResult::new(&rf, text);
                refs.entry(rf.file_name).or_insert_with(|| vec![]).push(line);
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
            for (file_name, mut lines) in bucket.into_iter() {
                lines.sort();
                let per_file = FileResult {
                    file_name: file_name.to_owned(),
                    lines: lines,
                };
                list.push(per_file);
            }
            list.sort();
            list
        }
    }

    fn highlight(analysis: &Analysis, file_name: String, file_text: String) -> String {
        let sess = parse::ParseSess::new();
        let fm = sess.codemap().new_filemap(file_name, None, file_text);

        let mut out = Highlighter::new(analysis, sess.codemap());
        let mut classifier = Classifier::new(lexer::StringReader::new(&sess.span_diagnostic, fm),
                                             sess.codemap());
        classifier.write_source(&mut out).unwrap();

        String::from_utf8_lossy(&out.buf).into_owned()
    }
}

impl FileCache {
    fn new() -> FileCache {
        FileCache {
            files: HashMap::new(),
            size: 0,
        }
    }

    fn reset(&mut self) {
        self.files = HashMap::new();
        self.size = 0;
    }

    fn reset_file(&mut self, path: &Path) {
        if self.files.remove(path).is_some() {
            self.size -= 1;
        }
    }

    fn get_string(file: &mut CachedFile) -> Result<&str, String> {
        Ok(str::from_utf8(&file.plain_text).unwrap())
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
        match self.files.entry(path.to_owned()) {
            Entry::Occupied(oe) => {
                Ok(oe.into_mut())
            }
            Entry::Vacant(ve) => {
                let text = FileCache::read_file(path)?;
                if text.is_empty() {
                    Err(format!("Empty file {}", path.display()))
                } else {
                    self.size += text.len();
                    Ok(ve.insert(CachedFile::new(text)))
                }
            }
        }
    }

    fn read_file(path: &Path) -> Result<Vec<u8>, String> {
        match File::open(&path) {
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

impl DirectoryListing {
    pub fn from_path(path: &Path) -> Result<DirectoryListing, String> {
        let mut files = vec![];
        let dir = match path.read_dir() {
            Ok(d) => d,
            Err(s) => return Err(s.to_string()),
        };
        for entry in dir {
            if let Ok(entry) = entry {
                let name = entry.file_name().to_str().unwrap().to_owned();
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        files.push(Listing { kind: ListingKind::Directory, name: name });
                    } else if file_type.is_file() {
                        files.push(Listing { kind: ListingKind::File, name: name });
                    }
                }
            }
        }

        files.sort();

        Ok(DirectoryListing {
            path: path.components().map(|c| c.as_os_str().to_str().unwrap().to_owned()).collect(),
            files: files,
        })
    }
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
