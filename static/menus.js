// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';

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
        return <span>
            <div id="div_overlay" onClick={hideMenu} />
            <div id={this.props.id} className="div_menu">
                {items}
            </div>
        </span>;
    }
}

class MenuHost extends React.Component {
    constructor(props) {
        super(props);
        this.state = { menuOpen: null };
    }

    render() {
        let menu = null;
        if (!!this.state.menuOpen) {
            const self = this;
            const onClose = () => self.setState({ menuOpen: null});
            menu = React.createElement(this.menuFn, { location: this.state.menuOpen, onClose: onClose, target: this.state.menuOpen.target });
        }

        const self = this;
        let contextMenu = (ev) => {
            self.setState({ menuOpen: { "top": ev.pageY, "left": ev.pageX, target: ev.target }});
            ev.preventDefault();
        };
        let onClick=null;
        if (this.leftClick) {
            onClick = contextMenu;
            contextMenu = null;
        }

        return (
            <span onContextMenu={contextMenu} onClick={onClick}>
                {this.renderInner()}
                {menu}
            </span>
        );
    }
}

module.exports = { MenuHost, Menu };
