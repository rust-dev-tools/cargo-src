// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use cargo_metadata;
use std::collections::HashMap;
use std::env;
use std::path::{Path, PathBuf};
use std::str;
use std::sync::Arc;

use analysis::{AnalysisHost, Id, Target};
use config::Config;
use span;
use vfs::Vfs;

use super::highlight;

// FIXME maximum size and evication policy
// FIXME keep timestamps and check on every read. Then don't empty on build.

mod results;
use file_controller::results::{
    DefResult, FileResult, FindResult, LineResult, SearchResult, SymbolResult, CONTEXT_SIZE,
};

pub struct Cache {
    config: Arc<Config>,
    files: Vfs<VfsUserData>,
    analysis: AnalysisHost,
    project_dir: PathBuf,
}

type Span = span::Span<span::ZeroIndexed>;

#[derive(Debug, Clone)]
pub struct Highlighted {
    pub source: Option<Vec<String>>,
    pub rendered: Option<String>,
}

// Our data which we attach to files in the VFS.
struct VfsUserData {
    highlighted: Option<Highlighted>,
}

impl VfsUserData {
    fn new() -> Self {
        VfsUserData { highlighted: None }
    }
}

macro_rules! vfs_err {
    ($e:expr) => {{
        let r: Result<_, String> = $e.map_err(|e| e.into());
        r
    }};
}

impl Cache {
    pub fn new(config: Arc<Config>) -> Cache {
        Cache {
            config,
            files: Vfs::new(),
            analysis: AnalysisHost::new(Target::Debug),
            project_dir: env::current_dir().unwrap(),
        }
    }

    pub fn get_lines(
        &self,
        path: &Path,
        line_start: span::Row<span::ZeroIndexed>,
        line_end: span::Row<span::ZeroIndexed>,
    ) -> Result<String, String> {
        vfs_err!(self.files.load_file(path))?;
        vfs_err!(self.files.load_lines(path, line_start, line_end))
    }

    pub fn get_highlighted(&self, path: &Path) -> Result<Highlighted, String> {
        fn raw_lines(text: &str) -> Vec<String> {
            let mut highlighted: Vec<String> = text.lines().map(|s| s.to_owned()).collect();
            if text.ends_with('\n') {
                highlighted.push(String::new());
            }

            highlighted
        }

        vfs_err!(self.files.load_file(path))?;
        vfs_err!(
            self.files
                .ensure_user_data(path, |_| Ok(VfsUserData::new()))
        )?;
        vfs_err!(self.files.with_user_data(path, |u| {
            let (text, u) = u?;

            if u.highlighted.is_none() {
                if let Some(ext) = path.extension() {
                    if ext == "rs" {
                        let text = match text {
                            Some(t) => t,
                            None => return Err(::vfs::Error::BadFileKind),
                        };

                        let highlighted = highlight::highlight(
                            &self.analysis,
                            &self.project_dir,
                            path.to_str().unwrap().to_owned(),
                            text.to_owned(),
                        );

                        let mut highlighted = highlighted
                            .lines()
                            .map(|line| line.replace("<br>", "\n"))
                            .collect::<Vec<_>>();

                        if text.ends_with('\n') {
                            highlighted.push(String::new());
                        }

                        u.highlighted = Some(Highlighted {
                            source: Some(highlighted),
                            rendered: None,
                        });
                    } else if ext == "md" || ext == "markdown" {
                        let text = match text {
                            Some(t) => t,
                            None => return Err(::vfs::Error::BadFileKind),
                        };

                        u.highlighted = Some(Highlighted {
                            rendered: Some(::comrak::markdown_to_html(text, &Default::default())),
                            source: Some(raw_lines(text)),
                        });
                    } else if ext == "png"
                        || ext == "jpg"
                        || ext == "jpeg"
                        || ext == "gif"
                        || ext == "ico"
                        || ext == "svg"
                        || ext == "apng"
                        || ext == "bmp"
                    {
                        if let Ok(path) = path.strip_prefix(&self.project_dir) {
                            u.highlighted = Some(Highlighted {
                                source: None,
                                rendered: Some(format!(
                                    r#"<img src="/raw/{}"/>"#,
                                    &*path.to_string_lossy()
                                )),
                            });
                        }
                    }
                }

                // Don't try to highlight non-Rust files (and cope with highlighting failure).
                if u.highlighted.is_none() {
                    let text = match text {
                        Some(t) => t,
                        None => return Err(::vfs::Error::BadFileKind.into()),
                    };

                    u.highlighted = Some(Highlighted {
                        source: Some(raw_lines(text)),
                        rendered: None,
                    });
                }
            }

            Ok(u.highlighted.clone().unwrap())
        }))
    }

    pub fn update_analysis(&self) {
        println!("Processing analysis...");
        let workspace_root = self
            .config
            .workspace_root
            .as_ref()
            .map(|s| Path::new(s).to_owned())
            .unwrap_or(self.project_dir.clone());
        self.analysis
            .reload_with_blacklist(
                &self.project_dir,
                &workspace_root,
                &::blacklist::CRATE_BLACKLIST,
            )
            .unwrap();

        // FIXME Possibly extreme, could invalidate by crate or by file. Also, only
        // need to invalidate Rust files.
        self.files.clear();

        println!("done");
    }

