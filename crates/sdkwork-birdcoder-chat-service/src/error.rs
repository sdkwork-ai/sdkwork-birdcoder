use std::fmt;

#[derive(Clone, Debug)]
pub enum ChatError {
    NotFound(String),
    InvalidInput(String),
    Forbidden(String),
    Repository(String),
    Internal(String),
}

impl fmt::Display for ChatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::Forbidden(msg) => write!(f, "forbidden: {msg}"),
            Self::Repository(msg) => write!(f, "repository error: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for ChatError {}
