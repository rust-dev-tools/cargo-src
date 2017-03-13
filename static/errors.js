import React from 'react';
import ReactDOM from 'react-dom';

const { Snippet } = require('./snippet');

// TODO state (in particular, update spans)

class Error extends React.Component {
    render() {
        const { children: _children, code: _code, level, spans } = this.props;

        let children = null;
        if (_children && _children.length > 0) {
            const childList = [];
            for (let i in _children) {
                let c = _children[i];
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
            <Error code={data.code} level={data.level} message={data.message} spans={data.spans} children={data.children} />,
            container
        );
    },

    Error
}
