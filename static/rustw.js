// Copyright 2016-2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.


module.exports = {
    do_build: function() {
        if (CONFIG.demo_mode) {
            do_build_internal('test');
        } else {
            do_build_internal('build');
        }
    },

    onLoad: function () {
        $.getJSON("/config", function(data) {
            CONFIG = data;
            if (CONFIG.build_on_load) {
                module.exports.do_build();
            }
        });

        load_start();
        MAIN_PAGE_STATE = { page: "start" };
        history.replaceState(MAIN_PAGE_STATE, "");

        window.onpopstate = onPopState;    
    },

    win_err_code: function (domElement, errData) {
        let element = $(domElement);
        var explain = element.attr("data-explain");
        if (!explain) {
            return;
        }

        topbar.renderTopBar("builtAndNavigating");

        // Prepare the data for the error code window.
        var data = { "code": element.attr("data-code"), "explain": marked(explain), "error": errData };

        var state = { page: "err_code", data: data };
        load_err_code(state);
        history.pushState(state, "", utils.make_url("#" + element.attr("data-code")));
    },

    pre_load_build: function() {
        SNIPPET_PLAIN_TEXT = {};
        window.scroll(0, 0);
    },

    load_build: function (state) {
        topbar.renderTopBar("built");

        // TODO use React for page re-loads
        // update_snippets(MAIN_PAGE_STATE.snippets);
    },

    load_error: function () {
        $("#div_main").text("Server error?");
    },

    // Identifer search - shows defs and refs
    load_search: function (state) {
        load_search_internal(state);
    },

    load_find: function(state) {
        load_find_internal(state);
    },

    highlight_spans(highlight, line_number_prefix, src_line_prefix, css_class) {
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

            // TODO hover text
        } else {
            // First line
            var lhs = (highlight.column_start - 1);
            var rhs = 0;
            if (highlight.line_end == highlight.line_start && highlight.column_end > 0) {
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
    },

    get_source: function(file_name) {
        get_source_internal(file_name);
    },

    load_link: function() {
        load_link_internal.call(this);
    },

    reload_source: function() {
        if (history.state.page == "source") {
            var source_data = {
                "file": history.state.file,
                "display": "",
                "line_start": 0,
                "line_end": 0,
                "column_start": 0,
                "column_end": 0
            };
            load_source_view(source_data);
        }
    }
};

const errors = require("./errors");
const err_code = require('./err_code');
const topbar = require('./topbar');
const dirView = require('./dirView');
const srcView = require('./srcView');
const utils = require('./utils');
const summary = require('./summary');
const search = require('./search');

function load_link_internal() {
    topbar.renderTopBar("builtAndNavigating");

    var file_loc = this.dataset.link.split(':');
    var file = file_loc[0];

    if (file == "search") {
        search.findUses(file_loc[1]);
        return;
    }

    if (file == "summary") {
        summary.pullSummary(file_loc[1]);
        return;
    }

    var line_start = parseInt(file_loc[1], 10);
    var column_start = parseInt(file_loc[2], 10);
    var line_end = parseInt(file_loc[3], 10);
    var column_end = parseInt(file_loc[4], 10);

    if (line_start == 0 || isNaN(line_start)) {
        line_start = 0;
        line_end = 0;
    } else if (line_end == 0 || isNaN(line_end)) {
        line_end = line_start;
    }

    if (isNaN(column_start) || isNaN(column_end)) {
        column_start = 0;
        column_end = 0;
    }

    // FIXME the displayed span doesn't include column start and end, should it?
    var display = "";
    if (line_start > 0) {
        display += ":" + line_start;
        if (!(line_end == 0 || line_end == line_start)) {
            display += ":" + line_end;
        }
    }

    var data = {
        "file": file,
        "display": display,
        "line_start": line_start,
        "line_end": line_end,
        "column_start": column_start,
        "column_end": column_end
    };
    load_source_view(data);
}

function load_start() {
    $("#div_main").html("");
    $("#div_quick_edit").hide();
    $("#div_rename").hide();
    $("#measure").hide();

    topbar.renderTopBar("fresh");
}

function load_search_internal(state) {
    topbar.renderTopBar("builtAndNavigating");
    search.renderSearchResults(state.data.defs, state.data.refs, $("#div_main").get(0));
    window.scroll(0, 0);
}

// Find = basic search, just a list of uses, e.g., find impls or text search
function load_find_internal(state) {
    topbar.renderTopBar("builtAndNavigating");
    search.renderFindResults(state.data.results, $("#div_main").get(0));
    window.scroll(0, 0);
}

function load_err_code(state) {
    topbar.renderTopBar("builtAndNavigating");
    err_code.renderErrorExplain(state.data, $("#div_main").get(0));
}

function load_source(state) {
    const highlight = {
        file: state.file,
        display: state.display,
        line_start: state.line_start,
        line_end: state.line_end,
        column_start: state.column_start,
        column_end: state.column_end
    };
    srcView.renderSourceView(state.data.path, state.data.lines, highlight, $("#div_main").get(0));

    // Jump to the start line. 100 is a fudge so that the start line is not
    // right at the top of the window, which makes it easier to see.
    var y = state.line_start * $("#src_line_number_1").height() - 100;
    window.scroll(0, y);
}

function do_build_internal(buildStr) {
    errors.rebuildAndRender(buildStr, $("#div_main").get(0));
    topbar.renderTopBar("building");
    window.scroll(0, 0);
}

function load_dir(state) {
    dirView.renderDirView(state.file, state.data.files, state.data.path, $("#div_main").get(0));
    window.scroll(0, 0);
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
    if (right == 0) {
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

function get_source_internal(file_name) {
    topbar.renderTopBar("builtAndNavigating");

    $.ajax({
        url: 'src' + utils.make_url(file_name),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        if (json.Directory) {
            var state = {
                "page": "source_dir",
                "data": json.Directory,
                "file": file_name,
            };
            load_dir(state);
            history.pushState(state, "", utils.make_url("#src=" + file_name));
        } else if (json.Source) {
            var state = {
                "page": "source",
                "data": json.Source,
                "file": file_name,
            };
            load_source(state);
            history.pushState(state, "", utils.make_url("#src=" + file_name));
        } else {
            console.log("Unexpected source data.")
            console.log(json);
        }
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with source request for " + file_name);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", utils.make_url("#src=" + file_name));
    });

    $("#div_main").text("Loading...");
}

function load_source_view(data) {
    $.ajax({
        url: utils.make_url('src/' + data.file),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        data.page = "source";
        data.data = json.Source;
        load_source(data);

        history.pushState(data, "", utils.make_url("#src=" + data.file + data.display));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with source request");
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({ page: "error"}, "", utils.make_url("#src=" + data.file + data.display));
    });

    $("#div_main").text("Loading...");
}

function onPopState(event) {
    var state = event.state;
    if (!state) {
        console.log("ERROR: null state: ");
        load_start();
    } else if (state.page == "start") {
        load_start();
    } else if (state.page == "error") {
        load_error();
    } else if (state.page == "build") {
        pre_load_build();
        load_build(state);
    } else if (state.page == "err_code") {
        load_err_code(state);
    } else if (state.page == "source") {
        load_source(state);
    } else if (state.page == "source_dir") {
        load_dir(state);
    } else if (state.page == "search") {
        module.exports.load_search(state);
    } else if (state.page == "find") {
        load_find_internal(state);
    } else if (state.page == "summary") {
        summary.loadSummary(state);
    } else {
        console.log("ERROR: Unknown page state: ");
        console.log(state);
        load_start();
    }
}
