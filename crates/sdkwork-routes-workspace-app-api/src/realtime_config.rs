#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RealtimeBackendKind {
    Memory,
    Redis,
}

#[derive(Clone, Debug)]
pub struct RealtimeRedisConfig {
    pub url: String,
    pub key_prefix: String,
}

pub fn realtime_backend_from_env() -> RealtimeBackendKind {
    if let Ok(value) = std::env::var("SDKWORK_BIRDCODER_REALTIME_BACKEND") {
        if value.eq_ignore_ascii_case("redis") {
            return RealtimeBackendKind::Redis;
        }
        if value.eq_ignore_ascii_case("memory") || value.eq_ignore_ascii_case("in-memory") {
            return RealtimeBackendKind::Memory;
        }
    }

    if redis_enabled_from_env() {
        return RealtimeBackendKind::Redis;
    }

    RealtimeBackendKind::Memory
}

pub fn redis_enabled_from_env() -> bool {
    std::env::var("SDKWORK_BIRDCODER_REDIS_ENABLED")
        .ok()
        .is_some_and(|value| value == "1" || value.eq_ignore_ascii_case("true"))
}

pub fn resolve_redis_config() -> Result<RealtimeRedisConfig, String> {
    let url = resolve_redis_url()?;
    let key_prefix = std::env::var("SDKWORK_BIRDCODER_REDIS_KEY_PREFIX")
        .unwrap_or_else(|_| "birdcoder".to_string());
    Ok(RealtimeRedisConfig { url, key_prefix })
}

fn resolve_redis_url() -> Result<String, String> {
    if let Ok(url) = std::env::var("SDKWORK_BIRDCODER_REDIS_URL") {
        let trimmed = url.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    let host = std::env::var("SDKWORK_BIRDCODER_REDIS_HOST")
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("SDKWORK_BIRDCODER_REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
    let database = std::env::var("SDKWORK_BIRDCODER_REDIS_DATABASE").unwrap_or_else(|_| "0".to_string());
    let username = std::env::var("SDKWORK_BIRDCODER_REDIS_USERNAME")
        .ok()
        .filter(|value| !sdkwork_utils_rust::is_blank(Some(value)));
    let password = resolve_redis_password()?;
    let tls = std::env::var("SDKWORK_BIRDCODER_REDIS_TLS")
        .ok()
        .is_some_and(|value| value == "1" || value.eq_ignore_ascii_case("true"));

    let scheme = if tls { "rediss" } else { "redis" };
    let auth = match (username.as_deref(), password.as_deref()) {
        (Some(user), Some(pass)) => format!("{user}:{pass}@"),
        (None, Some(pass)) => format!(":{pass}@"),
        (Some(user), None) => format!("{user}@"),
        (None, None) => String::new(),
    };

    Ok(format!("{scheme}://{auth}{host}:{port}/{database}"))
}

fn resolve_redis_password() -> Result<Option<String>, String> {
    if let Ok(path) = std::env::var("SDKWORK_BIRDCODER_REDIS_PASSWORD_FILE") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            let value = std::fs::read_to_string(trimmed)
                .map_err(|error| format!("read SDKWORK_BIRDCODER_REDIS_PASSWORD_FILE failed: {error}"))?;
            let password = value.trim().to_string();
            if !password.is_empty() {
                return Ok(Some(password));
            }
        }
    }

    if let Ok(password) = std::env::var("SDKWORK_BIRDCODER_REDIS_PASSWORD") {
        let trimmed = password.trim();
        if !trimmed.is_empty() {
            return Ok(Some(trimmed.to_string()));
        }
    }

    Ok(None)
}
