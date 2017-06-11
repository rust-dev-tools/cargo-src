module.exports = {
    make_url: function (suffix) {
        return '/' + CONFIG.demo_mode_root_path + suffix;
    },

    highlight_spans: function(highlight, line_number_prefix, src_line_prefix, css_class) {
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

    request: function(urlStr, success, errStr, skipLoadingPage) {
        $.ajax({
            url: this.make_url(urlStr),
            type: 'POST',
            dataType: 'JSON',
            cache: false
        })
        .done(success)
        .fail(function (xhr, status, errorThrown) {
            console.log(errStr);
            console.log("error: " + errorThrown + "; status: " + status);

            $("#div_main").text("Server error?");
            history.pushState({}, "", this.make_url("#error"));
        });

        if (!skipLoadingPage) {
            $("#div_main").text("Loading...");
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
