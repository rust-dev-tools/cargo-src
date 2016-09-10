// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// FIXME this whole module all needs *lots* of optimisation.

pub mod raw;
mod lowering;

pub use self::raw::Target;
use std::collections::HashMap;
use std::env;
use std::sync::Mutex;
use syntax::codemap::Loc;

pub struct AnalysisHost {
    analysis: Mutex<Option<Analysis>>,
    path_prefix: String,
    target: Target,
}

impl AnalysisHost {
    pub fn new(path_prefix: &str, target: Target) -> AnalysisHost {
        AnalysisHost {
            analysis: Mutex::new(None),
            path_prefix: path_prefix.to_owned(),
            target: target,
        }
    }

    pub fn reload(&self) -> Result<(), ()> {
        let new_analysis = Analysis::read(&self.path_prefix, self.target);
        match self.analysis.lock() {
            Ok(mut a) => {
                *a = Some(new_analysis);
                Ok(())
            }
            Err(_) => Err(()),
        }
    }

    pub fn goto_def(&self, span: &Span) -> Result<Span, ()> {
        self.read(|a| a.refs.get(span).and_then(|id| a.defs.get(id)).map(|def| {
            lowering::lower_span(&def.span, Some(&a.project_dir))
        }).ok_or(()))
    }

    pub fn find_all_refs(&self, span: &Span) -> Result<Vec<Span>, ()> {
        self.read(|a| a.class_ids.get(span).and_then(|id| {
            let def = a.defs.get(id).map(|def| lowering::lower_span(&def.span, Some(&a.project_dir)));
            match a.ref_spans.get(id) {
                Some(refs) => Some(def.into_iter().chain(refs.iter().cloned()).collect()),
                None => def.map(|s| vec![s]),
            }
        }).ok_or(()))
    }

    pub fn show_type(&self, span: &Span) -> Result<String, ()> {
        self.read(|a| a.titles
                       .get(&span)
                       .map(|s| &**s)
                       .or_else(|| {
                           a.refs.get(&span).and_then(|id| {
                               a.defs.get(id).map(|def| &*def.value)
                           })
                       })
                       .map(|s| s.to_owned())
                       .ok_or(()))
    }

    pub fn docs(&self, span: &Span) -> Result<String, ()> {
        self.read(|a| a.class_ids.get(span).and_then(|id| {
            a.defs.get(id).map(|def| def.docs.to_owned())
        }).ok_or(()))
    }

    pub fn search(&self, name: &str) -> Result<Vec<Span>, ()> {
        self.read(|a| {
            a.def_names.get(name).map(|names| {
                names.into_iter().flat_map(|id| {
                    a.ref_spans.get(id).map_or(vec![], |v| v.clone()).into_iter()
                }).collect(): Vec<Span>
            }).ok_or(())
        })
    }

    pub fn symbols(&self, file_name: &str) -> Result<Vec<SymbolResult>, ()> {
        self.read(|a| {
            a.defs_per_file.get(file_name).map(|ids| ids.iter().map(|id| {
                let def = &a.defs[id];
                SymbolResult {
                    id: *id,
                    name: def.name.clone(),
                    span: lowering::lower_span(&def.span, Some(&a.project_dir)),
                    kind: def.kind.clone(),
                }
            }).collect()).ok_or(())
        })
    }

    fn read<F, T>(&self, f: F) -> Result<T, ()>
        where F: FnOnce(&Analysis) -> Result<T, ()>
    {
        match self.analysis.lock() {
            Ok(a) => {
                if let Some(ref a) = *a {
                    f(a)
                } else {
                    Err(())
                }
            }
            _ => Err(())
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SymbolResult {
    pub id: u32,
    pub name: String,
    pub kind: raw::DefKind,
    pub span: Span,
}

#[derive(Debug)]
pub struct Analysis {
    // This only has fixed titles, not ones which use a ref.
    // TODO not clear this is a good way to organise things tbh - use refs
    titles: HashMap<Span, String>,
    // Unique identifiers for identifiers with the same def (including the def).
    class_ids: HashMap<Span, u32>,
    defs: HashMap<u32, raw::Def>,
    defs_per_file: HashMap<String, Vec<u32>>,
    def_names: HashMap<String, Vec<u32>>,
    // we don't really need this and class_ids
    refs: HashMap<Span, u32>,
    ref_spans: HashMap<u32, Vec<Span>>,
    pub project_dir: String,
}

#[derive(Debug, Clone, Hash, Ord, PartialOrd, Eq, PartialEq, Serialize, Deserialize)]
pub struct Span {
    // Note the ordering of fields for the Ord impl.
    pub file_name: String,
    pub line_start: usize,
    pub column_start: usize,
    pub line_end: usize,
    pub column_end: usize,
}

impl Analysis {
    pub fn new(project_dir: &str) -> Analysis {
        Analysis {
            titles: HashMap::new(),
            class_ids: HashMap::new(),
            defs: HashMap::new(),
            defs_per_file: HashMap::new(),
            def_names: HashMap::new(),
            refs: HashMap::new(),
            ref_spans: HashMap::new(),
            project_dir: project_dir.to_owned(),
        }
    }

    pub fn read(path_prefix: &str, target: Target) -> Analysis {
        let raw_analysis = raw::Analysis::read(path_prefix, target);
        let project_dir = format!("{}/{}", env::current_dir().unwrap().display(), path_prefix);
        lowering::lower(raw_analysis, &project_dir)
    }

    pub fn lookup_def_ids(&self, name: &str) -> Option<&Vec<u32>> {
        self.def_names.get(name)
    }

    fn lookup_def(&self, id: u32) -> &raw::Def {
        &self.defs[&id]
    }

    pub fn lookup_def_span(&self, id: u32) -> Span {
        lowering::lower_span(&self.defs[&id].span, None)
    }

    pub fn lookup_refs(&self, id: u32) -> &[Span] {
        &self.ref_spans[&id]
    }

    pub fn get_spans(&self, id: u32) -> Vec<Span> {
        let mut result = self.lookup_refs(id).to_owned();
        // TODO what if lookup_def panics
        result.push(lowering::lower_span(&self.lookup_def(id).span, Some(&self.project_dir)));
        result
    }

    pub fn get_title(&self, lo: &Loc, hi: &Loc) -> Option<&str> {
        let span = Span::from_locs(lo, hi);
        self.titles.get(&span).map(|s| &**s).or_else(|| self.refs.get(&span).and_then(|id| self.defs.get(id).map(|def| &*def.value)))
    }

    pub fn get_class_id(&self, lo: &Loc, hi: &Loc) -> Option<u32> {
        let span = Span::from_locs(lo, hi);
        self.class_ids.get(&span).map(|i| *i)
    }

    pub fn get_link(&self, lo: &Loc, hi: &Loc) -> Option<String> {
        let span = Span::from_locs(lo, hi);
        self.refs.get(&span).and_then(|id| self.defs.get(id)).map(|def| {
            let s = &def.span;
            format!("{}:{}:{}:{}:{}", s.file_name, s.line_start, s.column_start, s.line_end, s.column_end)
        })
    }
}

impl Span {
    fn from_locs(lo: &Loc, hi: &Loc) -> Span {
        Span {
            file_name: lo.file.name.clone(),
            line_start: lo.line as usize,
            column_start: lo.col.0 as usize + 1,
            line_end: hi.line as usize,
            column_end: hi.col.0 as usize + 1,
        }
    }
}

// Used to indicate a missing index in the Id.
const NULL: u32 = u32::max_value();
