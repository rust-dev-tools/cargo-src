// Copyright 2018 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

export const Highlight = (props) => {
    const src_line_prefix = 'src_line_';
    const highlight = props.highlight;
    const is_valid_highlight = validate_highlight(highlight);

    if (!is_valid_highlight) {
        return null;
    }

    const lhs = (highlight.column_start - 1);
    const rhs = (highlight.column_end - 1);
    const highlight_specs = make_highlight(src_line_prefix, highlight.line_start, lhs, rhs);
    if (highlight_specs) {
        const { top, left, width } = highlight_specs;
        const style = {
            top: top,
            left: left,
            width: width,
        }
        return <div className="selected floating_highlight" key={highlight.line_start} style={style}>&nbsp;</div>;
    }

    return null;
}

function make_highlight(src_line_prefix, line_number, left, right) {
    const line_div = $("#" + src_line_prefix + line_number);

    // TODO: get adjust variable as prop through diffIndent in FileResult
    // if Highlight component is to be used in the SearchResults component
    // const adjust = line_div.data('adjust');
    // if (adjust) {
    //     left -= adjust;
    //     right -= adjust;
    // }

    left *= CHAR_WIDTH;
    right *= CHAR_WIDTH;
    if (right === 0) {
        right = line_div.width();
    }

    let width = right - left;
    const paddingLeft = parseInt(line_div.css("padding-left"));
    const paddingTop = parseInt(line_div.css("padding-top"));
    if (left >= 0) {
        left -= paddingLeft;
    } else {
        width += paddingLeft;
    }

    const position = line_div.position();
    if (position) {
        position.left += left;
        position.top += paddingTop;
        return { top: position.top, left: position.left, width };
    }
    // If no position, don't render the highlight
    return null;
}

// TODO: this could maybe be validated in app.js, at srcHighlight declaration
function validate_highlight(highlight) {
    const required_keys = ['line_start', 'line_end', 'column_start', 'column_end'];
    const has_keys = required_keys.reduce((acc, k) => {
        return acc && highlight[k] !== undefined;
    }, true);

    if (!has_keys || highlight.column_start <= 0) {
        return false;
    }
    return true;
}
