// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

// props: { id, items: [{id, label, fn, unstable}], location, onClose, target }
//   fn: (target: Element, location) -> ()
export class Menu extends React.Component {
    componentDidUpdate() {
        this.didRender();
    }

    componentDidMount() {
        this.didRender();
    }

    didRender() {
        console.log("menu didRender")
        if (this.items().length == 0) {
            this.props.onClose();
            return;
        }

        var menuDiv = $(`#${this.props.id}`);
        menuDiv.offset(this.props.location);
    }

    items() {
        return this.props
            .items
            .filter((i) => { return !i.unstable || CONFIG.unstable_features })
            .map((i) => {
                const className = `${this.props.id}_link menu_link`;
                let onClick = (ev) => {
                    hideMenu(ev);
                    i.fn(self.props.target, self.props.location);
                };
                return <div className={className} id={i.id} key={i.id} onClick={onClick}>{i.label}</div>;
            });
    }

    render() {
        const self = this;
        const hideMenu = (event) => {
            self.props.onClose();
            event.preventDefault();
            event.stopPropagation();
        };

        let items = this.items();
    
        if (items.length === 0) {
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

export class MenuHost extends React.Component {
    constructor(props) {
        super(props);
        this.state = { menuOpen: null };
    }

    render() {
        let menu = null;
        if (!!this.state.menuOpen) {
            const onClose = () => this.setState({ menuOpen: null});
            menu = React.createElement(this.menuFn, { location: this.state.menuOpen, onClose: onClose, target: this.state.menuOpen.target, callbacks: this.props.callbacks });
        }

        let contextMenu = (ev) => {
            this.setState({ menuOpen: { "top": ev.pageY, "left": ev.pageX, target: ev.target }});
            ev.preventDefault();
            ev.stopPropagation();
        };
        
        let onClick = null;
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
