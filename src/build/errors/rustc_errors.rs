// Copyright 2016 The Rustw Project Developers.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

use build::errors;

// Error structs copied from
// https://github.com/rust-lang/rust/blob/master/src/libsyntax/errors/json.rs

#[derive(Deserialize, Debug)]
pub struct Diagnostic {
    /// The primary error message.
    message: String,
    code: Option<DiagnosticCode>,
    /// "error: internal compiler error", "error", "warning", "note", "help".
    level: String,
    spans: Vec<DiagnosticSpan>,
    /// Associated diagnostic messages.
    children: Vec<Diagnostic>,
}

#[derive(Deserialize, Debug)]
pub struct DiagnosticSpan {
    file_name: String,
    byte_start: u32,
    byte_end: u32,
    /// 1-based.
    line_start: usize,
    line_end: usize,
    /// 1-based, character offset.
    column_start: usize,
    column_end: usize,
    /// Is this a "primary" span -- meaning the point, or one of the points,
    /// where the error occurred?
    is_primary: bool,
    /// Source text from the start of line_start to the end of line_end.
    text: Vec<DiagnosticSpanLine>,
    /// Label that should be placed at this location (if any)
    label: Option<String>,

    // TODO suggestions and macros
    // /// If we are suggesting a replacement, this will contain text
    // /// that should be sliced in atop this span. You may prefer to
    // /// load the fully rendered version from the parent `Diagnostic`,
    // /// however.
    // suggested_replacement: Option<String>,
    // /// Macro invocations that created the code at this span, if any.
    // expansion: Option<Box<DiagnosticSpanMacroExpansion>>,
}

#[derive(Deserialize, Debug)]
pub struct DiagnosticSpanLine {
    text: String,
    /// 1-based, character offset in self.text.
    highlight_start: usize,
    highlight_end: usize,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DiagnosticCode {
    /// The code itself.
    code: String,
    /// An explanation for the code.
    explanation: Option<String>,
}

// The lower operation takes errors emitted by rustc, processes them and makes
// errors suitable for the frontend.

pub struct LoweringContext {
    id: u32,
}

impl LoweringContext {
    pub fn new() -> LoweringContext {
        LoweringContext { id: 0 }
    }

