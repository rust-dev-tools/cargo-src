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

struct CrateReader {
    crate_map: Vec<u8>,
}

impl CrateReader {
    fn from_prelude(mut prelude: build::CratePreludeData, master_crate_map: &mut HashMap<String, u8>) -> CrateReader {
        // println!("building crate map for {}", prelude.crate_name);
        let next = master_crate_map.len() as u8;
        let mut crate_map = vec![*master_crate_map.entry(prelude.crate_name.clone()).or_insert_with(|| next)];
        // println!("  {} -> {}", prelude.crate_name, master_crate_map[&prelude.crate_name]);

        prelude.external_crates.sort_by(|a, b| a.num.cmp(&b.num));
        for c in prelude.external_crates {
            assert!(c.num == crate_map.len() as u32);
            let next = master_crate_map.len() as u8;
            crate_map.push(*master_crate_map.entry(c.name.clone()).or_insert_with(|| next));
            // println!("  {} -> {}", c.name, master_crate_map[&c.name]);
        }

        CrateReader {
            crate_map: crate_map,
        }
    }

    fn read_crate(analysis: &mut Analysis, master_crate_map: &mut HashMap<String, u8>, krate: build::Analysis) {
        let reader = CrateReader::from_prelude(krate.prelude.unwrap(), master_crate_map);

        for i in krate.imports {
            analysis.titles.insert(Span::from_build(&i.span), i.value);
        }
        for d in krate.defs {
            let span = Span::from_build(&d.span);
            if !d.value.is_empty() {
                analysis.titles.insert(span.clone(), d.value.clone());
            }
            let id = reader.id_from_compiler_id(&d.id);
            if id != NULL {
                analysis.class_ids.insert(span, id);
                analysis.def_names.entry(d.name.clone()).or_insert_with(|| vec![]).push(id);
                analysis.defs.insert(id, d);
            }
        }
        for r in krate.refs {
            let id = reader.id_from_compiler_id(&r.ref_id);
            if id != NULL {
                let span = Span::from_build(&r.span);
                // TODO class_ids = refs + defs.keys
                analysis.class_ids.insert(span.clone(), id);
                analysis.refs.insert(span.clone(), id);
                analysis.ref_spans.entry(id).or_insert_with(|| vec![]).push(span);
            }
        }
    }

    // TODO need to handle std libraries too.
    fn id_from_compiler_id(&self, id: &build::CompilerId) -> u32 {
        if id.krate == NULL || id.index == NULL {
            return NULL;
        }
        // We build an id by looking up the local crate number into a global crate number and using
        // that for the 8 high order bits, and use the least significant 24 bits of the index part
        // of the def index as the low order bits.
        let krate = self.crate_map[id.krate as usize] as u32;
        let crate_local = id.index & 0x00ffffff;
        krate << 24 | crate_local
    }
}

#[derive(Debug, Clone, Hash, Ord, PartialOrd, Eq, PartialEq)]
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

    pub fn from_build(build: Vec<build::Analysis>) -> Analysis {
        let mut result = Analysis::new();
        if build.is_empty() {
            return result;
        }

        let mut master_crate_map = HashMap::new();
        for krate in build.into_iter() {
            CrateReader::read_crate(&mut result, &mut master_crate_map, krate);
        }

        result
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

    pub fn get_spans(&self, id: u32) -> Vec<Span> {
        let mut result = self.lookup_refs(id).to_owned();
        // TODO what if lookup_def panics
        result.push(Span::from_build(&self.lookup_def(id).span));
        result
    }

    pub fn get_title(&self, lo: &Loc, hi: &Loc) -> Option<&str> {
        let span = Span {
            file_name: lo.file.name.clone(),
            line_start: lo.line as usize,
            column_start: lo.col.0 as usize + 1,
            line_end: hi.line as usize,
            column_end: hi.col.0 as usize + 1,
        };
        self.titles.get(&span).map(|s| &**s).or_else(|| self.refs.get(&span).and_then(|id| self.defs.get(id).map(|def| &*def.value)))
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

// macro_rules! known_crates {
//     {($name: expr, $src_url: expr, $doc_url: expr;)*} => {}
// }

// TODO If we had the spans, we could actually jump to the file and line in the source, I think we would need an index for std then though
// TODO what about docs? Can we magically make a URL?
// known_crates! {
//     "std", "https://github.com/rust-lang/rust/tree/master/src/libstd", "https://doc.rust-lang.org/nightly/std";
// }
