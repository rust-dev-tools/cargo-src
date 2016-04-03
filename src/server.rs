
use web::router;
use build;
use build::errors::{self, Diagnostic};
use config::Config;

use std::process::Command;

use hyper::server::request::Request;
use hyper::server::response::Response;
use hyper::net::Fresh;
use hyper::uri::RequestUri;
use hyper::header::ContentType;
use serde_json;

/// An instance of the server. Something of a God Class. Runs a session of
/// rustw.
pub struct Instance {
    router: router::Router,
    builder: build::Builder,
    pub config: Config,
}

impl Instance {
    pub fn new(config: Config) -> Instance {
        Instance {
            router: router::Router::new(),
            builder: build::Builder::from_config(&config),
            config: config,
        }
    }

    pub fn build(&self) -> String {
        let build_result = self.builder.build().unwrap();
        let mut result = BuildResult::from_build(&build_result);
        for d in result.errors.iter_mut() {
            d.fold_on_message(&|s| errors::codify_message(&s));
            d.fold_on_span(&|sp| errors::expand_zero_spans(sp));
        }

        serde_json::to_string(&result).unwrap()
    }
}

impl ::hyper::server::Handler for Instance {
    fn handle<'a, 'k>(&'a self, req: Request<'a, 'k>, mut res: Response<'a, Fresh>) {
        if let RequestUri::AbsolutePath(ref s) = req.uri {
            let action = self.router.route(s, &self.config);
            match action {
                router::Action::Static(ref data, ref content_type) => {
                    res.headers_mut().set(content_type.clone());
                    res.send(data).unwrap();
                }
                router::Action::Build => {
                    assert!(!self.config.demo_mode, "Build shouldn't happen in demo mode");
                    let text = self.build();
                    // Used for generating the test data.
                    //println!("{}", text);
                    res.headers_mut().set(ContentType::json());
                    res.send(text.as_bytes()).unwrap();
                }
                router::Action::CodeLines(ref s) => {
                    let src_result = SourceResult::from_source(s);
                    let text = serde_json::to_string(&src_result).unwrap();
                    res.headers_mut().set(ContentType::json());
                    res.send(text.as_bytes()).unwrap();
                }
                router::Action::Edit(ref args) => {
                    let cmd_line = &self.config.edit_command;
                    if !cmd_line.is_empty() {
                        let cmd_line = cmd_line.replace("$file", &args[0])
                                               .replace("$line", &args[1])
                                               .replace("$col", &args[2]);

                        let mut splits = cmd_line.split(' ');

                        let mut cmd = Command::new(splits.next().unwrap());
                        for arg in splits {
                            cmd.arg(arg);
                        }

                        // TODO log, don't print
                        match cmd.spawn() {
                            Ok(_) => println!("edit, launched successfully"),
                            Err(e) => println!("edit, launch failed: `{:?}`, command: `{}`", e, cmd_line),
                        }
                    }

                    res.headers_mut().set(ContentType::json());
                    res.send("{}".as_bytes()).unwrap();                    
                }
                router::Action::Error(status, ref msg) => {
                    // TODO log it
                    //println!("ERROR: {} ({})", msg, status);

                    *res.status_mut() = status;
                    res.send(msg.as_bytes()).unwrap();
                }
            }
        } else {
            // TODO log this and ignore it.
            panic!("Unexpected uri");
        }
    }
}

#[derive(Serialize, Debug)]
struct BuildResult {
    messages: String,
    errors: Vec<Diagnostic>,
    // build_command: String,
}

impl BuildResult {
    fn from_build(build: &build::BuildResult) -> BuildResult {
        BuildResult {
            messages: build.stdout.to_owned(),
            errors: errors::parse_errors(&build.stderr),
        }
    }
}

#[derive(Serialize, Debug)]
struct SourceResult {
    lines: Vec<String>,
}

impl SourceResult {
    fn from_source(s: &str) -> SourceResult {
        let highlighted = highlight(s);

        let mut lines = vec![];

        for line in highlighted.lines() {
            lines.push(line.to_owned());
        }
        if s.ends_with('\n') {
            lines.push(String::new());
        }

        SourceResult {
            lines: lines,
        }
    }
}

use rustdoc::html::escape::Escape;

use std::io;
use std::io::prelude::*;
use syntax::parse::lexer;
use syntax::parse::token;
use syntax::parse;

// TODO copypasta from rustdoc, change rustdoc...

/// Highlights some source code, returning the HTML output.
pub fn highlight(src: &str) -> String {
    let sess = parse::ParseSess::new();
    let fm = sess.codemap().new_filemap("<stdin>".to_string(), src.to_string());

    let mut out = Vec::new();
    doit(&sess,
         lexer::StringReader::new(&sess.span_diagnostic, fm),
         &mut out).unwrap();
    String::from_utf8_lossy(&out[..]).into_owned()
}

