# precompile handlbars templates
if type "handlebars" &> /dev/null ; then
  handlebars templates/search_results.handlebars -f static/templates/search_results.js -k each -k if -m
  handlebars templates/find_results.handlebars -f static/templates/find_results.js -k each -k if -m
  handlebars templates/err_code.handlebars -f static/templates/err_code.js -k if -o -m
  handlebars templates/src_view.handlebars -f static/templates/src_view.js -m
  handlebars templates/dir_view.handlebars -f static/templates/dir_view.js -m
  handlebars templates/summary.handlebars -f static/templates/summary.js -m
  handlebars templates/bread_crumbs.handlebars -f static/templates/bread_crumbs.js -k each -m
else
  echo "Please install handlebars http://handlebarsjs.com/" >&2
fi
