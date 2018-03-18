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


export function Sidebar(props) {
    return (
        <Tabs className="div_sidebar" selectedTabClassName="selected">
            <TabList className="div_sidebar_tabs">
                <Tab className="div_sidebar_tab">search</Tab>
                <Tab className="div_sidebar_tab">files</Tab>
            </TabList>
            <TabPanel className="div_sidebar_main">
                <SearchPanel app={props.app} {...props.search} />
            </TabPanel>
            <TabPanel className="div_sidebar_main">
            </TabPanel>
        </Tabs>
    );
}
