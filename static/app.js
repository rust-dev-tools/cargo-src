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
import { DirView } from './dirView';
import { SourceView } from './srcView';
import { Sidebar } from './sidebar';
import { makeTreeData } from './symbolPanel';

const Page = {
    START: 'START',
    SOURCE: 'SOURCE',
    SOURCE_DIR: 'SOURCE_DIR',
    SEARCH: 'SEARCH',
    FIND: 'FIND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export class RustwApp extends React.Component {
    constructor() {
        super();
        this.state = { page: Page.START, fileTreeData: [], symbols: {} }
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

    // TODO don't do this until analysis is ready (or make the server block until then). Should the server ping us?
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

    showSource(path, lines, lineStart, highlight) {
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

    showSearch(defs, refs) {
        this.setState({ search: { defs, refs, results: null }});
    }

    showFind(results) {
        this.setState({ search: { results, defs: null, refs: null }});
    }

    render() {
        // FIXME factor out the content panel
        let divMain;
        switch (this.state.page) {
            case Page.SOURCE:
                divMain = <SourceView app={this} path={this.state.params.path} lines={this.state.params.lines} highlight={this.state.params.highlight} scrollTo={this.state.params.lineStart} />;
                break;
            case Page.SOURCE_DIR:
                divMain = <DirView app={this} path={this.state.params.path} files={this.state.params.files} />;
                break;
            case Page.LOADING:
                divMain = <div id="div_loading">Loading...</div>;
                break;
            case Page.INTERNAL_ERROR:
                divMain = "Server error?";
                break;
            case Page.START:
            default:
                divMain = null;
        }

        return <div id="div_app">
            <div id="div_main">
                <Sidebar app={this} search={this.state.search} fileTreeData={this.state.fileTreeData} symbols={this.state.symbols} />
                {divMain}
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
