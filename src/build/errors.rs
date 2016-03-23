use serde_json;

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
    /// Assocaited diagnostic messages.
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
}

#[derive(Deserialize, Debug)]
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
            Ok(x) => result.push(x),
            Err(e) => {
                println!("ERROR parsing compiler output: {}", e);
                println!("input: `{}`", input);
            }
        }
    }

    result
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_parse() {
        let input = r#"{"message":"unused variable: `matches`, #[warn(unused_variables)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/main.rs","byte_start":771,"byte_end":778,"line_start":49,"line_end":49,"column_start":9,"column_end":16}],"children":[]}"#;
        let result = parse_errors(input);
    }
}
