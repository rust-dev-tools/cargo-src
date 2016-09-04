// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// FIXME this whole module all needs *lots* of optimisation.

mod raw;
mod lowering;

pub use self::raw::Target;
use std::collections::HashMap;
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
            lowering::lower_span(&def.span)
        }).ok_or(()))
    }

    pub fn show_type(&self, span: &Span) -> Result<String, ()> {
        self.read(|a| a.titles.get(&span).map(|s| &**s).or_else(|| a.refs.get(&span).and_then(|id| a.defs.get(id).map(|def| &*def.value))).map(|s| s.to_owned()).ok_or(()))
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

#[derive(Debug)]
pub struct Analysis {
    // This only has fixed titles, not ones which use a ref.
    titles: HashMap<Span, String>,
    // Unique identifiers for identifiers with the same def (including the def).
    class_ids: HashMap<Span, u32>,
    defs: HashMap<u32, raw::Def>,
    def_names: HashMap<String, Vec<u32>>,
    refs: HashMap<Span, u32>,
    ref_spans: HashMap<u32, Vec<Span>>,
}

#[derive(Debug, Clone, Hash, Ord, PartialOrd, Eq, PartialEq, Deserialize, RustcDecodable, RustcEncodable)]
pub struct Span {
    // Note the ordering of fields for the Ord impl.
    pub file_name: String,
    pub line_start: usize,
    pub column_start: usize,
    pub line_end: usize,
    pub column_end: usize,
}

impl Analysis {
    pub fn new() -> Analysis {
        Analysis {
            titles: HashMap::new(),
            class_ids: HashMap::new(),
            defs: HashMap::new(),
            def_names: HashMap::new(),
            refs: HashMap::new(),
            ref_spans: HashMap::new(),
        }
    }

    pub fn read(path_prefix: &str, target: Target) -> Analysis {
        let raw_analysis = raw::Analysis::read(path_prefix, target);
        lowering::lower(raw_analysis)
    }

    pub fn lookup_def_ids(&self, name: &str) -> Option<&Vec<u32>> {
        self.def_names.get(name)
    }

    fn lookup_def(&self, id: u32) -> &raw::Def {
        &self.defs[&id]
    }

    pub fn lookup_def_span(&self, id: u32) -> Span {
        lowering::lower_span(&self.defs[&id].span)
    }

    pub fn lookup_refs(&self, id: u32) -> &[Span] {
        &self.ref_spans[&id]
    }

    pub fn get_spans(&self, id: u32) -> Vec<Span> {
        let mut result = self.lookup_refs(id).to_owned();
        // TODO what if lookup_def panics
        result.push(lowering::lower_span(&self.lookup_def(id).span));
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
