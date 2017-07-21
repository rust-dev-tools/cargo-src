// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { connect } from 'react-redux';
import * as actions from './actions';

import { HideButton } from './hideButton';
import * as utils from './utils';
import { MenuHost, Menu } from './menus';

export function Snippet(props) {
    const spans = props.spans.map((sp) => (<SnippetSpan {...sp} key={sp.id} showBlock={props.showSpans} getSource={props.getSource} />));
    if (!spans || spans.length === 0) {
        return null;
    }
    let button = null;
    if (!props.hideButtons) {
        button = <HideButton hidden={!props.showSpans} onClick={props.toggleSpans} />;
    }

    return (
        <span className="div_snippet">
            <br />
            {button}
            <span className="div_spans">
                {spans}
            </span>
        </span>
    );
}


// props: location, onClose, target, file_name, line_start, line_end, column_start, column_end
// location: { "top": event.pageY, "left": event.pageX }
function SrcLinkMenu(props) {
    const { file_name, line_start, line_end, column_start, column_end } = props;
    const items = [
        { id: "src_menu_edit", label: "edit", fn: utils.edit, unstable: true },
        { id: "src_menu_view", label: "view file", fn: (target) => {
            const highlight = {
                "line_start": line_start,
                "line_end": line_end,
                "column_start": column_start,
                "column_end": column_end
            };
            props.getSource(file_name, highlight);
        } }
    ];
    return <Menu id={"div_src_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

class SnippetSpan extends MenuHost {
    constructor(props) {
        super(props);
        this.menuFn = SrcLinkMenu;
    }

    componentDidMount() {
        this.showHighlights();
    }

    componentDidUpdate() {
        this.showHighlights();
    }

    showHighlights() {
        const { highlights, id, showBlock } = this.props;

        if (showBlock && highlights) {
            const { line_start, line_end, column_start, column_end } = this.props;

            // TODO[ES6]: use highlights.forEach
            for (const h of highlights) {
                let css_class = "selected_secondary";
                if (JSON.stringify(h[0]) === JSON.stringify({ line_start, line_end, column_start, column_end })) {
                    css_class = "selected";
                }
                utils.highlight_spans(h[0],
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

    renderInner() {
        const { line_start, line_end, column_start, column_end } = this.props;
        const { label: _label, id, file_name, text, showBlock } = this.props;

        let label = null;
        if (_label) {
            label = <span className="div_span_label">{_label}</span>;
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

        // TODO[ES6]: seems to be unnecessary
        const self = this;
        const onClick = (ev) => {
            var highlight = {
                "line_start": line_start,
                "line_end": line_end,
                "column_start": column_start,
                "column_end": column_end
            };
            self.props.getSource(file_name, highlight);
        };
        return (
            <span className="div_span" id={'div_span_' + id}>
                <span className="span_loc" id={'span_loc_' + id} onClick={onClick}>
                    {file_name}:{line_start}:{column_start}:{line_end}:{column_end}
                </span>
                {label}
                {block}
            </span>
        );
    }
}

function SnippetBlock(props) {
    let { line_start: line_number, text, id } = props;
    const numbers = [];
    const lines = [];
    // TODO[ES6]: use text.map
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
