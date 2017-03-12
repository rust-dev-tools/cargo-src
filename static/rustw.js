// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

let errors = require("./errors.js");
let snippet = require("./snippet.js");

Handlebars.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
});

Handlebars.registerHelper("add", function(a, b, options)
{
    return parseInt(a) + parseInt(b);
});

Handlebars.registerHelper("def", function(a, b, options)
{
    return a != undefined;
});

Handlebars.registerHelper("isDir", function(a, options)
{
    return a == "Directory";
});

Handlebars.registerPartial("bread_crumbs", Handlebars.templates.bread_crumbs);

module.exports = {
    onLoad: function () {
        $.getJSON("/config", function(data) {
            CONFIG = data;
            if (CONFIG.build_on_load) {
                do_build();
            }
        });

        load_start();
        $(document).on("keypress", "#search_box", function(e) {
             if (e.which == 13) {
                 win_search(this.value);
             }
        });
        MAIN_PAGE_STATE = { page: "start" };
        history.replaceState(MAIN_PAGE_STATE, "");

        window.onpopstate = function(event) {
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
                  load_search(state);
            } else if (state.page == "find") {
                  load_find(state);
            } else if (state.page == "summary") {
                  load_summary(state);
            } else {
                console.log("ERROR: Unknown page state: ");
                console.log(state);
                load_start();
            }

            hide_options();
        };    
    }
};

function load_start() {
    enable_button($("#link_build"), "build");
    $("#link_build").click(do_build);
    $("#link_options").click(show_options);
    $("#link_browse").click(do_browse);

    $("#div_main").html("");
    $("#div_options").hide();
    // TODO at this point, it makes sense to make these programatically.
    $("#div_src_menu").hide();
    $("#div_line_number_menu").hide();
    $("#div_ref_menu").hide();
    $("#div_glob_menu").hide();
    $("#div_quick_edit").hide();
    $("#div_rename").hide();
    $("#measure").hide();
}

function show_options(event) {
    var options = $("#div_options");

    options.show();
    options.offset({ "top": event.pageY, "left": event.pageX });

    $("#div_main").click(hide_options);
    $("#div_header").click(hide_options);

    return false;
}

function hide_options() {
    $("#div_main").off("click");
    $("#div_header").off("click");

    $("#div_options").hide();
}

function pre_load_build() {
    $("#div_main").html("<div id=\"div_errors\">\
                             <span id=\"expand_errors\" class=\"small_button\"></span> <span id=\"div_std_label\">errors:</span>\
                         </div>\
                         \
                         <div id=\"div_stdout\">\
                             <span id=\"expand_messages\" class=\"small_button\"></span> <span id=\"div_std_label\">info:</span>\
                             <div id=\"div_messages\">\
                             </div>\
                         </div>");

    if (CONFIG.demo_mode) {
        $("#div_main").prepend("<div id=\"div_message\">\
                                    <h2>demo mode</h2>\
                                    Click '+' and '-' to expand/hide info.<br>\
                                    Click error codes or source links to see more stuff. Source links can be right-clicked for more options (note that edit functionality won't work in demo mode).\
                                </div>");
    }

    SNIPPET_PLAIN_TEXT = {};
    show_stdout();
    show_stderr();
    window.scroll(0, 0);
}

function load_build(state) {
    // TODO need to append any errors in the state to the screen
    // so that back works and if we missed any earlier

    var rebuild_label = "rebuild";
    if (CONFIG.build_on_load) {
        rebuild_label += " (F5)";
    }
    enable_button($("#link_build"), rebuild_label);
    $("#link_build").click(do_build);

    $("#link_back").css("visibility", "hidden");
    $("#link_browse").css("visibility", "visible");
    init_build_results();

    update_snippets(MAIN_PAGE_STATE.snippets);
}

function load_summary(state) {
    show_back_link();
    // console.log(state.data);
    $("#div_main").html(Handlebars.templates.summary(state.data));

    // Make link and menus for idents on the page.
    let idents = $(".summary_ident");
    idents.click(load_link);
    idents.on("contextmenu", (ev) => {
        let target = ev.target;
        ev.data = ev.target.id.substring("def_".length);
        return show_ref_menu(ev);
    });

    // Add links and menus for breadcrumbs.
    let breadcrumbs = $(".link_breadcrumb");
    breadcrumbs.click(load_link);
    breadcrumbs.on("contextmenu", (ev) => {
        let target = ev.target;
        ev.data = ev.target.id.substring("breadcrumb_".length);
        return show_ref_menu(ev);
    });

    // Hide extra docs.
    hide_summary_doc();

    // Up link to jump up a level.
    $("#jump_up").click(load_link);
    // Down links to jump to children.
    $(".jump_children").click(load_link);

    window.scroll(0, 0);
}

