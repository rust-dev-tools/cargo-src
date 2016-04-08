use serde_json;

mod rustc_errors;

pub fn parse_errors(input: &str) -> Vec<Diagnostic> {
    let mut result: Vec<rustc_errors::Diagnostic> = vec![];
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

    let mut lowering_ctxt = rustc_errors::LoweringContext::new();
    result.into_iter().map(|d| d.lower(&mut lowering_ctxt)).collect()
}

#[derive(Serialize, Debug)]
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

#[derive(Serialize, Debug)]
pub struct DiagnosticSpan {
    pub id: u32,
    pub file_name: String,
    pub byte_start: u32,
    pub byte_end: u32,
    /// 1-based.
    pub line_start: usize,
    pub line_end: usize,
    /// 1-based, character offset.
    pub column_start: usize,
    pub column_end: usize,
    /// Source text from the start of line_start to the end of line_end.
    pub text: Vec<String>,
    pub plain_text: String,
}


#[derive(Serialize, Debug)]
pub struct DiagnosticCode {
    /// The code itself.
    code: String,
    /// An explanation for the code.
    explanation: Option<String>,
}

#[cfg(test)]
mod test {
    use super::parse_errors;

    #[test]
    fn test_parse() {
        let input = r#"{"message":"unused variable: `matches`, #[warn(unused_variables)] on by default","code":null,"level":"warning","spans":[{"file_name":"src/main.rs","byte_start":771,"byte_end":778,"line_start":49,"line_end":49,"column_start":9,"column_end":16}],"children":[]}"#;
        let _result = parse_errors(input);
    }
}
