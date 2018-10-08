# rustw design doc

This is mostly covering rustw as it should be, rather than as it is. I'm
contemplating yet another reboot (hopefully not too much of a rewrite) and I
thought it would be good to do some upfront design.

## Goals

### Code browsing

Many engineers prefer code browser support to IDEs. This would be popular with
Gecko and Servo devs. Also a nice improvement to Rustdoc (especially with
docs.rs integration.)

I see two ways to use this tool:

* primarily as a reference (similar to rustdoc output or GitHub search/browsing)
* primarily interactive

The former use case suggests a hosted solution (which makes network speed
important). Search and doc integration are probably the most important features.
Only needs to work with compiling code, speed of indexing not really an issue.

The second use case suggests a local solution. Could either watch and rebuild or
requires easy rebuild (e.g., on refresh). Needs to work with non-compiling code
and needs to index fast (similar constraints to an IDE). Features for debugging
such as macro exploration and borrow visualisation would fit well.


### Better error messages, etc.

By using the web rather than the console we can do better for error messages. We
can link to err code info, jump to source, open in the editor, even do quick
fixes (though I actually removed this recently), or apply suggestions. We can
also expand error messages and do nice layout, syntax highlighting of snippets,
etc. I hoped this would be really useful for beginners.

However, the workflow is a bit unergonomic. And people who work on the console,
don't like this, and people who work in the editor want IDEs, so it seems there
may not be an audience at all.

In theory, we could host a Rust env on a server and do remote builds with rustw
as the interface, but this would take a lot more backend work (this can be
hacked atm, but security is a real issue - e.g., proc macros).

I had wanted to provide a kind of GUI for rustup too.


### Questions and implications

rustw currently priorities the build screen and only offers code browsing via
links. Should we prioritise code browsing? Should we go all in and abandon the
error messages work? Or might this be useful if we did it right?

If we go down the code browsing path, should we aim for a reference or
interactive mode? There seems more demand for the former, but the latter could
do more interesting things (high risk, high reward).


### New features

Some possible important features we could implement (these mostly have issues
but I'm too lazy to find them).

Building:

* Apply suggestions
* Quick edit (restore editing features)
* Overlay errors/warnings on source code

Browsing:

* Macro expansion
* Borrow visualisation
* More advanced searches (sub-/super-traits, etc., search by type (like Hoogle), full text search, fuzzy search, regex search)
* summary view (is this just docs in the end?)
* side-by-side scrolling source + summary/docs
* peek (for searches, defintion, etc)
* smart history (provide a tree history view rather than just browser back/forward)
* navigate backtraces (from debuggers and rust backtrace)
* Version control integration (integrated blame etc.)
* semantic syntax highlighting
* C++/other lang integration (perhaps by making it work with searchfox or whatever, see below)

Misc:

* Mobile use (tablets, rather than phones) - responsive design, UI (can't right click?)
* Embedding - would be cool to embed our source view into other stuff (e.g., directly in rustdoc, rather than a separate source view mode)
* Integration with other search tools (e.g., GitHub, DXR, searchfox, Google's code search thing. Lots of options for how this might work)

Non-goals:

* General editing (just use an IDE)
* Refactoring (well, maybe, but mostly just use an IDE)
* Fancy backend building stuff - distributed builds etc. (just too far out of scope)
  - although perhaps some kind of integration with sccache would help with interactive-ish remote code browsing
* Debugger frontend (although this would be cool)

## Layout

### Current

```
+-------------------------------------------+
| topbar                                    |
+-------------------------------------------+
| main                                      |
|                                           |
|                                           |
|                                           |
|                                           |
|                                           |
|                                           |
|                                           |
|                                           |
+-------------------------------------------+
```

We use the (non-scrolling) topbar for a few links/buttons and a search box

We use the main area for everything else - the errors screen, various code browsing/search screens, etc.

We use the thin bar between the topbar and main area as a progress indicator when building.

We have custom popup menus on right click and for options, etc.


### Future

I think we require some non-scrolling navigational features - search box is
useful, home (build results), perhaps breadcrumbs should be non-scrolling too.
Would be nice to make the topbar feel more lightweight.

We could use pop-over panels more - e.g., for error code info, or to peek stuff
in code browsing mode. Could also use side-by-side panels for this (we rarely
use the rhs of the main panel).

I would like to allow side-by-side scrolling of docs and source code

```
+-------------------------------------------+
| topbar                                    |
+------------------------+------------------+
| main                   | side panel       |
|                        |                  |
|                        |                  |
|                        |                  |
|                        |                  |
|                        |                  |
|                        |                  |
|                        |                  |
|                        |                  |
+------------------------+------------------+
```


## Pages/modes

Current:

* empty (on startup)
* 'Internal error'
* 'loading'
* build results
* error code explanation
* view source file
* view directory
* search results
  - one list
  - defs/refs (might reorg this at some point)
* summary (something like rustdoc, but more source-oriented)

Possible changes:

If we priorities code browsing, home screen could be the top directory view.
Build results could be removed completely or made into a panel (pop-over or side
panel).

Error code explanation should be a panel (or removed, if we prioritise code browsing)

Could remove summary for now (it is currently broken, plus rustdoc2 is happening)


## URLs/routes

TODO depends on above


## Data

I.e., what does our Redux store look like? What data do we need to keep locally.

TODO depends on above


## Architectural considerations

We currently move big chunks of data to the client. E.g., for error pages, we
include all the error explanations; for source browsing we keep a lot of
information inside links. We could use smaller ajax requests to get this kind of
info (and thus make quicker responding pages). And hopefully fewer frontend
hacks.


## Colours and other graphic design issues

I kind of hate the pale yellow background colour.

Also hate the thick black bar between topbar and main panel (although I like
using it for progress indicator)

Buttons? Menus? Both look kind of old to me. Perhaps links instead of buttons.
Not sure how to improve menus. Ideally we wouldn't use right click. But having
left-click naviagate rather than opening a menu is nice.
