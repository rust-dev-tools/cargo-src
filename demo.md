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
* Build rustw (see README.md).
* Assuming you're running Apache, you'll need to add TODO
* Run it on your server: in the project directory, `/path/to/rustw/target/debug/rustw`.
* It should now be live at, e.g., `www.ncameron.org/rustw`.
