// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import { runBuild } from './build';

export const DO_BUILD = "do_build";
export const BUILD_COMPLETE = "build_complete";
export const SHOW_BUILD_RESULTS = "show_build_results";
export const SHOW_ERROR = "show_error";
export const SHOW_LOADING = "show_loading";
export const SHOW_ERR_CODE = "SHOW_ERR_CODE";

export const ADD_MESSAGE = "ADD_MESSAGE";
export const SET_ERROR = "SET_ERROR";
export const UPDATE_SNIPPET = "UPDATE_SNIPPET";
export const UPDATE_CHILD_SNIPPET = "UPDATE_CHILD_SNIPPET";
export const TOGGLE_CHILDREN = "TOGGLE_CHILDREN";
export const TOGGLE_SPANS = "TOGGLE_SPANS";

export const Page = {
    START: 'start',
    BUILD_RESULTS: 'build_results',
    SOURCE_DIR: 'source_dir',
    SOURCE: 'source',
    ERR_CODE: 'err_code',
    SEARCH: 'search',
    FIND: 'find',
    SUMMARY: 'summary',
    LOADING: 'loading',
    INTERNAL_ERROR: 'internal_error',
};

export const BuildState = {
    FRESH: 'fresh',
    BUILDING: 'building',
    BUILT: 'built',
    BUILT_AND_NAVIGATING: 'built_and_navigating',
};

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
