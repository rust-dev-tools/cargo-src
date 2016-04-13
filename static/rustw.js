Handlebars.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
});

Handlebars.registerHelper("add", function(a, b, options)
{
    return parseInt(a) + parseInt(b);
});

Handlebars.registerPartial("src_snippet", Handlebars.templates.src_snippet);
Handlebars.registerPartial("src_snippet_inner", Handlebars.templates.src_snippet);

function onLoad() {
    load_start();
    MAIN_PAGE_STATE = { page: "start" };
    history.replaceState(MAIN_PAGE_STATE, "", "/");

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
    set_build_onclick();
    $("#link_options").click(show_options);
    
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
    if (DEMO_MODE) {
        state.results.rustw_message =
            "<h2>demo mode</h2>Click `+` and `-` to expand/hide info.<br>Click error codes or source links to see more stuff. Source links can be right-clicked for more options.";
    }

    $("#div_main").html(Handlebars.templates.build_results(state.results));
    set_build_onclick();
    enable_button($("#link_build"), "rebuild");
    $("#link_back").css("visibility", "hidden");
    init_build_results();

    update_snippets(MAIN_PAGE_STATE.snippets);
}

function load_error() {
    $("#div_main").text("Server error?");
    set_build_onclick();
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
    highlight_spans(state, "src_line_number_", "src_line_");

    // Jump to the start line. 100 is a fudge so that the start line is not
    // right at the top of the window, which makes it easier to see.
    var y = state.line_start * $("#src_line_number_1").height() - 100;
    window.scroll(0, y);
}

