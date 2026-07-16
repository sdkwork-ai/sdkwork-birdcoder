use std::fmt;

#[derive(Clone, Debug)]
pub enum ProjectError {
    NotFound(String),
    Forbidden(String),
    InvalidInput(String),
    /// An existing resource requires an optimistic-concurrency precondition.
    PreconditionRequired(String),
    /// A supplied optimistic-concurrency precondition no longer matches the
    /// current durable state. HTTP adapters map this to 412.
    PreconditionFailed(String),
    Conflict(String),
    Repository(String),
    EventPublish(String),
    GitOperation(String),
    Unavailable(String),
    Internal(String),
}

impl fmt::Display for ProjectError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::Forbidden(msg) => write!(f, "forbidden: {msg}"),
            Self::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Self::PreconditionRequired(msg) => write!(f, "precondition required: {msg}"),
            Self::PreconditionFailed(msg) => write!(f, "precondition failed: {msg}"),
            Self::Conflict(msg) => write!(f, "conflict: {msg}"),
            Self::Repository(msg) => write!(f, "repository error: {msg}"),
            Self::EventPublish(msg) => write!(f, "event publish error: {msg}"),
            Self::GitOperation(msg) => write!(f, "git operation error: {msg}"),
            Self::Unavailable(msg) => write!(f, "unavailable: {msg}"),
            Self::Internal(msg) => write!(f, "internal error: {msg}"),
        }
    }
}

impl std::error::Error for ProjectError {}
