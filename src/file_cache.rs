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
use std::fs::File;
use std::io::Read;
use std::str;

use rustdoc::html::highlight;

// TODO maximum size and evication policy
// TODO keep timestamps and check on every read. Then don't empty on build.

pub struct Cache {
    files: HashMap<PathBuf, CachedFile>,
    size: usize,
}

#[derive(Serialize, Debug, Clone)]
pub struct DirectoryListing {
    pub path: Vec<String>,
    pub files: Vec<Listing>,
}

#[derive(Serialize, Debug, Clone)]
pub struct Listing {
    kind: ListingKind,
    name: String,
}

#[derive(Serialize, Debug, Clone)]
pub enum ListingKind {
    File,
    Directory,
}

struct CachedFile {
    plain_text: Vec<u8>,
    highlighted_lines: Vec<String>,
    new_lines: Vec<usize>,
}

impl Cache {
    pub fn new() -> Cache {
        Cache {
            files: HashMap::new(),
            size: 0,
        }
    }

    pub fn reset(&mut self) {
        self.files = HashMap::new();
        self.size = 0;
    }

    pub fn get_text(&mut self, path: &Path) -> Result<&[u8], String> {
        Ok(&self.get(path)?.plain_text)
    }

    pub fn get_lines(&mut self, path: &Path, line_start: usize, line_end: usize) -> Result<&str, String> {
        let file = self.get(path)?;
        if file.new_lines.is_empty() {
            Cache::compute_new_lines(file);
        }

        let line_start = file.new_lines[line_start];
        let line_end = file.new_lines[line_end] - 1;
        let text = Cache::get_string(file)?;
        Ok(&text[line_start..line_end])
    }

    // TODO handle non-rs files by returning plain text lines
    pub fn get_highlighted(&mut self, path: &Path) -> Result<&[String], String> {
        let file = self.get(path)?;
        if file.highlighted_lines.is_empty() {
            let highlighted = highlight::render_inner_with_highlighting(Cache::get_string(file)?);

            for line in highlighted.lines() {
                file.highlighted_lines.push(line.to_owned());
            }
            if file.plain_text.ends_with(&['\n' as u8]) {
                file.highlighted_lines.push(String::new());
            }
        }
        Ok(&file.highlighted_lines)
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
                let text = Cache::read_file(path)?;
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

        // TODO order files
        Ok(DirectoryListing {
            path: path.components().map(|c| c.as_os_str().to_str().unwrap().to_owned()).collect(),
            files: files,
        })
    }
}
