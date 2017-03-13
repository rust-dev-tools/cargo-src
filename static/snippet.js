import React from 'react';
import ReactDOM from 'react-dom';

class Snippet extends React.Component {
    render() {
        const { spans } = this.props;
        if (!spans || spans.length == 0) {
            return null;
        }

        return (
            <span className="div_snippet">
                <br /><span className="expand_spans small_button" />
                <span className="div_spans">
                    {spans.map((sp) => <SnippetSpan {...sp} key={sp.id}/>)}
                </span>
            </span>
        );
    }
}

class SnippetSpan extends React.Component {
    render() {
        const { line_start, line_end, column_start, column_end } = this.props;
        const { label: _label, id, file_name, text } = this.props;

        let label = null;
        if (_label) {
            label = <span className="div_span_label" id={'div_span_label_' + id}>{_label}</span>;
        }

        return (
            <span className="div_span" id={'div_span_' + id}>
                <span className="span_loc" data-link={file_name + ':' + line_start + ':' + column_start + ':' + line_end + ':' + column_end}  id={'span_loc_' + id}>{file_name}:{line_start}:{column_start}: {line_end}:{column_end}</span>
                {label}
                <div className="div_all_span_src" id={'src_span_' + id}>
                    <SnippetBlock id={id} line_start={line_start} text={text}/>
                </div>
            </span>
        );
    }
}

class SnippetBlock extends React.Component {
    render() {
        const { line_start: line_number, text: lines, id } = this.props;
        const numbers = [];
        const lines = [];
        for (let line of lines) {
            numbers.push(<div className="span_src_number" id={'snippet_line_number_' + id + '_' + line_number} key={'number_' + line_number}>{line_number}</div>);
            let text = "&nbsp;";
            if (line) {
                text = line;
            }
            lines.push(<div className="span_src" id={'snippet_line_' + id + '_' + line_number} key={'span_' + line_number}  dangerouslySetInnerHTML={{__html: text}} />);
            line_number += 1;
        }
        return (
            <span>
                <span className="div_span_src_number">
                    {numbers}
                </span><span className="div_span_src">
                    {lines}
                </span>
            </span>
        );
    }
}

module.exports = {
    renderSnippetSpan: function(data, container) {
        ReactDOM.render(
            <SnippetBlock text={data.text} id={data.id} line_start={data.line_start} />,
            container
        );
    },

    Snippet: Snippet
}
