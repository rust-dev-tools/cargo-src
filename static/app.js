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
import { rustwReducer } from './reducers';
import * as actions from './actions';

const utils = require('./utils');
const { TopBarController } = require('./topbar');
const { ResultsController, Error } = require("./errors");
const { ErrCodeController } = require("./err_code");
const { FindResults, SearchResults } = require("./search");
const { DirView } = require('./dirView');
const { SourceViewController } = require('./srcView');
const { Summary } = require('./summary');

// TODOs in build
// TODO refactoring in actions/reducers

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
        switch (this.props.page) {
            case actions.Page.BUILD_RESULTS:
                divMain = <ResultsController />;
                break;
            case actions.Page.ERR_CODE:
                divMain = <ErrCodeController />;
                break;
            case actions.Page.SEARCH:
                divMain = <SearchResults defs={this.props.search.defs} refs={this.props.search.refs} />;
                break;
            case actions.Page.FIND:
                divMain = <FindResults results={this.props.find.results} />;
                break;
            case actions.Page.SOURCE:
                divMain = <SourceViewController path={this.props.source.path} lines={this.props.source.lines} highlight={this.props.source.highlight} scrollTo={this.props.source.lineStart} />;
                break;
            case actions.Page.SOURCE_DIR:
                divMain = <DirView file={this.props.sourceDir.name} files={this.props.sourceDir.files} getSource={this.props.getSource} />;
                break;
            case actions.Page.LOADING:
                divMain = "Loading...";
                break;
            case actions.Page.SUMMARY:
                divMain = <Summary breadCrumbs={this.props.summary.breadCrumbs} parent={this.props.summary.parent} signature={this.props.summary.signature} doc_summary={this.props.summary.doc_summary} doc_rest={this.props.summary.doc_rest} children={this.props.summary.children} />;
                break;
            case actions.Page.INTERNAL_ERROR:
                divMain = "Server error?";
                break;
            case actions.Page.START:
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
        search: state.search,
        sourceDir: state.sourceDir,
        source: state.source,
        find: state.find,
        summary: state.summary,
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

module.exports = {
    renderApp: function() {
        ReactDOM.render(
            <Provider store={store}>
                <AppController />
            </Provider>,
            document.getElementById('container')
        );
    }
}
