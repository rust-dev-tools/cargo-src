// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

const utils = require('./utils');

class ResultSet extends React.Component {
    componentDidMount() {
        $(".src_link").removeClass("src_link");
        highlight_needle(this.props.input, this.props.kind);
    }

    render() {
        const { input, kind } = this.props;
        let result = [];
        let count = 0;
        const self = this;
        for (const r of input) {
            let lines = [];
            for (const l of r.lines) {
                const lineId = "snippet_line_number_" + kind + "_" + count + "_" + l.line_start;
                const snippetId = "snippet_line_" + kind + "_" + count + "_" + l.line_start;
                const lineClick = (e) => {
                    const highlight = {
                        "line_start": l.line_start,
                        "line_end": l.line_start,
                        "column_start": 0,
                        "column_end": 0
                    };
                    self.props.callbacks.getSource(r.file_name, highlight);
                    e.preventDefault();
                };
                const snippetClick = (e) => {
                    const highlight = {
                        "line_start": l.line_start,
                        "line_end": l.line_end,
                        "column_start": l.column_start,
                        "column_end": l.column_end
                    };
                    self.props.callbacks.getSource(r.file_name, highlight);
                    e.preventDefault();
                };
                lines.push(<div key={kind + "-" + l.line_start}>
                    <span className="div_span_src_number">
                        <div className="span_src_number" id={lineId} onClick={lineClick}>{l.line_start}</div>
                    </span>
                    <span className="div_span_src">
                        <div className="span_src" id={snippetId} onClick={snippetClick} dangerouslySetInnerHTML={{__html: l.line}} />
                    </span>
                    <br />
                </div>);
            }
            const onClick = (e) => {
                self.props.callbacks.getSource(r.file_name, {});
                e.preventDefault();
            };
            result.push(<div key={kind + "-" + r.file_name}>
                <div className="div_search_file_link" onClick={onClick}>{r.file_name}</div>
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
}

function noResults() {
    return <span className="div_search_no_results">No results found</span>;
}

function FindResults(props) {
    if (!props.results) {
        return noResults();
    } else {
        return <div>
            <div className="div_search_title">Search results:</div>
                 <ResultSet input={props.results} kind="result" callbacks={props.callbacks} />
            </div>;
    }
}

function SearchResults(props) {
    if (!props.defs) {
        return noResults();
    } else {
        return <div>
            <div className="div_search_title">Definitions:</div>
            <ResultSet input={props.defs} kind="def" callbacks={props.callbacks} />
            <div className="div_search_title">References:</div>
            <ResultSet input={props.refs} kind="ref" callbacks={props.callbacks} />
        </div>;
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

module.exports = { FindResults, SearchResults };
