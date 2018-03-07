// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { connect } from 'react-redux';
import { BuildState } from './reducers';

import { FindResults, SearchResults } from "./search";
import { Menu, MenuHost } from './menus';
import * as actions from './actions';

class SearchPanel extends React.Component {
    render() {
        return <SearchBox getSearch={this.props.getSearch} />
    }
}

const mapStateToProps = (state) => {
    let visibleHomeLink = null;
    let visibleBrowseLink = true;
    let indicatorStatus = null;
    let buildState = state.build;
    switch (state.build) {
        case BuildState.BUILDING:
            indicatorStatus = true;
            break;
        case BuildState.BUILT:
            break;
        case BuildState.BUILT_AND_NAVIGATING:
            visibleHomeLink = true;
            buildState = BuildState.BUILT;
            break;
    }

    return {
        visibleHomeLink,
        visibleBrowseLink,
        indicatorStatus,
        buildState
    }
};

const mapDispatchToProps = (dispatch) => {
    return {
        clickHomeLink: () => dispatch(actions.showBuildResults()),
        clickBuild: () => dispatch(actions.doBuild()),
        getSearch: (needle) => dispatch(actions.getSearch(needle)),
    }
};

const mergeProps = (stateProps, dispatchProps) => {
    let props = Object.assign({}, stateProps, dispatchProps);
    if (stateProps.buildState === BuildState.BUILDING) {
        props.clickBuild = null;
    }
    return props;
};

export const SearchPanelController = connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
)(SearchPanel);

function SearchBox(props) {
    const enterKeyCode = 13;
    const onKeyPress = (e) => {
        if (e.which === enterKeyCode) {
            props.getSearch(e.currentTarget.value);
        }
    };

    return (<div>
        <input id="search_box" placeholder="identifier search" autoComplete="off" onKeyPress={onKeyPress}></input>
    </div>)
}

function BuildButton(props) {
    const state = props.state;
    let label;
    let className = "button";
    if (state === BuildState.FRESH) {
        label = "build";
        className += " enabled_button";
    } else if (state === BuildState.BUILDING) {
        label = "building...";
        className += " disabled_button";
    } else if (state === BuildState.BUILT) {
        label = "rebuild";
        if (CONFIG.build_on_load) {
            label += " (F5)";
        }
        className += " enabled_button";
    }

    return <span id="link_build" className={className} onClick={props.onClick}>{label}</span>;
}

function OptionsMenu(props) {
    let items = [
        { id: "opt-0", label: "list view/code view", fn: () => {} },
        { id: "opt-1", label: "show/hide warnings", fn: () => {} },
        { id: "opt-2", label: "show/hide notes and help", fn: () => {} },
        { id: "opt-3", label: "show/hide all source snippets", fn: () => {} },
        { id: "opt-4", label: "show/hide context for source code", fn: () => {} },
        { id: "opt-5", label: "show/hide child messages", fn: () => {} },
        { id: "opt-6", label: "show/hide error context", fn: () => {} },
        { id: "opt-7", label: "build command: <code>cargo build</code>", fn: () => {} },
        { id: "opt-8", label: "toolchain: TODO", fn: () => {} },
        { id: "opt-9", label: "build time: TODO", fn: () => {} },
        { id: "opt-10", label: "exit status: TODO", fn: () => {} }
    ];

    return <Menu id={"div_options"} items={items} location={props.location} onClose={props.onClose} target={props.target} />;
}

class Options extends MenuHost {
    constructor(props) {
        super(props);
        this.menuFn = OptionsMenu;
        this.leftClick = true;
    }

    renderInner() {
        return <span id="link_options" className="button">options</span>;
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
