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

function add_source_jump_links() {
    var linkables = $("#div_src_view").find(".src_link");
    linkables.click(load_doc_or_src_link);
}

function add_glob_menus() {
    var globs = $("#div_src_view").find(".glob");
    globs.on("contextmenu", show_glob_menu);
    globs.addClass("hand_cursor");
}

function show_glob_menu(event) {
    if (CONFIG.unstable_features) {
        var menu = $("#div_glob_menu");
        var data = show_menu(menu, event, hide_glob_menu);

        $("#glob_menu_deglob").click(event.target, deglob);

        return false;
    }
}

function deglob(event) {
    let glob = $(event.data);
    let location = glob.attr("location").split(":");
    let file_name = history.state.file;
    let deglobbed = glob.attr("title");

    let data = {
        file_name: file_name,
        line_start: location[0],
        line_end: location[0],
        column_start: location[1],
        column_end: parseInt(location[1]) + 1,
        // TODO we could be much smarter here - don't use {} if there is only one item, delete the
        // line if there are none. Put on multiple lines if necessary or use rustfmt.
        text: "{" + deglobbed + "}"
    };

    $.ajax({
        url: utils.make_url('subst'),
        type: 'POST',
        dataType: 'JSON',
        cache: false,
        'data': JSON.stringify(data)
    })
    .done(function (json) {
        console.log("success");
        var source_data = {
            "file": data.file_name,
            "display": ":" + data.line_start,
            "line_start": data.line_start,
            "line_end": data.line_end,
            "column_start": data.column_start,
            "column_end": parseInt(data.column_start) + parseInt(data.text.length)
        };
        load_source_view(source_data);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with subsitution for " + data);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", utils.make_url("#subst"));
    });

    hide_glob_menu();
}

function hide_glob_menu() {
    hide_menu($("#div_glob_menu"));
}

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

function quick_edit_line_number(event) {
    hide_line_number_menu();
    var file_name = history.state.file;
    var line = line_number_for_span(event.data.target);

    $.ajax({
        url: utils.make_url('plain_text?file=' + file_name + '&line=' + line),
        type: 'POST',
        dataType: 'JSON',
        cache: false,
    })
    .done(function (json) {
        console.log("retrieve plain text - success");
        $("#quick_edit_text").val(json.text);
        $("#quick_edit_save").show();
        $("#quick_edit_save").click(json, save_quick_edit);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with plain text request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#quick_edit_text").val("Error: could not load text");
        $("#quick_edit_save").off("click");
        $("#quick_edit_save").hide();
    });

    show_quick_edit(event);
}

class SourceView extends React.Component {
    componentDidMount() {
        rustw.highlight_spans(this.props.highlight, "src_line_number_", "src_line_", "selected");

        add_source_jump_links();
        add_glob_menus();
        add_ref_functionality();
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
        </div>;
    }
}

module.exports = {
    renderSourceView: function(path, lines, highlight, container) {
        ReactDOM.render(<SourceView path={path} lines={lines} highlight={highlight} />, container);
    }
}