    fn next_id(&mut self) -> u32 {
        self.id += 1;
        self.id
    }
}

impl Diagnostic {
    pub fn lower(self, ctxt: &mut LoweringContext) -> errors::Diagnostic {
        errors::Diagnostic {
            id: ctxt.next_id(),
            message: codify_message(&self.message),
            code: self.code.map(|c| c.lower(ctxt)),
            level: self.level,
            spans: self.spans.into_iter().map(|s| s.lower(ctxt)).collect(),
            children: self.children.into_iter().map(|d| d.lower(ctxt)).collect(),
        }
    }
}

impl DiagnosticSpan {
    fn lower(self, ctxt: &mut LoweringContext) -> errors::DiagnosticSpan {
        let mut col_start = self.column_start;
        let mut col_end = self.column_end;

        if self.line_start == self.line_end && col_start == col_end {
            if col_end == 0 {
                col_end = 1;
            } else {
                col_start -= 1;
            }
        }

        // TODO we should make plain_text ourselves straight from the files,
        // then when we save after quick edit, we can check the time on the file
        // cache to check the file wasn't modified.
        let mut plain_text = String::with_capacity(
            self.text.len() + self.text.iter().fold(0, |a, l| a + l.text.len()),
        );
        for l in &self.text {
            plain_text.push_str(&l.text);
            plain_text.push('\n');
        }

        errors::DiagnosticSpan {
            id: ctxt.next_id(),
            file_name: self.file_name,
            byte_start: self.byte_start,
            byte_end: self.byte_end,
            line_start: self.line_start,
            line_end: self.line_end,
            column_start: col_start,
            column_end: col_end,
            is_primary: self.is_primary,
            text: self.text.into_iter().map(|l| l.lower(ctxt)).collect(),
            plain_text: plain_text,
            label: self.label.unwrap_or(String::new()),
        }
    }
}

impl DiagnosticSpanLine {
    // Lower straight to an HTML string.
    fn lower(self, _ctxt: &mut LoweringContext) -> String {
        if self.highlight_end < self.highlight_start || self.text.is_empty() {
            self.text
        } else {
            let mut start = self.highlight_start;
            let mut end = self.highlight_end;

            if start > 0 {
                start -= 1;
                end -= 1;

                if start == end {
                    if start == 0 {
                        end += 1;
                    } else {
                        start -= 1;
                    }
                }
            }

            let mut result = String::new();
            result.push_str(&self.text[..start]);
            result.push_str("<span class=\"src_highlight\">");
            result.push_str(&self.text[start..end]);
            result.push_str("</span>");
            result.push_str(&self.text[end..]);
            result
        }
    }
}

impl DiagnosticCode {
    pub fn lower(self, _ctxt: &mut LoweringContext) -> errors::DiagnosticCode {
        errors::DiagnosticCode {
            code: self.code,
            explanation: self.explanation,
        }
    }
}


/// Creates a new string, inserting <code> tags around text between backticks.
/// E.g., "foo `bar`" becomes "foo `<code>bar</code>`".
fn codify_message(source: &str) -> String {
    enum State {
        Outer,
        Backtick(String),
        NewHash,
        Attr(String),
        Issue(String),
        // Parsed "<", but not yet convinced it's a URL.
        MaybeUrl(String),
        // Parsed "<http"
        Url(String),
    }

    impl State {
        fn upgrade_url(self) -> State {
            if let State::MaybeUrl(s) = self {
                State::Url(s)
            } else {
                self
            }
        }
    }

    let mut result = String::new();

    let mut state = State::Outer;
    for c in source.chars() {
        // This is an embarassing hack to get around the borrow checker :-(
        let mut reset_state = false;
        let mut upgrade_url = false;

        match state {
            State::Issue(ref mut buf) => if c.is_digit(10) {
                buf.push(c);
            } else {
                result.push_str(
                    "<a class=\"issue_link\" href=\"https://github.com/rust-lang/rust/issues/",
                );
                result.push_str(buf);
                result.push_str("\" target=\"_blank\">#");
                result.push_str(buf);
                result.push_str("</a>");
                push_char(&mut result, c);
                reset_state = true;
            },
            State::NewHash => if c == '[' {
                state = State::Attr(String::new());
            } else if c.is_digit(10) {
                state = State::Issue(c.to_string());
            } else {
                result.push('#');
                push_char(&mut result, c);
                reset_state = true;
            },
            State::MaybeUrl(ref mut buf) => {
                if c == '>' {
                    // Wasn't a URL afterall.
                    result.push_str("&lt;");
                    result.push_str(buf);
                    result.push_str("&gt;");
                    reset_state = true;
                } else {
                    buf.push(c);
                    // Pretty sure this is a URL.
                    if buf == "http" {
                        upgrade_url = true;
                    }
                }
            }
            State::Url(ref mut buf) => if c == '>' {
                result.push_str("&lt;<a class=\"link\" href=\"");
                result.push_str(buf);
                result.push_str("\" target=\"_blank\">");
                result.push_str(buf);
                result.push_str("</a>&gt;");
                reset_state = true;
            } else {
                buf.push(c);
            },
            State::Backtick(ref mut buf) => if c == '`' {
                result.push_str("`<code class=\"code\">");
                result.push_str(&buf);
                result.push_str("</code>`");
                reset_state = true;
            } else {
                push_char(buf, c);
            },
            State::Attr(ref mut buf) => if c == ']' {
                result.push_str("<code class=\"attr\">#[");
                result.push_str(&buf);
                result.push_str("]</code>");
                reset_state = true;
            } else {
                push_char(buf, c);
            },
            State::Outer => match c {
                '`' => state = State::Backtick(String::new()),
                '#' => state = State::NewHash,
                '<' => state = State::MaybeUrl(String::new()),
                '[' => state = State::Attr(String::new()),
                _ => push_char(&mut result, c),
            },
        }

        if reset_state {
            state = State::Outer;
        } else if upgrade_url {
            state = state.upgrade_url();
        }
    }

    match state {
        State::Backtick(ref buf) => {
            result.push('`');
            result.push_str(&buf);
        }
        State::Attr(ref buf) => {
            result.push_str("#[");
            result.push_str(&buf);
        }
        State::NewHash => result.push('#'),
        State::Issue(ref buf) => {
            // TODO factor this out with the above
            result.push_str("<a href=\"https://github.com/rust-lang/rust/issues/");
            result.push_str(buf);
            result.push_str("\" target=\"_blank\">#");
            result.push_str(buf);
            result.push_str("</a>");
        }
        State::Url(ref buf) | State::MaybeUrl(ref buf) => {
            result.push_str("&lt;");
            result.push_str(&buf);
        }
        _ => {}
    }

    result
}

fn push_char(buf: &mut String, c: char) {
    match c {
        '>' => buf.push_str("&gt;"),
        '<' => buf.push_str("&lt;"),
        '&' => buf.push_str("&amp;"),
        '\'' => buf.push_str("&#39;"),
        '"' => buf.push_str("&quot;"),
        '\n' => buf.push_str("<br />"),
        _ => buf.push(c),
    }
}

#[cfg(test)]
mod test {
    use super::codify_message;

