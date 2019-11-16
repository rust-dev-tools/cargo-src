// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use std::cmp::{Ord, Ordering, PartialOrd};
use std::path::{Path, PathBuf};

#[derive(Serialize, Debug, Clone)]
pub struct DirectoryListing {
    pub path: PathBuf,
    pub files: Vec<Listing>,
}

#[derive(Serialize, Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct Listing {
    pub kind: ListingKind,
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Debug, Clone, Eq, PartialEq)]
pub enum ListingKind {
    Directory,
    DirectoryTree(Vec<Listing>),
    File,
}

impl PartialOrd for ListingKind {
    fn partial_cmp(&self, other: &ListingKind) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for ListingKind {
    fn cmp(&self, other: &ListingKind) -> Ordering {
        if *self == ListingKind::File && *other == ListingKind::File {
            Ordering::Equal
        } else if *self == ListingKind::File {
            Ordering::Greater
        } else if *other == ListingKind::File {
            Ordering::Less
        } else {
            Ordering::Equal
        }
    }
}

impl DirectoryListing {
    pub fn from_path(path: &Path, recurse: bool) -> Result<DirectoryListing, String> {
        Ok(DirectoryListing {
            path: path.to_owned(),
            files: Self::list_files(path, recurse)?,
        })
    }

    fn list_files(path: &Path, recurse: bool) -> Result<Vec<Listing>, String> {
        let mut files = vec![];
        let dir = match path.read_dir() {
            Ok(d) => d,
            Err(s) => return Err(s.to_string()),
        };
        for entry in dir {
            if let Ok(entry) = entry {
                let name = entry.file_name().to_str().unwrap().to_owned();
                let path = entry.path().to_str().unwrap().to_owned();
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        if recurse {
                            let nested = Self::list_files(&entry.path(), true)?;
                            files.push(Listing {
                                kind: ListingKind::DirectoryTree(nested),
                                name,
                                path,
                            });
                        } else {
                            files.push(Listing {
                                kind: ListingKind::Directory,
                                name,
                                path,
                            });
                        }
                    } else if file_type.is_file() {
                        files.push(Listing {
                            kind: ListingKind::File,
                            name,
                            path,
                        });
                    }
                }
            }
        }

        files.sort();
        Ok(files)
    }
}
