// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// FIXME this all needs *lots* of optimisation.

use build;

use std::collections::HashMap;
use syntax::codemap::Loc;

#[derive(Debug)]
pub struct Analysis {
    // This only has fixed titles, not ones which use a ref.
    titles: HashMap<Span, String>,
    // Unique identifiers for identifiers with the same def (including the def).
    class_ids: HashMap<Span, u32>,
    defs: HashMap<u32, build::Def>,
    def_names: HashMap<String, Vec<u32>>,
    refs: HashMap<Span, u32>,
    ref_spans: HashMap<u32, Vec<Span>>,
}

#[derive(Debug, Clone, Hash, Ord, PartialOrd, Eq, PartialEq)]
pub struct Span {
    // NOte the ordering of fields for the Ord impl.
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

    pub fn from_build(build: Vec<build::Analysis>) -> Analysis {
        if build.is_empty() {
            return Analysis::new();
        }

        let mut titles = HashMap::new();
        let mut class_ids = HashMap::new();
        let mut defs = HashMap::new();
        let mut def_names = HashMap::new();
        let mut refs = HashMap::new();
        let mut ref_spans = HashMap::new();

        // TODO multi-crate - need to normalise IDs
        let mut build = build;
        let crate0 = build.remove(0);

        for i in crate0.imports {
            titles.insert(Span::from_build(&i.span), i.value);
        }
        for d in crate0.defs {
            let span = Span::from_build(&d.span);
            if !d.value.is_empty() {
                titles.insert(span.clone(), d.value.clone());
            }
            let id = d.id.index;
            if id != NULL {
                class_ids.insert(span, id);
                def_names.entry(d.name.clone()).or_insert_with(|| vec![]).push(id);
                defs.insert(id, d);
            }
        }
        for r in crate0.refs {
            let id = r.ref_id.index;
            if id != NULL && defs.contains_key(&id) {
                let span = Span::from_build(&r.span);
                // TODO class_ids = refs + defs.keys
                class_ids.insert(span.clone(), id);
                refs.insert(span.clone(), id);
                ref_spans.entry(id).or_insert_with(|| vec![]).push(span);
            }
        }

        Analysis {
            titles: titles,
            class_ids: class_ids,
            defs: defs,
            def_names: def_names,
            refs: refs,
            ref_spans: ref_spans,
        }
    }

    pub fn lookup_def_ids(&self, name: &str) -> Option<&Vec<u32>> {
        self.def_names.get(name)
    }

    pub fn lookup_def(&self, id: u32) -> &build::Def {
        &self.defs[&id]
    }

    pub fn lookup_refs(&self, id: u32) -> &[Span] {
        &self.ref_spans[&id]
    }

    pub fn get_title(&self, lo: &Loc, hi: &Loc) -> Option<&str> {
        let span = Span {
            file_name: lo.file.name.clone(),
            line_start: lo.line as usize,
            column_start: lo.col.0 as usize + 1,
            line_end: hi.line as usize,
            column_end: hi.col.0 as usize + 1,
        };
        self.refs.get(&span).and_then(|id| self.defs.get(id).map(|def| &*def.value))
    }

    pub fn get_class_id(&self, lo: &Loc, hi: &Loc) -> Option<u32> {
        let span = Span {
            file_name: lo.file.name.clone(),
            line_start: lo.line as usize,
            column_start: lo.col.0 as usize + 1,
            line_end: hi.line as usize,
            column_end: hi.col.0 as usize + 1,
        };
        self.class_ids.get(&span).map(|i| *i)
    }

    pub fn get_link(&self, lo: &Loc, hi: &Loc) -> Option<String> {
        let span = Span {
            file_name: lo.file.name.clone(),
            line_start: lo.line as usize,
            column_start: lo.col.0 as usize + 1,
            line_end: hi.line as usize,
            column_end: hi.col.0 as usize + 1,
        };
        self.refs.get(&span).and_then(|id| self.defs.get(id)).map(|def| {
            let s = &def.span;
            format!("{}:{}:{}:{}:{}", s.file_name, s.line_start, s.column_start, s.line_end, s.column_end)
        })
    }
}

// Used to indicate a missing index in the Id.
const NULL: u32 = u32::max_value();

impl Span {
    pub fn from_build(build: &build::SpanData) -> Span {
        Span {
            file_name: build.file_name.clone(),
            line_start: build.line_start,
            column_start: build.column_start,
            line_end: build.line_end,
            column_end: build.column_end,
        }
    }
}
