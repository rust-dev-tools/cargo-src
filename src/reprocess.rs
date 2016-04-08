// Reprocessing snippets after building.

use build::errors::Diagnostic;
use file_cache::Cache;
use server::BuildResult;

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time;

use serde_json;

pub fn make_key() -> String {
    // This is a pretty roundabout way to make a fairly unique string.
    let now = time::SystemTime::now();
    let now = now.duration_since(time::UNIX_EPOCH).unwrap();
    now.subsec_nanos().to_string()
}

// For any snippet in the build result, we syntax highlight the file, and return
// a new, syntax highlighted snippet.
// This function should be run in its own thread, the result is posted to
// pending_push_data.
pub fn reprocess_snippets(result: BuildResult,
                          pending_push_data: Arc<Mutex<HashMap<String, Option<String>>>>,
                          file_cache: Arc<Mutex<Cache>>) {
    let mut snippets = ReprocessedSnippets::new(result.push_data_key.unwrap());
    for d in &result.errors {
        // Lock the file_cache on every iteration because this thread should be
        // low priority, and we're happy to wait if someone else wants access to
        // the file_cache.
        reprocess_diagnostic(d, &file_cache, &mut snippets);
    }

    let mut pending_push_data = pending_push_data.lock().unwrap();
    let entry = pending_push_data.get_mut(&snippets.key).unwrap();
    assert!(entry.is_none());
    *entry = Some(serde_json::to_string(&snippets).unwrap());
}

fn reprocess_diagnostic(diagnostic: &Diagnostic,
                        file_cache: &Mutex<Cache>,
                        result: &mut ReprocessedSnippets) {
    {
        let mut file_cache = file_cache.lock().unwrap();
        for sp in &diagnostic.spans {
            // TODO ignore the span rather than panicking here
            let file = file_cache.get_highlighted(&Path::new(&sp.file_name)).unwrap();
            let snippet = Snippet::new(sp.id,
                                       file[(sp.line_start - 1)..sp.line_end].to_owned(),
                                       sp.line_start);
            result.snippets.push(snippet);
        }
    }

    for d in &diagnostic.children {
        reprocess_diagnostic(d, file_cache, result);
    }
}

#[derive(Serialize, Debug)]
struct ReprocessedSnippets {
    snippets: Vec<Snippet>,
    key: String,
}

// TODO will want highlighting info,
// which lines are context.
#[derive(Serialize, Debug)]
struct Snippet {
    id: u32,
    // TODO do we ever want to update the plain_text? Probably do to keep the
    // snippet up to date after a quick edit, etc.
    text: Vec<String>,
    line_start: usize,
}

impl ReprocessedSnippets {
    fn new(key: String) -> ReprocessedSnippets {
        ReprocessedSnippets {
            snippets: vec![],
            key: key,
        }
    }
}

impl Snippet {
    fn new(id: u32, text: Vec<String>, line_start: usize) -> Snippet {
        Snippet {
            id: id,
            text: text,
            line_start: line_start,
        }
    }
}