# How to make a demo

* You'll need a server.
* Clone the rustw repo. build it (see README.md).
* You'll want some code to demonstrate on too.
* In that directory create a rustw.toml. You'll want at least:

```
demo_mode = true
demo_mode_root_path = "rustw/"
```

Or whatever you'll use for your root path.

* You'll need to edit index.html and change all the URLs, e.g., `/static/favicon.ico` to `/rustw/static/favicon.ico`.
* In rustw.js, find `onLoad()`, you'll need to change the `/config` url to include the root path, e.g, `/rustw/config`.
* Likewise, update the URLs for the fonts in rustw.css.
* Update the test data in `build.rs` with the JSON output from building your project.
* Build rustw (see README.md).
* Assuming you're running Apache, you'll need to add modify your configuration. I changed `000-default.conf` in `/etc/apache2/sites-enabled`, by adding

```
ProxyPass /rustw http://localhost:2348
ProxyPassReverse /rustw http://localhost:2348
```

to the `<VirtualHost *:80>` element. Note that you'll want the port here to match the port you specify in rustw.toml.

* Run it on your server: in the project directory, `/path/to/rustw/target/debug/rustw`.
* It should now be live at, e.g., `www.ncameron.org/rustw`.