function show_summary_doc() {
    var element = $("#expand_docs");
    show_hide(element, "-", hide_summary_doc);
    $("#div_summary_doc_more").show();
}

function hide_summary_doc() {
    var element = $("#expand_docs");
    show_hide(element, "+", show_summary_doc);
    $("#div_summary_doc_more").hide();
}

function win_search(needle) {
    $.ajax({
        url: make_url('search?needle=' + needle),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "search",
            "data": json,
            "needle": needle,
        };
        load_search(state);
        history.pushState(state, "", make_url("#search=" + needle));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with search request for " + needle);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", make_url("#search=" + needle));
    });

    $("#div_main").text("Loading...");
}

// Identifer search - shows defs and refs
function load_search(state) {
    show_back_link();
    $("#div_main").html(Handlebars.templates.search_results(state.data));
    $(".src_link").removeClass("src_link");
    $(".div_search_file_link").click(load_link);
    $(".div_span_src_number").click(load_link);
    $(".span_src").click(load_link);
    highlight_needle(state.data.defs, "def");
    highlight_needle(state.data.refs, "ref");
    window.scroll(0, 0);
}

// Find = basic search, just a list of uses, e.g., find impls or text search
function load_find(state) {
    show_back_link();
    $("#div_main").html(Handlebars.templates.find_results(state.data));
    $(".src_link").removeClass("src_link");
    $(".div_search_file_link").click(load_link);
    $(".div_span_src_number").click(load_link);
    $(".span_src").click(load_link);
    highlight_needle(state.data.results, "result");
    window.scroll(0, 0);
}

function highlight_needle(results, tag) {
    for (var i in results) {
        for (var line of results[i].lines) {
            line.line_end = line.line_start;
            highlight_spans(line,
                            null,
                            "snippet_line_" + tag + "_" + i + "_",
                            "selected");
        }
    }
}

function set_snippet_plain_text(spans) {
    SNIPPET_PLAIN_TEXT = {};
    for (var s of spans) {
        set_one_snippet_plain_text(s);
    }
}

function set_one_snippet_plain_text(s) {
    var data = {
        "plain_text": s.plain_text,
        "file_name": s.file_name,
        "line_start": s.line_start,
        "line_end": s.line_end
    };
    SNIPPET_PLAIN_TEXT["span_loc_" + s.id] = data;
}

function load_error() {
    $("#div_main").text("Server error?");
}

function load_err_code(state) {
    $("#div_main").html(Handlebars.templates.err_code(state.data));

    // Customise the copied error.
    var err = $("#div_err_code_error");
    // Make the error code not a link
    var err_err_code = err.find(".err_code");
    err_err_code.css("text-decoration", "none");
    err_err_code.css("cursor", "auto");
    err_err_code.off("click");
    // Make all sub-parts visible.
    var err_all = err.find(":hidden");
    err_all.show();
    // Hide all buttons.
    var err_buttons = err.find(".small_button");
    err_buttons.css("visibility", "hidden");
}

function load_source(state) {
    let page = $(Handlebars.templates.src_view(state.data));
    page.find(".link_breadcrumb").click(state.file, handle_bread_crumb_link);
    $("#div_main").empty().append(page);

    highlight_spans(state, "src_line_number_", "src_line_", "selected");

    // Jump to the start line. 100 is a fudge so that the start line is not
    // right at the top of the window, which makes it easier to see.
    var y = state.line_start * $("#src_line_number_1").height() - 100;
    window.scroll(0, y);

    // This is kind of slow and shouldn't cause reflow, so we'll do it after
    // we display the page.
    add_source_jump_links(page);
    add_line_number_menus(page);
    add_glob_menus(page);
    add_ref_functionality(page);
}

// Menus, highlighting on mouseover.
function add_ref_functionality(page) {
    for (let el of page.find(".class_id")) {
        let element = $(el);
        var classes = el.className.split(' ');
        for (let c of classes) {
            if (c.startsWith('class_id_')) {
                element.hover(function() {
                    $("." + c).css("background-color", "#d5f3b5");
                }, function() {
                    $("." + c).css("background-color", "");
                });

                var id = c.slice('class_id_'.length);
                element.on("contextmenu", null, id, show_ref_menu);
                element.addClass("hand_cursor");

                break;
            }
        }
    }
}

