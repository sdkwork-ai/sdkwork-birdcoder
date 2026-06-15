use std::fmt;

#[derive(Clone, Debug)]
pub enum SystemDescriptorError {
    NotFound(String),
    InvalidInput(String),
    Internal(String),
}

impl fmt::Display for SystemDescriptorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for SystemDescriptorError {}
