// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import { connect } from 'react-redux';
import * as actions from './actions';

import { Snippet } from './snippet';
import { HideButton } from './hideButton';
import * as utils from './utils';


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
            errors = <ErrorsController errors={this.props.errors.toArray()} />;
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

const mapStateToProps = (state) => {
    return {
        errors: state.errors.errors,
        messages: state.errors.messages,
    }
}

export const ResultsController = connect(
    mapStateToProps,
)(Results);


function demoMsg() {
    return <div id="div_message">
        <h2>demo mode</h2>
        Click '+' and '-' to expand/hide info.<br />
        Click error codes or source links to see more stuff. Source links can be right-clicked for more options.
    </div>;
}

function Messages(props) {
    // TODO[ES6]: use props.messages.map
    let msgs = [];
    for (const m of props.messages) {
        msgs.push(<pre key={m}>{m}</pre>);
    }
    return <div id="div_messages">
        {msgs}
    </div>;
}

export class Error extends React.Component {
    render() {
        const { children: _children, code: _code, level, spans, message } = this.props;
        const self = this;

        let children = null;
        if (_children && _children.length > 0) {
            let button = null;
            if (!this.props.hideButtons) {
                button = <HideButton hidden={!this.props.showChildren} onClick={this.props.toggleChildren} />;
            }
            let childrenSub;
            if (this.props.showChildren) {
                const childList = [];
                for (let c of _children) {
                    childList.push(<ChildError level={c.level} message={c.message} spans={c.spans} key={c.id} getSource={this.props.getSource} />)
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
                onClick = () => self.props.showErrCode(_code.code, marked(_code.explanation), self.props);
            }
            code = <span className={className} onClick={onClick}>{_code.code}</span>;
        }

        return (
            <div className={'div_diagnostic div_' + level}>
                <span className={'level_' + level}>{level}</span><span className="err_colon"> {code}:</span> <span className="err_msg" dangerouslySetInnerHTML={{__html: message}} />
                <Snippet spans={spans} showSpans={this.props.showSpans} hideButtons={this.props.hideButtons} toggleSpans={this.props.toggleSpans} getSource={this.props.getSource} />

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
                <Snippet spans={spans} showSpans="true" hideButtons="true" getSource={props.getSource} />
            </span><br />
        </span>
    );
}

const mapStateToPropsError = (state, ownProps) => {
    let data = state.errors.errors.get(ownProps.id);
    return data;
}

const mapDispatchToPropsError = (dispatch, ownProps) => {
    return {
        toggleChildren: () => dispatch(actions.toggleChildren(ownProps.id)),
        toggleSpans: () => dispatch(actions.toggleSpans(ownProps.id)),
        showErrCode: (code, explain, error) => dispatch(actions.showErrCode(code, explain, error)),
        getSource: (fileName, lineStart) => dispatch(actions.getSource(fileName, lineStart)),
    };
}

export const ErrorController = connect(
    mapStateToPropsError,
    mapDispatchToPropsError
)(Error);

function Errors(props) {
    const errors = props.errors.toArray().map((data) => {
        return <ErrorController id={data.id} key={data.id} />;
    });
    return <div>
        {errors}
    </div>;
}

const mapStateToPropsErrors = (state) => {
    return {
        errors: state.errors.errors
    };
}

const ErrorsController = connect(
    mapStateToPropsErrors,
)(Errors);

export function makeError(data) {
    data.showChildren = true;
    data.showSpans = false;
    data.hideButtons = false;
    data.hideCodeLink = false;
    return data;
}
