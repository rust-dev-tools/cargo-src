// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// TODO test and fix it
// `data is undefined`

function quick_edit_line_number(event) {
    var file_name = history.state.file;
    var line = line_number_for_span(event.data.target);

    $.ajax({
        url: utils.make_url('plain_text?file=' + file_name + '&line=' + line),
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
function quick_edit_link(target, location) {
    var id = target.getAttribute("id");
    var data = SNIPPET_PLAIN_TEXT[id];
    show_quick_edit(location);
    $("#quick_edit_save").show();
    $("#quick_edit_save").click(data, save_quick_edit);

    $("#quick_edit_text").val(data.plain_text);
}

function show_quick_edit(location) {
    var quick_edit_div = $("#div_quick_edit");

    quick_edit_div.show();
    quick_edit_div.offset(location);

    $("#quick_edit_text").prop("disabled", false);

    $("#quick_edit_message").hide();
    $("#quick_edit_cancel").text("cancel");
    $("#quick_edit_cancel").click(hide_quick_edit);
    // TODO overlay
    $("#div_main").click(hide_quick_edit);
    $("#div_header").click(hide_quick_edit);
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
        url: utils.make_url('quick_edit'),
        type: 'POST',
        dataType: 'JSON',
        cache: false,
        'data': JSON.stringify(data),
    })
    .done(function (json) {
        console.log("quick edit - success");
        $("#quick_edit_message").text("edit saved");

        rustw.reload_source();

        // TODO add a fade-out animation here
        window.setTimeout(hide_quick_edit, 1000);
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with quick edit request");
        console.log("error: " + errorThrown + "; status: " + status);
        $("#quick_edit_message").text("error trying to save edit");
    });
}

module.exports = { quick_edit_link, quick_edit_line_number };
