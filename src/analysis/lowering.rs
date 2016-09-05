// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// For processing the raw save-analysis data from rustc into rustw's in-memory representation.

use super::raw;
use super::{Analysis, Span, NULL};

use std::collections::HashMap;

pub fn lower(raw_analysis: Vec<raw::Analysis>, project_dir: &str) -> Analysis {
    let mut result = Analysis::new();
    let mut master_crate_map = HashMap::new();
    for krate in raw_analysis.into_iter() {
        CrateReader::read_crate(&mut result, &mut master_crate_map, krate, project_dir);
    }

    result
}

pub fn lower_span(raw_span: &raw::SpanData, project_dir: Option<&str>) -> Span {
    let file_name = &raw_span.file_name;
    let file_name = if file_name.starts_with('/') {
        file_name.clone()
    } else {
        format!("{}/{}", project_dir.expect("Required project directory, but not supplied"), file_name)
    };
    Span {
        file_name: file_name,
        line_start: raw_span.line_start,
        column_start: raw_span.column_start,
        line_end: raw_span.line_end,
        column_end: raw_span.column_end,
    }
}

struct CrateReader {
    crate_map: Vec<u8>,
}

impl CrateReader {
    fn from_prelude(mut prelude: raw::CratePreludeData, master_crate_map: &mut HashMap<String, u8>) -> CrateReader {
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

    fn read_crate(analysis: &mut Analysis, master_crate_map: &mut HashMap<String, u8>, krate: raw::Analysis, project_dir: &str) {
        let reader = CrateReader::from_prelude(krate.prelude.unwrap(), master_crate_map);

        for i in krate.imports {
            analysis.titles.insert(lower_span(&i.span, Some(project_dir)), i.value);
        }
        for d in krate.defs {
            let span = lower_span(&d.span, Some(project_dir));
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
            if id != NULL && analysis.defs.contains_key(&id) {
                let span = lower_span(&r.span, Some(project_dir));

                //println!("record ref {:?} {:?} {:?} {}", r.kind, span, r.ref_id, id);
                // TODO class_ids = refs + defs.keys
                analysis.class_ids.insert(span.clone(), id);
                analysis.refs.insert(span.clone(), id);
                analysis.ref_spans.entry(id).or_insert_with(|| vec![]).push(span);
            }
        }
    }

    // TODO need to handle std libraries too.
    fn id_from_compiler_id(&self, id: &raw::CompilerId) -> u32 {
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
