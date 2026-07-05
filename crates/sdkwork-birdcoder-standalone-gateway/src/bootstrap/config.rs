use std::path::{Path, PathBuf};

pub const DEFAULT_HOST: &str = "127.0.0.1";
pub const DEFAULT_PORT: u16 = 10240;
pub const DEFAULT_SQLITE_FILE: &str = ".local/sdkwork-birdcoder-pc-server-private.sqlite3";
pub const DEFAULT_RATE_LIMIT_ENABLED: bool = true;
pub const DEFAULT_RATE_LIMIT_MAX_REQUESTS: u32 = 120;
pub const DEFAULT_RATE_LIMIT_WINDOW_SECS: u64 = 60;
const BIRDCODER_DATABASE_SERVICE: &str = "BIRDCODER";

pub struct BirdServerConfig {
    pub host: String,
    pub port: u16,
    pub sqlite_file: PathBuf,
    pub allowed_origins: Vec<String>,
    pub project_root: Option<String>,
    pub rate_limit_enabled: bool,
    pub rate_limit_max_requests: u32,
    pub rate_limit_window_secs: u64,
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
            .unwrap_or_else(|| default_allowed_origins_for_host(&host));
        let project_root = std::env::var("BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT").ok();
        let rate_limit_enabled = std::env::var("BIRDCODER_RATE_LIMIT_ENABLED")
            .ok()
            .map(|value| matches!(value.trim(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(DEFAULT_RATE_LIMIT_ENABLED);
        let rate_limit_max_requests: u32 = std::env::var("BIRDCODER_RATE_LIMIT_MAX_REQUESTS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(DEFAULT_RATE_LIMIT_MAX_REQUESTS);
        let rate_limit_window_secs: u64 = std::env::var("BIRDCODER_RATE_LIMIT_WINDOW_SECONDS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(DEFAULT_RATE_LIMIT_WINDOW_SECS);

        Self {
            host,
            port,
            sqlite_file,
            allowed_origins,
            project_root,
            rate_limit_enabled,
            rate_limit_max_requests,
            rate_limit_window_secs,
        }
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    /// Returns the resolved database URL, preferring env var over config default.
    /// This replaces the former `seed_birdcoder_database_env` method to avoid
    /// `std::env::set_var` which is unsafe in multi-threaded contexts.
    pub fn resolved_database_url(&self) -> String {
        let url_key = format!("SDKWORK_{BIRDCODER_DATABASE_SERVICE}_DATABASE_URL");
        std::env::var(&url_key)
            .unwrap_or_else(|_| sqlite_database_url(&self.sqlite_file))
    }

    /// Returns the resolved database engine, preferring env var over default.
    pub fn resolved_database_engine(&self) -> String {
        let engine_key = format!("SDKWORK_{BIRDCODER_DATABASE_SERVICE}_DATABASE_ENGINE");
        std::env::var(&engine_key).unwrap_or_else(|_| "sqlite".to_string())
    }
}

pub fn sqlite_database_url(path: &Path) -> String {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    };
    let normalized = absolute.to_string_lossy().replace('\\', "/");
    format!("sqlite:///{normalized}?mode=rwc")
}

pub fn default_allowed_origins_for_host(host: &str) -> Vec<String> {
    if is_loopback_bind_host(host) || is_wildcard_bind_host(host) {
        default_loopback_browser_origins()
    } else {
        Vec::new()
    }
}

/// Returns true when `host` is a loopback address.
///
/// IPv4 loopback is strictly `127.0.0.0/8` (any `127.x.x.x`).
/// IPv6 loopback is strictly `::1`. `0.0.0.0` is NOT loopback; use
/// [`is_wildcard_bind_host`] to detect wildcard/any bind hosts.
pub fn is_loopback_bind_host(host: &str) -> bool {
    let normalized = normalize_bind_host(host);
    if normalized.eq_ignore_ascii_case("localhost") {
        return true;
    }
    match normalized.parse::<std::net::IpAddr>() {
        Ok(std::net::IpAddr::V4(addr)) => addr.is_loopback(),
        Ok(std::net::IpAddr::V6(addr)) => addr.is_loopback(),
        Err(_) => false,
    }
}

/// Returns true when `host` is a wildcard/any bind address (`0.0.0.0` or `::`).
///
/// Wildcard hosts are not loopback; binding to them makes the server reachable
/// via loopback, so [`default_allowed_origins_for_host`] still returns loopback
/// origins for wildcard hosts.
pub fn is_wildcard_bind_host(host: &str) -> bool {
    let normalized = normalize_bind_host(host);
    match normalized.parse::<std::net::IpAddr>() {
        Ok(std::net::IpAddr::V4(addr)) => addr.is_unspecified(),
        Ok(std::net::IpAddr::V6(addr)) => addr.is_unspecified(),
        Err(_) => false,
    }
}

fn normalize_bind_host(host: &str) -> String {
    host.trim()
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_ascii_lowercase()
}

pub fn default_loopback_browser_origins() -> Vec<String> {
    vec![
        "http://127.0.0.1:5173".to_string(),
        "http://localhost:5173".to_string(),
        "http://127.0.0.1:3000".to_string(),
        "http://localhost:3000".to_string(),
        "http://127.0.0.1:4173".to_string(),
        "http://localhost:4173".to_string(),
        "http://127.0.0.1:10240".to_string(),
        "http://localhost:10240".to_string(),
        "tauri://localhost".to_string(),
        "https://tauri.localhost".to_string(),
    ]
}

#[cfg(test)]
mod tests {
    use super::{default_allowed_origins_for_host, is_loopback_bind_host, is_wildcard_bind_host};

    #[test]
    fn ipv4_loopback_127_0_0_1_is_loopback() {
        assert!(is_loopback_bind_host("127.0.0.1"));
        assert!(!is_wildcard_bind_host("127.0.0.1"));
    }

    #[test]
    fn ipv4_loopback_127_1_2_3_is_loopback() {
        assert!(is_loopback_bind_host("127.1.2.3"));
        assert!(!is_wildcard_bind_host("127.1.2.3"));
    }

    #[test]
    fn wildcard_0_0_0_0_is_not_loopback() {
        assert!(!is_loopback_bind_host("0.0.0.0"));
        assert!(is_wildcard_bind_host("0.0.0.0"));
    }

    #[test]
    fn ipv6_loopback_is_loopback() {
        assert!(is_loopback_bind_host("::1"));
        assert!(is_loopback_bind_host("[::1]"));
        assert!(!is_wildcard_bind_host("::1"));
    }

    #[test]
    fn private_ipv4_is_not_loopback() {
        assert!(!is_loopback_bind_host("192.168.1.1"));
        assert!(!is_wildcard_bind_host("192.168.1.1"));
    }

    #[test]
    fn localhost_is_loopback() {
        assert!(is_loopback_bind_host("localhost"));
        assert!(is_loopback_bind_host("Localhost"));
        assert!(!is_wildcard_bind_host("localhost"));
    }

    #[test]
    fn ipv6_wildcard_is_wildcard() {
        assert!(!is_loopback_bind_host("::"));
        assert!(is_wildcard_bind_host("::"));
        assert!(is_wildcard_bind_host("[::]"));
    }

    #[test]
    fn default_origins_returned_for_loopback_and_wildcard() {
        assert!(!default_allowed_origins_for_host("127.0.0.1").is_empty());
        assert!(!default_allowed_origins_for_host("0.0.0.0").is_empty());
        assert!(default_allowed_origins_for_host("192.168.1.1").is_empty());
    }
}
