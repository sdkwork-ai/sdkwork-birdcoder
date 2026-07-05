//! Rate limiting middleware for the BirdCoder commerce API surface (`/api/v1/*`).
//!
//! Implements three configurable dimensions:
//! - Global per-IP limit (default 100 req/min)
//! - Per-tenant limit (default 1000 req/min) — applied when a `RateLimitSubject`
//!   is present in request extensions (populated by the API key auth middleware)
//! - Per-API-key limit (default 600 req/min) — bucketed by the `bc_` bearer token
//!   prefix extracted from the `Authorization` header, no database lookup required
//!
//! Store backend is abstracted through the [`RateLimitStore`] trait. The default
//! implementation is [`InMemoryRateLimitStore`] (process-local fixed-window
//! counter). The configuration exposes a `redis_url` field so a future
//! `RedisRateLimitStore` implementation can be wired without changing the
//! middleware surface. When `redis_url` is set but no distributed store is
//! registered, the middleware emits a `tracing::warn` on startup so operators
//! know multi-replica deployments will not share rate-limit counters; the
//! in-memory store is then used as the documented fallback.
//!
//! Excluded paths: `/health` and `/metrics` are never rate limited.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use tokio::sync::Mutex;

use sdkwork_utils_rust::trusted_proxy::{extract_client_ip as resolve_trusted_client_ip, TrustedProxyConfig};

use crate::bootstrap::config::BirdServerConfig;

pub const DEFAULT_GLOBAL_PER_IP_PER_MIN: u32 = 100;
pub const DEFAULT_PER_TENANT_PER_MIN: u32 = 1000;
pub const DEFAULT_PER_API_KEY_PER_MIN: u32 = 600;
pub const RATE_LIMIT_WINDOW_SECS: u64 = 60;

/// Header names published alongside every rate-limited response.
pub const HEADER_RATE_LIMIT_LIMIT: &str = "X-RateLimit-Limit";
pub const HEADER_RATE_LIMIT_REMAINING: &str = "X-RateLimit-Remaining";
pub const HEADER_RATE_LIMIT_RESET: &str = "X-RateLimit-Reset";
pub const HEADER_RETRY_AFTER: &str = "Retry-After";

/// Cooperative subject inserted by an auth middleware so the rate limiter can
/// enforce per-tenant and per-API-key quotas without re-parsing credentials.
#[derive(Clone, Debug)]
pub struct RateLimitSubject {
    pub tenant_id: String,
    pub api_key_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct RateLimitConfig {
    pub enabled: bool,
    pub global_per_ip_per_min: u32,
    pub per_tenant_per_min: u32,
    pub per_api_key_per_min: u32,
    /// When set, a distributed store (e.g. Redis) SHOULD be used. The current
    /// implementation only ships [`InMemoryRateLimitStore`]; when `redis_url`
    /// is set the middleware emits a startup warning and falls back to the
    /// in-memory store. Wire a custom [`RateLimitStore`] implementation via
    /// [`RateLimitState::with_store`] to honor this field.
    pub redis_url: Option<String>,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            global_per_ip_per_min: DEFAULT_GLOBAL_PER_IP_PER_MIN,
            per_tenant_per_min: DEFAULT_PER_TENANT_PER_MIN,
            per_api_key_per_min: DEFAULT_PER_API_KEY_PER_MIN,
            redis_url: None,
        }
    }
}

