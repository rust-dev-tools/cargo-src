// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';

const { Snippet } = require('./snippet');
const { HideButton } = require('./hideButton');
const utils = require('./utils');


class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showErrors: true, showMessages: true };
    }

    showErrors(e) {
        this.setState((prevState) => ({ showErrors: !prevState.showErrors }));
    }
    showMessages(e) {
        this.setState((prevState) => ({ showMessages: !prevState.showMessages }));
    }

    render() {
        let demoMessage = null;
        if (CONFIG.demo_mode) {
            demoMessage = demoMsg();
        }
        // show/hide stuff
        let errors = null;
        if (this.state.showErrors) {
            errors = <Errors errors={this.props.errors.toArray()} />;
        }
        let messages = null;
        if (this.state.showMessages) {
            messages = <Messages messages={this.props.messages} />;
        }
        return <div>
            {demoMessage}
            <div id="div_errors">
                <HideButton hidden={!this.state.showErrors} onClick={this.showErrors.bind(this)}/>
                <span id="div_std_label">errors:</span>
                {errors}
            </div>

            <div id="div_stdout">
                <HideButton hidden={!this.state.showMessages} onClick={this.showMessages.bind(this)}/>
                <span id="div_std_label">info:</span>
                {messages}
            </div>
        </div>;
    }
}

function demoMsg() {
    return <div id="div_message">
        <h2>demo mode</h2>
        Click '+' and '-' to expand/hide info.<br />
        Click error codes or source links to see more stuff. Source links can be right-clicked for more options.
    </div>;
}

function Messages(props) {
    let msgs = [];
    for (const m of props.messages) {
        msgs.push(<pre key={m}>{m}</pre>);
    }
    return <div id="div_messages">
        {msgs}
    </div>;
}

function Errors(props) {
    return <div>
        {props.errors}
    </div>;
}

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
        const self = this;

        let children = null;
        if (childErrors && childErrors.length > 0) {
            let button = null;
            if (!this.props.hideButtons) {
                button = <HideButton hidden={!this.state.showChildren} onClick={this.showChildren.bind(this)} />;
            }
            let childrenSub;
            if (this.state.showChildren) {
                const childList = [];
                for (let c of childErrors) {
                    childList.push(<ChildError level={c.level} message={c.message} spans={c.spans} key={c.id} callbacks={this.props.callbacks} />)
                }
                childrenSub = <span className="div_children">{childList}</span>;
            } else {
                childrenSub = <span className="div_children_dots">...</span>;
            }
            children =
                <div className="group_children">
                    {button}
                    {childrenSub}
                </div>;
        }

        let code = null;
        if (_code) {
            let className = "err_code";
            let onClick = null;
            if (_code.explanation && !this.props.hideCodeLink) {
                className += " err_code_link";
                onClick = (ev) => self.props.callbacks.showErrCode(ev.target, self.props);
            }
            code = <span className={className} data-explain={_code.explanation} data-code={_code.code} onClick={onClick}>{_code.code}</span>;
        }

        return (
            <div className={'div_diagnostic div_' + level}>
                <span className={'level_' + level}>{level}</span><span className="err_colon"> {code}:</span> <span className="err_msg" dangerouslySetInnerHTML={{__html: message}} />
                <Snippet spans={spans} showSpans={this.props.showSpans} hideButtons={this.props.hideButtons} callbacks={this.props.callbacks} />

               {children}
            </div>
        );
    }
}

function ChildError(props) {
    const { level, spans, message } = props;

    return (
        <span>
            <span className={'div_diagnostic_nested div_' + level}>
                <span className={'level_' + level}>{level}</span><span className="err_colon">:</span> <span className="err_msg" dangerouslySetInnerHTML={{__html: message}}></span>
                <Snippet spans={spans} callbacks={props.callbacks} />
            </span><br />
        </span>
    );
}

module.exports = {
    Error,
    Results
}
