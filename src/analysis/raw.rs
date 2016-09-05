// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use listings::{DirectoryListing, ListingKind};

use serde;
use serde::Deserialize;
use serde_json;

use std::path::Path;
use std::fmt;
use std::fs::File;
use std::io::Read;

#[derive(Deserialize, Debug)]
pub struct Analysis {
    pub prelude: Option<CratePreludeData>,
    pub imports: Vec<Import>,
    pub defs: Vec<Def>,
    pub refs: Vec<Ref>,
    pub macro_refs: Vec<MacroRef>,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Target {
    Release,
    Debug,
}

impl fmt::Display for Target {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match *self {
            Target::Release => write!(f, "release"),
            Target::Debug => write!(f, "debug"),
        }
    }
}

impl Analysis {
    pub fn read(path_prefix: &str, target: Target) -> Vec<Analysis> {
        let mut result = vec![];

        // TODO shouldn't hard-code these paths, it's cargo-specific
        // TODO deps path allows to break out of sandbox - is that Ok?
        let principle_path = format!("{}/target/{}/save-analysis", path_prefix, target);
        let deps_path = format!("{}/target/{}/deps/save-analysis", path_prefix, target);
        let paths = &[&Path::new(&principle_path),
                      &Path::new(&deps_path)];
        for p in paths {
            let listing = match DirectoryListing::from_path(p) {
                Ok(l) => l,
                Err(_) => { continue; },
            };
            for l in &listing.files {
                if l.kind == ListingKind::File {
                    let mut path = p.to_path_buf();
                    path.push(&l.name);
                    // TODO unwraps
                    let mut file = File::open(&path).unwrap();
                    let mut buf = String::new();
                    file.read_to_string(&mut buf).unwrap();
                    match serde_json::from_str(&buf) {
                        Ok(a) => result.push(a),
                        Err(e) => println!("Error reading raw analysis: {}", e),
                    }
                }
            }
        }

        result
    }
}

#[derive(Deserialize, Debug)]
pub struct CompilerId {
    pub krate: u32,
    pub index: u32,
}

#[derive(Deserialize, Debug)]
pub struct CratePreludeData {
    pub crate_name: String,
    pub crate_root: String,
    pub external_crates: Vec<ExternalCrateData>,
    pub span: SpanData,
}

#[derive(Deserialize, Debug)]
pub struct ExternalCrateData {
    pub name: String,
    pub num: u32,
    pub file_name: String,
}

#[derive(Deserialize, Debug)]
pub struct Def {
    pub kind: DefKind,
    pub id: CompilerId,
    pub span: SpanData,
    pub name: String,
    pub qualname: String,
    pub value: String,
}

#[derive(Debug)]
pub enum DefKind {
    Enum,
    Tuple,
    Struct,
    Trait,
    Function,
    Method,
    Macro,
    Mod,
    Type,
    Local,
    Static,
    Const,
    Field,
}

// Custom impl to read rustc_serialize's format.
impl Deserialize for DefKind {
    fn deserialize<D>(deserializer: &mut D) -> Result<DefKind, D::Error>
        where D: serde::Deserializer,
    {
        let s = String::deserialize(deserializer)?;
        match &*s {
            "Enum" => Ok(DefKind::Enum),
            "Tuple" => Ok(DefKind::Tuple),
            "Struct" => Ok(DefKind::Struct),
            "Trait" => Ok(DefKind::Trait),
            "Function" => Ok(DefKind::Function),
            "Method" => Ok(DefKind::Method),
            "Macro" => Ok(DefKind::Macro),
            "Mod" => Ok(DefKind::Mod),
            "Type" => Ok(DefKind::Type),
            "Local" => Ok(DefKind::Local),
            "Static" => Ok(DefKind::Static),
            "Const" => Ok(DefKind::Const),
            "Field" => Ok(DefKind::Field),
            _ => {
                println!("{:?}", s);
                Err(serde::de::Error::custom("unexpected def kind"))
            }
        }
    }
}

#[derive(Deserialize, Debug)]
pub struct Ref {
    pub kind: RefKind,
    pub span: SpanData,
    pub ref_id: CompilerId,
}

#[derive(Debug)]
pub enum RefKind {
    Function,
    Mod,
    Type,
    Variable,
}

// Custom impl to read rustc_serialize's format.
impl Deserialize for RefKind {
    fn deserialize<D>(deserializer: &mut D) -> Result<RefKind, D::Error>
        where D: serde::Deserializer,
    {
        let s = String::deserialize(deserializer)?;
        match &*s {
            "Function" => Ok(RefKind::Function),
            "Mod" => Ok(RefKind::Mod),
            "Type" => Ok(RefKind::Type),
            "Variable" => Ok(RefKind::Variable),
            _ => Err(serde::de::Error::custom("unexpected ref kind")),
        }
    }
}

#[derive(Deserialize, Debug)]
pub struct MacroRef {
    pub span: SpanData,
    pub qualname: String,
    pub callee_span: SpanData,
}

#[derive(Deserialize, Debug)]
pub struct Import {
    pub kind: ImportKind,
    pub id: CompilerId,
    pub span: SpanData,
    pub name: String,
    pub value: String,
}

#[derive(Debug)]
pub enum ImportKind {
    ExternCrate,
    Use,
    GlobUse,
}

// Custom impl to read rustc_serialize's format.
impl Deserialize for ImportKind {
    fn deserialize<D>(deserializer: &mut D) -> Result<ImportKind, D::Error>
        where D: serde::Deserializer,
    {
        let s = String::deserialize(deserializer)?;
        match &*s {
            "ExternCrate" => Ok(ImportKind::ExternCrate),
            "Use" => Ok(ImportKind::Use),
            "GlobUse" => Ok(ImportKind::GlobUse),
            _ => Err(serde::de::Error::custom("unexpected import kind")),
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
pub struct SpanData {
    pub file_name: String,
    pub byte_start: u32,
    pub byte_end: u32,
    /// 1-based.
    pub line_start: usize,
    pub line_end: usize,
    /// 1-based, character offset.
    pub column_start: usize,
    pub column_end: usize,
}