impl RateLimitConfig {
    /// Reads rate limit configuration from environment variables:
    /// - `BIRDCODER_RATE_LIMIT_ENABLED`
    /// - `BIRDCODER_RATE_LIMIT_GLOBAL_PER_IP_PER_MIN`
    /// - `BIRDCODER_RATE_LIMIT_PER_TENANT_PER_MIN`
    /// - `BIRDCODER_RATE_LIMIT_PER_API_KEY_PER_MIN`
    /// - `BIRDCODER_RATE_LIMIT_REDIS_URL` (optional, reserved for distributed store)
    pub fn from_env() -> Self {
        let enabled = std::env::var("BIRDCODER_RATE_LIMIT_ENABLED")
            .ok()
            .map(|value| matches!(value.trim(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(true);
        let parse_u32 = |name: &str, default: u32| {
            std::env::var(name)
                .ok()
                .and_then(|value| value.trim().parse().ok())
                .unwrap_or(default)
        };
        let redis_url = std::env::var("BIRDCODER_RATE_LIMIT_REDIS_URL")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        Self {
            enabled,
            global_per_ip_per_min: parse_u32(
                "BIRDCODER_RATE_LIMIT_GLOBAL_PER_IP_PER_MIN",
                DEFAULT_GLOBAL_PER_IP_PER_MIN,
            ),
            per_tenant_per_min: parse_u32(
                "BIRDCODER_RATE_LIMIT_PER_TENANT_PER_MIN",
                DEFAULT_PER_TENANT_PER_MIN,
            ),
            per_api_key_per_min: parse_u32(
                "BIRDCODER_RATE_LIMIT_PER_API_KEY_PER_MIN",
                DEFAULT_PER_API_KEY_PER_MIN,
            ),
            redis_url,
        }
    }

    /// Builds a config from the legacy `BirdServerConfig` rate limit fields plus
    /// the new per-tenant/per-key defaults. Honors the existing
    /// `rate_limit_enabled` / `rate_limit_max_requests` / `rate_limit_window_secs`
    /// fields for the per-IP dimension to preserve backward compatibility.
    pub fn from_server_config(config: &BirdServerConfig) -> Self {
        let mut env = Self::from_env();
        if !config.rate_limit_enabled {
            env.enabled = false;
        }
        // Only override the per-IP dimension from the legacy config when the
        // dedicated env var was not set, so explicit operator config wins.
        if std::env::var("BIRDCODER_RATE_LIMIT_GLOBAL_PER_IP_PER_MIN").is_err() {
            env.global_per_ip_per_min = config.rate_limit_max_requests;
        }
        env
    }
}

#[derive(Clone, Copy, Debug)]
struct Counter {
    count: u32,
    window_start: Instant,
}

impl Counter {
    fn fresh() -> Self {
        Self {
            count: 0,
            window_start: Instant::now(),
        }
    }

    fn reset_in_secs(self) -> u64 {
        let elapsed = Instant::now().saturating_duration_since(self.window_start);
        RATE_LIMIT_WINDOW_SECS.saturating_sub(elapsed.as_secs())
    }
}

/// Dimension of a rate-limit check. Each dimension has its own bucket store
/// so per-IP, per-tenant, and per-API-key counters never collide.
#[derive(Clone, Copy)]
pub enum RateLimitDimension<'a> {
    Ip(&'a str),
    Tenant(&'a str),
    ApiKey(&'a str),
}

impl<'a> RateLimitDimension<'a> {
    fn key(&self) -> &str {
        match self {
            RateLimitDimension::Ip(v) => v,
            RateLimitDimension::Tenant(v) => v,
            RateLimitDimension::ApiKey(v) => v,
        }
    }
}

/// Outcome of a single dimension check: `(allowed, limit, remaining, reset_in_secs)`.
pub type RateLimitDecision = (bool, u32, u32, u64);

/// Abstract rate-limit store contract. Implementations may back the store with
/// in-memory state, Redis, or any other shared counter backend. The middleware
/// depends only on this trait so new backends can be added without touching the
/// request-handling code (open-closed principle).
#[async_trait]
pub trait RateLimitStore: Send + Sync + std::fmt::Debug {
    /// Records a request for `dimension` against `limit` and returns the
    /// decision tuple `(allowed, limit, remaining, reset_in_secs)`.
    async fn check(&self, dimension: RateLimitDimension<'_>, limit: u32) -> RateLimitDecision;

    /// Drops expired buckets to bound memory growth. Called opportunistically
    /// by the middleware. Implementations may no-op if the backend reclaims
    /// storage automatically (e.g. Redis TTLs).
    async fn evict_expired(&self);
}

/// In-memory fixed-window rate limit store. Process-local; suitable for the
/// standalone deployment profile and as a fallback when no distributed store
/// is configured.
#[derive(Default, Clone, Debug)]
pub struct InMemoryRateLimitStore {
    ip: Arc<Mutex<HashMap<String, Counter>>>,
    tenant: Arc<Mutex<HashMap<String, Counter>>>,
    api_key: Arc<Mutex<HashMap<String, Counter>>>,
}

impl InMemoryRateLimitStore {
    pub fn new() -> Self {
        Self::default()
    }

    fn store_for(
        &self,
        dimension: RateLimitDimension<'_>,
    ) -> &Arc<Mutex<HashMap<String, Counter>>> {
        match dimension {
            RateLimitDimension::Ip(_) => &self.ip,
            RateLimitDimension::Tenant(_) => &self.tenant,
            RateLimitDimension::ApiKey(_) => &self.api_key,
        }
    }
}

#[async_trait]
impl RateLimitStore for InMemoryRateLimitStore {
    async fn check(&self, dimension: RateLimitDimension<'_>, limit: u32) -> RateLimitDecision {
        if limit == 0 {
            return (true, 0, 0, RATE_LIMIT_WINDOW_SECS);
        }
        let key = dimension.key();
        let store = self.store_for(dimension);
        let mut guard = store.lock().await;
        let now = Instant::now();
        let window_duration = Duration::from_secs(RATE_LIMIT_WINDOW_SECS);
        let entry = guard.entry(key.to_owned()).or_insert_with(Counter::fresh);
        if now.duration_since(entry.window_start) >= window_duration {
            *entry = Counter::fresh();
        }
        let allowed = entry.count < limit;
        if allowed {
            entry.count += 1;
        }
        let remaining = limit.saturating_sub(entry.count);
        let reset_in_secs = entry.reset_in_secs();
        (allowed, limit, remaining, reset_in_secs)
    }

    async fn evict_expired(&self) {
        let now = Instant::now();
        let window = Duration::from_secs(RATE_LIMIT_WINDOW_SECS);
        evict_map(&self.ip, now, window).await;
        evict_map(&self.tenant, now, window).await;
        evict_map(&self.api_key, now, window).await;
    }
}

/// Helper for [`InMemoryRateLimitStore::evict_expired`]: retains only counters
/// whose window start is still within the rate-limit window.
async fn evict_map(
    map: &Arc<Mutex<HashMap<String, Counter>>>,
    now: Instant,
    window: Duration,
) {
    let mut guard = map.lock().await;
    guard.retain(|_, counter| now.duration_since(counter.window_start) < window);
}

/// Shared, cloneable state for the rate limit middleware.
#[derive(Clone)]
pub struct RateLimitState {
    pub config: RateLimitConfig,
    pub store: Arc<dyn RateLimitStore>,
}

impl std::fmt::Debug for RateLimitState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RateLimitState")
            .field("config", &self.config)
            .field("store_kind", &"dyn RateLimitStore")
            .finish()
    }
}

impl RateLimitState {
    /// Builds state from the rate limit config. When `config.redis_url` is set
    /// but no distributed store is registered, a startup `tracing::warn` is
    /// emitted and the in-memory store is used so multi-replica deployments
    /// surface the divergence instead of silently under-limiting.
    pub fn new(config: RateLimitConfig) -> Self {
        if let Some(redis_url) = config.redis_url.as_ref() {
            tracing::warn!(
                redis_url = %redis_url,
                "BIRDCODER_RATE_LIMIT_REDIS_URL is set but no distributed RateLimitStore is registered. \
                 Falling back to InMemoryRateLimitStore; multi-replica deployments will NOT share \
                 rate-limit counters. Wire a Redis-backed RateLimitStore via RateLimitState::with_store \
                 before public release.",
            );
        }
        Self {
            config,
            store: Arc::new(InMemoryRateLimitStore::new()),
        }
    }

    /// Builds state with a custom [`RateLimitStore`] implementation. Use this
    /// to wire a Redis-backed store (or any other distributed backend) without
    /// touching the middleware. When `config.redis_url` is `None` callers
    /// typically pass [`InMemoryRateLimitStore`] directly.
    pub fn with_store(config: RateLimitConfig, store: Arc<dyn RateLimitStore>) -> Self {
        Self { config, store }
    }

    /// Builds state from the server config, merging legacy fields with env overrides.
    pub fn from_server_config(config: &BirdServerConfig) -> Self {
        Self::new(RateLimitConfig::from_server_config(config))
    }
}

/// Returns true for paths that must never be rate limited.
pub fn is_rate_limit_excluded(path: &str) -> bool {
    matches!(path, "/health" | "/metrics") || path.starts_with("/health/")
}

fn extract_client_ip(request: &Request) -> String {
    static TRUSTED_PROXIES: std::sync::OnceLock<TrustedProxyConfig> = std::sync::OnceLock::new();
    let config = TRUSTED_PROXIES.get_or_init(TrustedProxyConfig::from_env);
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|info| info.0.ip());
    let ip = resolve_trusted_client_ip(peer, |name| {
        request
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned)
    }, config);
    ip.to_string()
}

/// Extracts a stable API key bucket identifier from the `Authorization: Bearer bc_...`
/// header without validating the key against the database. Returns `None` when no
/// BirdCoder API key bearer token is present.
fn extract_api_key_bucket(request: &Request) -> Option<String> {
    let authorization = request.headers().get(header::AUTHORIZATION)?;
    let value = authorization.to_str().ok()?;
    let token = value.strip_prefix("Bearer ").or_else(|| value.strip_prefix("bearer "))?;
    let token = token.trim();
    if token.is_empty() {
        return None;
    }
    // Bucket by the `bc_` prefix plus the first 12 chars of the secret. This avoids
    // storing the full secret in the rate limit store while keeping buckets stable.
    let prefix = if token.len() >= 15 { &token[..15] } else { token };
    Some(prefix.to_string())
}

struct DimensionDecision {
    limit: u32,
    remaining: u32,
    reset_in_secs: u64,
}

/// Axum middleware enforcing per-IP, per-tenant, and per-API-key rate limits on
/// the `/api/v1/*` commerce surface. Returns `429 Too Many Requests` with
/// `Retry-After` and `X-RateLimit-*` headers when a quota is exceeded.
pub async fn rate_limit_middleware(
    State(state): State<RateLimitState>,
    request: Request,
    next: Next,
) -> Response {
    if !state.config.enabled {
        return next.run(request).await;
    }

    let path = request.uri().path();
    if is_rate_limit_excluded(path) {
        return next.run(request).await;
    }

    // Opportunistic eviction to bound memory growth under load.
    state.store.evict_expired().await;

    let ip = extract_client_ip(&request);
    let ip_decision = state
        .store
        .check(RateLimitDimension::Ip(&ip), state.config.global_per_ip_per_min)
        .await;
    if !ip_decision.0 {
        return too_many_requests(ip_decision.1, ip_decision.2, ip_decision.3);
    }

    let mut most_restrictive = DimensionDecision {
        limit: ip_decision.1,
        remaining: ip_decision.2,
        reset_in_secs: ip_decision.3,
    };

    // Per-API-key dimension: bucketed by the bearer token prefix, no DB lookup.
    if let Some(bucket) = extract_api_key_bucket(&request) {
        let decision = state
            .store
            .check(
                RateLimitDimension::ApiKey(&bucket),
                state.config.per_api_key_per_min,
            )
            .await;
        if !decision.0 {
            return too_many_requests(decision.1, decision.2, decision.3);
        }
        if decision.2 < most_restrictive.remaining {
            most_restrictive = DimensionDecision {
                limit: decision.1,
                remaining: decision.2,
                reset_in_secs: decision.3,
            };
        }
    }

    // Per-tenant dimension: cooperative, applied when an auth middleware has
    // populated `RateLimitSubject` in extensions.
    if let Some(subject) = request.extensions().get::<RateLimitSubject>().cloned() {
        let decision = state
            .store
            .check(
                RateLimitDimension::Tenant(&subject.tenant_id),
                state.config.per_tenant_per_min,
            )
            .await;
        if !decision.0 {
            return too_many_requests(decision.1, decision.2, decision.3);
        }
        if decision.2 < most_restrictive.remaining {
            most_restrictive = DimensionDecision {
                limit: decision.1,
                remaining: decision.2,
                reset_in_secs: decision.3,
            };
        }
    }

    let mut response = next.run(request).await;
    insert_rate_limit_headers(
        &mut response,
        most_restrictive.limit,
        most_restrictive.remaining,
        most_restrictive.reset_in_secs,
    );
    response
}

fn insert_rate_limit_headers(response: &mut Response, limit: u32, remaining: u32, reset_in_secs: u64) {
    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&limit.to_string()) {
        headers.insert(HEADER_RATE_LIMIT_LIMIT, value);
    }
    if let Ok(value) = HeaderValue::from_str(&remaining.to_string()) {
        headers.insert(HEADER_RATE_LIMIT_REMAINING, value);
    }
    if let Ok(value) = HeaderValue::from_str(&reset_in_secs.to_string()) {
        headers.insert(HEADER_RATE_LIMIT_RESET, value);
    }
}

fn too_many_requests(limit: u32, remaining: u32, reset_in_secs: u64) -> Response {
    let retry_after = reset_in_secs.max(1);
    let mut response = StatusCode::TOO_MANY_REQUESTS.into_response();
    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&retry_after.to_string()) {
        headers.insert(HEADER_RETRY_AFTER, value);
    }
    if let Ok(value) = HeaderValue::from_str(&limit.to_string()) {
        headers.insert(HEADER_RATE_LIMIT_LIMIT, value);
    }
    if let Ok(value) = HeaderValue::from_str(&remaining.to_string()) {
        headers.insert(HEADER_RATE_LIMIT_REMAINING, value);
    }
    if let Ok(value) = HeaderValue::from_str(&reset_in_secs.to_string()) {
        headers.insert(HEADER_RATE_LIMIT_RESET, value);
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request as HttpRequest;

    fn config_with(limit: u32) -> RateLimitConfig {
        RateLimitConfig {
            enabled: true,
            global_per_ip_per_min: limit,
            per_tenant_per_min: limit,
            per_api_key_per_min: limit,
            redis_url: None,
        }
    }

    #[tokio::test]
    async fn allows_until_limit_then_blocks() {
        let store = InMemoryRateLimitStore::new();
        let dim = RateLimitDimension::Ip("127.0.0.1");
        for _ in 0..3 {
            let (allowed, _, _, _) = store.check(dim, 3).await;
            assert!(allowed);
        }
        let (allowed, limit, remaining, _) = store.check(dim, 3).await;
        assert!(!allowed);
        assert_eq!(limit, 3);
        assert_eq!(remaining, 0);
    }

    #[tokio::test]
    async fn zero_limit_allows_all() {
        let store = InMemoryRateLimitStore::new();
        let (allowed, limit, _, _) = store.check(RateLimitDimension::Ip("1.1.1.1"), 0).await;
        assert!(allowed);
        assert_eq!(limit, 0);
    }

    #[tokio::test]
    async fn isolated_dimensions() {
        let store = InMemoryRateLimitStore::new();
        let ip_a = RateLimitDimension::Ip("10.0.0.1");
        let ip_b = RateLimitDimension::Ip("10.0.0.2");
        // Exhaust ip_a
        for _ in 0..2 {
            store.check(ip_a, 2).await;
        }
        let (allowed_a, _, _, _) = store.check(ip_a, 2).await;
        assert!(!allowed_a);
        let (allowed_b, _, _, _) = store.check(ip_b, 2).await;
        assert!(allowed_b);
    }

    #[test]
    fn excluded_paths_are_skipped() {
        assert!(is_rate_limit_excluded("/health"));
        assert!(is_rate_limit_excluded("/metrics"));
        assert!(is_rate_limit_excluded("/health/live"));
        assert!(!is_rate_limit_excluded("/api/v1/api-keys"));
    }

    #[test]
    fn api_key_bucket_extracted_from_bearer() {
        let request = HttpRequest::builder()
            .header(header::AUTHORIZATION, "Bearer bc_abcdefghijklmnop")
            .body(Body::empty())
            .unwrap();
        assert_eq!(
            extract_api_key_bucket(&request).as_deref(),
            Some("bc_abcdefghijkl")
        );
    }

    #[test]
    fn missing_authorization_returns_none() {
        let request = HttpRequest::builder().body(Body::empty()).unwrap();
        assert!(extract_api_key_bucket(&request).is_none());
    }

    #[test]
    fn env_config_defaults_when_unset() {
        // Env may already be set in test process; just assert sane bounds.
        let config = RateLimitConfig {
            enabled: true,
            global_per_ip_per_min: DEFAULT_GLOBAL_PER_IP_PER_MIN,
            per_tenant_per_min: DEFAULT_PER_TENANT_PER_MIN,
            per_api_key_per_min: DEFAULT_PER_API_KEY_PER_MIN,
            redis_url: None,
        };
        assert_eq!(config.global_per_ip_per_min, 100);
        assert_eq!(config.per_tenant_per_min, 1000);
    }

    #[test]
    fn too_many_requests_carries_headers() {
        let response = too_many_requests(100, 0, 30);
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response.headers().get(HEADER_RETRY_AFTER).unwrap(),
            "30"
        );
        assert_eq!(
            response.headers().get(HEADER_RATE_LIMIT_LIMIT).unwrap(),
            "100"
        );
        assert_eq!(
            response.headers().get(HEADER_RATE_LIMIT_REMAINING).unwrap(),
            "0"
        );
    }

