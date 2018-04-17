// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Route, Switch } from 'react-router-dom';

import * as utils from './utils';
import { Sidebar } from './sidebar';
import { makeTreeData } from './symbolPanel';
import { ContentPanel, Page } from './contentPanel';


export class RustwApp extends React.Component {
    constructor() {
        super();
        this.state = { page: Page.START, fileTreeData: [], symbols: {}, status: null, hasConfig: false };
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
        this.setState({ hasConfig: true });
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
        const self = this;
        utils.request(
            "status",
            function (data) {
                self.setState({ status: data.status });
            },
            "Could not fetch status",
            null,
        );
    }


    getSearch(needle) {
        const self = this;
        return utils.request(
            'search?needle=' + needle,
            function(json) {
                self.refreshStatus();
                self.setState({ search: { defs: json.defs, refs: json.refs, results: null, searchTerm: needle }});
            },
            "Error with search request for " + needle,
            null
        );
    }

    getUses(needle) {
        const self = this;
        return utils.request(
            'search?id=' + needle,
            function(json) {
                self.refreshStatus();
                self.setState({ search: { defs: json.defs, refs: json.refs, results: null, searchTerm: null }});
            },
            "Error with search (uses) request for " + needle,
            null
        );
    }

    getImpls(needle) {
        const self = this;
        return utils.request(
            'find?impls=' + needle,
            function(json) {
                self.refreshStatus();
                self.setState({ search: { results: json.results, defs: null, refs: null }});
            },
            "Error with find (impls) request for " + needle,
            null
        );
    }


    showLoading() {
        this.setState({ page: Page.LOADING});
    }

    showError() {
        this.setState({ page: Page.INTERNAL_ERROR});
    }

    loadSource(path, highlight) {
        if (!path.startsWith('/')) {
            path = CONFIG.workspace_root + '/' + path;
        }
        const location = {
            pathname: path,
            state: { highlight }
        };
        this.props.history.push(location);
    }

    render() {
        let contentPanel = "Loading...";
        if (this.state.hasConfig) {
            let srcHighlight = null;
            if (this.props.location.state && this.props.location.state.highlight) {
                srcHighlight = this.props.location.state.highlight;
            }
            contentPanel = <ContentPanel path={this.props.location.pathname} app={this} srcHighlight={srcHighlight} />;
        }
        return <div id="div_app">
            <div id="div_main">
                <Sidebar app={this} search={this.state.search} fileTreeData={this.state.fileTreeData} symbols={this.state.symbols} status={this.state.status} />
                {contentPanel}
            </div>
        </div>;
    }
}

export function renderApp() {
    ReactDOM.render(
        <BrowserRouter>
            <Route component={RustwApp} />
        </BrowserRouter>,
        document.getElementById('container')
    );
}