function highlight_spans(highlight, line_number_prefix, src_line_prefix) {
    for (var i = highlight.line_start; i <= highlight.line_end; ++i) {
        $("#" + line_number_prefix + i).addClass("selected");
    }

    // Highlight all of the middle lines.
    for (var i = highlight.line_start + 1; i <= highlight.line_end - 1; ++i) {
        $("#" + src_line_prefix + i).addClass("selected");
    }

    // If we don't have columns (at least a start), then highlight all the lines.
    // If we do, then highlight between columns.
    if (highlight.column_start <= 0) {
        $("#" + src_line_prefix + highlight.line_start).addClass("selected");
        $("#" + src_line_prefix + highlight.line_end).addClass("selected");
    } else {
        // First line
        var lhs = (highlight.column_start - 1);
        var rhs = 0;
        if (highlight.line_end == highlight.line_start && highlight.column_end > 0) {
            // If we're only highlighting one line, then the highlight must stop
            // before the end of the line.
            rhs = (highlight.column_end - 1);
        }
        make_highlight(src_line_prefix, highlight.line_start, lhs, rhs);

        // Last line
        if (highlight.line_end > highlight.line_start) {
            var rhs = 0;
            if (highlight.column_end > 0) {
                rhs = (highlight.column_end - 1);
            }
            make_highlight(src_line_prefix, highlight.line_end, 0, rhs);
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
function make_highlight(src_line_prefix, line_number, left, right) {
    var line_div = $("#" + src_line_prefix + line_number);
    var highlight = $("<div>&nbsp;</div>");
    highlight.addClass("selected floating_highlight");

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

    highlight.offset({ "left": line_div.offset().left + left});
    highlight.width(width);
    line_div.before(highlight);
}

function do_build(data) {
    $.ajax({
        url: '/' + data.data,
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        stop_build_animation();
        MAIN_PAGE_STATE = { page: "build", results: json }
        load_build(MAIN_PAGE_STATE);
        pull_data(json.push_data_key);

        history.pushState(MAIN_PAGE_STATE, "", "#build");
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with build request");
        console.log("error: " + errorThrown + "; status: " + status);
        console.log(data);
        load_error();

        MAIN_PAGE_STATE = { page: "error" };
        history.pushState(MAIN_PAGE_STATE, "", "#build");
        stop_build_animation();
    });

    $("#link_back").css("visibility", "hidden");
    disable_button($("#link_build"), "building...");
    hide_options();
    start_build_animation();
}

function pull_data(key) {
    if (!key) {
        return;
    }

    console.log("sending pull request for key " + key);
    $.ajax({
        url: '/pull?key=' + key,
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
        let target = $("#src_span_" + s.id);
        let snip = s;
        target[0].update_span = function() {
            let html = Handlebars.templates.src_snippet_inner(snip);
            target.html(html);

            highlight_spans(snip.highlight,
                            "snippet_line_number_" + snip.id + "_",
                            "snippet_line_" + snip.id + "_");
        };
    }
}

function init_build_results() {
    hide_stdout();
    show_stderr();

    var expand_spans = $(".expand_spans");
    expand_spans.each(hide_spans);

    var expand_children = $(".expand_children");
    expand_children.each(show_children);

    var err_codes = $(".err_code");
    err_codes.click(win_err_code);

    var src_links = $(".span_loc");
    src_links.click(win_src_link);
    src_links.on("contextmenu", show_src_menu);
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
    var span = element.next().find(".div_all_span_src");
    span.show();

    if (span[0].update_span) {
        span[0].update_span();
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
            history.pushState(backup, "", "#build");
    });    
}

function win_err_code() {
    show_back_link();

    // Prepare the data for the error code window.
    var element = $(this);
    var error_html = element.parent().html();
    var data = { "code": element.attr("code"), "explain": marked(element.attr("explain")), "error": error_html };

    var state = { page: "err_code", data: data };
    load_err_code(state);
    history.pushState(state, "", "#" + element.attr("code"));
}

function win_src_link() {
    show_back_link();

    var element = $(this);
    var file_loc = element.attr("link").split(':');
    var file = file_loc[0];
    var line_start = parseInt(file_loc[1], 10);
    var column_start = parseInt(file_loc[2], 10);
    var line_end = parseInt(file_loc[3], 10);
    var column_end = parseInt(file_loc[4], 10);

    if (line_start == 0) {
        line_end = 0;
    } else if (line_end == 0) {
        line_end = line_start;
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
        url: '/src/' + file,
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "source",
            "data": json,
            "file": file,
            "display": display,
            "line_start": line_start,
            "line_end": line_end,
            "column_start": column_start,
            "column_end": column_end
        };
        load_source(state);

        history.pushState(state, "", "#src=" + file + display);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with build request");
        console.log("error: " + errorThrown + "; status: " + status);

        load_error();
        history.pushState({ page: "error"}, "", "#src=" + file + display);
    });

    $("#div_main").text("Loading...");
}

function show_src_menu(event) {
    var src_menu = $("#div_src_menu");
    var target = $(event.target);
    var data = {
        "position": { "top": event.pageY, "left": event.pageX },
        "text": target.attr("snippet"),
        "location": target.attr("link")
    };

    src_menu.show();
    src_menu.offset(data.position);

    // TODO can we do better than this to close the menu? (Also options menu).
    $("#div_main").click(hide_src_menu);
    $("#div_header").click(hide_src_menu);

    $("#src_menu_edit").click(target, edit);
    $("#src_menu_quick_edit").click(data, quick_edit);

    return false;
}

function hide_src_menu() {
    $("#src_menu_edit").off("click");
    $("#src_menu_quick_edit").off("click");
    $("#div_src_menu").hide();
}

function edit(event) {
    $.ajax({
        url: '/edit?file=' + event.data.attr("link"),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        console.log("edit - success");
        console.log(json);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with edit request");
        console.log("error: " + errorThrown + "; status: " + status);
    });

    hide_src_menu();
}

function quick_edit(event) {
    hide_src_menu();

    var quick_edit_div = $("#div_quick_edit");

    quick_edit_div.show();
    quick_edit_div.offset(event.data.position);

    
    $("#quick_edit_text").val(event.data.text);
    $("#quick_edit_text").prop("disabled", false);

    $("#quick_edit_message").hide();
    $("#quick_edit_cancel").text("cancel");
    $("#quick_edit_cancel").click(hide_quick_edit);
    $("#quick_edit_save").show();
    var save_data = { "location": event.data.location };
    $("#quick_edit_save").click(save_data, save_quick_edit);
    $("#div_main").click(hide_quick_edit);
    $("#div_header").click(hide_quick_edit);
}

function hide_quick_edit() {
    $("#quick_edit_save").off("click");
    $("#quick_edit_cancel").off("click");
    $("#div_quick_edit").hide();
}

function save_quick_edit(event) {
    $("#quick_edit_message").show();
    $("#quick_edit_message").text("saving...");
    $("#quick_edit_save").hide();
    $("#quick_edit_cancel").text("close");
    $("#quick_edit_text").prop("disabled", true);

    var data = event.data;
    data.text = $("#quick_edit_text").val();

    $.ajax({
        url: '/quick_edit',
        type: 'POST',
        dataType: 'JSON',
        cache: false,
        'data': JSON.stringify(data),
    })
    .done(function (json) {
        console.log("quick edit - success");
        console.log(json);
        $("#quick_edit_message").text("edit saved");
        // TODO add a fade-out animation here
        window.setTimeout(hide_quick_edit, 1500);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with quick edit request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#quick_edit_message").text("error trying to save edit");
    });
}

function set_build_onclick() {
    var button = $("#link_build");
    button.off('click');
    if (DEMO_MODE) {
        button.click('test', do_build);
    } else {
        button.click('build', do_build);
    }
}
