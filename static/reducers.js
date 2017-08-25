// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { combineReducers } from 'redux';
import { OrderedMap } from 'immutable';
import { Build, DO_BUILD, BUILD_COMPLETE, SHOW_BUILD_RESULTS, SHOW_ERROR, SHOW_ERR_CODE,
         SHOW_LOADING, ADD_MESSAGE, SET_ERROR, UPDATE_SNIPPET, UPDATE_CHILD_SNIPPET, TOGGLE_CHILDREN,
         TOGGLE_SPANS, SHOW_SEARCH, SHOW_FIND, SHOW_SOURCE, SHOW_SOURCE_DIR, SHOW_SUMMARY } from './actions';

export const Page = {
    START: 'START',
    BUILD_RESULTS: 'BUILD_RESULTS',
    SOURCE: 'SOURCE',
    SOURCE_DIR: 'SOURCE_DIR',
    ERR_CODE: 'ERR_CODE',
    SEARCH: 'SEARCH',
    FIND: 'FIND',
    SUMMARY: 'SUMMARY',
    LOADING: 'LOADING',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export const BuildState = {
    FRESH: 'FRESH',
    BUILDING: 'BUILDING',
    BUILT: 'BUILT',
    BUILT_AND_NAVIGATING: 'BUILT_AND_NAVIGATING',
};

const initialState = {
    page: { type: Page.START },
    build: BuildState.FRESH,
    buildId: 0,
};

const initialErrors = {
    errors: OrderedMap(),
    messages: [],
};

export const rustwReducer = combineReducers({
    page,
    errors,
    build,
    buildId,
});

function page(state = { type: Page.START }, action) {
    switch (action.type) {
        case DO_BUILD:
        case SHOW_BUILD_RESULTS:
            return  { type: Page.BUILD_RESULTS };
        case SHOW_ERROR:
            return { type: Page.INTERNAL_ERROR };
        case SHOW_LOADING:
            return { type: Page.LOADING };
        case SHOW_ERR_CODE:
            return {
                type: Page.ERR_CODE,
                code: action.code,
                explain: action.explain,
                error: action.error,
            };
        case SHOW_SEARCH:
            return {
                type: Page.SEARCH,
                defs: action.defs,
                refs: action.refs,
            };
        case SHOW_FIND:
            return {
                type: Page.FIND,
                results: action.results,
            };
        case SHOW_SOURCE:
            return {
                type: Page.SOURCE,
                path: action.path,
                lines: action.lines,
                lineStart: action.lineStart,
                highlight: action.highlight
            };
        case SHOW_SOURCE_DIR:
            return {
                type: Page.SOURCE_DIR,
                name: action.name,
                files: action.files,
            };
        case SHOW_SUMMARY:
            return {
                type: Page.SUMMARY,
                ...actions.data,
            };
        default:
            return state;
    }
}

function build(state = BuildState.FRESH, action) {
    switch (action.type) {
        case DO_BUILD:
            return BuildState.BUILDING;
        case BUILD_COMPLETE:
        case SHOW_BUILD_RESULTS:
            return BuildState.BUILT;
        case SHOW_ERR_CODE:
        case SHOW_SEARCH:
        case SHOW_FIND:
        case SHOW_SOURCE:
        case SHOW_SOURCE_DIR:
        case SHOW_SUMMARY:
            return BuildState.BUILT_AND_NAVIGATING;
        default:
            return state;
    }
}

function buildId(state = 0, action) {
    switch (action.type) {
        case DO_BUILD:
            return Math.random();
        default:
            return state;
    }
}

function errors(state = initialErrors, action) {
    switch (action.type) {
        case ADD_MESSAGE:
            return { ...state, ... {
                messages: state.messages.concat([action.newMessage]),
            }};
        case SET_ERROR:
            return { ...state, ... {
                errors: state.errors.set(action.newError.id, action.newError),
            }};
        case UPDATE_SNIPPET:
            const id = action.snippet.diagnostic_id;
            const err = state.errors.get(id);
            if (err) {
                return { ...state, ... {
                    errors: state.errors.set(id, updateSnippet(err, action.snippet))
                }};
            } else {
                console.log('Could not find error to update: ' + id);
                return state;
            }
        case UPDATE_CHILD_SNIPPET: {
                const parent = state.errors.get(action.parentId);
                if (parent) {
                    return { ...state, ... {
                        errors: state.errors.set(action.parentId, updateChildSnippet(parent, action.snippet))
                    }};
                } else {
                    console.log('Could not find error to update: ' + action.parentId);
                    return state;
                }
            }
        case TOGGLE_CHILDREN: {
                const parent = state.errors.get(action.parentId);
                if (parent) {
                    return { ...state, ... {
                        errors: state.errors.set(action.parentId, { ...parent, ... { showChildren: !parent.showChildren }})
                    }};
                } else {
                    console.log('Could not find error to update: ' + action.parentId);
                    return state;
                }
            }
        case TOGGLE_SPANS: {
                const parent = state.errors.get(action.parentId);
                if (parent) {
                    return { ...state, ... {
                        errors: state.errors.set(action.parentId, { ...parent, ... { showSpans: !parent.showSpans }})
                    }};
                } else {
                    console.log('Could not find error to update: ' + action.parentId);
                    return state;
                }
            }
        default:
            return state;
    }        
}

function updateChildSnippet(err, snippet) {
    const old_children = OrderedMap(err.children.map((c) => [c.id, c]));
    let child = old_children.get(snippet.diagnostic_id);
    if (!child) {
        console.log("Could not find child error: " + snippet.diagnostic_id);
        return {};
    }
    let children = old_children.filter((v, k) => k != snippet.diagnostic_id);

    const oldSpans = OrderedMap(child.spans.map((sp) => [sp.id, sp]));
    const spans = updateSpans(oldSpans, snippet);
    child.spans = spans.toArray();
    children = children.set(child.id, child);

    return { ...err, ... { children: children.toArray() }};
}

function updateSnippet(err, snippet) {
    const oldSpans = OrderedMap(err.spans.map((sp) => [sp.id, sp]));
    const spans = updateSpans(oldSpans, snippet);

    return { ...err, ... { spans: spans.toArray() }};
}

function updateSpans(oldSpans, snippet) {
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
