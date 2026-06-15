use std::path::PathBuf;

pub const DEFAULT_HOST: &str = "127.0.0.1";
pub const DEFAULT_PORT: u16 = 10240;
pub const DEFAULT_SQLITE_FILE: &str = "birdcoder-server.db";

pub struct BirdServerConfig {
    pub host: String,
    pub port: u16,
    pub sqlite_file: PathBuf,
    pub allowed_origins: Vec<String>,
    pub project_root: Option<String>,
}

impl BirdServerConfig {
    pub fn from_env() -> Self {
        let host = std::env::var("BIRDCODER_SERVER_HOST").unwrap_or_else(|_| DEFAULT_HOST.to_string());
        let port: u16 = std::env::var("BIRDCODER_SERVER_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_PORT);
        let sqlite_file = std::env::var("BIRDCODER_CODING_SERVER_SQLITE_FILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(DEFAULT_SQLITE_FILE));
        let allowed_origins = std::env::var("BIRDCODER_CODING_SERVER_ALLOWED_ORIGINS")
            .ok()
            .map(|v| v.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(|| vec!["*".to_string()]);
        let project_root = std::env::var("BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT").ok();

        Self {
            host,
            port,
            sqlite_file,
            allowed_origins,
            project_root,
        }
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
