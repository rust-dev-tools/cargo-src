// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';
import { OrderedMap } from 'immutable';

const utils = require('./utils');
const { TopBar } = require('./topbar');
const { Results, Error } = require("./errors");
const { ErrCode } = require("./err_code");
const { FindResults, SearchResults } = require("./search");
const { DirView } = require('./dirView');
const { SourceView } = require('./srcView');
const { Summary } = require('./summary');


class RustwApp extends React.Component {
    constructor(props) {
        super(props);
        this.state = { state: "fresh", page: "start", buildId: 0, errors: OrderedMap(), messages: [] };
    }

    componentWillMount() {
        $("#measure").hide();

        // MAIN_PAGE_STATE = { page: "start" };
        // history.replaceState(MAIN_PAGE_STATE, "");

        // window.onpopstate = onPopState;    
    }

    componentDidMount() {
        const self = this;
        $.getJSON("/config", function(data) {
            CONFIG = data;
            if (CONFIG.build_on_load) {
                self.doBuild();
            }
        });
    }

    doBuild() {
        this.setState({ state: "building", page: "build_results", buildId: Math.random(), errors: OrderedMap(), messages: [] });
        this.runBuild();
    }

    buildComplete() {
        this.setState({ state: "built" });
    }

    showBuildResults() {
        window.scroll(0, 0);
        // history.pushState(backup, "", utils.make_url("#build"));
        this.setState({ page: "build_results" });
    }

    showErrCode(domElement, errData) {
        let element = $(domElement);
        var explain = element.attr("data-explain");
        if (!explain) {
            return;
        }

        // Prepare the data for the error code window.
        var data = { "code": element.attr("data-code"), "explain": marked(explain), "error": errData };

        this.setState({ state: "builtAndNavigating", page: "err_code", errData: data });
    }

    getSearch(needle) {
        const self = this;

        utils.request(
            self,
            'search?needle=' + needle,
            function(json) {
                self.showSearch(json.defs, json.refs);
                // history.pushState(state, "", utils.make_url("#search=" + needle));
            },
            "Error with search request for " + needle);
    }

    getUses(needle) {
        const self = this;
        utils.request(
            self,
            'search?id=' + needle,
            function(json) {
                self.showSearch(json.defs, json.refs);
                // history.pushState(state, "", utils.make_url("#search=" + needle));
            },
            "Error with search request for " + needle);
    }

    getImpls(needle) {
        const self = this;
        utils.request(
            self,
            'find?impls=' + needle,
            function(json) {
                self.showFind(json.results);
                //history.pushState(state, "", utils.make_url("#impls=" + needle));
            },
            "Error with find (impls) request for " + needle);
    }

    showSearch(defs, refs) {
        this.setState({ state: "builtAndNavigating", page: "search", defs, refs });
    }

    showFind(results) {
        this.setState({ state: "builtAndNavigating", page: "find", results });
    }

    getSummary(id) {
        const self = this;
        utils.request(
            self,
            'summary?id=' + id,
            function (json) {
                window.scroll(0, 0);
                self.setState({ state: "builtAndNavigating", page: "summary", data: json });
                // history.pushState(state, "", utils.make_url("#summary=" + id));
            },
            "Error with summary request for " + id,
        );
    }

    showLoading() {
        this.setState({ page: "loading" });
    }

    showError() {
        this.setState({ page: "internal_error" });
    }

    getSource(file_name, highlight) {
        const self = this;

        utils.request(
            self,
            'src/' + file_name,
            function(json) {
                if (json.Directory) {
                    self.setState({
                        state: "builtAndNavigating",
                        page: "source_dir",
                        data: json.Directory,
                        file: file_name
                    });
                    // history.pushState(state, "", utils.make_url("#src=" + file_name));
                } else if (json.Source) {
                    let line_start;
                    if (highlight) {
                        line_start = highlight.line_start;
                    }
                    self.setState({
                        state: "builtAndNavigating",
                        page: "source",
                        data: json.Source,
                        file: file_name,
                        line_start: line_start,
                        highlight: highlight
                    });
                    // history.pushState(state, "", utils.make_url("#src=" + file_name));
                } else {
                    console.log("Unexpected source data.")
                    console.log(json);
                }
            },
            "Error with source request for " + file_name,
        );
    }

    runBuild() {
        const self = this;
        utils.request(
            self,
            'build',
            function(json) {
                // TODO this isn't quite right because results doesn't include the incremental updates, OTOH, they should get over-written anyway
                // MAIN_PAGE_STATE = { page: "build", results: json }
                self.buildComplete();
                self.pull_data(json.push_data_key);

                // TODO probably not right. Do this before we make the ajax call?
                // history.pushState(MAIN_PAGE_STATE, "", utils.make_url("#build"));
            },
            "Error with build request",
            true,
        );

        let updateSource = new EventSource(utils.make_url("build_updates"));
        updateSource.addEventListener("error", function(event) {
            const data = JSON.parse(event.data);
            const error = <Error code={data.code} level={data.level} message={data.message} spans={data.spans} childErrors={data.children} key={data.id} callbacks={self} />;
            self.setState((prevState) => ({ errors: prevState.errors.set(data.id, error) }));
        }, false);
        updateSource.addEventListener("message", function(event) {
            const data = JSON.parse(event.data);
            self.setState((prevState) => ({ messages: prevState.messages.concat([data]) }));
        }, false);
        updateSource.addEventListener("close", function(event) {
            updateSource.close();
        }, false);
    }

