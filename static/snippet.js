import React from 'react';
import ReactDOM from 'react-dom';

class Snippet extends React.Component {
    render() {
        if (!this.props.spans || this.props.spans.length == 0) {
            return null;
        }

        return (
            <span className="div_snippet">
                <br /><span className="expand_spans small_button" />
                <span className="div_spans">
                    {this.props.spans.map((sp) => <SnippetSpan {...sp} key={sp.id}/>)}
                </span>
            </span>
        );
    }
}

class SnippetSpan extends React.Component {
    render() {
        let label = null;
        if (this.props.label) {
            label = <span className="div_span_label" id={'div_span_label_' + this.props.id}>{this.props.label}</span>;
        }
        return (
            <span className="div_span" id={'div_span_' + this.props.id}>
                <span className="span_loc" data-link={this.props.file_name + ':' + this.props.line_start + ':' + this.props.column_start + ':' + this.props.line_end + ':' + this.props.column_end}  id={'span_loc_' + this.props.id}>{this.props.file_name}:{this.props.line_start}:{this.props.column_start}: {this.props.line_end}:{this.props.column_end}</span>
                {label}
                <div className="div_all_span_src" id={'src_span_' + this.props.id}>
                    <SnippetBlock id={this.props.id} line_start={this.props.line_start} text={this.props.text}/>
                </div>
            </span>
        );
    }
}

class SnippetBlock extends React.Component {
    render() {
        let line_number = this.props.line_start;
        let numbers = [];
        let lines = [];
        for (let line of this.props.text) {
            numbers.push(<div className="span_src_number" id={'snippet_line_number_' + this.props.id + '_' + line_number} key={'number_' + line_number}>{line_number}</div>);
            let text = "&nbsp;";
            if (line) {
                text = line;
            }
            lines.push(<div className="span_src" id={'snippet_line_' + this.props.id + '_' + line_number} key={'span_' + line_number}  dangerouslySetInnerHTML={{__html: text}} />);
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
