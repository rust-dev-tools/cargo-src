// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import * as React from 'react';

export interface HideButtonProps {
    hidden: boolean,
    onClick: () => any
}

export const HideButton: React.SFC<HideButtonProps> = (props) => {
    const text = props.hidden ? '+' : '-';
    return <span className="small_button" onClick={props.onClick}>{text}</span>
}
