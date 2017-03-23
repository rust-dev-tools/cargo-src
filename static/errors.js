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
const utils = require('./utils');
const rustw = require('./rustw');

// TODO state
// - update spans - call update_span on spans
// - current page
// - menus?

// TODO remove uses of pre_load_build
// TODO Not showing `Building...` message or clearing page.

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = { errors: [], messages: [], showErrors: true, showMessages: true };
    }

    showErrors(e) {
        this.setState((prevState) => ({ showErrors: !prevState.showErrors }));
    }
    showMessages(e) {
        this.setState((prevState) => ({ showMessages: !prevState.showMessages }));
    }

    componentDidMount() {
        let updateSource = new EventSource(utils.make_url("build_updates"));
        const self = this;
        updateSource.addEventListener("error", function(event) {
            const data = JSON.parse(event.data);
            let key;
            if (data.spans.length > 0) {
                key = data.spans[0].id;
            } else {
                key = data.message;
            }
            const error = <Error code={data.code} level={data.level} message={data.message} spans={data.spans} childErrors={data.children} key={key}/>;
            self.setState((prevState) => ({ errors: prevState.errors.concat([error]) }));

            // TODO
            // for (let s of error.spans) {
            //     set_one_snippet_plain_text(s);
            // }
            // for (let c of error.children) {
            //     for (let s of c.spans) {
            //         set_one_snippet_plain_text(s);
            //     }
            // }
        }, false);
        updateSource.addEventListener("message", function(event) {
            const data = JSON.parse(event.data);
            const msg = <pre key={data}>{data}</pre>;
            self.setState((prevState) => ({ messages: prevState.messages.concat([msg]) }));
        }, false);
        updateSource.addEventListener("close", function(event) {
            updateSource.close();
        }, false);
    }

    render() {
        let demoMessage = null;
        if (CONFIG.demo_mode) {
            demoMessage =
                <div id="div_message">
                    <h2>demo mode</h2>
                    Click '+' and '-' to expand/hide info.<br />
                    Click error codes or source links to see more stuff. Source links can be right-clicked for more options (note that edit functionality won't work in demo mode).
                </div>;
        }
        // show/hide stuff
        let errors = null;
        if (this.state.showErrors) {
            errors = this.state.errors;
        }
        let messages = null;
        if (this.state.showMessages) {
            messages = this.state.messages;
        }
        return (
            <div>
                {demoMessage}
                <div id="div_errors">
                    <HideButton hidden={!this.state.showErrors} onClick={this.showErrors.bind(this)}/><span id="div_std_label">errors:</span>
                    {errors}
                </div>

                <div id="div_stdout">
                    <HideButton hidden={!this.state.showMessages} onClick={this.showMessages.bind(this)}/><span id="div_std_label">info:</span>
                    <div id="div_messages">
                    {messages}
                    </div>
                </div>
            </div>);
    }
}

class Error extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showChildren: true };
    }

    componentDidMount() {
        let err_codes = $(".err_code").filter(function(i, e) { return !!$(e).attr("data-explain"); });
        err_codes.click(rustw.win_err_code);
        err_codes.addClass("err_code_link");
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
    renderResults: function(container) {
        ReactDOM.render(
            <Results />,
            container
        );
    },

    renderError: function (data, container) {
        ReactDOM.render(
            <Error code={data.code} level={data.level} message={data.message} spans={data.spans} childErrors={data.children} />,
            container
        );
    },

    Error
}