function add_glob_menus(page) {
    var globs = page.find(".glob");
    globs.on("contextmenu", show_glob_menu);
    globs.addClass("hand_cursor");
}

function add_source_jump_links(page) {
    var linkables = page.find(".src_link");
    linkables.click(load_doc_or_src_link);
}

function add_line_number_menus(page) {
    var line_nums = page.find(".div_src_line_number");
    line_nums.on("contextmenu", show_line_number_menu);
    line_nums.addClass("hand_cursor");
}

function highlight_spans(highlight, line_number_prefix, src_line_prefix, css_class) {
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

function do_build() {
    if (CONFIG.demo_mode) {
        do_build_internal('test');
    } else {
        do_build_internal('build');
    }
}

function make_url(suffix) {
    return '/' + CONFIG.demo_mode_root_path + suffix;
}

function do_build_internal(build_str) {
    $.ajax({
        url: make_url(build_str),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        stop_build_animation();
        // TODO this isn't quite right because results doesn't include the incremental updates, OTOH, they should get over-written anyway
        MAIN_PAGE_STATE = { page: "build", results: json }
        load_build(MAIN_PAGE_STATE);
        pull_data(json.push_data_key);

        // TODO should get moved below when state is right
        history.pushState(MAIN_PAGE_STATE, "", make_url("#build"));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with build request");
        console.log("error: " + errorThrown + "; status: " + status);
        load_error();

        MAIN_PAGE_STATE = { page: "error" };
        history.pushState(MAIN_PAGE_STATE, "", make_url("#build"));
        stop_build_animation();
    });

    $("#link_back").css("visibility", "hidden");
    $("#link_browse").css("visibility", "hidden");
    disable_button($("#link_build"), "building...");
    hide_options();
    start_build_animation();
    pre_load_build();

    let updateSource = new EventSource(make_url("build_updates"));
    updateSource.addEventListener("error", function(event) {
        let error = JSON.parse(event.data);

        let container = $("<div />");
        errors.renderError(error, container.get(0));
        $("#div_errors").append(container);

        for (let s of error.spans) {
            set_one_snippet_plain_text(s);
        }
        for (let c of error.children) {
            for (let s of c.spans) {
                set_one_snippet_plain_text(s);
            }
        }

        // TODO should be doing init_build_results stuff on just one error at a time
        init_build_results();
    }, false);
    updateSource.addEventListener("message", function(event) {
        $("#div_messages").append("<pre>" + JSON.parse(event.data) + "</pre>")
    }, false);
    updateSource.addEventListener("close", function(event) {
        updateSource.close();
    }, false);
}

function pull_data(key) {
    if (!key) {
        return;
    }

    $.ajax({
        url: make_url('pull?key=' + key),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        MAIN_PAGE_STATE.snippets = json;
        update_snippets(json);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error pulling data for key " + key);
        console.log("error: " + errorThrown + "; status: " + status);
    });
}


function update_snippets(data) {
    if (!data) {
        return;
    }

    for (let s of data.snippets) {
        // Used by set_snippet_plain_text.
        s.id = s.ids[0];

        var loc = $("#span_loc_" + s.id);
        var p = s.primary_span;
        loc.attr("data-link", s.file_name + ":" + p.line_start + ":" + p.column_start + ":" + p.line_end + ":" + p.column_end);
        loc.text(s.file_name + ":" + p.line_start + ":" + p.column_start + ": " + p.line_end + ":" + p.column_end);

        $("#div_span_label_" + s.id).text("");

        let target = $("#src_span_" + s.id);
        let snip = s;
        // TODO if the spans are shown before we call this, then we won't call
        // show_spans and we won't call update_span.
        target[0].update_span = function() {
            // TODO should use state for this rather than updating directly
            snippet.renderSnippetSpan(snip, target.get(0));

            for (let h of snip.highlights) {
                var css_class = "selected_secondary";
                if (JSON.stringify(h[0]) == JSON.stringify(snip.primary_span)) {
                    css_class = "selected";
                }
                highlight_spans(h[0],
                                "snippet_line_number_" + snip.id + "_",
                                "snippet_line_" + snip.id + "_",
                                css_class);

                // Make a label for the message.
                if (h[1]) {
                    var line_span = $("#snippet_line_" + snip.id + "_" + h[0].line_start);
                    var old_width = line_span.width();
                    var label_span = $("<span class=\"highlight_label\">" + h[1] + "</span>");
                    line_span.append(label_span);
                    var offset = line_span.offset();
                    offset.left += old_width + 40;
                    label_span.offset(offset);
                }
            }
        };

        // We are replacing multiple spans with a single one. We put everything
        // in the first slot, so hide the others.
        for (var i = 1; i < s.ids.length; ++i) {
            let div = $("#div_span_" + s.ids[i]);
            div.hide();
        }
    }
    set_snippet_plain_text(data.snippets);
}

function init_build_results() {
    var expand_spans = $(".expand_spans");
    expand_spans.each(hide_spans);

    var expand_children = $(".expand_children");
    expand_children.each(show_children);

    var err_codes = $(".err_code").filter(function(i, e) { return !!$(e).attr("data-explain"); });
    err_codes.click(win_err_code);
    err_codes.addClass("err_code_link");

    var src_links = $(".span_loc");
    src_links.click(win_src_link);
    src_links.on("contextmenu", show_src_link_menu);
}

// Doesn't actually add an action to the button, just makes it look active.
function enable_button(button, text) {
    button.css("color", "black");
    button.css("cursor", "pointer");
    button.text(text);
}

// Removes click action and makes it look disabled.
function disable_button(button, text) {
    button.css("color", "#808080");
    button.css("cursor", "auto");
    button.off("click");
    button.text(text);
}

function start_build_animation() {
    $("#div_border").css("background-color", "#e3e9ff");

    var border = $("#div_border_animated");
    border.show();
    border.addClass("animated_border");
}

function stop_build_animation() {
    $("#div_border").css("background-color", "black");

    var border = $("#div_border_animated");
    border.removeClass("animated_border");
    border.hide();
}

function show_hide(element, text, fn) {
    element.text(text);
    element.off("click");
    element.click(fn);
}

function show_stdout() {
    var expand = $("#expand_messages");
    show_hide(expand, "-", hide_stdout);
    $("#div_messages").show();
}

function hide_stderr() {
    var expand = $("#expand_errors");
    show_hide(expand, "+", show_stderr);
    $(".div_diagnostic").hide();
}

function show_stderr() {
    var expand = $("#expand_errors");
    show_hide(expand, "-", hide_stderr);
    $(".div_diagnostic").show();
}

function hide_stdout() {
    var expand = $("#expand_messages");
    show_hide(expand, "+", show_stdout);
    $("#div_messages").hide();
}

function show_spans() {
    var element = $(this);
    show_hide(element, "-", hide_spans);
    var spans = element.next().find(".div_all_span_src");
    spans.show();

    for (let s of spans) {
        if (s.update_span) {
            s.update_span();
        }
    }
}

function hide_spans() {
    var element = $(this);
    show_hide(element, "+", show_spans);
    element.next().find(".div_all_span_src").hide();
}

function show_children() {
    var element = $(this);
    show_hide(element, "-", hide_children);
    element.next().hide();
    element.next().next().show();
}

function hide_children() {
    var element = $(this);
    show_hide(element, "+", show_children);
    element.next().show();
    element.next().next().hide();
}

function show_back_link() {
    // Save the current window.
    var backup = history.state;

    // Make the 'back' link visible and go back on click.
    $("#link_back").css("visibility", "visible");
    $("#link_back").click(function() {
        pre_load_build();
        load_build(backup);
        history.pushState(backup, "", make_url("#build"));
    });
}

function win_err_code() {
    var element = $(this);
    var explain = element.attr("data-explain");
    if (!explain) {
        return;
    }

    show_back_link();

    // Prepare the data for the error code window.
    var error_html = element.parent().html();
    var data = { "code": element.attr("data-code"), "explain": marked(explain), "error": error_html };

    var state = { page: "err_code", data: data };
    load_err_code(state);
    history.pushState(state, "", make_url("#" + element.attr("data-code")));
}

function do_browse() {
    get_source(CONFIG.source_directory);
}

function get_source(file_name) {
    show_back_link();

    $.ajax({
        url: 'src' + make_url(file_name),
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
            history.pushState(state, "", make_url("#src=" + file_name));
        } else if (json.Source) {
            var state = {
                "page": "source",
                "data": json.Source,
                "file": file_name,
            };
            load_source(state);
            history.pushState(state, "", make_url("#src=" + file_name));
        } else {
            console.log("Unexpected source data.")
            console.log(json);
        }
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with source request for " + file_name);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", make_url("#src=" + file_name));
    });

    $("#div_main").text("Loading...");
}

