// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, withRouter } from 'react-router-dom';
import * as actions from './actions';

import * as utils from './utils';
import { Sidebar } from './sidebar';
import { makeTreeData } from './symbolPanel';
import { ContentPanel, Page } from './contentPanel';


export class RustwApp extends React.Component {
    constructor() {
        super();
        this.state = { page: Page.START, fileTreeData: [], symbols: {}, status: null }
    }

    componentDidMount() {
        $.ajax({
            dataType: "json",
            url: "/config",
            success: (data) => {
                CONFIG = data;
                this.loadFileTreeData();
                this.loadSymbols();
            },
            async: false
        });
        actions.getSource(this, CONFIG.workspace_root);
    }

    loadFileTreeData() {
        let self = this;
        utils.request(
            'tree/' + CONFIG.workspace_root,
            function(json) {
                if (json.Directory) {
                    self.setState({ fileTreeData: json })
                } else {
                    console.log("Unexpected tree data.")
                    console.log(json);
                }
            },
            "Error with tree request",
            null,
        );
    }

    loadSymbols() {
        const self = this;
        utils.request(
            'symbol_roots',
            function(json) {
                self.setState({ symbols: makeTreeData(json) });
            },
            "Error with symbol_roots request",
            null
        );
    }

    refreshStatus() {
        let self = this;
        utils.request(
            "status",
            function (data) {
                self.setState({ status: data.status });
            },
            "Could not fetch status",
            null,
        );
    }

    showSource(path, lines, lineStart, highlight) {
        this.refreshStatus();
        this.setState({ page: Page.SOURCE, params: { path, lines, highlight, lineStart }});
    }

    showSourceDir(path, files) {
        this.setState({ page: Page.SOURCE_DIR, params: { path, files }});
    }

    showLoading() {
        this.setState({ page: Page.LOADING});
    }

    showError() {
        this.setState({ page: Page.INTERNAL_ERROR});
    }

    showSearch(defs, refs, searchTerm) {
        this.refreshStatus();
        this.setState({ search: { defs, refs, results: null, searchTerm }});
    }

    showFind(results) {
        this.setState({ search: { results, defs: null, refs: null }});
    }

    render() {
        return <div id="div_app">
            <div id="div_main">
                <Sidebar app={this} search={this.state.search} fileTreeData={this.state.fileTreeData} symbols={this.state.symbols} status={this.state.status} />
                <ContentPanel app={this} page={this.state.page} params={this.state.params} />
            </div>
        </div>;
    }
}

export function renderApp() {
    ReactDOM.render(
        <Router>
            <Route path='/' component={RustwApp} />
        </Router>,
        document.getElementById('container')
    );
}
