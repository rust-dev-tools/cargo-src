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
        { id: "src_menu_view", label: "view file", fn: (target) => rustw.load_link.call(target) }
    ];
    return <Menu id={"div_src_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

function LineNumberMenu(props) {
    let items = [
        { id: "line_number_menu_edit", label: "edit", fn: edit, unstable: true }
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

    return <Menu id={"div_ref_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
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

module.exports = { SrcLinkMenu, LineNumberMenu, RefMenu };
