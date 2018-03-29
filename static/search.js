// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import * as actions from './actions';

const utils = require('./utils');

class ResultSet extends React.Component {
    componentDidMount() {
        $(".src_link").removeClass("src_link");
        highlight_needle(this.props.input, this.props.kind);
    }

    render() {
        const { input, kind } = this.props;
        const self = this;
        let count = 0;
        let result = input.map((r) => {
            let lines = r.lines.map((l) => {
                const lineId = `snippet_line_number_${kind}_${count}_${l.line_start}`;
                const snippetId = `snippet_line_${kind}_${count}_${l.line_start}`;
                const lineClick = (e) => {
                    const highlight = {
                        "line_start": l.line_start,
                        "line_end": l.line_start,
                        "column_start": 0,
                        "column_end": 0
                    };
                    actions.getSource(self.props.app, r.file_name, highlight);
                    e.preventDefault();
                };
                const snippetClick = (e) => {
                    const highlight = {
                        "line_start": l.line_start,
                        "line_end": l.line_end,
                        "column_start": l.column_start,
                        "column_end": l.column_end
                    };
                    actions.getSource(self.props.app, r.file_name, highlight);
                    e.preventDefault();
                };

                // Squash the indent down by a factor of four.
                const text = l.line;
                let trimmed = text.trimLeft();
                const newIndent = (text.length - trimmed.length) / 4;
                trimmed = trimmed.padStart(trimmed.length + newIndent);

                return (<div key={`${kind}-${count}-${l.line_start}`}>
                    <span className="div_span_src_number">
                        <div className="span_src_number" id={lineId} onClick={lineClick}>{l.line_start}</div>
                    </span>
                    <span className="div_span_src">
                        <div className="span_src" id={snippetId} onClick={snippetClick} dangerouslySetInnerHTML={{__html: trimmed}} />
                    </span>
                    <br />
                </div>);
            });
            const onClick = (e) => {
                actions.getSource(self.props.app, r.file_name, {});
                e.preventDefault();
            };
            count += 1;
            return (<div key={`${kind}-${r.file_name}`}>
                <div className="div_search_file_link" onClick={onClick}>{r.file_name}</div>
                <div className="div_all_span_src">
                    {lines}
                </div>
            </div>);
        })

        return <div className="div_search_results">
            {result}
        </div>;
    }
}

function noResults() {
    return <span className="div_search_no_results">No results found</span>;
}

export function FindResults(props) {
    if (!props.results) {
        return noResults();
    } else {
        return(<div>
                <div className="div_search_title">Search results:</div>
                <ResultSet app={props.app} input={props.results} kind="result" />
            </div>);
    }
}

export function SearchResults(props) {
    if (!props.defs) {
        return noResults();
    } else {
        return <div>
            <div className="div_search_title">Definitions</div>
            <ResultSet app={props.app} input={props.defs} kind="def"/>
            <div className="div_search_title">References</div>
            <ResultSet app={props.app} input={props.refs} kind="ref"/>
        </div>;
    }
}

function highlight_needle(results, tag) {
    results.map((file, index) => {
        file.lines.map((line) => {
            line.line_end = line.line_start;
            utils.highlight_spans(line,
                                  null,
                                  `snippet_line_${tag}_${index}_`,
                                  "selected");
        })
    })
}
