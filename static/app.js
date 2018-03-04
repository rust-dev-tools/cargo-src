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
import { BrowserRouter as Router, Route, withRouter } from 'react-router-dom'
import thunk from 'redux-thunk';
import { rustwReducer, Page } from './reducers';
import * as actions from './actions';

import * as utils from './utils';
import { ResultsController, Error } from "./errors";
import { ErrCodeController } from "./err_code";
import { FindResults, SearchResults } from "./search";
import { DirView } from './dirView';
import { SourceViewController } from './srcView';
import { Summary } from './summary';
import { SidebarController } from './Sidebar';

// TODOs in build

class RustwApp extends React.Component {
    componentWillMount() {

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
        store.dispatch(actions.getSource(CONFIG.workspace_root));
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
            case Page.SOURCE:
                divMain = <SourceViewController path={this.props.page.path} lines={this.props.page.lines} highlight={this.props.page.highlight} scrollTo={this.props.page.lineStart} />;
                break;
            case Page.SOURCE_DIR:
                divMain = <DirView path={this.props.page.path} files={this.props.page.files} getSource={this.props.getSource} />;
                break;
            case Page.LOADING:
                divMain = <div id="div_loading">Loading...</div>;
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
            <div id="div_main">
                <SidebarController page={this.props.page}/>
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

const AppController = withRouter(connect(
    mapStateToProps,
    mapDispatchToProps
)(RustwApp));


let store = createStore(rustwReducer, applyMiddleware(thunk));

export function renderApp() {
    ReactDOM.render(
        <Provider store={store}>
            <Router>
                <Route path='/' component={AppController} />
            </Router>
        </Provider>,
        document.getElementById('container')
    );
}
