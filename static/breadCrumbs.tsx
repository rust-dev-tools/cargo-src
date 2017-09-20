// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import * as React from 'react';

export interface BreadCrumbProps {
    path: Array<string>,
    getSource: (path :string) => any
}

export const BreadCrumbs: React.SFC<BreadCrumbProps> = (props) => {
    let path = "",
        crumbs = props.path.map((p: string) => {
            if (path.length > 0) {
                path += '/';
            }
            path += p;
            const pathCopy = path;
            const onClick = () => props.getSource(pathCopy);
            return (<span key={path}>> <span className="link_breadcrumb" onClick={onClick}>{p}</span></span>);
        });
    return <div id="div_dir_path">
        {crumbs}
    </div>;
}
