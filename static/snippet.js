// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';
import { OrderedMap } from 'immutable';

const { HideButton } = require('./hideButton');
const rustw = require('./rustw');

// TODO can probably remove uses of id

class Snippet extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showSpans: false };
    }

    showSpans(e) {
        this.setState((prevState) => ({ showSpans: !prevState.showSpans }));
    }

    render() {
        const spans = this.props.spans.map((sp) => (<SnippetSpan {...sp} key={sp.id} showBlock={this.state.showSpans}/>));
        if (!spans || spans.length == 0) {
            return null;
        }

        return (
            <span className="div_snippet">
                <br /><HideButton hidden={!this.state.showSpans} onClick={this.showSpans.bind(this)}/>
                <span className="div_spans">
                    {spans}
                </span>
            </span>
        );
    }
}

class SnippetSpan extends React.Component {
    componentDidMount() {
        let src_links = $(".span_loc");
        src_links.click(rustw.win_src_link);
        src_links.on("contextmenu", rustw.show_src_link_menu);
    }

    componentDidUpdate() {
        const { highlights, id, showBlock } = this.props;

        if (showBlock && highlights) {
            const { line_start, line_end, column_start, column_end } = this.props;

            for (const h of highlights) {
                let css_class = "selected_secondary";
                if (JSON.stringify(h[0]) == JSON.stringify({ line_start, line_end, column_start, column_end })) {
                    css_class = "selected";
                }
                rustw.highlight_spans(h[0],
                                      "snippet_line_number_" + id + "_",
                                      "snippet_line_" + id + "_",
                                      css_class);

                // Make a label for the message.
                if (h[1]) {
                    let line_span = $("#snippet_line_" + id + "_" + h[0].line_start);
                    let old_width = line_span.width();
                    let label_span = $("<span class=\"highlight_label\">" + h[1] + "</span>");
                    line_span.append(label_span);
                    let offset = line_span.offset();
                    offset.left += old_width + 40;
                    label_span.offset(offset);
                }
            }
        }
    }

    render() {
        const { line_start, line_end, column_start, column_end } = this.props;
        const { label: _label, id, file_name, text, showBlock } = this.props;

        let label = null;
        if (_label) {
            label = <span className="div_span_label" id={'div_span_label_' + id}>{_label}</span>;
        }

        let block = null;
        if (showBlock) {
            let block_line_start = this.props.block_line_start;
            if (!block_line_start) {
                block_line_start = line_start;
            }

            block = <div className="div_all_span_src" id={'src_span_' + id}>
                    <SnippetBlock id={id} line_start={block_line_start} text={text}/>
                </div>;
        }

        return (
            <span className="div_span" id={'div_span_' + id}>
                <span className="span_loc" data-link={file_name + ':' + line_start + ':' + column_start + ':' + line_end + ':' + column_end}  id={'span_loc_' + id}>
                    {file_name}:{line_start}:{column_start}: {line_end}:{column_end}
                </span>
                {label}
                {block}
            </span>
        );
    }
}

class SnippetBlock extends React.Component {
    render() {
        let { line_start: line_number, text, id } = this.props;
        const numbers = [];
        const lines = [];
        for (let line of text) {
            numbers.push(<div className="span_src_number" id={'snippet_line_number_' + id + '_' + line_number} key={'number_' + line_number}>{line_number}</div>);
            let text = "&nbsp;";
            if (line) {
                text = line;
            }
            lines.push(<div className="span_src" id={'snippet_line_' + id + '_' + line_number} key={'span_' + line_number}  dangerouslySetInnerHTML={{__html: text}} />);
            line_number += 1;
        }
        return (
            <span>
                <span className="div_span_src_number">
                    {numbers}
                </span><span className="div_span_src">
                    {lines}
                </span>
            </span>
        );
    }
}

module.exports = {
    Snippet: Snippet
}