/// Exhausts the `lexer` writing the output into `out`.
///
/// The general structure for this method is to iterate over each token,
/// possibly giving it an HTML span with a class specifying what flavor of token
/// it's used. All source code emission is done as slices from the source map,
/// not from the tokens themselves, in order to stay true to the original
/// source.
fn doit(sess: &parse::ParseSess, mut lexer: lexer::StringReader,
        out: &mut Write) -> io::Result<()> {
    use syntax::parse::lexer::Reader;

    let mut is_attribute = false;
    let mut is_macro = false;
    let mut is_macro_nonterminal = false;
    loop {
        let next = lexer.next_token();

        let snip = |sp| sess.codemap().span_to_snippet(sp).unwrap();

        if next.tok == token::Eof { break }

        let klass = match next.tok {
            token::Whitespace => {
                write!(out, "{}", Escape(&snip(next.sp)))?;
                continue
            },
            token::Comment => {
                write!(out, "<span class='comment'>{}</span>",
                       Escape(&snip(next.sp)))?;
                continue
            },
            token::Shebang(s) => {
                write!(out, "{}", Escape(&s.as_str()))?;
                continue
            },
            // If this '&' token is directly adjacent to another token, assume
            // that it's the address-of operator instead of the and-operator.
            // This allows us to give all pointers their own class (`Box` and
            // `@` are below).
            token::BinOp(token::And) if lexer.peek().sp.lo == next.sp.hi => "kw-2",
            token::At | token::Tilde => "kw-2",

            // consider this as part of a macro invocation if there was a
            // leading identifier
            token::Not if is_macro => { is_macro = false; "macro" }

            // operators
            token::Eq | token::Lt | token::Le | token::EqEq | token::Ne | token::Ge | token::Gt |
                token::AndAnd | token::OrOr | token::Not | token::BinOp(..) | token::RArrow |
                token::BinOpEq(..) | token::FatArrow => "op",

            // miscellaneous, no highlighting
            token::Dot | token::DotDot | token::DotDotDot | token::Comma | token::Semi |
                token::Colon | token::ModSep | token::LArrow | token::OpenDelim(_) |
                token::CloseDelim(token::Brace) | token::CloseDelim(token::Paren) |
                token::Question => "",
            token::Dollar => {
                if lexer.peek().tok.is_ident() {
                    is_macro_nonterminal = true;
                    "macro-nonterminal"
                } else {
                    ""
                }
            }

            // This is the start of an attribute. We're going to want to
            // continue highlighting it as an attribute until the ending ']' is
            // seen, so skip out early. Down below we terminate the attribute
            // span when we see the ']'.
            token::Pound => {
                is_attribute = true;
                write!(out, r"<span class='attribute'>#")?;
                continue
            }
            token::CloseDelim(token::Bracket) => {
                if is_attribute {
                    is_attribute = false;
                    write!(out, "]</span>")?;
                    continue
                } else {
                    ""
                }
            }

            token::Literal(lit, _suf) => {
                match lit {
                    // text literals
                    token::Byte(..) | token::Char(..) |
                        token::ByteStr(..) | token::ByteStrRaw(..) |
                        token::Str_(..) | token::StrRaw(..) => "string",

                    // number literals
                    token::Integer(..) | token::Float(..) => "number",
                }
            }

            // keywords are also included in the identifier set
            token::Ident(ident, _is_mod_sep) => {
                match &*ident.name.as_str() {
                    "ref" | "mut" => "kw-2",

                    "self" => "self",
                    "false" | "true" => "boolval",

                    "Option" | "Result" => "prelude-ty",
                    "Some" | "None" | "Ok" | "Err" => "prelude-val",

                    _ if next.tok.is_any_keyword() => "kw",
                    _ => {
                        if is_macro_nonterminal {
                            is_macro_nonterminal = false;
                            "macro-nonterminal"
                        } else if lexer.peek().tok == token::Not {
                            is_macro = true;
                            "macro"
                        } else {
                            "ident"
                        }
                    }
                }
            }

            // Special macro vars are like keywords
            token::SpecialVarNt(_) => "kw-2",

            token::Lifetime(..) => "lifetime",
            token::DocComment(..) => "doccomment",
            token::Underscore | token::Eof | token::Interpolated(..) |
                token::MatchNt(..) | token::SubstNt(..) => "",
        };

        // as mentioned above, use the original source code instead of
        // stringifying this token
        let snip = sess.codemap().span_to_snippet(next.sp).unwrap();
        if klass == "" {
            write!(out, "{}", Escape(&snip))?;
        } else {
            write!(out, "<span class='{}'>{}</span>", klass, Escape(&snip))?;
        }
    }

    Ok(())
}
