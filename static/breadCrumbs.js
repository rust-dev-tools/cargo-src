// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

export function BreadCrumbs(props) {
    // TODO[ES6]: use props.path.map
    let crumbs = [];
    let path = "";
    for (const p of props.path) {
        if (path.length > 0) {
            path += '/';
        }
        path += p;
        const pathCopy = path;
        const onClick = (e) => props.getSource(pathCopy);
        crumbs.push(<span key={path}>> <span className="link_breadcrumb" onClick={onClick}>{p}</span></span>);
    }
    return <div id="div_dir_path">
        {crumbs}
    </div>;
}
