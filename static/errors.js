// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';
import { OrderedMap } from 'immutable';

const { Snippet } = require('./snippet');
const { HideButton } = require('./hideButton');
const utils = require('./utils');
const rustw = require('./rustw');
const topbar = require('./topbar');


// TODO Taking *a long time* to load - maybe something in the rustw server?

class Results extends React.Component {
    constructor(props) {
        super(props);
        this.state = { errors: OrderedMap(), messages: [], showErrors: true, showMessages: true };
    }

    showErrors(e) {
        this.setState((prevState) => ({ showErrors: !prevState.showErrors }));
    }
    showMessages(e) {
        this.setState((prevState) => ({ showMessages: !prevState.showMessages }));
    }

    componentDidMount() {
        this.runBuild();
    }

    componentDidUpdate(prevProps) {
        const { buildStr, forceRebuild } = this.props;

        if (buildStr != prevProps.buildStr ||
            (!!forceRebuild && (!prevProps.forceRebuild || forceRebuild != prevProps.forceRebuild))) {
            const self = this;
            this.setState({ errors: OrderedMap(), messages: [] }, () => self.runBuild());
        }
    }

    runBuild() {
        const self = this;

        $.ajax({
            url: utils.make_url(this.props.buildStr),
            type: 'POST',
            dataType: 'JSON',
            cache: false
        })
        .done(function (json) {
            topbar.renderTopBar("built");
            // TODO this isn't quite right because results doesn't include the incremental updates, OTOH, they should get over-written anyway
            MAIN_PAGE_STATE = { page: "build", results: json }
            rustw.load_build(MAIN_PAGE_STATE);
            self.pull_data(json.push_data_key);

            // TODO probably not right. Do this before we make the ajax call?
            history.pushState(MAIN_PAGE_STATE, "", utils.make_url("#build"));
        })
        .fail(function (xhr, status, errorThrown) {
            rustw.stop_build_animation();
            console.log("Error with build request");
            console.log("error: " + errorThrown + "; status: " + status);
            rustw.load_error();

            MAIN_PAGE_STATE = { page: "error" };
            history.pushState(MAIN_PAGE_STATE, "", utils.make_url("#build"));
        });

        let updateSource = new EventSource(utils.make_url("build_updates"));
        updateSource.addEventListener("error", function(event) {
            const data = JSON.parse(event.data);
            let key;
            if (data.spans.length > 0) {
                key = data.spans[0].id;
            } else {
                key = data.message;
            }
            const error = <Error code={data.code} level={data.level} message={data.message} spans={data.spans} childErrors={data.children} key={data.id}/>;
            self.setState((prevState) => ({ errors: prevState.errors.set(data.id, error) }));

            for (let s of data.spans) {
                set_one_snippet_plain_text(s);
            }
            for (let c of data.children) {
                for (let s of c.spans) {
                    set_one_snippet_plain_text(s);
                }
            }
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

    pull_data(key) {
        if (!key) {
            return;
        }

        const self = this;
        $.ajax({
            url: utils.make_url('pull?key=' + key),
            type: 'POST',
            dataType: 'JSON',
            cache: false
        })
        .done(function (json) {
            MAIN_PAGE_STATE.snippets = json;
            self.updateSnippets(json);
        })
        .fail(function (xhr, status, errorThrown) {
            console.log("Error pulling data for key " + key);
            console.log("error: " + errorThrown + "; status: " + status);
        });
    }

    updateSnippets(data) {
        if (!data) {
            return;
        }

        SNIPPET_PLAIN_TEXT = {};

        for (let s of data.snippets) {
            this.setState((prevState) => {
                if (s.parent_id) {
                    let parent = prevState.errors.get(s.parent_id);
                    if (parent) {
                        return { errors: prevState.errors.set(s.parent_id, updateChildSnippet(parent, s)) };
                    } else {
                        console.log('Could not find error to update: ' + s.parent_id);
                        return {};
                    }

                } else {
                    let err = prevState.errors.get(s.diagnostic_id);
                    if (err) {
                        return { errors: prevState.errors.set(s.diagnostic_id, updateSnippet(err, s)) };
                    } else {
                        console.log('Could not find error to update: ' + s.diagnostic_id);
                        return {};
                    }
                }
            });
            set_one_snippet_plain_text(s);
        }
    }

    render() {
        let demoMessage = null;
        if (CONFIG.demo_mode) {
            demoMessage =
                <div id="div_message">
                    <h2>demo mode</h2>
                    Click '+' and '-' to expand/hide info.<br />
                    Click error codes or source links to see more stuff. Source links can be right-clicked for more options.
                </div>;
        }
        // show/hide stuff
        let errors = null;
        if (this.state.showErrors) {
            errors = this.state.errors.toArray();
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

function set_one_snippet_plain_text(s) {
    var data = {
        "plain_text": s.plain_text,
        "file_name": s.file_name,
        "line_start": s.line_start,
        "line_end": s.line_end
    };
    SNIPPET_PLAIN_TEXT["span_loc_" + s.id] = data;
}

function updateChildSnippet(err, snippet) {
    const old_children = OrderedMap(err.props.childErrors.map((c) => [c.id, c]));
    let child = old_children.get(snippet.diagnostic_id);
    if (!child) {
        console.log("Could not find child error: " + snippet.diagnostic_id);
        return {};
    }
    let children = old_children.filter((v, k) => k != snippet.diagnostic_id);

    const oldSpans = OrderedMap(child.spans.map((sp) => [sp.id, sp]));
    const spans = update_spans(oldSpans, snippet);
    child.spans = spans.toArray();
    children = children.set(child.id, child);

    return React.cloneElement(err, { childErrors: children.toArray() });
}

function updateSnippet(err, snippet) {
    const oldSpans = OrderedMap(err.props.spans.map((sp) => [sp.id, sp]));
    const spans = update_spans(oldSpans, snippet);

    return React.cloneElement(err, { spans: spans.toArray() });
}

function update_spans(oldSpans, snippet) {
    let spans = oldSpans.filter((v, k) => !snippet.span_ids.includes(k));
    const newSpan = {
        id: snippet.span_ids[0],
        file_name: snippet.file_name,
        block_line_start: snippet.line_start,
        block_line_end: snippet.line_end,
        line_start: snippet.primary_span.line_start,
        line_end: snippet.primary_span.line_end,
        column_start: snippet.primary_span.column_start,
        column_end: snippet.primary_span.column_end,
        text: snippet.text,
        plain_text: snippet.plain_text,
        label: "",
        highlights: snippet.highlights
    };
    return spans.set(newSpan.id, newSpan);
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
                    childList.push(<ChildError level={c.level} message={c.message} spans={c.spans} key={c.id} />)
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
                onClick = (ev) => rustw.win_err_code(ev.target, this.props);
            }
            code = <span className={className} data-explain={_code.explanation} data-code={_code.code} onClick={onClick}>{_code.code}</span>;
        }

        return (
            <div className={'div_diagnostic div_' + level}>
                <span className={'level_' + level}>{level}</span><span className="err_colon"> {code}:</span> <span className="err_msg" dangerouslySetInnerHTML={{__html: message}} />
                <Snippet spans={spans} showSpans={this.props.showSpans} hideButtons={this.props.hideButtons}/>

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
                    <span className={'level_' + level}>{level}</span><span className="err_colon">:</span> <span className="err_msg" dangerouslySetInnerHTML={{__html: message}}></span>
                    <Snippet spans={spans}/>
                </span><br />
            </span>
        );
    }
}

module.exports = {
    rebuildAndRender: function(buildStr, container) {
        ReactDOM.render(
            <Results buildStr={buildStr} forceRebuild={Math.random()} />,
            container
        );
    },

    Error: Error
}
