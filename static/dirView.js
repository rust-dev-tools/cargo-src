// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

const { BreadCrumbs } = require('./breadCrumbs');

function DirView(props) {
    let files = [];
    for (const f of props.files) {
        const onClick = (e) => props.getSource(props.file + "/" + f.name);
        if (f.kind == "Directory") {
            files.push(<div className="div_entry" key={f.name}>
                        <span className="div_entry_name div_dir_entry" onClick={onClick}>{f.name}</span>
                    </div>);
        } else {
            files.push(<div className="div_entry" key={f.name}>
                        <span className="div_entry_name div_file_entry" onClick={onClick}>{f.name}</span>
                    </div>);
        }
    }
    return <div id="div_dir_view">
        <BreadCrumbs path = {props.file.split('/')} getSource={props.getSource} />
        <div id="div_dir_contents">
            {files}
        </div>
    </div>;
}

module.exports = {
    DirView
}
