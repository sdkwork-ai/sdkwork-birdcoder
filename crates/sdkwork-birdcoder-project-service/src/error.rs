use std::fmt;

#[derive(Clone, Debug)]
pub enum ProjectError {
    NotFound(String),
    InvalidInput(String),
    Conflict(String),
    Repository(String),
    EventPublish(String),
    GitOperation(String),
    Internal(String),
}

impl fmt::Display for ProjectError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::Conflict(msg) => write!(f, "conflict: {msg}"),
            Self::Repository(msg) => write!(f, "repository error: {msg}"),
            Self::EventPublish(msg) => write!(f, "event publish error: {msg}"),
            Self::GitOperation(msg) => write!(f, "git operation error: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for ProjectError {}