function load_dir(state) {
    console.log(state);
    $("#div_main").html(Handlebars.templates.dir_view(state.data));
    $(".div_entry_name").click(state.file, handle_dir_link);
    $(".link_breadcrumb").click(state.file, handle_bread_crumb_link);
    window.scroll(0, 0);
}

function handle_dir_link(event) {
    get_source(event.data + "/" + event.target.innerText);
}

function handle_bread_crumb_link(event) {
    var crumbs = event.data.split('/');
    var slice = crumbs.slice(0, parseInt(event.target.id.substring("breadcrumb_".length), 10) + 1);
    get_source(slice.join('/'));
}

function win_src_link() {
    show_back_link();
    load_link.call(this);
}

function load_doc_or_src_link() {
    // TODO special case links to the same file
    var element = $(this);
    var doc_url = element.attr("doc_url")

    if (!doc_url) {
        return load_link.call(this);
    }

    window.open(doc_url, '_blank');
}

function load_link() {
    var element = $(this);
    var file_loc = element.attr("data-link").split(':');
    var file = file_loc[0];

    if (file == "search") {
        find_uses(file_loc[1]);
        return;
    }

    if (file == "summary") {
        summary(file_loc[1]);
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

function load_source_view(data) {
    $.ajax({
        url: make_url('src/' + data.file),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        data.page = "source";
        data.data = json.Source;
        load_source(data);

        history.pushState(data, "", make_url("#src=" + data.file + data.display));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with source request");
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({ page: "error"}, "", make_url("#src=" + data.file + data.display));
    });

    $("#div_main").text("Loading...");
}

function show_menu(menu, event, hide_fn) {
    var target = $(event.target);
    var data = {
        "position": { "top": event.pageY, "left": event.pageX },
        "target": target
    };

    menu.show();
    menu.offset(data.position);

    // TODO can we do better than this to close the menu? (Also options menu).
    $("#div_main").click(hide_fn);
    $("#div_header").click(hide_fn);

    return data;
}

function show_src_link_menu(event) {
    var src_menu = $("#div_src_menu");
    var data = show_menu(src_menu, event, hide_src_link_menu);

    if (CONFIG.unstable_features) {
        var edit_data = { 'link': data.target.attr("data-link"), 'hide_fn': hide_src_link_menu };
        $("#src_menu_edit").click(edit_data, edit);
        $("#src_menu_quick_edit").click(data, quick_edit_link);
    } else {
        $("#src_menu_edit").hide();
        $("#src_menu_quick_edit").hide();        
    }
    $("#src_menu_view").click(data.target, view_from_menu);

    return false;
}

function show_glob_menu(event) {
    if (CONFIG.unstable_features) {
        var menu = $("#div_glob_menu");
        var data = show_menu(menu, event, hide_glob_menu);

        $("#glob_menu_deglob").click(event.target, deglob);

        return false;
    }
}

function show_line_number_menu(event) {
    var menu = $("#div_line_number_menu");
    var data = show_menu(menu, event, hide_line_number_menu);

    var line_number = line_number_for_span(data.target);
    var file_name = history.state.file;
    if (CONFIG.unstable_features) {
        var edit_data = { 'link': file_name + ":" + line_number, 'hide_fn': hide_line_number_menu };
        $("#line_number_menu_edit").click(edit_data, edit);
        $("#line_number_quick_edit").click(data, quick_edit_line_number);
    } else {
        $("#line_number_menu_edit").hide();
        $("#line_number_quick_edit").hide();
    }

    if (CONFIG.vcs_link) {
        let link = $("#line_number_vcs").children().first();
        link.click(function() { hide_line_number_menu(); return true; });
        link.attr("href", CONFIG.vcs_link.replace("$file", file_name).replace("$line", line_number))
    } else {
        $("#line_number_vcs").hide();
    }

    return false;
}

function show_ref_menu(event) {
    var menu = $("#div_ref_menu");
    var data = show_menu(menu, event, hide_ref_menu);
    data.id = event.data;

    var doc_url = data.target.attr("doc_url");
    if (doc_url) {
        var view_data = { 'link': doc_url, 'hide_fn': hide_ref_menu };
        $("#ref_menu_view_docs").show();
        $("#ref_menu_view_docs").click(view_data, open_tab);
    } else {
        $("#ref_menu_view_docs").hide();
    }

    var src_url = data.target.attr("src_url");
    if (src_url) {
        var view_data = { 'link': src_url, 'hide_fn': hide_ref_menu };
        $("#ref_menu_view_source").show();
        $("#ref_menu_view_source").click(view_data, open_tab);
    } else {
        $("#ref_menu_view_source").hide();
    }

    $("#ref_menu_view_summary").click(event.data, (ev) => summary(ev.data));
    $("#ref_menu_find_uses").click(event.data, (ev) => find_uses(ev.data));

    let impls = data.target.attr("impls");
    // FIXME we could display the impl count in the menu
    if (impls && impls != "0") {
        $("#ref_menu_find_impls").click(event.data, (ev) => find_impls(ev.data));
    } else {
        $("#ref_menu_find_impls").hide();
    }

    if (CONFIG.unstable_features) {
        $("#ref_menu_rename").click(data, show_rename);
    } else {
        $("#ref_menu_rename").hide();
    }

    return false;
}

function hide_src_link_menu() {
    hide_menu($("#div_src_menu"));
}

function hide_glob_menu() {
    hide_menu($("#div_glob_menu"));
}

function hide_line_number_menu() {
    hide_menu($("#div_line_number_menu"));
}

function hide_ref_menu() {
    hide_menu($("#div_ref_menu"));
}

function hide_menu(menu) {
    menu.children("div").off("click");
    menu.hide();
}

function open_tab(event) {
    window.open(event.data.link, '_blank');
    event.data.hide_fn();
}

function deglob(event) {
    let glob = $(event.data);
    let location = glob.attr("location").split(":");
    let file_name = history.state.file;
    let deglobbed = glob.attr("title");

    let data = {
        file_name: file_name,
        line_start: location[0],
        line_end: location[0],
        column_start: location[1],
        column_end: parseInt(location[1]) + 1,
        // TODO we could be much smarter here - don't use {} if there is only one item, delete the
        // line if there are none. Put on multiple lines if necessary or use rustfmt.
        text: "{" + deglobbed + "}"
    };

    $.ajax({
        url: make_url('subst'),
        type: 'POST',
        dataType: 'JSON',
        cache: false,
        'data': JSON.stringify(data)
    })
    .done(function (json) {
        console.log("success");
        var source_data = {
            "file": data.file_name,
            "display": ":" + data.line_start,
            "line_start": data.line_start,
            "line_end": data.line_end,
            "column_start": data.column_start,
            "column_end": parseInt(data.column_start) + parseInt(data.text.length)
        };
        load_source_view(source_data);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with subsitution for " + data);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", make_url("#subst"));
    });

    hide_glob_menu();
}

function summary(id) {
    $.ajax({
        url: make_url('summary?id=' + id),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "summary",
            "data": json,
            "id": id,
        };
        load_summary(state);
        history.pushState(state, "", make_url("#summary=" + id));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with summary request for " + id);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", make_url("#summary=" + id));
    });

    hide_ref_menu();
    $("#div_main").text("Loading...");
}

