!function(){var a=Handlebars.template,n=Handlebars.templates=Handlebars.templates||{};n.summary=a({1:function(a,n,l,s,i){var u;return(null!=(u=a.lambda(n,n))?u:"")+" :: "},3:function(a,n,l,s,i){var u;return'            <span class="small_button" id="jump_up" link="summary:'+a.escapeExpression((u=null!=(u=l.parent||(null!=n?n.parent:n))?u:l.helperMissing,"function"==typeof u?u.call(null!=n?n:{},{name:"parent",hash:{},data:i}):u))+'">&#x2191;</span>\n'},5:function(a,n,l,s,i){return'<span class="small_button" id="expand_docs">+</span>'},7:function(a,n,l,s,i){var u,d,e=null!=n?n:{},r=l.helperMissing,m="function",t=a.escapeExpression;return'                <div class="div_summary_sub" id="div_summary_sub_'+t((d=null!=(d=l.id||(null!=n?n.id:n))?d:r,typeof d===m?d.call(e,{name:"id",hash:{},data:i}):d))+'">\n                    <span class="jump_children small_button" link="summary:'+t((d=null!=(d=l.id||(null!=n?n.id:n))?d:r,typeof d===m?d.call(e,{name:"id",hash:{},data:i}):d))+'">&#x2192;</span> <span class="summary_sig_sub div_all_span_src">'+(null!=(d=null!=(d=l.signature||(null!=n?n.signature:n))?d:r,u=typeof d===m?d.call(e,{name:"signature",hash:{},data:i}):d)?u:"")+'</span>\n                    <p class="div_summary_doc_sub">'+(null!=(d=null!=(d=l.doc_summary||(null!=n?n.doc_summary:n))?d:r,u=typeof d===m?d.call(e,{name:"doc_summary",hash:{},data:i}):d)?u:"")+"</p>\n                </div>\n"},compiler:[7,">= 4.0.0"],main:function(a,n,l,s,i){var u,d,e=null!=n?n:{},r=l.helperMissing,m="function";return'<div id="div_summary">\n    <div id="div_mod_path">\n        '+(null!=(u=l.each.call(e,null!=n?n.bread_crumbs:n,{name:"each",hash:{},fn:a.program(1,i,0),inverse:a.noop,data:i}))?u:"")+'\n    </div>\n    <div id="div_summary_main">\n        <div id="div_summary_title">\n'+(null!=(u=l.if.call(e,null!=n?n.parent:n,{name:"if",hash:{},fn:a.program(3,i,0),inverse:a.noop,data:i}))?u:"")+'            <span class="summary_sig_main div_all_span_src">'+(null!=(d=null!=(d=l.signature||(null!=n?n.signature:n))?d:r,u=typeof d===m?d.call(e,{name:"signature",hash:{},data:i}):d)?u:"")+'</span>\n        </div>\n        <div class="div_summary_doc">\n            '+(null!=(u=l.if.call(e,null!=n?n.doc_rest:n,{name:"if",hash:{},fn:a.program(5,i,0),inverse:a.noop,data:i}))?u:"")+'<span id="div_summary_doc_summary">'+(null!=(d=null!=(d=l.doc_summary||(null!=n?n.doc_summary:n))?d:r,u=typeof d===m?d.call(e,{name:"doc_summary",hash:{},data:i}):d)?u:"")+'</span>\n            <div id="div_summary_doc_more">'+(null!=(d=null!=(d=l.doc_rest||(null!=n?n.doc_rest:n))?d:r,u=typeof d===m?d.call(e,{name:"doc_rest",hash:{},data:i}):d)?u:"")+'</div>\n        </div>\n        <div class="div_summary_children">\n'+(null!=(u=l.each.call(e,null!=n?n.children:n,{name:"each",hash:{},fn:a.program(7,i,0),inverse:a.noop,data:i}))?u:"")+"        </div>\n    </div>\n</div>\n"},useData:!0})}();