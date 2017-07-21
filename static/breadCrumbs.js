// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

export function BreadCrumbs(props) {
    let crumbs = [];
    for (const c in props.path) {
        const id = "breadcrumb_" + c;
        const path = props.path.slice(0, c + 1).join('/');
        const onClick = (e) => props.getSource(path);
        crumbs.push(<span key={c}>> <span className="link_breadcrumb" id={id} onClick={onClick}>{props.path[c]}</span></span>);
    }
    return <div id="div_dir_path">
        {crumbs}
    </div>;
}
