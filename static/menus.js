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
const { quick_edit_link } = require('./quickEdit');
const search = require('./search');
const summary = require('./summary');

// props: { id, items: [{id, label, fn, unstable}], location, onClose, target }
//   fn: (target: Element, location) -> ()
class Menu extends React.Component {
    componentDidUpdate() {
        this.didRender();
    }

    componentDidMount() {
        this.didRender();
    }

    didRender() {
        if (this.isEmpty) {
            this.props.onClose();
            return;
        }

        var menuDiv = $("#" + this.props.id);
        menuDiv.offset(this.props.location);
    }

    render() {
        const self = this;
        const hideMenu = (event) => {
            self.props.onClose();
            event.preventDefault();
            event.stopPropagation();
        };

        let items = [];
        for (const i of this.props.items) {
            if (!i.unstable || CONFIG.unstable_features) {
                const className = this.props.id + "_link menu_link";
                let onClick = (ev) => {
                    hideMenu(ev);
                    i.fn(self.props.target, self.props.location);
                };
                items.push(<div className={className} id={i.id} key={i.id} onClick={onClick}>{i.label}</div>);
            }
        }
        if (items == 0) {
            this.isEmpty = true;
            return null;
        }
        return <div>
            <div id="div_overlay" onClick={hideMenu} />
            <div id={this.props.id} className="div_menu">
                {items}
            </div>
        </div>;
    }
}

// TODO move actions into their own module

// props: location, onClose, target
// location: { "top": event.pageY, "left": event.pageX }
function SrcLinkMenu(props) {
    const items = [
        { id: "src_menu_edit", label: "edit", fn: edit, unstable: true },
        { id: "src_menu_quick_edit", label: "quick edit", fn: quick_edit_link, unstable: true },
        { id: "src_menu_view", label: "view file", fn: (target) => rustw.load_link.call(target) }
    ];
    return <Menu id={"div_src_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

function LineNumberMenu(props) {
    let items = [
        { id: "line_number_menu_edit", label: "edit", fn: edit, unstable: true },
        { id: "line_number_quick_edit", label: "quick edit", fn: quick_edit_link, unstable: true }
    ];
    if (CONFIG.vcs_link) {
        items.push({ id: "line_number_vcs", label: "view in VCS", fn: view_in_vcs });
    }
    return <Menu id={"div_line_number_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

function view_in_vcs(target) {
    const file_name = history.state.file;
    const line_number = line_number_for_span(target);
    window.open(CONFIG.vcs_link.replace("$file", file_name).replace("$line", line_number), '_blank');
}

function line_number_for_span(target) {
    var line_id = target.getAttribute("id");
    return parseInt(line_id.slice("src_line_number_".length));
}

// props: location, onClose, target, id
// location: { "top": event.pageY, "left": event.pageX }
function RefMenu(props) {
    // TODO summary, findUses, findImpls are going wrong - bad id, I think
    // target doesn't have id field
    let items = [{ id: "ref_menu_view_summary", label: "view summary", fn: () => summary.pullSummary(props.id) }];

    const docUrl = props.target.dataset['doc-url'];
    if (docUrl) {
        items.push({ id: "ref_menu_view_docs", label: "view docs", fn: () => window.open(docUrl, '_blank') });
    }
    const srcUrl = props.target.dataset['src-url'];
    if (srcUrl) {
        items.push({ id: "ref_menu_view_source", label: "view source", fn: window.open(srcUrl, '_blank') });
    }

    items.push({ id: "ref_menu_find_uses", label: "find all uses", fn: () => search.findUses(props.id) });

    let impls = props.target.dataset.impls;
    if (impls && impls != "0") {
        items.push({ id: "ref_menu_find_impls", label: "find impls (" + impls + ")", fn: () => search.findImpls(props.id) });
    }

    items.push({ id: "ref_menu_rename", label: "refactor - rename", fn: show_rename, unstable: true });

    return <Menu id={"div_ref_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

function GlobMenu(props) {
    const items = [
        { id: "glob_menu_deglob", label: "refactor - deglob", fn: deglob, unstable: true }
    ];
    return <Menu id={"div_glob_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

function deglob(target) {
    let location = target.dataset.location.split(":");
    let deglobbed = target.getAttribute("title");

    let data = {
        file_name: history.state.file,
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
        // TODO reload the source page
        // var source_data = {
        //     "file": data.file_name,
        //     "display": ":" + data.line_start,
        //     "line_start": data.line_start,
        //     "line_end": data.line_end,
        //     "column_start": data.column_start,
        //     "column_end": parseInt(data.column_start) + parseInt(data.text.length)
        // };
        // load_source_view(source_data);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with subsitution for " + data);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", utils.make_url("#subst"));
    });
}

function edit(target) {
    $.ajax({
        url: utils.make_url('edit?file=' + target.dataset.link),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        console.log("edit - success");
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with edit request");
        console.log("error: " + errorThrown + "; status: " + status);
    });
}

function show_rename(target, location) {
    let id = null;
    for (const c of target.className.split(' ')) {
        if (c.startsWith('class_id_')) {
            id = c.slice('class_id_'.length);
            break;
        }
    }
    if (!id) {
        console.log("Couldn't find id for element");
        console.log(target);
        return;
    }

    var div_rename = $("#div_rename");

    div_rename.show();
    div_rename.offset(location);

    $("#rename_text").prop("disabled", false);

    $("#rename_message").hide();
    $("#rename_cancel").text("cancel");
    $("#rename_cancel").click(hide_rename);
    $("#div_main").click(hide_rename);
    $("#div_header").click(hide_rename);
    $("#rename_save").show();
    $("#rename_save").click(() => save_rename(id));
    $(document).on("keypress", "#rename_text", function(e) {
         if (e.which == 13) {
             save_rename(id);
         }
    });

    $("#rename_text").val(target.textContent);
    $("#rename_text").select();
}

function hide_rename() {
    $("#rename_save").off("click");
    $("#rename_cancel").off("click");
    $("#div_rename").hide();
}

function save_rename(id) {
    $("#rename_message").show();
    $("#rename_message").text("saving...");
    $("#rename_save").hide();
    $("#rename_cancel").text("close");
    $("#rename_text").prop("disabled", true);

    $.ajax({
        url: utils.make_url('rename?id=' + id + "&text=" + $("#rename_text").val()),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        console.log("rename - success");
        $("#rename_message").text("rename saved");

        module.exports.reload_source();

        // TODO add a fade-out animation here
        window.setTimeout(hide_rename, 1000);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with rename request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#rename_message").text("error trying to save rename");
    });
}

module.exports = { SrcLinkMenu, GlobMenu, LineNumberMenu, RefMenu };
