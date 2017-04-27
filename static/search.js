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

// TODO needs testing
class FindResults extends React.Component {
    componentDidMount() {
        $(".src_link").removeClass("src_link");
        highlight_needle(state.data.results, "result");
    }

    render() {
        if (!props.results) {
            return <span className="div_search_no_results">No results found</span>;
        } else {
            let results = [];
            let count = 0;
            for (const r of props.results) {
                let lines = [];
                for (const l of r.lines) {
                    const lineLink = r.file_name + ":" + l.line_start;
                    const spanLink = lineLink  + ":" + l.column_start + ":" + l.line_start + ":" + column_end;
                    const lineNumberId = "snippet_line_number_result_" + count + "_" + l.line_start;
                    const lineId = "snippet_line_def_" + count + "_" + l.line_start;
                    lines.push(<span key={l.line_start}>
                                    <span className="div_span_src_number" link={lineLink}  onClick={rustw.load_link}>
                                        <div className="span_src_number" id={lineNumberId}>{l.line_start}</div>
                                    </span>
                                    <span className="div_span_src">
                                        <div className="span_src" id={lineId} link={spanLink} onClick={rustw.load_link} dangerouslySetInnerHTML={{__html: l.line}} />
                                    </span>
                                    <br />
                               </span>);
                }
                results.push(<div>
                                <div className="div_search_file_link" link={r.file_name} key={r.file_name} onClick={rustw.load_link}>{r.file_name}</div>
                                <div className="div_all_span_src">
                                    {lines}
                                </div>
                            </div>);
                count += 1;
            }
            return <div>
                <div className="div_search_title">Search results:</div>
                    <div className="div_search_results">
                        {results}
                    </div>
                </div>;
        }
    }
}

// TODO dup'ed in rustw, remove that copy
function highlight_needle(results, tag) {
    for (const i in results) {
        for (const line of results[i].lines) {
            line.line_end = line.line_start;
            rustw.highlight_spans(line,
                                  null,
                                  "snippet_line_" + tag + "_" + i + "_",
                                  "selected");
        }
    }
}

module.exports = {
    renderFindResults: function(container) {
        ReactDOM.render(<FindResults />, container);
    }
}
