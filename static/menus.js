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
        { id: "src_menu_edit", label: "edit", fn: edit, unstable: true},
        { id: "src_menu_quick_edit", label: "quick edit", fn: quick_edit_link, unstable: true},
        { id: "src_menu_view", label: "view file", fn: view_from_menu }
    ];
    return <Menu id={"div_src_menu"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

function view_from_menu(target) {
    rustw.load_link.call(target);
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

module.exports = { SrcLinkMenu };
