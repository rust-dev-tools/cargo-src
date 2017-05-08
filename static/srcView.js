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
const { quick_edit_line_number } = require('./quickEdit');
const { GlobMenu } = require('./menus');

function show_line_number_menu(event) {
    var menu = $("#div_line_number_menu");
    var data = show_menu(menu, event, hide_line_number_menu);

    var line_number = line_number_for_span(data.target);
    var file_name = history.state.file;
    if (CONFIG.unstable_features) {
        var edit_data = { 'link': file_name + ":" + line_number, 'hide_fn': hide_line_number_menu };
        $("#line_number_menu_edit").click(edit_data, edit);
        $("#line_number_quick_edit").click(data, quick_edit_line_number);
    } else {
        $("#line_number_menu_edit").hide();
        $("#line_number_quick_edit").hide();
    }

    if (CONFIG.vcs_link) {
        let link = $("#line_number_vcs").children().first();
        link.click(function() { hide_line_number_menu(); return true; });
        link.attr("href", CONFIG.vcs_link.replace("$file", file_name).replace("$line", line_number))
    } else {
        $("#line_number_vcs").hide();
    }

    return false;
}

function hide_line_number_menu() {
    hide_menu($("#div_line_number_menu"));
}

function load_doc_or_src_link() {
    // TODO special case links to the same file
    var docUrl = this.dataset['doc-url'];

    if (!docUrl) {
        return rustw.load_link.call(this);
    }

    window.open(docUrl, '_blank');
}

// Menus, highlighting on mouseover.
function add_ref_functionality() {
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
                element.on("contextmenu", null, id, show_ref_menu);
                element.addClass("hand_cursor");

                break;
            }
        }
    }
}

// TODO dup'ed in rustw.js
function show_ref_menu(event) {
    var menu = $("#div_ref_menu");
    var data = show_menu(menu, event, hide_ref_menu);
    data.id = event.data;

    var doc_url = data.target.attr("doc_url");
    if (doc_url) {
        var view_data = { 'link': doc_url, 'hide_fn': hide_ref_menu };
        $("#ref_menu_view_docs").show();
        $("#ref_menu_view_docs").click(view_data, open_tab);
    } else {
        $("#ref_menu_view_docs").hide();
    }

    var src_url = data.target.attr("src_url");
    if (src_url) {
        var view_data = { 'link': src_url, 'hide_fn': hide_ref_menu };
        $("#ref_menu_view_source").show();
        $("#ref_menu_view_source").click(view_data, open_tab);
    } else {
        $("#ref_menu_view_source").hide();
    }

    $("#ref_menu_view_summary").click(event.data, (ev) => summary(ev.data));
    $("#ref_menu_find_uses").click(event.data, (ev) => find_uses(ev.data));

    let impls = data.target.attr("impls");
    // FIXME we could display the impl count in the menu
    if (impls && impls != "0") {
        $("#ref_menu_find_impls").click(event.data, (ev) => find_impls(ev.data));
    } else {
        $("#ref_menu_find_impls").hide();
    }

    if (CONFIG.unstable_features) {
        $("#ref_menu_rename").click(data, show_rename);
    } else {
        $("#ref_menu_rename").hide();
    }

    return false;
}

function hide_ref_menu() {
    hide_menu($("#div_ref_menu"));
}

// TODO dup'ed
function show_menu(menu, event, hide_fn) {
    var target = $(event.target);
    var data = {
        "position": { "top": event.pageY, "left": event.pageX },
        "target": target
    };

    menu.show();
    menu.offset(data.position);

    // TODO use the overlay trick.
    $("#div_main").click(hide_fn);
    $("#div_header").click(hide_fn);

    return data;
}

// TODO dup'ed
function hide_menu(menu) {
    menu.children("div").off("click");
    menu.hide();
}

function line_number_for_span(target) {
    var line_id = target.attr("id");
    return parseInt(line_id.slice("src_line_number_".length));
}

class SourceView extends React.Component {
    constructor(props) {
        super(props);
        this.state = { globMenu: null };
    }

    componentDidMount() {
        rustw.highlight_spans(this.props.highlight, "src_line_number_", "src_line_", "selected");

        // Make source links active.
        var linkables = $("#div_src_view").find(".src_link");
        linkables.click(load_doc_or_src_link);

        add_ref_functionality();

        if (CONFIG.unstable_features) {
            var globs = $("#div_src_view").find(".glob");
            const self = this;
            globs.on("contextmenu", (ev) => {
                self.setState({ globMenu: { "top": ev.pageY, "left": ev.pageX, target: ev.target }});
                ev.preventDefault();
            });
            globs.addClass("hand_cursor");
        }
    }

    render() {
        let numbers = [];
        let lines = []
        let count = 0;

        for (const l of this.props.lines) {
            count += 1;
            const numId = "src_line_number_" + count;
            numbers.push(<div className="div_src_line_number hand_cursor" id={numId} key={"num-" + count} onContextMenu={show_line_number_menu}>{count}</div>);

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
            const self = this;
            const onClose = () => self.setState({ globMenu: null});
            globMenu = <GlobMenu location={this.state.globMenu} onClose={onClose} target={this.state.globMenu.target} />;
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
        </div>;
    }
}

module.exports = {
    renderSourceView: function(path, lines, highlight, container) {
        ReactDOM.render(<SourceView path={path} lines={lines} highlight={highlight} />, container);
    }
}
