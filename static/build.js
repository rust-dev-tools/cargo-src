// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import * as actions from './actions';
import { makeError } from './errors';
import * as utils from './utils';


export function runBuild(dispatch) {
    utils.request(
        dispatch,
        'build',
        function(json) {
            dispatch(actions.buildComplete());
            pull_data(json.push_data_key, dispatch);

            // probably not right. Do this before we make the ajax call?
            // history.pushState(MAIN_PAGE_STATE, "", utils.make_url("#build"));
        },
        "Error with build request",
        true,
    );

    let updateSource = new EventSource(utils.make_url("build_updates"));
    updateSource.addEventListener("error", function(event) {
        const error = makeError(JSON.parse(event.data));
        dispatch(actions.setError(error));
    }, false);
    updateSource.addEventListener("message", function(event) {
        const data = JSON.parse(event.data);
        dispatch(actions.addMessage(data));
    }, false);
    updateSource.addEventListener("close", function(event) {
        updateSource.close();
    }, false);
}

function pull_data(key, dispatch) {
    if (!key) {
        return;
    }

    utils.request(
        dispatch,
        'pull?key=' + key,
        function (json) {
            // MAIN_PAGE_STATE.snippets = json;
            updateSnippets(dispatch, json);
        },
        "Error pulling data for key " + key,
        true,
    );
}

function updateSnippets(dispatch, data) {
    if (!data) {
        return;
    }

    // TODO[ES6]: use data.snippets.forEach
    for (let s of data.snippets) {
        if (s.parent_id) {
            dispatch(actions.updateChildSnippet(s.parent_id, s));
        } else {
            dispatch(actions.updateSnippet(s.diagnostic_id, s));
        }
    }
}
