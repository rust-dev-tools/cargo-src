// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';

const rustw = require('./rustw');
const utils = require('./utils');

class TopBar extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let visibleHomeLink = null;
        let visibleBrowseLink = null;
        let indicatorStatus = null;
        let buildState = this.props.state;
        if (this.props.state == "fresh") {
        } else if (this.props.state == "building") {
            indicatorStatus = true;
        } else if (this.props.state == "built") {
            visibleBrowseLink = true;
        } else if (this.props.state == "builtAndNavigating") {
            visibleBrowseLink = true;
            visibleHomeLink = true;
            buildState = "built";
        }

        return <div id="div_header_group">
              <div id="div_header">
                <HomeLink visible={visibleHomeLink} />
                <BuildButton state={buildState} />
                <Options />
                <BrowseLink visible={visibleBrowseLink} />
                <SearchBox />
              </div>
              <Indicator status={indicatorStatus} />
            </div>;
    }
}

function renderLink(text, id, visible, onClick) {
    let className;
    let onClickFn;
    if (visible) {
        className = "header_link";
        onClickFn = onClick;
    } else {
        className = "link_hidden";
        onClickFn = null;
    }

    return <span id={id} className={className} onClick={onClickFn}>{text}</span>;    
}

function HomeLink(props) {
    // Save the current window.
    const backup = history.state;
    const onClick = function() {
        rustw.pre_load_build();
        rustw.load_build(backup);
        history.pushState(backup, "", utils.make_url("#build"));
    };
    // TODO should change this to be home-looking, rather than back-looking
    // TODO or even have this as a popup, rather than a 'home screen'
    return renderLink("← return to build results", "link_back", props.visible, onClick);
}

function BrowseLink(props) {
    const onClick = () => rustw.get_source(CONFIG.source_directory);
    return renderLink("browse source", "link_browse", props.visible, onClick);
}

function winSearch(needle) {
    $.ajax({
        url: utils.make_url('search?needle=' + needle),
        type: 'POST',
        dataType: 'JSON',
        cache: false
    })
    .done(function (json) {
        var state = {
            "page": "search",
            "data": json,
            "needle": needle,
        };
        rustw.load_search(state);
        history.pushState(state, "", utils.make_url("#search=" + needle));
    })
    .fail(function (xhr, status, errorThrown) {
        console.log("Error with search request for " + needle);
        console.log("error: " + errorThrown + "; status: " + status);

        rustw.load_error();
        history.pushState({}, "", utils.make_url("#search=" + needle));
    });

    $("#div_main").text("Loading...");
}

function SearchBox(props) {
    const onKeyPress = (e) => {
        if (e.which == 13) {
            winSearch(e.currentTarget.value);
        }
    };

    return <input id="search_box" placeholder="identifier search" autoComplete="off" onKeyPress={onKeyPress}></input>;
}

function BuildButton(props) {
    const state = props.state;
    let label;
    let onClick;
    let className = "button";
    if (state == "fresh") {
        label = "build";
        onClick = rustw.do_build;
        className += " enabled_button";
    } else if (state == "building") {
        label = "building...";
        onClick = null;
        className += " disabled_button";
    } else if (state == "built") {
        label = "rebuild";
        if (CONFIG.build_on_load) {
            label += " (F5)";
        }
        onClick = rustw.do_build;
        className += " enabled_button";
    }

    return <span id="link_build" className={className} onClick={onClick}>{label}</span>;
}

class Options extends React.Component {
    constructor(props) {
        super(props);
        this.state = { open: false };
    }

    componentDidUpdate() {
        this.didRender();
    }

    componentDidMount() {
        this.didRender();
    }

    didRender() {
        if (!!this.state.open) {
            var options = $("#div_options");
            options.offset(this.state.open);
        }
    }

    render() {
        let menu = null;
        let overlay = null;
        let showOptions = null;
        const self = this;
        if (!!this.state.open) {
            const hideOptions = (event) => {
                self.setState({ open: false });
                event.preventDefault();
                event.stopPropagation();
            };
            const killProp = (event) => {
                event.preventDefault();
                event.stopPropagation();
            };
            menu = <div id="div_options" onClick={killProp}>
                      <a id="link_close_options" className="link" onClick={hideOptions}>close</a>
                      <div className="div_option">list view/code view</div>
                      <div className="div_option">show/hide warnings</div>
                      <div className="div_option">show/hide notes and help</div>
                      <div className="div_option">show/hide all source snippets</div>
                      <div className="div_option">show/hide context for source code</div>
                      <div className="div_option">show/hide child messages</div>
                      <div className="div_option">show/hide error context</div>
                      <br /><div className="div_option">build command: <code>cargo build</code></div>
                      <div className="div_option">toolchain: TODO</div>
                      <div className="div_option">build time: TODO</div>
                      <div className="div_option">exit status: TODO</div>
                   </div>;
            overlay = <div id="div_overlay" onClick={hideOptions} />;
        } else {
            showOptions = (event) => {
                self.setState({ open: { "top": event.pageY, "left": event.pageX } });
                event.preventDefault();
                event.stopPropagation();
            };
        }
        return <span>
                    <span id="link_options" className="button" onClick={showOptions}>options</span>
                    {overlay}
                    {menu}
                </span>;
    }
}

function Indicator(props) {
    let overlay = null;
    let className = "div_border_plain";
    if (props.status) {
        overlay = <div id="div_border_animated" className="animated_border" />;
        className = "div_border_status";
    }
    return <div id="div_border" className={className}>{overlay}</div>;
}

module.exports = {
    renderTopBar: function(state) {
        ReactDOM.render(
            <TopBar state={state} />,
            $("#header_container").get(0)
        );
    }
}
