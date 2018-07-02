// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { SearchPanel } from './searchPanel.js';
import { TreePanel } from './treePanel.js';
import { SymbolPanel } from './symbolPanel.js';


export class Sidebar extends React.Component {
    constructor(props) {
        super(props);
        this.state = { symbols: null, tabIndex: 0, searchTerm: "" };
    }

    componentDidUpdate(prevProps) {
        if (this.props.search != prevProps.search) {
            let searchTerm = "";
            if (this.props.search.searchTerm) {
                searchTerm = this.props.search.searchTerm;
            }
            this.setState({ tabIndex: 0, searchTerm });
        }
    }

    render() {
        // We must keep the search box controller state here so that we preserve
        // the text in the box during tab switches.
        const enterKeyCode = 13;
        const searchController = {
            searchTerm: this.state.searchTerm,
            onKeyPress: (e) => {
                if (e.which === enterKeyCode) {
                    this.props.app.getSearch(e.currentTarget.value);
                }
            },
            onChange: (e) => {
                this.setState({searchTerm: e.target.value});
            },
        };

        const onSelect = tabIndex => this.setState({ tabIndex });

        return (
            <div
                className={"div_sidebar" + (this.state.collapsed ? " collapsed" : "")}
            >
                <a
                    className="a_side_collapsebtn"
                    href="javascript:void(0)"
                    onClick={_e => this.setState({ collapsed: !this.state.collapsed })}
                >
                    {this.state.collapsed ? "[+]" : "[-]"}
                </a>
                <Tabs
                    selectedIndex={this.state.tabIndex}
                    className="div_side_tabbar"
                    selectedTabClassName="selected"
                    onSelect={onSelect}
                >
                    <TabList className="div_sidebar_tabs">
                        <Tab className="div_sidebar_tab">search</Tab>
                        <Tab className="div_sidebar_tab">files</Tab>
                        <Tab className="div_sidebar_tab">symbols</Tab>
                    </TabList>
                    <TabPanel className="div_sidebar_main">
                        <SearchPanel
                            app={this.props.app}
                            {...this.props.search}
                            searchController={searchController}
                        />
                    </TabPanel>
                    <TabPanel className="div_sidebar_main">
                        <TreePanel app={this.props.app} tree={this.props.fileTreeData} />
                    </TabPanel>
                    <TabPanel className="div_sidebar_main">
                        <SymbolPanel app={this.props.app} symbols={this.props.symbols} />
                    </TabPanel>
                </Tabs>
                <StatusBar status={this.props.status} />
            </div>
        );
    }
}

class StatusBar extends React.Component {
    render() {
        let status = "";
        if (this.props.status) {
            status = this.props.status;
        }
        return <div id="div_status_display">
            Status: {status}
        </div>;
    }
}
