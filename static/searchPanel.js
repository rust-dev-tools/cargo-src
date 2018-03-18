// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { FindResults, SearchResults } from "./search";

// import { Menu, MenuHost } from './menus';
import * as actions from './actions';

export class SearchPanel extends React.Component {
    render() {
        let searchResults = null;
        if (this.props.defs || this.props.refs) {
            searchResults = <SearchResults app={this.props.app} defs={this.props.defs} refs={this.props.refs} />;
        } else if (this.props.results) {
            searchResults = <FindResults app={this.props.app} results={this.props.results} />;
        }

        return <div>
            <SearchBox app={this.props.app} />
            <div id="div_search_results">{searchResults}</div>
        </div>;
    }
}

function SearchBox(props) {
    const enterKeyCode = 13;
    const onKeyPress = (e) => {
        if (e.which === enterKeyCode) {
            actions.getSearch(props.app, e.currentTarget.value);
        }
    };

    return (<div>
        <input id="search_box" placeholder="identifier search" autoComplete="off" onKeyPress={onKeyPress}></input>
    </div>)
}

// function OptionsMenu(props) {
//     let items = [
//         { id: "opt-0", label: "list view/code view", fn: () => {} },
//         { id: "opt-1", label: "show/hide warnings", fn: () => {} },
//         { id: "opt-2", label: "show/hide notes and help", fn: () => {} },
//         { id: "opt-3", label: "show/hide all source snippets", fn: () => {} },
//         { id: "opt-4", label: "show/hide context for source code", fn: () => {} },
//         { id: "opt-5", label: "show/hide child messages", fn: () => {} },
//         { id: "opt-6", label: "show/hide error context", fn: () => {} },
//         { id: "opt-7", label: "build command: <code>cargo build</code>", fn: () => {} },
//         { id: "opt-8", label: "toolchain: TODO", fn: () => {} },
//         { id: "opt-9", label: "build time: TODO", fn: () => {} },
//         { id: "opt-10", label: "exit status: TODO", fn: () => {} }
//     ];

//     return <Menu id={"div_options"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
// }

// class Options extends MenuHost {
//     constructor(props) {
//         super(props);
//         this.menuFn = OptionsMenu;
//         this.leftClick = true;
//     }

//     renderInner() {
//         return <span id="link_options" className="button">options</span>;
//     }
// }

