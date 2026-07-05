use std::fmt;

#[derive(Clone, Debug)]
pub enum CommerceError {
    NotFound(String),
    InvalidInput(String),
    Forbidden(String),
    Conflict(String),
    Repository(String),
    Internal(String),
}

impl fmt::Display for CommerceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::Forbidden(msg) => write!(f, "forbidden: {msg}"),
            Self::Conflict(msg) => write!(f, "conflict: {msg}"),
            Self::Repository(msg) => write!(f, "repository error: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for CommerceError {}
