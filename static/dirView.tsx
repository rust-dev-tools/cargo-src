// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import * as React from 'react';

import { BreadCrumbs } from './breadCrumbs';
import { RustwApp } from './app.js';

export interface DirViewProps {
    app: RustwApp,
    files: Array<any>,
    path: Array<string>,
}

export const DirView: React.SFC<DirViewProps> = (props) => {
    const dirPath = props.path.join('/').replace('//', '/');
    let files: any = props.files.map((f: any) => {
        const onClick = () => props.app.loadSource(`${dirPath}/${f.name}`);
        const className = f.kind === "Directory" ? 'div_entry_name div_dir_entry' : 'div_entry_name div_file_entry';
        return (
            <div className="div_entry" key={f.name}>
                <span className={className} onClick={onClick}>{f.name}</span>
            </div>
        );
    });
    if (files.length == 0) {
        files = <div className="div_entry">&lt;Empty directory&gt;</div>
    }
    return <div id="src">
        <BreadCrumbs path={props.path} app={props.app} />
        <div id="div_dir_view">
            <div id="div_dir_contents">
                {files}
            </div>
        </div>
    </div>;
}