function find_uses(needle) {
    $.ajax({
        url: make_url('search?id=' + needle),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "search",
            "data": json,
            "id": needle,
        };
        load_search(state);
        history.pushState(state, "", make_url("#search=" + needle));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with search request for " + needle);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", make_url("#search=" + needle));
    });

    hide_ref_menu();
    $("#div_main").text("Loading...");
}

function find_impls(needle) {
    $.ajax({
        url: make_url('find?impls=' + needle),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "find",
            "data": json,
            "kind": "impls",
            "id": needle,
        };
        load_find(state);
        history.pushState(state, "", make_url("#impls=" + needle));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with find (impls) request for " + needle);
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({}, "", make_url("#impls=" + needle));
    });

    hide_ref_menu();
    $("#div_main").text("Loading...");
}

function show_rename(event) {
    hide_ref_menu();

    var div_rename = $("#div_rename");

    div_rename.show();
    div_rename.offset(event.data.position);

    $("#rename_text").prop("disabled", false);

    $("#rename_message").hide();
    $("#rename_cancel").text("cancel");
    $("#rename_cancel").click(hide_rename);
    $("#div_main").click(hide_rename);
    $("#div_header").click(hide_rename);
    $("#rename_save").show();
    $("#rename_save").click(event.data, save_rename);
    $(document).on("keypress", "#rename_text", function(e) {
         if (e.which == 13) {
             save_rename({ data: event.data });
         }
    });

    $("#rename_text").val(event.data.target[0].textContent);
    $("#rename_text").select();
}

