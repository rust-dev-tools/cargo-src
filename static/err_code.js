// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';

const { Error } = require('./errors');

function ErrCode(props) {
    let explain;
    if (props.explain) {
        explain = props.explain;
    } else {
        explain = "No further explaination for this error code.";
    }
    return (<div id="div_err_code">
        <h2 id="err_code_header">{props.code}</h2>

        <div id="div_err_code_explain" dangerouslySetInnerHTML={{__html: explain}} />

        <hr className="separator" />

        <div id="div_err_code_error">
            <Error {...props.error} showSpans="true" hideCodeLink="true" hideButtons="true" callbacks={props.callbacks} />
        </div>
    </div>
    );
}

module.exports = {
    ErrCode
}
