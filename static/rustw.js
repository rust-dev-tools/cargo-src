// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

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

Handlebars.registerPartial("src_snippet", Handlebars.templates.src_snippet);
Handlebars.registerPartial("src_snippet_inner", Handlebars.templates.src_snippet_inner);
Handlebars.registerPartial("bread_crumbs", Handlebars.templates.bread_crumbs);

function onLoad() {
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
            load_build(state);
        } else if (state.page == "err_code") {
            load_err_code(state);
        } else if (state.page == "source") {
            load_source(state);
        } else if (state.page == "source_dir") {
            load_dir(state);
          } else if (state.page == "search") {
              load_search(state);
        } else {
            console.log("ERROR: Unknown page state: ");
            console.log(state);
            load_start();
        }

        hide_options();
    };
}

function load_start() {
    enable_button($("#link_build"), "build");
    $("#link_build").click(do_build);
    $("#link_options").click(show_options);
    $("#link_browse").click(do_browse);

    $("#div_main").html("");
    $("#div_options").hide();
    $("#div_src_menu").hide();
    $("#div_quick_edit").hide();
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

function load_build(state) {
    if (CONFIG.demo_mode) {
        state.results.rustw_message =
            "<h2>demo mode</h2>Click `+` and `-` to expand/hide info.<br>Click error codes or source links to see more stuff. Source links can be right-clicked for more options (note that edit functionality won't work in demo mode).";
    }

    $("#div_main").html(Handlebars.templates.build_results(state.results));
    set_snippet_plain_text(state.results.errors.reduce(function(a, x) {
        for (var c of x.children) {
            a = a.concat(c.spans);
        }
        return a.concat(x.spans);
    }, []));

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

function load_search(state) {
    show_back_link();
    $("#div_main").html(Handlebars.templates.search_results(state.data));
    $(".src_link").removeClass("src_link");
    $(".div_search_file_link").click(load_link);
    $(".div_span_src_number").click(load_link);
    $(".span_src").click(load_link);
    highlight_needle(state.data.defs, "def");
    highlight_needle(state.data.refs, "ref");
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
        var data = {
            "plain_text": s.plain_text,
            "file_name": s.file_name,
            "line_start": s.line_start,
            "line_end": s.line_end
        };
        SNIPPET_PLAIN_TEXT["span_loc_" + s.id] = data;
    }
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
    $("#div_main").html(Handlebars.templates.src_view(state.data));
    $(".link_breadcrumb").click(state.file, handle_bread_crumb_link);
    highlight_spans(state, "src_line_number_", "src_line_", "selected");
    add_highlighters();
    add_source_jump_links();
    add_quick_edit_links();

    // Jump to the start line. 100 is a fudge so that the start line is not
    // right at the top of the window, which makes it easier to see.
    var y = state.line_start * $("#src_line_number_1").height() - 100;
    window.scroll(0, y);
}

function add_highlighters() {
    var all_idents = $(".class_id");
    all_idents.each(function() {
        var classes = this.className.split(' ');
        for (var c of classes) {
            if (c.startsWith('class_id_')) {
                $(this).hover(function() {
                    var similar = $("." + c);
                    similar.css("background-color", "#d5f3b5");
                }, function() {
                    var similar = $("." + c);
                    similar.css("background-color", "");
                });

                break;
            }
        }
    });
}

function add_source_jump_links() {
    var linkables = $(".src_link");
    // TODO special case links to the same file
    linkables.click(load_link);
}

function add_quick_edit_links() {
    var line_nums = $(".div_src_line_number");
    line_nums.on("contextmenu", show_line_number_menu);
    // TODO nrc - on click of quick edit
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
        MAIN_PAGE_STATE = { page: "build", results: json }
        load_build(MAIN_PAGE_STATE);
        pull_data(json.push_data_key);

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
        loc.attr("link", s.file_name + ":" + p.line_start + ":" + p.column_start + ":" + p.line_end + ":" + p.column_end);
        loc.text(s.file_name + ":" + p.line_start + ":" + p.column_start + ": " + p.line_end + ":" + p.column_end);

        $("#div_span_label_" + s.id).text("");

        let target = $("#src_span_" + s.id);
        let snip = s;
        // TODO if the spans are shown before we call this, then we won't call
        // show_spans and we won't call update_span.
        target[0].update_span = function() {
            let html = Handlebars.templates.src_snippet_inner(snip);
            target.html(html);

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
    hide_stdout();
    show_stderr();

    var expand_spans = $(".expand_spans");
    expand_spans.each(hide_spans);

    var expand_children = $(".expand_children");
    expand_children.each(show_children);

    var err_codes = $(".err_code").filter(function(i, e) { return !!$(e).attr("explain"); });
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
        load_build(backup);
        history.pushState(backup, "", make_url("#build"));
    });
}

function win_err_code() {
    var element = $(this);
    var explain = element.attr("explain");
    if (!explain) {
        return;
    }

    show_back_link();

    // Prepare the data for the error code window.
    var error_html = element.parent().html();
    var data = { "code": element.attr("code"), "explain": marked(explain), "error": error_html };

    var state = { page: "err_code", data: data };
    load_err_code(state);
    history.pushState(state, "", make_url("#" + element.attr("code")));
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
    $("#div_main").html(Handlebars.templates.dir_view(state.data));
    $(".div_entry_name").click(state.file, handle_dir_link);
    $(".link_breadcrumb").click(state.file, handle_bread_crumb_link);
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

function load_link() {
    var element = $(this);
    var file_loc = element.attr("link").split(':');
    var file = file_loc[0];
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

    $.ajax({
        url: make_url('src/' + file),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "source",
            "data": json.Source,
            "file": file,
            "display": display,
            "line_start": line_start,
            "line_end": line_end,
            "column_start": column_start,
            "column_end": column_end
        };
        load_source(state);

        history.pushState(state, "", make_url("#src=" + file + display));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with source request");
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({ page: "error"}, "", make_url("#src=" + file + display));
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

    var edit_data = { 'link': data.target.attr("link"), 'hide_fn': hide_src_link_menu };
    $("#src_menu_edit").click(edit_data, edit);
    $("#src_menu_quick_edit").click(data, quick_edit_link);
    $("#src_menu_view").click(data.target, view_from_menu);

    return false;
}

function hide_src_link_menu() {
    $("#src_menu_edit").off("click");
    $("#src_menu_quick_edit").off("click");
    $("#src_menu_view").off("click");
    $("#div_src_menu").hide();
}

function show_line_number_menu(event) {
    var menu = $("#div_line_number_menu");
    var data = show_menu(menu, event, hide_line_number_menu);

    var edit_data = { 'link': history.state.file + ":" + line_number_for_span(data.target), 'hide_fn': hide_line_number_menu };
    $("#line_number_menu_edit").click(edit_data, edit);
    $("#line_number_quick_edit").click(data, quick_edit_line_number);

    return false;
}

function hide_line_number_menu() {
    $("#line_number_menu_edit").off("click");
    $("#line_number_quick_edit").off("click");
    $("#div_line_number_menu").hide();
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
        // TODO add a fade-out animation here
        window.setTimeout(hide_quick_edit, 1000);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with quick edit request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#quick_edit_message").text("error trying to save edit");
    });
}

function view_from_menu(event) {
    hide_src_link_menu();
    win_src_link.call(event.data);
}
