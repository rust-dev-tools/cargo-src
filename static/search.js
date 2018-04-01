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
        $(".div_search_results .src_link").removeClass("src_link");
        highlight_needle(this.props.input, this.props.kind);
    }

    render() {
        const { input, kind } = this.props;
        const self = this;
        let count = -1;
        let result = input.map((r) => {
            count += 1;
            return <FileResult lines={r.lines} file_name={r.file_name} app={self.props.app} kind={kind} count={count} key={`${kind}-${r.file_name}`}/>;
        });

        return <div className="div_search_results">
            {result}
        </div>;
    }
}

function FileResult(props) {
    const { lines, file_name, kind, count } = props;
    let divLines = lines.map((l) => {
        const lineId = `snippet_line_number_${kind}_${count}_${l.line_start}`;
        const snippetId = `snippet_line_${kind}_${count}_${l.line_start}`;

        // Squash the indent down by a factor of four.
        const text = l.line;
        let trimmed = text.trimLeft();
        const newIndent = (text.length - trimmed.length) / 4;
        const diffIndent = (text.length - trimmed.length) - newIndent;
        trimmed = trimmed.padStart(trimmed.length + newIndent);

        const lineClick = (e) => {
            const highlight = {
                "line_start": l.line_start,
                "line_end": l.line_start,
                "column_start": 0,
                "column_end": 0
            };
            actions.getSource(props.app, file_name, highlight);
            e.preventDefault();
        };
        const snippetClick = (e) => {
            const highlight = {
                "line_start": l.line_start,
                "line_end": l.line_end,
                "column_start": l.column_start,
                "column_end": l.column_end
            };
            actions.getSource(props.app, file_name, highlight);
            e.preventDefault();
        };

        return <div key={`${kind}-${count}-${l.line_start}`}>
            <span className="div_span_src_number">
                <div className="span_src_number" id={lineId} onClick={lineClick}>{l.line_start}</div>
            </span>
            <span className="div_span_src">
                <div className="span_src" id={snippetId} onClick={snippetClick} dangerouslySetInnerHTML={{__html: trimmed}} data-adjust={diffIndent} />
            </span>
            <br />
        </div>;
    });
    const onClick = (e) => {
        actions.getSource(props.app, file_name, {});
        e.preventDefault();
    };
    return <div>
        <div className="div_search_file_link" onClick={onClick}>{file_name}</div>
        <div className="div_all_span_src">
            {divLines}
        </div>
    </div>;
}

class StructuredResultSet extends React.Component {
    componentDidMount() {
        $(".div_search_group .src_link").removeClass("src_link");
        const defFile = { file_name: this.props.input.file, lines: [this.props.input.line] };
        highlight_needle([defFile], "def");
    }

    render() {
        const def = <FileResult lines={[this.props.input.line]} file_name={this.props.input.file} app={this.props.app} count="0" kind="def"/>;
        const refs = <ResultSet input={this.props.input.refs} app={this.props.app} kind="ref" />
        return <div className="div_search_group">
            {def}
            <div className="div_search_title">References</div>
            {refs}
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
        return <div className="div_search_defs">
            <div className="div_search_title">Search results</div>
            <ResultSet app={props.app} input={props.results} kind="result" />
        </div>;
    }
}

export function SearchResults(props) {
    if (!props.defs) {
        return noResults();
    } else {
        let count = -1;
        let defs = props.defs.map((d) => {
            count += 1;
            return <StructuredResultSet app={props.app} input={d} key={d.file + '-' + count} />;
        });
        return <div>
            <div className="div_search_title">Search results</div>
            {defs}
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
                                  "selected_search");
        })
    })
}
