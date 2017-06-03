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
const { BreadCrumbs } = require('./breadCrumbs');
const { GlobMenu, LineNumberMenu, RefMenu } = require('./menus');


function load_doc_or_src_link() {
    // TODO special case links to the same file
    var docUrl = this.dataset['doc-url'];

    if (!docUrl) {
        return rustw.load_link.call(this);
    }

    window.open(docUrl, '_blank');
}

// Menus, highlighting on mouseover.
function add_ref_functionality(self) {
    for (const el of $("#div_src_view").find(".class_id")) {
        const element = $(el);
        const classes = el.className.split(' ');
        for (const c of classes) {
            if (c.startsWith('class_id_')) {
                element.hover(function() {
                    $("." + c).css("background-color", "#d5f3b5");
                }, function() {
                    $("." + c).css("background-color", "");
                });

                const id = c.slice('class_id_'.length);
                const showRefMenu = (ev) => {
                    self.setState({ refMenu: { "top": ev.pageY, "left": ev.pageX, target: ev.target, id }});
                    ev.preventDefault();
                };
                element.on("contextmenu", showRefMenu);
                element.addClass("hand_cursor");

                break;
            }
        }
    }
}

class SourceView extends React.Component {
    constructor(props) {
        super(props);
        this.state = { globMenu: null, lineNumberMenu: null, refMenu: null };
    }

    componentDidMount() {
        rustw.highlight_spans(this.props.highlight, "src_line_number_", "src_line_", "selected");

        // Make source links active.
        var linkables = $("#div_src_view").find(".src_link");
        linkables.click(load_doc_or_src_link);

        add_ref_functionality(this);
    }

    render() {
        const self = this;
        let numbers = [];
        let lines = []
        let count = 0;

        for (const l of this.props.lines) {
            count += 1;
            const numId = "src_line_number_" + count;
            const link = this.props.path.join('/') + ":" + count;
            const showLineNumberMenu = (ev) => {
                self.setState({ lineNumberMenu: { "top": ev.pageY, "left": ev.pageX, target: ev.target }});
                ev.preventDefault();                
            };
            numbers.push(<div className="div_src_line_number hand_cursor" id={numId} key={"num-" + count} onContextMenu={showLineNumberMenu} data-link={link}>{count}</div>);

            let line;
            if (!l) {
                line = "&nbsp;"
            } else {
                line = l;
            }
            const lineId = "src_line_" + count;
            lines.push(<div className="div_src_line" id={lineId} key={"line-" + count} dangerouslySetInnerHTML={{__html: line}} />);
        }

        let globMenu = null;
        if (!!this.state.globMenu) {
            const onClose = () => self.setState({ globMenu: null });
            globMenu = <GlobMenu location={this.state.globMenu} onClose={onClose} target={this.state.globMenu.target} />;
        }

        let lineNumberMenu = null;
        if (!!this.state.lineNumberMenu) {
            const onClose = () => self.setState({ lineNumberMenu: null });
            lineNumberMenu = <LineNumberMenu location={this.state.lineNumberMenu} onClose={onClose} target={this.state.lineNumberMenu.target} />;            
        }

        let refMenu = null;
        if (!!this.state.refMenu) {
            const onClose = () => self.setState({ refMenu: null });
            refMenu = <RefMenu location={this.state.refMenu} onClose={onClose} target={this.state.refMenu.target} id={this.state.refMenu.id} />;
        }

        return <div id="div_src_view">
            <BreadCrumbs path={this.props.path} />
            <br />
            <div id="div_src_contents">
                <span className="div_src_line_numbers">
                    {numbers}
                </span>
                <span className="div_src_lines">
                    {lines}
                </span>
            </div>
            {globMenu}
            {lineNumberMenu}
            {refMenu}
        </div>;
    }
}

module.exports = {
    renderSourceView: function(path, lines, highlight, container) {
        ReactDOM.render(<SourceView path={path} lines={lines} highlight={highlight} />, container);
    }
}
