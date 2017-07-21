// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider, connect } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { rustwReducer, Page } from './reducers';
import * as actions from './actions';

import * as utils from './utils';
import { TopBarController } from './topbar';
import { ResultsController, Error } from "./errors";
import { ErrCodeController } from "./err_code";
import { FindResults, SearchResults } from "./search";
import { DirView } from './dirView';
import { SourceViewController } from './srcView';
import { Summary } from './summary';

// TODOs in build

class RustwApp extends React.Component {
    componentWillMount() {
        $("#measure").hide();

        // history.replaceState(MAIN_PAGE_STATE, "");
        // window.onpopstate = onPopState;    
    }

    componentDidMount() {
        $.ajax({
            dataType: "json",
            url: "/config",
            success: (data) => {
                CONFIG = data;
            },
            async: false,
        });
        if (CONFIG.build_on_load) {
            store.dispatch(actions.doBuild());
        }
    }

    render() {
        let divMain;
        switch (this.props.page.type) {
            case Page.BUILD_RESULTS:
                divMain = <ResultsController />;
                break;
            case Page.ERR_CODE:
                divMain = <ErrCodeController />;
                break;
            case Page.SEARCH:
                divMain = <SearchResults defs={this.props.page.defs} refs={this.props.page.refs} />;
                break;
            case Page.FIND:
                divMain = <FindResults results={this.props.page.results} />;
                break;
            case Page.SOURCE:
                divMain = <SourceViewController path={this.props.page.path} lines={this.props.page.lines} highlight={this.props.page.highlight} scrollTo={this.props.page.lineStart} />;
                break;
            case Page.SOURCE_DIR:
                divMain = <DirView file={this.props.page.name} files={this.props.page.files} getSource={this.props.getSource} />;
                break;
            case Page.LOADING:
                divMain = "Loading...";
                break;
            case Page.SUMMARY:
                divMain = <Summary breadCrumbs={this.props.page.breadCrumbs} parent={this.props.page.parent} signature={this.props.page.signature} doc_summary={this.props.page.doc_summary} doc_rest={this.props.page.doc_rest} children={this.props.page.children} />;
                break;
            case Page.INTERNAL_ERROR:
                divMain = "Server error?";
                break;
            case Page.START:
            default:
                divMain = null;
        }

        return <div id="div_app">
            <TopBarController />
            <div id="div_main">
                {divMain}
            </div>
        </div>;
    }
}

const mapStateToProps = (state) => {
    return {
        page: state.page,
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        getSource: (fileName, lineStart) => dispatch(actions.getSource(fileName, lineStart)),
    }
}

const AppController = connect(
    mapStateToProps,
    mapDispatchToProps
)(RustwApp);

let store = createStore(rustwReducer, applyMiddleware(thunk));

export function renderApp() {
    ReactDOM.render(
        <Provider store={store}>
            <AppController />
        </Provider>,
        document.getElementById('container')
    );
}
