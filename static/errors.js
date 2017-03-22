// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';

const { Snippet } = require('./snippet');
const { HideButton } = require('./hideButton');

// TODO state
// - update spans - call update_span on spans
// - current page
// - menus?

class Error extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showChildren: true };
    }

    showChildren(e) {
        this.setState((prevState) => ({ showChildren: !prevState.showChildren }));
    }

    render() {
        const { childErrors, code: _code, level, spans, message } = this.props;

        let children = null;
        if (childErrors && childErrors.length > 0) {
            let childrenSub;
            if (this.state.showChildren) {
                const childList = [];
                for (let i in childErrors) {
                    let c = childErrors[i];
                    childList.push(<ChildError level={c.level} message={c.message} spans={c.spans} key={i} />)
                }
                childrenSub = <span className="div_children">{childList}</span>;
            } else {
                childrenSub = <span className="div_children_dots">...</span>;
            }
            children =
                <div className="group_children">
                    <HideButton hidden={!this.state.showChildren} onClick={this.showChildren.bind(this)}/>
                    {childrenSub}
                </div>;
        }

        let code = null;
        if (_code) {
            code = <span className="err_code" data-explain={_code.explanation} data-code={_code.code}>{_code.code}</span>;
        }

        return (
            <div className={'div_diagnostic div_' + level}>
                <span className={'level_' + level}>{level}</span> {code}: <span className="err_msg" dangerouslySetInnerHTML={{__html: message}} />
                <Snippet spans={spans}/>

               {children}
            </div>
        );
    }
}

class ChildError extends React.Component {
    render() {
        const { level, spans, message } = this.props

        return (
            <span>
                <span className={'div_diagnostic_nested div_' + level}>
                    <span className={'level_' + level}>{level}</span>: <span className="err_msg" dangerouslySetInnerHTML={{__html: message}}></span>
                    <Snippet spans={spans}/>
                </span><br />
            </span>
        );
    }
}

module.exports = {
    renderError: function (data, container) {
        ReactDOM.render(
            <Error code={data.code} level={data.level} message={data.message} spans={data.spans} childErrors={data.children} />,
            container
        );
    },

    Error
}
