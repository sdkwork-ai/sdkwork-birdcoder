use std::fmt;

#[derive(Debug)]
pub enum RepositoryError {
    Database(String),
    Mapping(String),
    NotFound(String),
    Conflict(String),
}

impl fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Database(msg) => write!(f, "database error: {msg}"),
            Self::Mapping(msg) => write!(f, "mapping error: {msg}"),
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
            Self::Conflict(msg) => write!(f, "conflict: {msg}"),
        }
    }
}

impl std::error::Error for RepositoryError {}

impl From<rusqlite::Error> for RepositoryError {
    fn from(err: rusqlite::Error) -> Self {
        Self::Database(err.to_string())
    }
}

impl From<serde_json::Error> for RepositoryError {
    fn from(err: serde_json::Error) -> Self {
        Self::Mapping(err.to_string())
    }
}

impl From<RepositoryError> for sdkwork_birdcoder_skill_packages_service::error::SkillPackageError {
    fn from(err: RepositoryError) -> Self {
        Self::Repository(err.to_string())
    }
}

