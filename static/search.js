// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';
const rustw = require('./rustw');
const utils = require('./utils');


function noResults() {
    return <span className="div_search_no_results">No results found</span>;
}

function loadLink(e) {
    rustw.load_link.call(e.target);
    e.preventDefault();
}

function resultSet(input, kind) {
    let result = [];
    count = 0;
    for (const r of input) {
        let lines = [];
        for (const l of r.lines) {
            const lineLink = r.file_name + ':' + l.line_start;
            const lineId = "snippet_line_number_" + kind + "_" + count + "_" + l.line_start;
            const snippetLink = lineLink + ":" + l.column_start + ":" +  l.line_start + ":" + l.column_end;
            const snippetId = "snippet_line_" + kind + "_" + count + "_" + l.line_start;
            lines.push(<div key={kind + "-" + lineLink}>
                <span className="div_span_src_number">
                    <div className="span_src_number" id={lineId} data-link={lineLink} onClick={loadLink}>{l.line_start}</div>
                </span>
                <span className="div_span_src">
                    <div className="span_src" id={snippetId} data-link={snippetLink} onClick={loadLink} dangerouslySetInnerHTML={{__html: l.line}} />
                </span>
                <br />
            </div>);
        }
        result.push(<div key={kind + "-" + r.file_name}>
            <div className="div_search_file_link" data-link={r.file_name} onClick={loadLink}>{r.file_name}</div>
            <div className="div_all_span_src">
                {lines}
            </div>
        </div>);
        count += 1;
    }

    return <div className="div_search_results">
        {result}
    </div>;
}

class FindResults extends React.Component {
    componentDidMount() {
        $(".src_link").removeClass("src_link");
        highlight_needle(this.props.results, "result");
    }

    render() {
        if (!this.props.results) {
            return noResults();
        } else {
            let results = resultSet(this.props.results, "result");
            return <div>
                <div className="div_search_title">Search results:</div>
                     {results}
                </div>;
        }
    }
}

class SearchResults extends React.Component {
    componentDidMount() {
        $(".src_link").removeClass("src_link");
        highlight_needle(this.props.defs, "def");
        highlight_needle(this.props.refs, "ref");
    }

    render() {
        if (!this.props.defs) {
            return noResults();
        } else {
            let defs = resultSet(this.props.defs, 'def');
            let refs = resultSet(this.props.refs, 'ref');
            return <div>
                <div className="div_search_title">Definitions:</div>
                {defs}
                <div className="div_search_title">References:</div>
                {refs}
            </div>;
        }
    }
}

function highlight_needle(results, tag) {
    for (const i in results) {
        for (const line of results[i].lines) {
            line.line_end = line.line_start;
            utils.highlight_spans(line,
                                  null,
                                  "snippet_line_" + tag + "_" + i + "_",
                                  "selected");
        }
    }
}

function request(urlStr, success, errStr) {
    $.ajax({
        url: utils.make_url(urlStr),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(success)
    .fail(function (xhr, status, errorThrown) {
        console.log(errStr);
        console.log("error: " + errorThrown + "; status: " + status);

        rustw.load_error();
        history.pushState({}, "", utils.make_url("#error"));
    });

    $("#div_main").text("Loading...");
}


function findUses(needle) {
    request('search?id=' + needle,
            function(json) {
                var state = {
                    "page": "search",
                    "data": json,
                    "id": needle,
                };
                rustw.load_search(state);
                history.pushState(state, "", utils.make_url("#search=" + needle));
            },
            "Error with search request for " + needle);
}

function findImpls(needle) {
    request('find?impls=' + needle,
            function(json) {
            var state = {
                "page": "find",
                "data": json,
                "kind": "impls",
                "id": needle,
            };
            rustw.load_find(state);
            history.pushState(state, "", utils.make_url("#impls=" + needle));
            },
            "Error with find (impls) request for " + needle);
}

module.exports = {
    renderFindResults: function(results, container) {
        ReactDOM.render(<FindResults results={results}/>, container);
    },

    renderSearchResults: function(defs, refs, container) {
        ReactDOM.render(<SearchResults defs={defs} refs={refs}/>, container);
    },

    findImpls, findUses
}
