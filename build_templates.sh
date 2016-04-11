# precompile handlbars templates

handlebars templates/src_snippet.handlebars -f static/templates/src_snippet.js -k each -k if -m
handlebars templates/src_snippet_inner.handlebars -f static/templates/src_snippet_inner.js -k each -m
handlebars templates/build_results.handlebars -f static/templates/build_results.js -k each -k if -m
handlebars templates/err_code.handlebars -f static/templates/err_code.js -k if -o -m
handlebars templates/src_view.handlebars -f static/templates/src_view.js -m

# Copy data to install directory.
# TODO better to do this in a Cargo build script.

cp -r static target/debug
