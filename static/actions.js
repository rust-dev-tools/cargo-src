// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

const utils = require('./utils');

export function getSource(app, fileName, highlight) {
    return utils.request(
        'src/' + fileName,
        function(json) {
            if (json.Directory) {
                app.showSourceDir(json.Directory.path, json.Directory.files);
            } else if (json.Source) {
                let lineStart;
                if (highlight) {
                    lineStart = highlight.line_start;
                }
                app.showSource(json.Source.path, json.Source.lines, lineStart, highlight);
            } else {
                console.log("Unexpected source data.")
                console.log(json);
            }
        },
        "Error with source request for " + fileName,
        app
    );
}

export function getSearch(app, needle) {
    return utils.request(
        'search?needle=' + needle,
        function(json) {
            app.showSearch(json.defs, json.refs, needle);
        },
        "Error with search request for " + needle,
        null
    );
}

export function getUses(app, needle) {
    return utils.request(
        'search?id=' + needle,
        function(json) {
            app.showSearch(json.defs, json.refs);
        },
        "Error with search (uses) request for " + needle,
        null
    );
}

export function getImpls(app, needle) {
    return utils.request(
        'find?impls=' + needle,
        function(json) {
            app.showFind(json.results);
        },
        "Error with find (impls) request for " + needle,
        null
    );
}

