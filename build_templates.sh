# precompile handlbars templates
handlebars templates/build_results.handlebars -f static/templates/build_results.js -k each -k if -o -m
handlebars templates/err_code.handlebars -f static/templates/err_code.js -k if -o -m
handlebars templates/src_view.handlebars -f static/templates/src_view.js -m
