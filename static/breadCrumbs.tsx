// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import * as React from 'react';
import { RustwApp } from './app.js';

declare var CONFIG: any;

export interface BreadCrumbProps {
    app: RustwApp,
    path: Array<string>,
}

export const BreadCrumbs: React.SFC<BreadCrumbProps> = (props) => {
    // The root path for the workspace.
    let root = CONFIG.workspace_root.split('/');
    if (root[0] === '') {
        root[0] = '/';
    }
    root.pop();
    root.reverse();

    let path = "",
        crumbs = props.path.map((p: string) => {
            if (path.length > 0 && path != '/') {
                path += '/';
            }
            path += p;

            // Don't display the workspace root prefix.
            if (p === root.pop()) {
                return null;
            }
            root = [];

            const pathCopy = path;
            const onClick = () => {
                props.app.loadSource(pathCopy);
            }
            return (<span key={path}> > <span className="link_breadcrumb" onClick={onClick}>{p}</span></span>);
        });
    return <div id="div_dir_path">
        {crumbs}
    </div>;
}
