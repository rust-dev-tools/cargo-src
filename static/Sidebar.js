// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { connect } from 'react-redux';
import * as actions from './actions';
import { DirView } from './dirView';
import { SearchPanelController } from './SearchPanel.js';

import { FindResults, SearchResults } from "./search";

import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

function Sidebar(props) {
    return (
        <Tabs className="div_sidebar" selectedTabClassName="selected">
            <TabList className="div_sidebar_tabs">
                <Tab className="div_sidebar_tab">Search</Tab>
                <Tab className="div_sidebar_tab">DirView</Tab>
            </TabList>
            <TabPanel className="div_sidebar_main">
                <SearchPanelController/>
                <div id="div_search_results"><SearchResults defs={props.page.defs} refs={props.page.refs} /></div> 
            </TabPanel>
            <TabPanel className="div_sidebar_main">
            </TabPanel>
        </Tabs>
    );
}

const mapStateToProps = (state, ownProps) => {
    return ownProps;
}

const mapDispatchToProps = (dispatch) => {
    return {
        getSource: (fileName, lineStart) => dispatch(actions.getSource(fileName, lineStart)),
        
    }
}

export const SidebarController = connect(
    mapStateToProps,
    mapDispatchToProps
)(Sidebar);