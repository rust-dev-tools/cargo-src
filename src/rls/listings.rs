// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use std::path::Path;

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