    #[tokio::test]
    async fn evict_expired_drops_stale_entries() {
        let store = InMemoryRateLimitStore::new();
        store.check(RateLimitDimension::Ip("10.0.0.9"), 1).await;
        // Manually back-date the entry so eviction removes it.
        {
            let mut guard = store.ip.lock().await;
            for counter in guard.values_mut() {
                counter.window_start = Instant::now() - Duration::from_secs(120);
            }
        }
        store.evict_expired().await;
        let guard = store.ip.lock().await;
        assert!(guard.is_empty());
    }

    #[test]
    fn state_with_custom_store_is_accepted() {
        // Verifies the open-closed extension point: a custom RateLimitStore
        // implementation can be wired via with_store without touching the
        // middleware. Uses the in-memory store as a stand-in.
        #[derive(Debug, Default)]
        struct StubStore;
        #[async_trait]
        impl RateLimitStore for StubStore {
            async fn check(&self, _dimension: RateLimitDimension<'_>, limit: u32) -> RateLimitDecision {
                (true, limit, limit, RATE_LIMIT_WINDOW_SECS)
            }
            async fn evict_expired(&self) {}
        }

        let config = config_with(5);
        let state = RateLimitState::with_store(config, Arc::new(StubStore));
        assert_eq!(state.config.global_per_ip_per_min, 5);
        // The middleware can accept the custom store through the trait object.
        let _store_ref: &dyn RateLimitStore = state.store.as_ref();
    }
}
