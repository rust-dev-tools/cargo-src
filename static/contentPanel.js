// Copyright 2018 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

import { DirView } from './dirView';
import { SourceView } from './srcView';
import { request } from './utils';

export const Page = {
    START: 'START',
    FILE: 'FILE',
    SOURCE_DIR: 'SOURCE_DIR',
    SEARCH: 'SEARCH',
    FIND: 'FIND',
    LOADING: 'LOADING',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export class ContentPanel extends React.Component {
    constructor() {
        super();
        this.state = { page: Page.LOADING }
    }

    componentDidMount() {
        this.query_api(this.props.path);
    }

    componentDidUpdate() {
        document.title = 'cargo src - ' + this.props.path;
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (nextProps.path == this.props.path) {
            return;
        }
        this.query_api(nextProps.path);
    }

    query_api(path) {
        if (!path || path === '/') {
            path = CONFIG.workspace_root;
        }

        const app = this.props.app;
        const self = this;

        request(
            'src/' + path,
            function(json) {
                if (json.Directory) {
                    self.setState({ page: Page.SOURCE_DIR, params: { path: json.Directory.path, files: json.Directory.files }});
                } else if (json.File) {
                    app.refreshStatus();
                    self.setState({
                        page: Page.FILE,
                        params: {
                            path: json.File.path,
                            lines: json.File.lines,
                            rendered: json.File.rendered
                        },
                    });
                } else {
                    console.log("Unexpected source data.")
                    console.log(json);
                }
            },
            'Error with source request for ' + '/src' + path,
            app
        );
    }

    render() {
        let divMain;
        switch (this.state.page) {
            case Page.FILE:
                divMain = <SourceView app={this.props.app} path={this.state.params.path} lines={this.state.params.lines} content={this.state.params.rendered} highlight={this.props.srcHighlight} />;
                break;
            case Page.SOURCE_DIR:
                divMain = <DirView app={this.props.app} path={this.state.params.path} files={this.state.params.files} />;
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

        return divMain;
    }
}
