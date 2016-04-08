use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::Read;
use std::str;

// TODO maximum size and evication policy
// TODO keep timestamps and check on every read. Then don't empty on build.

pub struct Cache {
    files: HashMap<PathBuf, CachedFile>,
    size: usize,
}

struct CachedFile {
    plain_text: Vec<u8>,
    highlighted_lines: Vec<String>,
}

impl Cache {
    pub fn new() -> Cache {
        Cache {
            files: HashMap::new(),
            size: 0,
        }
    }

    pub fn reset(&mut self) {
        self.files = HashMap::new();
        self.size = 0;
    }

    pub fn get_text(&mut self, path: &Path) -> Result<&[u8], String> {
        Ok(&self.get(path)?.plain_text)
    }

    pub fn get_highlighted(&mut self, path: &Path) -> Result<&[String], String> {
        let file = self.get(path)?;
        if file.highlighted_lines.is_empty() {
            let highlighted = highlight(str::from_utf8(&file.plain_text).unwrap());

            for line in highlighted.lines() {
                file.highlighted_lines.push(line.to_owned());
            }
            if file.plain_text.ends_with(&['\n' as u8]) {
                file.highlighted_lines.push(String::new());
            }
        }
        Ok(&file.highlighted_lines)
    }

    fn get(&mut self, path: &Path) -> Result<&mut CachedFile, String> {
        // Annoying that we have to clone here :-(
        match self.files.entry(path.to_owned()) {
            Entry::Occupied(oe) => {
                Ok(oe.into_mut())
            }
            Entry::Vacant(ve) => {
                let text = Cache::read_file(path)?;
                if text.is_empty() {
                    Err(format!("Empty file {}", path.display()))
                } else {
                    self.size += text.len();
                    Ok(ve.insert(CachedFile::new(text)))
                }
            }
        }
    }

    fn read_file(path: &Path) -> Result<Vec<u8>, String> {
        match File::open(&path) {
            Ok(mut file) => {
                let mut buf = Vec::new();
                file.read_to_end(&mut buf).unwrap();
                Ok(buf)
            }
            Err(msg) => {
                println!("Error opening file: `{}`; {}", path.to_str().unwrap(), msg);
                Err(format!("Error opening file: `{}`; {}", path.to_str().unwrap(), msg))
            }
        }
    }
}

impl CachedFile {
    fn new(text: Vec<u8>) -> CachedFile {
        CachedFile {
            plain_text: text,
            highlighted_lines: vec![],
        }
    }
}



// TODO copypasta from rustdoc, change rustdoc...
use std::io;
use std::io::Write;
use syntax::parse;
use syntax::parse::lexer;
 
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
    use rustdoc::html::escape::Escape;

    use std::io::prelude::*;
    use syntax::parse::token;
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
