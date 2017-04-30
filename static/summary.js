// Copyright 2017 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

import React from 'react';
import ReactDOM from 'react-dom';

const rustw = require('./rustw');

// TODO dup'ed in srcView
function show_ref_menu(event) {
    var menu = $("#div_ref_menu");
    var data = show_menu(menu, event, hide_ref_menu);
    data.id = event.data;

    var doc_url = data.target.attr("doc_url");
    if (doc_url) {
        var view_data = { 'link': doc_url, 'hide_fn': hide_ref_menu };
        $("#ref_menu_view_docs").show();
        $("#ref_menu_view_docs").click(view_data, open_tab);
    } else {
        $("#ref_menu_view_docs").hide();
    }

    var src_url = data.target.attr("src_url");
    if (src_url) {
        var view_data = { 'link': src_url, 'hide_fn': hide_ref_menu };
        $("#ref_menu_view_source").show();
        $("#ref_menu_view_source").click(view_data, open_tab);
    } else {
        $("#ref_menu_view_source").hide();
    }

    $("#ref_menu_view_summary").click(event.data, (ev) => summary(ev.data));
    $("#ref_menu_find_uses").click(event.data, (ev) => find_uses(ev.data));

    let impls = data.target.attr("impls");
    // FIXME we could display the impl count in the menu
    if (impls && impls != "0") {
        $("#ref_menu_find_impls").click(event.data, (ev) => find_impls(ev.data));
    } else {
        $("#ref_menu_find_impls").hide();
    }

    if (CONFIG.unstable_features) {
        $("#ref_menu_rename").click(data, show_rename);
    } else {
        $("#ref_menu_rename").hide();
    }

    return false;
}

function open_tab(event) {
    window.open(event.data.link, '_blank');
    event.data.hide_fn();
}

// TODO dup'ed in rustw.js
function show_menu(menu, event, hide_fn) {
    var target = $(event.target);
    var data = {
        "position": { "top": event.pageY, "left": event.pageX },
        "target": target
    };

    menu.show();
    menu.offset(data.position);

    // TODO can we do better than this to close the menu? (Also options menu).
    $("#div_main").click(hide_fn);
    $("#div_header").click(hide_fn);

    return data;
}

// TODO dup'ed in rustw.js
function hide_ref_menu() {
    hide_menu($("#div_ref_menu"));
}

// TODO dup'ed in rustw.js
function hide_menu(menu) {
    menu.children("div").off("click");
    menu.hide();
}

// TODO needs testing
class Summary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { showDocs: false };
    }

    componentDidMount() {
        // Make link and menus for idents on the page.
        let idents = $(".summary_ident");
        idents.click(rustw.load_link);
        idents.on("contextmenu", (ev) => {
            let target = ev.target;
            ev.data = ev.target.id.substring("def_".length);
            return show_ref_menu(ev);
        });

        // Add links and menus for breadcrumbs.
        let breadcrumbs = $(".link_breadcrumb");
        breadcrumbs.click(rustw.load_link);
        breadcrumbs.on("contextmenu", (ev) => {
            let target = ev.target;
            ev.data = ev.target.id.substring("breadcrumb_".length);
            return show_ref_menu(ev);
        });
    }

    render() {
        let breadCrumbs = [];
        for (const bc in this.props.breadCrumbs) {
            breadCrumbs.push(<span>{bc} :: </span>);
        }
        let parent = null;
        if (this.props.parent) {
            parent = <span className="small_button" id="jump_up" data-link={'summary:' + this.props.parent} onClick={rustw.load_link}>&#x2191;</span>;
        }

        let docExpandButton = null;
        if (this.props.doc_rest) {
            if (this.state.showDocs) {
                docExpandButton = <span className="small_button" id="expand_docs" onClick={() => $("#div_summary_doc_more").hide()}>-</span>;
            } else {
                docExpandButton = <span className="small_button" id="expand_docs" onClick={() => $("#div_summary_doc_more").show()}>+</span>;
            }
        }

        let children = [];
        for (const c of this.props.children) {
            children.push(<div className="div_summary_sub" id={"div_summary_sub_" + c.id} key={c.id}>
                            <span className="jump_children small_button" data-link={"summary:" + c.id} onClick={rustw.load_link}>&#x2192;</span>
                            <span className="summary_sig_sub div_all_span_src" dangerouslySetInnerHTML={{__html: c.signature}} />
                            <p className="div_summary_doc_sub" dangerouslySetInnerHTML={{__html: c.doc_summary}} />
                        </div>);
        }
        return <div id="div_summary">
            <div id="div_mod_path">
                {breadCrumbs}
            </div>
            <div id="div_summary_main">
                <div id="div_summary_title">
                    {parent}
                    <span className="summary_sig_main div_all_span_src" dangerouslySetInnerHTML={{__html: this.props.signature}} />
                </div>
                <div className="div_summary_doc">
                    {docExpandButton}<span id="div_summary_doc_summary" dangerouslySetInnerHTML={{__html: this.props.doc_summary}} />
                    <div id="div_summary_doc_more" dangerouslySetInnerHTML={{__html: this.props.doc_rest}} />
                </div>
                <div className="div_summary_children">
                    {children}
                </div>
            </div>
        </div>;
    }
}

module.exports = {
    renderSummary: function(data, container) {
        ReactDOM.render(
            <Summary breadCrumbs={data.breadCrumbs} parent={data.parent} signature={data.signature} doc_summary={data.doc_summary} doc_rest={data.doc_rest} children={data.children} />,
            container
        );
    }
}
