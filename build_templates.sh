# precompile handlbars templates
if type "handlebars" &> /dev/null ; then
  handlebars templates/src_view.handlebars -f static/templates/src_view.js -m
  handlebars templates/summary.handlebars -f static/templates/summary.js -m
else
  echo "Please install handlebars http://handlebarsjs.com/" >&2
fi
