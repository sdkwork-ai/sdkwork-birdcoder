use std::fmt;

#[derive(Clone, Debug)]
pub enum CommerceMembershipError {
    NotFound(String),
    InvalidInput(String),
    Conflict(String),
    Repository(String),
    Provider(String),
    Internal(String),
}

impl fmt::Display for CommerceMembershipError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::Conflict(msg) => write!(f, "conflict: {msg}"),
            Self::Repository(msg) => write!(f, "repository error: {msg}"),
            Self::Provider(msg) => write!(f, "provider error: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for CommerceMembershipError {}