    // FIXME we should cache this information rather than compute every time.
    pub fn get_symbol_roots(&self) -> Result<Vec<SymbolResult>, String> {
        let all_crates = self
            .analysis
            .def_roots()
            .unwrap_or_else(|_| vec![])
            .into_iter()
            .filter_map(|(id, name)| {
                let span = self.analysis.get_def(id).ok()?.span;
                Some(SymbolResult {
                    id: id.to_string(),
                    name,
                    file_name: self.make_file_path(&span).display().to_string(),
                    line_start: span.range.row_start.one_indexed().0,
                })
            });

        // FIXME Unclear ot sure if we should include dep crates or not here.
        // Need to test on workspace crates. Might be nice to have deps in any
        // case, in which case we should return the primary crate(s) first.
        let metadata = match cargo_metadata::metadata_deps(None, false) {
            Ok(metadata) => metadata,
            Err(_) => return Err("Could not access cargo metadata".to_owned()),
        };

        let names: Vec<String> = metadata.packages.into_iter().map(|p| p.name).collect();

        Ok(all_crates.filter(|sr| names.contains(&sr.name)).collect())
    }

    // FIXME we should indicate whether the symbol has children or not
    pub fn get_symbol_children(&self, id: Id) -> Result<Vec<SymbolResult>, String> {
        self.analysis
            .for_each_child_def(id, |id, def| {
                let span = &def.span;
                SymbolResult {
                    id: id.to_string(),
                    name: def.name.clone(),
                    file_name: self.make_file_path(&span).display().to_string(),
                    line_start: span.range.row_start.one_indexed().0,
                }
            })
            .map_err(|e| e.to_string())
    }

    pub fn id_search(&self, id: Id) -> Result<SearchResult, String> {
        self.ids_search(vec![id])
    }

    pub fn ident_search(&self, needle: &str) -> Result<SearchResult, String> {
        // First see if the needle corresponds to any definitions, if it does, get a list of the
        // ids, otherwise, return an empty search result.
        let ids = match self.analysis.search_for_id(needle) {
            Ok(ids) => ids.to_owned(),
            Err(_) => {
                return Ok(SearchResult { defs: vec![] });
            }
        };

        self.ids_search(ids)
    }

    pub fn find_impls(&self, id: Id) -> Result<FindResult, String> {
        let impls = self
            .analysis
            .find_impls(id)
            .map_err(|_| "No impls found".to_owned())?;
        Ok(FindResult {
            results: self.make_search_results(impls)?,
        })
    }

    fn ids_search(&self, ids: Vec<Id>) -> Result<SearchResult, String> {
        let mut defs = Vec::new();

        for id in ids {
            // If all_refs.len() > 0, the first entry will be the def.
            let all_refs = self.analysis.find_all_refs_by_id(id);
            let mut all_refs = match all_refs {
                Err(_) => return Err("Error finding references".to_owned()),
                Ok(ref all_refs) if all_refs.is_empty() => continue,
                Ok(all_refs) => all_refs.into_iter(),
            };

            let def_span = all_refs.next().unwrap();
            let def_path = self.make_file_path(&def_span);
            let line = self.make_line_result(&def_path, &def_span)?;

            defs.push(DefResult {
                file: def_path.display().to_string(),
                line,
                refs: self.make_search_results(all_refs.collect())?,
            });
        }

        // We then save each bucket of defs/refs as a vec, and put it together to return.
        return Ok(SearchResult { defs });
    }

    fn make_file_path(&self, span: &Span) -> PathBuf {
        let file_path = Path::new(&span.file);
        file_path
            .strip_prefix(&self.project_dir)
            .unwrap_or(file_path)
            .to_owned()
    }

    fn make_line_result(&self, file_path: &Path, span: &Span) -> Result<LineResult, String> {
        let (text, pre, post) = match self.get_highlighted(file_path) {
            Ok(Highlighted {
                source: Some(lines),
                ..
            }) => {
                let line = span.range.row_start.0 as i32;
                let text = lines[line as usize].clone();

                let mut ctx_start = line - CONTEXT_SIZE;
                if ctx_start < 0 {
                    ctx_start = 0;
                }
                let mut ctx_end = line + CONTEXT_SIZE;
                if ctx_end >= lines.len() as i32 {
                    ctx_end = lines.len() as i32 - 1;
                }
                let pre = lines[ctx_start as usize..line as usize].join("\n");
                let post = lines[line as usize + 1..=ctx_end as usize].join("\n");

                (text, pre, post)
            }
            Ok(_) => return Err(format!("Not a text file: {}", &*file_path.to_string_lossy())),
            Err(_) => return Err(format!("Error finding text for {:?}", span)),
        };
        Ok(LineResult::new(span, text, pre, post))
    }

    pub fn get_raw(&self, path: &Path) -> Result<::vfs::FileContents, ::vfs::Error> {
        self.files.load_file(path)
    }

    // Sorts a set of search results into buckets by file.
    fn make_search_results(&self, raw: Vec<Span>) -> Result<Vec<FileResult>, String> {
        let mut file_buckets = HashMap::new();

        for span in &raw {
            let file_path = self.make_file_path(span);
            let line = match self.make_line_result(&file_path, span) {
                Ok(l) => l,
                Err(_) => continue,
            };
            file_buckets
                .entry(file_path.display().to_string())
                .or_insert_with(|| vec![])
                .push(line);
        }

        let mut result = vec![];
        for (file_path, mut lines) in file_buckets.into_iter() {
            lines.sort();
            let per_file = FileResult {
                file_name: file_path,
                lines: lines,
            };
            result.push(per_file);
        }
        result.sort();
        Ok(result)
    }
}