function hide_rename() {
    $("#rename_save").off("click");
    $("#rename_cancel").off("click");
    $("#div_rename").hide();
}

// Note event is not necessarily an actual event, might be faked.
function save_rename(event) {
    $("#rename_message").show();
    $("#rename_message").text("saving...");
    $("#rename_save").hide();
    $("#rename_cancel").text("close");
    $("#rename_text").prop("disabled", true);

    $.ajax({
        url: make_url('rename?id=' + event.data.id + "&text=" + $("#rename_text").val()),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        console.log("rename - success");
        $("#rename_message").text("rename saved");

        reload_source();

        // TODO add a fade-out animation here
        window.setTimeout(hide_rename, 1000);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with rename request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#rename_message").text("error trying to save rename");
    });
}

function edit(event) {
    $.ajax({
        url: make_url('edit?file=' + event.data.link),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        console.log("edit - success");
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with edit request");
        console.log("error: " + errorThrown + "; status: " + status);
    });

    event.data.hide_fn();
}

function show_quick_edit(event) {
    var quick_edit_div = $("#div_quick_edit");

    quick_edit_div.show();
    quick_edit_div.offset(event.data.position);

    $("#quick_edit_text").prop("disabled", false);

    $("#quick_edit_message").hide();
    $("#quick_edit_cancel").text("cancel");
    $("#quick_edit_cancel").click(hide_quick_edit);
    $("#div_main").click(hide_quick_edit);
    $("#div_header").click(hide_quick_edit);
}

