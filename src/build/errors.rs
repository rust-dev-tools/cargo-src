use serde;
use serde_json;

// Error structs copied from
// https://github.com/rust-lang/rust/blob/master/src/libsyntax/errors/json.rs

#[derive(Serialize, Deserialize, Debug)]
pub struct Diagnostic {
    /// The primary error message.
    pub message: String,
    pub code: Option<DiagnosticCode>,
    /// "error: internal compiler error", "error", "warning", "note", "help".
    pub level: String,
    pub spans: Vec<DiagnosticSpan>,
    /// Associated diagnostic messages.
    pub children: Vec<Diagnostic>,
}

impl Diagnostic {
    pub fn fold_on_message(&mut self, f: &Fn(&str) -> String) {
        self.message = f(&self.message);
        for c in &mut self.children {
            c.fold_on_message(f);
        }
    }

    pub fn fold_on_span(&mut self, f: &Fn(&mut DiagnosticSpan)) {
        for sp in &mut self.spans {
            f(sp);
        }
        for c in &mut self.children {
            c.fold_on_span(f);
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
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
    /// Source text from the start of line_start to the end of line_end.
    text: Vec<DiagnosticSpanLine>,
}

#[derive(Deserialize, Debug)]
pub struct DiagnosticSpanLine {
    text: String,
    /// 1-based, character offset in self.text.
    highlight_start: usize,
    highlight_end: usize,
}


impl serde::Serialize for DiagnosticSpanLine {
    fn serialize<S>(&self, serializer: &mut S) -> Result<(), S::Error>
        where S: serde::Serializer
    {
        if self.highlight_end < self.highlight_start {
            serializer.serialize_str(&self.text)
        } else {
            let start = self.highlight_start;
            let end = self.highlight_end;

            // Can we do this without allocating a buffer?
            let mut result = String::new();
            result.push_str(&self.text[..start]);
            result.push_str("<span class=\"src_highlight\">");
            result.push_str(&self.text[start..end]);
            result.push_str("</span>");
            result.push_str(&self.text[end..]);
            serializer.serialize_str(&result)
        }
    }
}


#[derive(Serialize, Deserialize, Debug)]
pub struct DiagnosticCode {
    /// The code itself.
    code: String,
    /// An explanation for the code.
    explanation: Option<String>,
}

pub fn parse_errors(input: &str) -> Vec<Diagnostic> {
    let mut result = vec![];
    for i in input.split('\n') {
        if i.trim().is_empty() || !i.starts_with('{') {
            continue;
        }
        match serde_json::from_str(i) {
            Ok(x) => {
                result.push(x);
            }
            Err(e) => {
                println!("ERROR parsing compiler output: {}", e);
                println!("input: `{}`", input);
            }
        }
    }

    result
}

pub fn expand_zero_spans(span: &mut DiagnosticSpan) {
    if span.line_start == span.line_end && span.column_start == span.column_end {
        if span.column_start == 0 {
            span.column_end = 1;
        } else {
            span.column_start -= 1;
        }
    }

    for line in span.text.iter_mut() {
        if line.highlight_end < line.highlight_start {
            line.highlight_start = 0;
            line.highlight_end = 0;
        } else {
            if line.highlight_start > 0 {
                line.highlight_start -= 1;
                line.highlight_end -= 1;

                if line.highlight_start == line.highlight_end {
                    if line.highlight_start == 0 {
                        line.highlight_end += 1;
                    } else {
                        line.highlight_start -= 1;
                    }
                }
            }
        }
    }
}

/// Creates a new string, inserting <code> tags around text between backticks.
/// E.g., "foo `bar`" becomes "foo `<code>bar</code>`".
pub fn codify_message(source: &str) -> String {
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
            State::Issue(ref mut buf) => {
                if c.is_digit(10) {
                    buf.push(c);
                } else {
                    result.push_str("<a class=\"issue_link\" href=\"https://github.com/rust-lang/rust/issues/");
                    result.push_str(buf);
                    result.push_str("\" target=\"_blank\">#");
                    result.push_str(buf);
                    result.push_str("</a>");
                    push_char(&mut result, c);
                    reset_state = true;
                }
            }
            State::NewHash => {
                if c == '[' {
                    state = State::Attr(String::new());
                } else if c.is_digit(10) {
                    state = State::Issue(c.to_string());
                } else {
                    result.push('#');
                    push_char(&mut result, c);
                    reset_state = true;
                }
            }
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
            State::Url(ref mut buf) => {
                if c == '>' {
                    result.push_str("&lt;<a class=\"link\" href=\"");
                    result.push_str(buf);
                    result.push_str("\" target=\"_blank\">");
                    result.push_str(buf);
                    result.push_str("</a>&gt;");
                    reset_state = true;
                } else {
                    buf.push(c);
                }
            }
            State::Backtick(ref mut buf) => {
                if c == '`' {
                    result.push_str("`<code class=\"code\">");
                    result.push_str(&buf);
                    result.push_str("</code>`");
                    reset_state = true;
                } else {
                    push_char(buf, c);
                }
            }
            State::Attr(ref mut buf) => {
                if c == ']' {
                    result.push_str("<code class=\"attr\">#[");
                    result.push_str(&buf);
                    result.push_str("]</code>");
                    reset_state = true;
                } else {
                    push_char(buf, c);
                }
            }
            State::Outer => {
                match c {
                    '`' => state = State::Backtick(String::new()),
                    '#' => state = State::NewHash,
                    '<' => state = State::MaybeUrl(String::new()),
                    '[' => state = State::Attr(String::new()),
                    _ => push_char(&mut result, c),
                }
            }
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
        State::Url(ref buf) | State::MaybeUrl(ref buf)=> {
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
        _ => buf.push(c),
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_parse() {
        let input = r#"{"message":"unused variable: `matches`, #[warn(unused_variables)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/main.rs","byte_start":771,"byte_end":778,"line_start":49,"line_end":49,"column_start":9,"column_end":16}],"children":[]}"#;
        let _result = parse_errors(input);
    }


    #[test]
    fn test_codify_message_escape() {
        let input = "&<a>'b\"".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "&amp;&lt;a&gt;&#39;b&quot;");
    }

    #[test]
    fn test_codify_message_backtick() {
        let input = "foo `bar` baz `qux`".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo `<code class=\"code\">bar</code>` baz `<code class=\"code\">qux</code>`");

        let input = "foo `bar baz".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo `bar baz");
    }

    #[test]
    fn test_codify_message_attr() {
        let input = "foo #[foo] `qux` #[bar] baz".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo <code class=\"attr\">#[foo]</code> `<code class=\"code\">qux</code>` <code class=\"attr\">#[bar]</code> baz");

        let input = "foo #[foo]".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo <code class=\"attr\">#[foo]</code>");

        let input = "foo #[bar".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo #[bar");

        let input = "foo #[".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo #[");
    }

    #[test]
    fn test_codify_message_issue_ref() {
        let input = "foo #123 bar".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo <a class=\"issue_link\" href=\"https://github.com/rust-lang/rust/issues/123\" target=\"_blank\">#123</a> bar");
    }

    #[test]
    fn test_codify_message_url() {
        let input = "foo <http://bar.com> baz".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo &lt;<a class=\"link\" href=\"http://bar.com\" target=\"_blank\">http://bar.com</a>&gt; baz");

        let input = "foo <http://bar.c".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo &lt;http://bar.c");

        let input = "foo <bar".to_owned();
        let result = codify_message(&input);
        println!("{}", result);
        assert!(result == "foo &lt;bar");
    }
}