    #[test]
    fn test_codify_message_escape() {
        let input = "&<a>'b\"".to_owned();
        let result = codify_message(&input);
        assert!(result == "&amp;&lt;a&gt;&#39;b&quot;");
    }

    #[test]
    fn test_codify_message_backtick() {
        let input = "foo `bar` baz `qux`".to_owned();
        let result = codify_message(&input);
        assert!(
            result == "foo `<code class=\"code\">bar</code>` baz `<code class=\"code\">qux</code>`"
        );

        let input = "foo `bar baz".to_owned();
        let result = codify_message(&input);
        assert!(result == "foo `bar baz");
    }

    #[test]
    fn test_codify_message_attr() {
        let input = "foo #[foo] `qux` #[bar] baz".to_owned();
        let result = codify_message(&input);
        assert!(
            result == "foo <code class=\"attr\">#[foo]</code> `<code class=\"code\">qux</code>` <code class=\"attr\">#[bar]</code> baz"
        );

        let input = "foo #[foo]".to_owned();
        let result = codify_message(&input);
        assert!(result == "foo <code class=\"attr\">#[foo]</code>");

        let input = "foo #[bar".to_owned();
        let result = codify_message(&input);
        assert!(result == "foo #[bar");

        let input = "foo #[".to_owned();
        let result = codify_message(&input);
        assert!(result == "foo #[");
    }

    #[test]
    fn test_codify_message_issue_ref() {
        let input = "foo #123 bar".to_owned();
        let result = codify_message(&input);
        assert!(
            result == "foo <a class=\"issue_link\" href=\"https://github.com/rust-lang/rust/issues/123\" target=\"_blank\">#123</a> bar"
        );
    }

    #[test]
    fn test_codify_message_url() {
        let input = "foo <http://bar.com> baz".to_owned();
        let result = codify_message(&input);
        assert!(
            result == "foo &lt;<a class=\"link\" href=\"http://bar.com\" target=\"_blank\">http://bar.com</a>&gt; baz"
        );

        let input = "foo <http://bar.c".to_owned();
        let result = codify_message(&input);
        assert!(result == "foo &lt;http://bar.c");

        let input = "foo <bar".to_owned();
        let result = codify_message(&input);
        assert!(result == "foo &lt;bar");
    }
}
