// Copyright 2018 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { Treebeard } from 'react-treebeard';

import * as actions from './actions';
const utils = require('./utils');

// FIXME share code with treePanel

export class SymbolPanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = { data: {} };
        this.onToggle = this.onToggle.bind(this);
    }

    componentDidMount() {
        const self = this;
        utils.request(
            'symbol_roots',
            function(json) {
                self.setState({ data: makeTreeData(json) });
            },
            "Error with symbol_roots request",
            null
        );
    }

    onToggle(node, toggled){
        const {cursor} = this.state;
        const self = this;

        // Tree handling overhead
        if (cursor) {
            cursor.active = false;
        }
        node.active = true;
        node.toggled = toggled;
        this.setState({ cursor: node });

        // Jump to the line in the source code.
        if (node.file_name) {
            actions.getSource(this.props.app, node.file_name, { line_start: node.line_start, line_end: node.line_start });
        }

        // Get any children from the server and add them to the tree.
        if (!node.children || node.children.length == 0) {
            utils.request(
                'symbol_children?id=' + node.symId,
                function(json) {
                    node.children = json.map(makeTreeNode);
                    self.setState({});
                },
                "Error with symbol_children request",
                null
            );
        }
    }

    render() {
        return (
            <Treebeard data={this.state.data} onToggle={this.onToggle} style={style} />
        );
    }
}

function makeTreeData(rootData) {
    return {
        name: 'symbols',
        toggled: true,
        children: rootData.map(makeTreeNode),
    };
}

function makeTreeNode(symData) {
    return {
        name: symData.name,
        toggled: false,
        children: [],
        symId: symData.id,
        file_name: symData.file_name,
        line_start: symData.line_start,
    };
}

const style = {
    tree: {
        base: {
            listStyle: 'none',
            //backgroundColor: '#21252B',
            margin: 0,
            padding: 0,
            //color: '#9DA5AB',
            //fontFamily: 'lucida grande ,tahoma,verdana,arial,sans-serif',
            //fontSize: '14px'
        },
        node: {
            base: {
                position: 'relative'
            },
            link: {
                cursor: 'pointer',
                position: 'relative',
                padding: '0px 5px',
                display: 'block'
            },
            activeLink: {
                background: '#B1B6BF'
            },
            toggle: {
                base: {
                    position: 'relative',
                    display: 'inline-block',
                    verticalAlign: 'top',
                    marginLeft: '-5px',
                    height: '24px',
                    width: '24px'
                },
                wrapper: {
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    margin: '-7px 0 0 -7px',
                    height: '14px'
                },
                height: 14,
                width: 14,
                arrow: {
                    //fill: '#9DA5AB',
                    strokeWidth: 0
                }
            },
            header: {
                base: {
                    display: 'inline-block',
                    verticalAlign: 'top',
                    //color: '#9DA5AB'
                },
                connector: {
                    width: '2px',
                    height: '12px',
                    borderLeft: 'solid 2px black',
                    borderBottom: 'solid 2px black',
                    position: 'absolute',
                    top: '0px',
                    left: '-21px'
                },
                title: {
                    lineHeight: '24px',
                    verticalAlign: 'middle'
                }
            },
            subtree: {
                listStyle: 'none',
                paddingLeft: '19px'
            },
            loading: {
                color: '#E2C089'
            }
        }
    }
};
