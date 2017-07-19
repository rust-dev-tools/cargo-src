// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import { runBuild } from './build';
const utils = require('./utils');

export const DO_BUILD = "DO_BUILD";
export const BUILD_COMPLETE = "BUILD_COMPLETE";
export const SHOW_BUILD_RESULTS = "SHOW_BUILD_RESULTS";
export const SHOW_ERROR = "SHOW_ERROR";
export const SHOW_LOADING = "SHOW_LOADING";
export const SHOW_ERR_CODE = "SHOW_ERR_CODE";

export const ADD_MESSAGE = "ADD_MESSAGE";
export const SET_ERROR = "SET_ERROR";
export const UPDATE_SNIPPET = "UPDATE_SNIPPET";
export const UPDATE_CHILD_SNIPPET = "UPDATE_CHILD_SNIPPET";
export const TOGGLE_CHILDREN = "TOGGLE_CHILDREN";
export const TOGGLE_SPANS = "TOGGLE_SPANS";

export const SHOW_SEARCH = "SHOW_SEARCH";
export const SHOW_FIND = "SHOW_FIND";
export const SHOW_SOURCE = "SHOW_SOURCE";
export const SHOW_SOURCE_DIR = "SHOW_SOURCE_DIR";
export const SHOW_SUMMARY = "SHOW_SUMMARY";


export function startBuild() {
    return { type: DO_BUILD };
}

export function doBuild() {
    return (dispatch) => {
        dispatch(startBuild());
        runBuild(dispatch);
    };
}

export function buildComplete() {
    return { type: BUILD_COMPLETE };
}

export function showBuildResults() {
    // TODO
    // window.scroll(0, 0);
    return { type: SHOW_BUILD_RESULTS };
}

export function showError() {
    return { type: SHOW_ERROR };
}

export function showErrCode(code, explain, error) {
    return { type: SHOW_ERR_CODE, code, explain, error };
}

export function showLoading() {
    return { type: SHOW_LOADING };
}

export function addMessage(msg) {
    return { type: ADD_MESSAGE, newMessage: msg };
}

export function setError(err) {
    return { type: SET_ERROR, newError: err };
}

export function updateSnippet(id, s) {
    return { type: UPDATE_SNIPPET, id: id, snippet: s };
}

export function updateChildSnippet(parentId, err) {
    return { type: UPDATE_CHILD_SNIPPET, parentId: parentId, snippet: s };
}

export function toggleChildren(parentId) {
    return { type: TOGGLE_CHILDREN, parentId };
}

export function toggleSpans(parentId) {
    return { type: TOGGLE_SPANS, parentId };
}

export function getSearch(needle) {
    return (dispatch) => {
        utils.request(
            dispatch,
            'search?needle=' + needle,
            function(json) {
                dispatch(showSearch(json.defs, json.refs));
                // history.pushState(state, "", utils.make_url("#search=" + needle));
            },
            "Error with search request for " + needle);
    };
}

export function showSearch(defs, refs) {
    return { type: SHOW_SEARCH, defs, refs };
}

export function showFind(results) {
    return { type: SHOW_FIND, results };
}

export function getSource(fileName, highlight) {
    return (dispatch) => {
        utils.request(
            dispatch,
            'src/' + fileName,
            function(json) {
                if (json.Directory) {
                    dispatch(showSourceDir(fileName, json.Directory.files));
                    // history.pushState(state, "", utils.make_url("#src=" + fileName));
                } else if (json.Source) {
                    let lineStart;
                    if (highlight) {
                        lineStart = highlight.line_start;
                    }
                    dispatch(showSource(json.Source.path, json.Source.lines, lineStart, highlight));
                    // history.pushState(state, "", utils.make_url("#src=" + fileName));
                } else {
                    console.log("Unexpected source data.")
                    console.log(json);
                }
            },
            "Error with source request for " + fileName,
        );
    };
}

export function showSource(path, lines, lineStart, highlight) {
    return { type: SHOW_SOURCE, path, lines, lineStart, highlight };
}

export function showSourceDir(name, files) {
    return { type: SHOW_SOURCE_DIR, name, files };
}

export function getUses(needle) {
    return (dispatch) => {
        utils.request(
            dispatch,
            'search?id=' + needle,
            function(json) {
                dispatch(showSearch(json.defs, json.refs));
                // history.pushState(state, "", utils.make_url("#search=" + needle));
            },
            "Error with search (uses) request for " + needle);
    };
}

export function getImpls(needle) {
    return (dispatch) => {
        utils.request(
            dispatch,
            'find?impls=' + needle,
            function(json) {
                dispatch(showFind(json.results));
                //history.pushState(state, "", utils.make_url("#impls=" + needle));
            },
            "Error with find (impls) request for " + needle);
    };
}

export function getSummary(id) {
    return (dispatch) => {
        utils.request(
            dispatch,
            'summary?id=' + id,
            function(json) {
                window.scroll(0, 0);
                dispatch(showSummary(json));
                // history.pushState(state, "", utils.make_url("#summary=" + id));
            },
            "Error with summary request for " + id);
    };
}

export function showSummary(data) {
    return { type: SHOW_SUMMARY, data };
}
