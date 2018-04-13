// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { FindResults, SearchResults } from "./search";

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
            <SearchBox app={this.props.app} searchController={this.props.searchController} />
            <div id="div_search_results">{searchResults}</div>
        </div>;
    }
}

function SearchBox(props) {
    return <div>
        <input id="search_box" value={props.searchController.searchTerm} placeholder="identifier search" autoComplete="off" onKeyPress={props.searchController.onKeyPress} onChange={props.searchController.onChange}></input>
    </div>;
}