    pull_data(key) {
        if (!key) {
            return;
        }

        const self = this;
        utils.request(
            self,
            'pull?key=' + key,
            function (json) {
                // MAIN_PAGE_STATE.snippets = json;
                // TODO if we've already navigated away from the errors page then this will error
                self.updateSnippets(json);
            },
            "Error pulling data for key " + key,
            true,
        );
    }

    updateSnippets(data) {
        if (!data) {
            return;
        }

        for (let s of data.snippets) {
            this.setState((prevState) => {
                if (s.parent_id) {
                    let parent = prevState.errors.get(s.parent_id);
                    if (parent) {
                        return { errors: prevState.errors.set(s.parent_id, updateChildSnippet(parent, s)) };
                    } else {
                        console.log('Could not find error to update: ' + s.parent_id);
                        return {};
                    }
                } else {
                    let err = prevState.errors.get(s.diagnostic_id);
                    if (err) {
                        return { errors: prevState.errors.set(s.diagnostic_id, updateSnippet(err, s)) };
                    } else {
                        console.log('Could not find error to update: ' + s.diagnostic_id);
                        return {};
                    }
                }
            });
        }
    }

    render() {
        const self = this;
        // TODO we should pass functions without needing closures here
        const fns = {
            doBuild: () => self.doBuild(),
            buildComplete: () => self.buildComplete(),
            getSource: (file_name, line_start) => self.getSource(file_name, line_start),
            getSearch: (needle) => self.getSearch(needle),
            getSummary: (id) => self.getSummary(id),
            getUses: (needle) => self.getUses(needle),
            getImpls: (needle) => self.getImpls(needle),
            showBuildResults: () => self.showBuildResults(),
            showErrCode: (el, data) => self.showErrCode(el, data),
            showError: () => self.showError(),
            showLoading: () => self.showLoading(),
            runBuild: () => self.runBuild(),
        };

        let divMain;
        switch (this.state.page) {
            case "build_results":
                divMain = <Results errors={self.state.errors} messages={self.state.messages} callbacks={fns} />;
                break;
            case "err_code":
                const errData = this.state.errData;
                divMain = <ErrCode code={errData.code} explain={errData.explain} error={errData.error} />;
                break;
            case "search":
                divMain = <SearchResults defs={this.state.defs} refs={this.state.refs} callbacks={fns} />;
                break;
            case "find":
                divMain = <FindResults results={this.state.results} callbacks={fns} />;
                break;
            case "source":
                divMain = <SourceView path={this.state.data.path} lines={this.state.data.lines} highlight={this.state.highlight} scrollTo={this.state.line_start} callbacks={fns} />;
                break;
            case "source_dir":
                divMain = <DirView file={this.state.file} files={this.state.data.files} callbacks={fns} />;
                break;
            case "loading":
                divMain = "Loading...";
                break;
            case "summary":
                divMain = <Summary breadCrumbs={state.data.breadCrumbs} parent={state.data.parent} signature={state.data.signature} doc_summary={state.data.doc_summary} doc_rest={state.data.doc_rest} children={state.data.children} />;
                break;
            case "internal_error":
                divMain = "Server error?";
                break;
            case "start":
            default:
                divMain = null;
        }

        return <div id="div_app">
            <TopBar state={this.state.state} callbacks={fns} />
            <div id="div_main">
                {divMain}
            </div>
        </div>;
    }
}

module.exports = {
    renderApp: function() {
        ReactDOM.render(
            <RustwApp />,
            document.getElementById('container')
        );
    }
}

function updateChildSnippet(err, snippet) {
    const old_children = OrderedMap(err.props.childErrors.map((c) => [c.id, c]));
    let child = old_children.get(snippet.diagnostic_id);
    if (!child) {
        console.log("Could not find child error: " + snippet.diagnostic_id);
        return {};
    }
    let children = old_children.filter((v, k) => k != snippet.diagnostic_id);

    const oldSpans = OrderedMap(child.spans.map((sp) => [sp.id, sp]));
    const spans = update_spans(oldSpans, snippet);
    child.spans = spans.toArray();
    children = children.set(child.id, child);

    return React.cloneElement(err, { childErrors: children.toArray() });
}

function updateSnippet(err, snippet) {
    const oldSpans = OrderedMap(err.props.spans.map((sp) => [sp.id, sp]));
    const spans = update_spans(oldSpans, snippet);

    return React.cloneElement(err, { spans: spans.toArray() });
}

function update_spans(oldSpans, snippet) {
    let spans = oldSpans.filter((v, k) => !snippet.span_ids.includes(k));
    const newSpan = {
        id: snippet.span_ids[0],
        file_name: snippet.file_name,
        block_line_start: snippet.line_start,
        block_line_end: snippet.line_end,
        line_start: snippet.primary_span.line_start,
        line_end: snippet.primary_span.line_end,
        column_start: snippet.primary_span.column_start,
        column_end: snippet.primary_span.column_end,
        text: snippet.text,
        plain_text: snippet.plain_text,
        label: "",
        highlights: snippet.highlights
    };
    return spans.set(newSpan.id, newSpan);
}