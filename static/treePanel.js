// Copyright 2018 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { Treebeard } from 'react-treebeard';

export class TreePanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = { data: makeTreeData(this.props.tree.Directory) };
        this.onToggle = this.onToggle.bind(this);
    }

    onToggle(node, toggled){
        const {cursor} = this.state;

        if (cursor) {
            cursor.active = false;
        }

        node.active = true;
        if (node.children) {
            node.toggled = toggled;
        } else {
            this.props.app.loadSource(node.path);
        }
        this.setState({ cursor: node });
    }

    render() {
        return (
            <Treebeard data={this.state.data} onToggle={this.onToggle} style={style} />
        );
    }
}

function makeTreeData(dirData) {
    return {
        name: dirData.path[dirData.path.length - 1],
        toggled: true,
        children: dirData.files.map(node),
        path: dirData.path.join('/'),
    };
}

function node(fileData) {
    let children = null;
    if (fileData.kind.DirectoryTree) {
        children = fileData.kind.DirectoryTree.map(node);
    }

    return {
        name: fileData.name,
        toggled: false,
        children,
        path: fileData.path,
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
            container: {
                link: {
                    cursor: 'pointer', position: 'relative', padding: '0px 5px', display: 'block'
                },
                activeLink: {
                    background: '#31363F'
                }
            },
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
