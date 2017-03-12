import React from 'react';
import ReactDOM from 'react-dom';

var Snippet = require('./snippet.js').Snippet;

// TODO state (in particular, update spans)

class Error extends React.Component {
    render() {
        let children = null;
        if (this.props.children && this.props.children.length > 0) {
            let childList = [];
            for (let i in this.props.children) {
                let c = this.props.children[i];
                childList.push(<ChildError level={c.level} message={c.message} spans={c.spans} key={i} />)
            }
            children =
                <div className="group_children">
                    <span className="expand_children small_button" />
                    <span className="div_children_dots">...</span>
                    <span className="div_children">
                        {childList}
                    </span>
                </div>;
        }

        let code = null;
        if (this.props.code) {
            code = <span className="err_code" data-explain={this.props.code.explanation} data-code={this.props.code.code}>{this.props.code.code}</span>;
        }

        return (
            <div className={'div_diagnostic div_' + this.props.level}>
                <span className={'level_' + this.props.level}>{this.props.level}</span> {code}: <span className="err_msg" dangerouslySetInnerHTML={{__html: this.props.message}}></span>
                <Snippet spans={this.props.spans}/>

                {children}
            </div>
        );
    }
}

class ChildError extends React.Component {
    render() {
        return (
            <span>
                <span className={'div_diagnostic_nested div_' + this.props.level}>
                    <span className={'level_' + this.props.level}>{this.props.level}</span>: <span className="err_msg" dangerouslySetInnerHTML={{__html: this.props.message}}></span>
                    <Snippet spans={this.props.spans}/>
                </span><br />
            </span>
        );
    }
}

module.exports = {
    renderError: function (data, container) {
        ReactDOM.render(
            <Error code={data.code} level={data.level} message={data.message} spans={data.spans} children={data.children} />,
            container
        );
    },

    Error: Error
}
