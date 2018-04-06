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

export const Page = {
    START: 'START',
    SOURCE: 'SOURCE',
    SOURCE_DIR: 'SOURCE_DIR',
    SEARCH: 'SEARCH',
    FIND: 'FIND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export class ContentPanel extends React.Component {
    render() {
        let divMain;
        switch (this.props.page) {
            case Page.SOURCE:
                divMain = <SourceView app={this.props.app} path={this.props.params.path} lines={this.props.params.lines} highlight={this.props.params.highlight} scrollTo={this.props.params.lineStart} />;
                break;
            case Page.SOURCE_DIR:
                divMain = <DirView app={this.props.app} path={this.props.params.path} files={this.props.params.files} />;
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
