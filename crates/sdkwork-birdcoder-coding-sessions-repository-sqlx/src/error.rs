use std::fmt;

use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;

#[derive(Debug)]
pub enum RepositoryError {
    Connection(String),
    Query(String),
    Insert(String),
    Update(String),
    Delete(String),
    Mapping(String),
    NotFound(String),
}

impl fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Connection(msg) => write!(f, "connection error: {msg}"),
            Self::Query(msg) => write!(f, "query error: {msg}"),
            Self::Insert(msg) => write!(f, "insert error: {msg}"),
            Self::Update(msg) => write!(f, "update error: {msg}"),
            Self::Delete(msg) => write!(f, "delete error: {msg}"),
            Self::Mapping(msg) => write!(f, "mapping error: {msg}"),
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
        }
    }
}

impl std::error::Error for RepositoryError {}

impl From<sqlx::Error> for RepositoryError {
    fn from(err: sqlx::Error) -> Self {
        Self::Query(err.to_string())
    }
}

pub(crate) fn map_sqlx_error<T>(result: Result<T, sqlx::Error>) -> Result<T, CodingSessionError> {
    result.map_err(|err| CodingSessionError::from(RepositoryError::from(err)))
}

impl From<serde_json::Error> for RepositoryError {
    fn from(err: serde_json::Error) -> Self {
        Self::Mapping(err.to_string())
    }
}

impl From<RepositoryError> for sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError {
    fn from(err: RepositoryError) -> Self {
        match err {
            RepositoryError::NotFound(msg) => Self::NotFound(msg),
            other => Self::Repository(other.to_string()),
        }
    }
}

