// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';

const rustw = require('./rustw');
const utils = require('./utils');

function HomeLink(props) {
    // Save the current window.
    const backup = history.state;
    const onClick = function() {
        rustw.pre_load_build();
        rustw.load_build(backup);
        history.pushState(backup, "", utils.make_url("#build"));
    };

    let className;
    if (props.visible) {
        className = "header_link";
    } else {
        className = "link_hidden";
    }

    return <span id="link_back" className={className} onClick={onClick}>&#8592; return to build results</span>;
}

module.exports = {
    renderHomeLink: function() {
        ReactDOM.render(
            <HomeLink visible="true"/>,
            $("#link_back_container").get(0)
        );
    },

    unrenderHomeLink: function() {
            ReactDOM.render(<HomeLink />, $("#link_back_container").get(0));
    }
}
