// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import * as actions from './actions';

export function make_url(suffix) {
    return '/' + CONFIG.demo_mode_root_path + suffix;
}

export function highlight_spans(highlight, line_number_prefix, src_line_prefix, css_class) {
    if (!highlight.line_start || !highlight.line_end) {
        return;
    }

    if (line_number_prefix) {
        for (var i = highlight.line_start; i <= highlight.line_end; ++i) {
            $("#" + line_number_prefix + i).addClass(css_class);
        }
    }

    if (!highlight.column_start || !highlight.column_end || !src_line_prefix) {
        return;
    }

    // Highlight all of the middle lines.
    for (var i = highlight.line_start + 1; i <= highlight.line_end - 1; ++i) {
        $("#" + src_line_prefix + i).addClass(css_class);
    }

    // If we don't have columns (at least a start), then highlight all the lines.
    // If we do, then highlight between columns.
    if (highlight.column_start <= 0) {
        $("#" + src_line_prefix + highlight.line_start).addClass(css_class);
        $("#" + src_line_prefix + highlight.line_end).addClass(css_class);
    } else {
        // First line
        var lhs = (highlight.column_start - 1);
        var rhs = 0;
        if (highlight.line_end === highlight.line_start && highlight.column_end > 0) {
            // If we're only highlighting one line, then the highlight must stop
            // before the end of the line.
            rhs = (highlight.column_end - 1);
        }
        make_highlight(src_line_prefix, highlight.line_start, lhs, rhs, css_class);

        // Last line
        if (highlight.line_end > highlight.line_start) {
            var rhs = 0;
            if (highlight.column_end > 0) {
                rhs = (highlight.column_end - 1);
            }
            make_highlight(src_line_prefix, highlight.line_end, 0, rhs, css_class);
        }
    }
}

export function request(dispatch, urlStr, success, errStr, suppressMessages) {
    const self = this;
    $.ajax({
        url: self.make_url(urlStr),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(success)
    .fail(function (xhr, status, errorThrown) {
        console.log(errStr);
        console.log("error: " + errorThrown + "; status: " + status);

        if (!suppressMessages) {
            dispatch(actions.showError());
        }
        // history.pushState({}, "", self.make_url("#error"));
    });

    if (!suppressMessages) {
        dispatch(actions.showLoading());
    }
}

export function parseLink(file_loc) {
    let line_start = parseInt(file_loc[1], 10);
    let column_start = parseInt(file_loc[2], 10);
    let line_end = parseInt(file_loc[3], 10);
    let column_end = parseInt(file_loc[4], 10);

    if (line_start === 0 || isNaN(line_start)) {
        line_start = 0;
        line_end = 0;
    } else if (line_end === 0 || isNaN(line_end)) {
        line_end = line_start;
    }

    if (isNaN(column_start) || isNaN(column_end)) {
        column_start = 0;
        column_end = 0;
    }

    // FIXME the displayed span doesn't include column start and end, should it?
    // var display = "";
    // if (line_start > 0) {
    //     display += ":" + line_start;
    //     if (!(line_end == 0 || line_end == line_start)) {
    //         display += ":" + line_end;
    //     }
    // }

    var data = {
        "line_start": line_start,
        "line_end": line_end,
        "column_start": column_start,
        "column_end": column_end
    };

    return data;
}

export function edit(target) {
    request(
        null,
        'edit?file=' + target.dataset.link,
        function(json) {
            console.log("edit - success");
        },
        "Error with search edit",
        true);
}

// Left is the number of chars from the left margin to where the highlight
// should start. right is the number of chars to where the highlight should end.
// If right == 0, we take it as the last char in the line.
// 1234 |  text highlight text
//         ^    ^-------^
//         |origin
//         |----| left
//         |------------| right
function make_highlight(src_line_prefix, line_number, left, right, css_class) {
    var line_div = $("#" + src_line_prefix + line_number);
    var highlight = $("<div>&nbsp;</div>");
    highlight.addClass(css_class + " floating_highlight");

    left *= CHAR_WIDTH;
    right *= CHAR_WIDTH;
    if (right === 0) {
        right = line_div.width();
    }

    var width = right - left;
    var padding = parseInt(line_div.css("padding-left"));
    if (left > 0) {
        left += padding;
    } else {
        width += padding;
    }

    var offset = line_div.offset();
    line_div.after(highlight);
    offset.left += left;
    highlight.offset(offset);
    highlight.width(width);
}
