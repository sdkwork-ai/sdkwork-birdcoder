use std::fmt;

#[derive(Clone, Debug)]
pub enum WorkspaceError {
    NotFound(String),
    Forbidden(String),
    InvalidInput(String),
    PreconditionRequired(String),
    PreconditionFailed(String),
    Conflict(String),
    Repository(String),
    Internal(String),
}

impl fmt::Display for WorkspaceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::Forbidden(msg) => write!(f, "forbidden: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::PreconditionRequired(msg) => write!(f, "precondition required: {msg}"),
            Self::PreconditionFailed(msg) => write!(f, "precondition failed: {msg}"),
            Self::Conflict(msg) => write!(f, "conflict: {msg}"),
            Self::Repository(msg) => write!(f, "repository error: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for WorkspaceError {}
