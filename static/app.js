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
const { SourceView } = require('./srcView');
const { Summary } = require('./summary');

// TODO - snippet - callbacks

class RustwApp extends React.Component {
    componentWillMount() {
        $("#measure").hide();

        // MAIN_PAGE_STATE = { page: "start" };
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

    // getSearch(needle) {
    //     const self = this;

    //     utils.request(
    //         store.dispatch,
    //         'search?needle=' + needle,
    //         function(json) {
    //             self.showSearch(json.defs, json.refs);
    //             // history.pushState(state, "", utils.make_url("#search=" + needle));
    //         },
    //         "Error with search request for " + needle);
    // }

    // getUses(needle) {
    //     const self = this;
    //     utils.request(
    //         store.dispatch,
    //         'search?id=' + needle,
    //         function(json) {
    //             self.showSearch(json.defs, json.refs);
    //             // history.pushState(state, "", utils.make_url("#search=" + needle));
    //         },
    //         "Error with search request for " + needle);
    // }

    // getImpls(needle) {
    //     const self = this;
    //     utils.request(
    //         store.dispatch,
    //         'find?impls=' + needle,
    //         function(json) {
    //             self.showFind(json.results);
    //             //history.pushState(state, "", utils.make_url("#impls=" + needle));
    //         },
    //         "Error with find (impls) request for " + needle);
    // }

    // showSearch(defs, refs) {
    //     this.setState({ state: "builtAndNavigating", page: "search", defs, refs });
    // }

    // showFind(results) {
    //     this.setState({ state: "builtAndNavigating", page: "find", results });
    // }

    // getSummary(id) {
    //     const self = this;
    //     utils.request(
    //         store.dispatch,
    //         'summary?id=' + id,
    //         function (json) {
    //             window.scroll(0, 0);
    //             self.setState({ state: "builtAndNavigating", page: "summary", data: json });
    //             // history.pushState(state, "", utils.make_url("#summary=" + id));
    //         },
    //         "Error with summary request for " + id,
    //     );
    // }

    // showLoading() {
    //     this.setState({ page: "loading" });
    // }

    // showError() {
    //     this.setState({ page: "internal_error" });
    // }

    // getSource(file_name, highlight) {
    //     const self = this;

    //     utils.request(
    //         store.dispatch,
    //         'src/' + file_name,
    //         function(json) {
    //             if (json.Directory) {
    //                 self.setState({
    //                     state: "builtAndNavigating",
    //                     page: "source_dir",
    //                     data: json.Directory,
    //                     file: file_name
    //                 });
    //                 // history.pushState(state, "", utils.make_url("#src=" + file_name));
    //             } else if (json.Source) {
    //                 let line_start;
    //                 if (highlight) {
    //                     line_start = highlight.line_start;
    //                 }
    //                 self.setState({
    //                     state: "builtAndNavigating",
    //                     page: "source",
    //                     data: json.Source,
    //                     file: file_name,
    //                     line_start: line_start,
    //                     highlight: highlight
    //                 });
    //                 // history.pushState(state, "", utils.make_url("#src=" + file_name));
    //             } else {
    //                 console.log("Unexpected source data.")
    //                 console.log(json);
    //             }
    //         },
    //         "Error with source request for " + file_name,
    //     );
    // }

    render() {
        // const self = this;
        // // TODO inline dispatches
        // const fns = {
        //     doBuild: () => store.dispatch(actions.doBuild()),
        //     buildComplete: () => store.dispatch(actions.buildComplete()),
        //     getSource: (file_name, line_start) => self.getSource(file_name, line_start),
        //     getSearch: (needle) => self.getSearch(needle),
        //     getSummary: (id) => self.getSummary(id),
        //     getUses: (needle) => self.getUses(needle),
        //     getImpls: (needle) => self.getImpls(needle),
        //     showBuildResults: () => store.dispatch(actions.showBuildResults()),
        //     showErrCode: (el, data) => self.showErrCode(el, data),
        //     showError: () => store.dispatch(actions.showError()),
        //     showLoading: () => store.dispatch(actions.showLoading()),
        //     // TODO is this used anywhere
        //     // runBuild: () => self.runBuild(),
        // };

        let divMain;
        switch (this.props.page) {
            case "build_results":
                divMain = <ResultsController />;
                break;
            case "err_code":
                divMain = <ErrCodeController />;
                break;
            // case "search":
            //     divMain = <SearchResults defs={this.state.defs} refs={this.state.refs} callbacks={fns} />;
            //     break;
            // case "find":
            //     divMain = <FindResults results={this.state.results} callbacks={fns} />;
            //     break;
            // case "source":
            //     divMain = <SourceView path={this.state.data.path} lines={this.state.data.lines} highlight={this.state.highlight} scrollTo={this.state.line_start} callbacks={fns} />;
            //     break;
            // case "source_dir":
            //     divMain = <DirView file={this.state.file} files={this.state.data.files} callbacks={fns} />;
            //     break;
            case "loading":
                divMain = "Loading...";
                break;
            // case "summary":
            //     divMain = <Summary breadCrumbs={this.state.data.breadCrumbs} parent={this.state.data.parent} signature={this.state.data.signature} doc_summary={this.state.data.doc_summary} doc_rest={this.state.data.doc_rest} children={this.state.data.children} />;
            //     break;
            case "internal_error":
                divMain = "Server error?";
                break;
            case "start":
            default:
                divMain = null;
        }

        // TODO replace store prop with connect for controller components
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
    return {}
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
