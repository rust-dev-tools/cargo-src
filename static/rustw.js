Handlebars.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
});

function onLoad() {
    load_start();
    history.replaceState({ page: "start" }, "", "/");

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
    $("#link_build").text("build");
    set_build_onclick();
    $("#link_options").click(show_options);
    
    $("#div_main").html("");
    $("#div_options").hide();
    $("#div_src_menu").hide();
    $("#div_quick_edit").hide();
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
    $("#link_build").text("rebuild");
    $("#link_back").css("visibility", "hidden");
    init_build_results();
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

    for (var i = state.start_line; i <= state.end_line; ++i) {
        $("#src_line_number_" + i).addClass("selected");
        $("#src_line_" + i).addClass("selected");
    }

    // Jump to the start line. 100 is a fudge so that the start line is not
    // right at the top of the window, which makes it easier to see.
    var y = state.start_line * $("#src_line_number_1").height() - 100;
    window.scroll(0, y);
}

function do_build(data) {
    $.ajax({
        url: '/' + data.data,
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = { page: "build", results: json }
        load_build(state);

        history.pushState(state, "", "#build");
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with build request");
        console.log("error: " + errorThrown + "; status: " + status);
        console.log(data);
        load_error();

        history.pushState({ page: "error" }, "", "#build");
    });

    $("#link_back").css("visibility", "hidden");
    $("#div_main").text("Building...");
    $("#link_build").off("click");
    $("#link_build").html("&nbsp;");
    hide_options();
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
    element.next().find(".div_all_span_src").show();
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
    var start = file_loc[1];
    var end = file_loc[2];

    var display = "";
    if (!start) {
        start = 0;
        end = 0;
    } else if (!end) {
        end = start;
        display = ":" + start;
    } else if (start == end) {
        display = ":" + start;
    } else {
        display = ":" + start + ":" + end;
    }

    $.ajax({
        url: '/src/' + file,
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = { page: "source", data: json, file: file, display: display, start_line: start, end_line: end };
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
    var data = { "position": { "top": event.pageY, "left": event.pageX }, "text": target.attr("snippet")};

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
    console.log(event.data.attr("link"));
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

    $("#quick_edit_cancel").click(hide_quick_edit);
    $("#div_main").click(hide_quick_edit);
    $("#div_header").click(hide_quick_edit);

    // TODO save
}

function hide_quick_edit() {
    $("#quick_edit_save").off("click");
    $("#quick_edit_cancel").off("click");
    $("#div_quick_edit").hide();
}

function set_build_onclick() {
    $("#link_build").off('click');
    if (DEMO_MODE) {
        $("#link_build").click('test', do_build);
    } else {
        $("#link_build").click('build', do_build);
    }
}