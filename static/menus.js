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
        return <div>
            <div id="div_overlay" onClick={hideMenu} />
            <div id={this.props.id} className="div_menu">
                {items}
            </div>
        </div>;
    }
}

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

// TODO
function LineNumberMenu(props) {
    const items = [
        { id: "line_number_menu_edit", label: "edit", fn: edit, unstable: true },
        { id: "line_number_quick_edit", label: "quick edit", fn: quick_edit_link, unstable: true },
        // <a target="_blank" class="link">view in VCS</a>
        { id: "line_number_vcs", label: "view in VCS", fn: TODO }
    ];
    return <Menu id={"div_line_number_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

// TODO
function RefMenu(props) {
    const items = [
        { id: "ref_menu_view_summary", label: "view summary", fn: TODO },
        { id: "ref_menu_view_docs", label: "view docs", fn: TODO },
        { id: "ref_menu_view_source", label: "view source", fn: TODO },
        { id: "ref_menu_find_uses", label: "find all uses", fn: TODO },
        { id: "ref_menu_find_impls", label: "find impls", fn: TODO },
        { id: "ref_menu_rename", label: "refactor - rename", fn: TODO, unstable: true }
    ];
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

// Needs testing
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

module.exports = { SrcLinkMenu, GlobMenu };