function line_number_for_span(target) {
    var line_id = target.attr("id");
    return parseInt(line_id.slice("src_line_number_".length));
}

function quick_edit_line_number(event) {
    hide_line_number_menu();
    var file_name = history.state.file;
    var line = line_number_for_span(event.data.target);

    $.ajax({
        url: make_url('plain_text?file=' + file_name + '&line=' + line),
        type: 'POST',
        dataType: 'JSON',
        cache: false,
    })
    .done(function (json) {
        console.log("retrieve plain text - success");
        $("#quick_edit_text").val(json.text);
        $("#quick_edit_save").show();
        $("#quick_edit_save").click(json, save_quick_edit);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with plain text request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#quick_edit_text").val("Error: could not load text");
        $("#quick_edit_save").off("click");
        $("#quick_edit_save").hide();
    });

    show_quick_edit(event);
}

// Quick edit for a source link in an error message.
function quick_edit_link(event) {
    hide_src_link_menu();

    var id = event.data.target.attr("id");
    var data = SNIPPET_PLAIN_TEXT[id];
    show_quick_edit(event);
    $("#quick_edit_save").show();
    $("#quick_edit_save").click(data, save_quick_edit);

    $("#quick_edit_text").val(data.plain_text);
}

function hide_quick_edit() {
    $("#quick_edit_save").off("click");
    $("#quick_edit_cancel").off("click");
    $("#div_quick_edit").hide();
}

function show_quick_edit_saving() {
    $("#quick_edit_message").show();
    $("#quick_edit_message").text("saving...");
    $("#quick_edit_save").hide();
    $("#quick_edit_cancel").text("close");
    $("#quick_edit_text").prop("disabled", true);
}

function save_quick_edit(event) {
    show_quick_edit_saving();

    var data = event.data;
    data.text = $("#quick_edit_text").val();

    $.ajax({
        url: make_url('quick_edit'),
        type: 'POST',
        dataType: 'JSON',
        cache: false,
        'data': JSON.stringify(data),
    })
    .done(function (json) {
        console.log("quick edit - success");
        $("#quick_edit_message").text("edit saved");

        reload_source();

        // TODO add a fade-out animation here
        window.setTimeout(hide_quick_edit, 1000);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with quick edit request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#quick_edit_message").text("error trying to save edit");
    });
}

function reload_source() {
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

function view_from_menu(event) {
    hide_src_link_menu();
    win_src_link.call(event.data);
}
