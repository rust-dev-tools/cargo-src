// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import * as React from 'react';

import { BreadCrumbs } from './breadCrumbs';

export interface DirViewProps {
    files: Array<any>,
    file: string,
    getSource: (path :string) => any
}

export const DirView: React.SFC<DirViewProps> = (props) => {
    let files = props.files.map((f: any) => {
        const onClick = () => props.getSource(`${props.file}/${f.name}`);
        const className = f.kind === "Directory" ? 'div_entry_name div_dir_entry' : 'div_entry_name div_file_entry';
        return (
            <div className="div_entry" key={f.name}>
                <span className={className} onClick={onClick}>{f.name}</span>
            </div>
        );
    });
    return <div>
        <BreadCrumbs path = {props.file.split('/')} getSource={props.getSource} />
        <div id="div_dir_view">
            <div id="div_dir_contents">
                {files}
            </div>
        </div>
    </div>;
}
