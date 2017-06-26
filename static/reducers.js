// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { OrderedMap } from 'immutable';
import { Page, Build, BuildState, DO_BUILD, BUILD_COMPLETE, SHOW_BUILD_RESULTS, SHOW_ERROR, SHOW_ERR_CODE, SHOW_LOADING, ADD_MESSAGE, SET_ERROR, UPDATE_SNIPPET, UPDATE_CHILD_SNIPPET, TOGGLE_CHILDREN, TOGGLE_SPANS } from './actions';


const initialState = {
    page: Page.START,
    build: BuildState.FRESH,
    errors: initialErrorsState,
    buildId: 0,
};

const initialErrorsState = {
    errors: OrderedMap(),
    messages: [],
};

// TODO seperate out page and build reducers, then use combineReducers to generate rustwReducer
export function rustwReducer(state = initialState, action) {
    switch (action.type) {
        case DO_BUILD:
            return { ...state, ... {
                build: BuildState.BUILDING,
                page: Page.BUILD_RESULTS,
                buildId: Math.random(),
                errors: errorsReducer(state.errors, action),
            }};
        case BUILD_COMPLETE:
            return { ...state, ... {
                build: BuildState.BUILT,
            }};
        case SHOW_BUILD_RESULTS:
            return { ...state, ... {
                page: Page.BUILD_RESULTS,
            }};
        case SHOW_ERROR:
            return { ...state, ... {
                page: Page.INTERNAL_ERROR,
            }};
        case SHOW_LOADING:
            return { ...state, ... {
                page: Page.LOADING,
            }};
        case SHOW_ERR_CODE:
            return { ...state, ... {
                page: Page.ERR_CODE,
                errCode: { code: action.code, explain: action.explain, error: action.error },
            }};
        case ADD_MESSAGE:
        case SET_ERROR:
        case UPDATE_SNIPPET:
        case UPDATE_CHILD_SNIPPET:
        case TOGGLE_CHILDREN:
        case TOGGLE_SPANS:
            return { ...state, ... {
                errors: errorsReducer(state.errors, action),
            }};
        default:
            return state;
    }
}

export function errorsReducer(state = initialErrorsState, action) {
    switch (action.type) {
        case DO_BUILD:
            return initialErrorsState;
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
