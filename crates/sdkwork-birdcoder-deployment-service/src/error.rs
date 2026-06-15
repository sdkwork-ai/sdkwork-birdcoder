use std::fmt;

#[derive(Clone, Debug)]
pub enum DeploymentError {
    NotFound(String),
    InvalidInput(String),
    Conflict(String),
    Repository(String),
    EventPublish(String),
    Internal(String),
}

impl fmt::Display for DeploymentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::Conflict(msg) => write!(f, "conflict: {msg}"),
            Self::Repository(msg) => write!(f, "repository error: {msg}"),
            Self::EventPublish(msg) => write!(f, "event publish error: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for DeploymentError {}
