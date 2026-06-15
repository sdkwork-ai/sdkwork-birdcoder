use std::fmt;

#[derive(Clone, Debug)]
pub enum AppTemplateError {
    NotFound(String),
    InvalidInput(String),
    Repository(String),
    Internal(String),
}

impl fmt::Display for AppTemplateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::Repository(msg) => write!(f, "repository error: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for AppTemplateError {}
