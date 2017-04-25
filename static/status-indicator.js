// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';

function Indicator(props) {
    let overlay = null;
    let className = "div_border_plain";
    if (props.status) {
        // TODO this is changing the background colour, but not adding the animation
        overlay = <div id="div_border_animated" className="animated_border" />;
        className = "div_border_status";
    }
    return <div id="div_border" className={className}>{overlay}</div>;
}

module.exports = {
    renderStatus: function() {
        ReactDOM.render(
            <Indicator status="true" />,
            $("#status_indicator_container").get(0)
        );
    },
    renderBorder: function() {
        ReactDOM.render(
            <Indicator />,
            $("#status_indicator_container").get(0)
        );
    }
}
