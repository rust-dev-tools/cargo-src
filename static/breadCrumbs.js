// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

function BreadCrumbs(props) {
    const pathParts = props.path.split('/');
    let crumbs = [];
    for (const c in pathParts) {
        const id = "breadcrumb_" + c;
        const path = pathParts.slice(0, c + 1).join('/');
        const onClick = (e) => rustw.get_source(path);
        crumbs.push(<span key={c}>> <span className="link_breadcrumb" id={id} onClick={onClick}>{pathParts[c]}</span></span>);
    }
    return <div id="div_dir_path">
        {crumbs}
    </div>;
}

module.exports = {
    BreadCrumbs: BreadCrumbs
}
