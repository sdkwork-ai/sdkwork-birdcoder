//! Commerce API surface (`/api/v1/*`) for BirdCoder P2/P3 commercialization.
//!
//! This module wires three capability route groups on top of the P0 commerce
//! schema (`commerce_api_key`, `commerce_usage_metering`, `commerce_notification`):
//!
//! - [`api_keys`]: API key CRUD, key generation/rotation, and the API key
//!   authentication middleware shared across the commerce surface.
//! - [`usage`]: usage metering recording, real-time aggregation, and quota checks.
//! - [`notifications`]: notification send/list/read with quota-warning integration.
//!
//! Authentication for the commerce surface is API-key based. The
//! [`api_keys::api_key_auth`] middleware validates a `Bearer bc_...` token against
//! the `commerce_api_key` table, injects [`CommercePrincipal`] and the rate-limit
//! subject into request extensions, and records `last_used_at`.

pub mod api_keys;
pub mod notifications;
pub mod usage;

use axum::extract::{FromRequestParts, Request, State};
use axum::http::{request::Parts, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use sqlx::AnyPool;
use std::convert::Infallible;

pub use sdkwork_birdcoder_errors::ProblemJsonBody;
use sdkwork_birdcoder_errors::{
    trace_id_from_request_id, traced_legacy_problem, traced_platform_problem,
};
use sdkwork_birdcoder_router_context::WebRequestContext;
use sdkwork_utils_rust::SdkWorkResultCode;

use crate::server::middleware::rate_limit::RateLimitSubject;

/// Shared application state for the commerce route group.
#[derive(Clone)]
pub struct CommerceAppState {
    pub pool: AnyPool,
}

impl CommerceAppState {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }
}

/// Resolved principal injected by [`api_keys::api_key_auth`]. Identifies the
/// API key owner and the active tenant for tenant-scoped commerce operations.
#[derive(Clone, Debug)]
pub struct CommercePrincipal {
    pub user_id: String,
    pub tenant_id: String,
    pub api_key_id: String,
    pub scopes: Vec<String>,
}

impl CommercePrincipal {
    /// Returns true when the principal holds the requested scope. The `admin`
    /// scope always satisfies any requested scope.
    pub fn has_scope(&self, scope: &str) -> bool {
        self.scopes.iter().any(|s| s == "admin") || self.scopes.iter().any(|s| s == scope)
    }
}

/// Resolves the trace id from the BirdCoder web request context, if present.
pub fn trace_id(request: &Request) -> Option<&str> {
    request
        .extensions()
        .get::<WebRequestContext>()
        .and_then(|web| trace_id_from_request_id(web.request_id.0.as_str()))
}

/// Resolves the request id used in response envelopes.
pub fn request_id(request: &Request) -> String {
    request
        .extensions()
        .get::<WebRequestContext>()
        .map(|web| web.request_id.0.clone())
        .unwrap_or_default()
}

/// Resolves the trace id from request parts (used by `FromRequestParts` impls).
fn trace_id_from_parts(parts: &Parts) -> Option<&str> {
    parts
        .extensions
        .get::<WebRequestContext>()
        .and_then(|web| trace_id_from_request_id(web.request_id.0.as_str()))
}

fn traced_problem_for_code(
    code: &str,
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    match code {
        "not_found" => traced_platform_problem(SdkWorkResultCode::NotFound, message, trace_id),
        "invalid_input" => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, message, trace_id)
        }
        "forbidden" => {
            traced_platform_problem(SdkWorkResultCode::PermissionRequired, message, trace_id)
        }
        "unauthorized" => {
            traced_platform_problem(SdkWorkResultCode::AuthenticationRequired, message, trace_id)
        }
        "conflict" => traced_platform_problem(SdkWorkResultCode::Conflict, message, trace_id),
        "rate_limited" => {
            traced_platform_problem(SdkWorkResultCode::RateLimitExceeded, message, trace_id)
        }
        _ => traced_legacy_problem(code, message, trace_id),
    }
}

/// Builds a Problem Details body tuple for handlers returning
/// `Result<Json<_>, ProblemJsonBody>`. Accepts an explicit `trace_id` so
/// handlers no longer need to take `&Request` directly.
pub fn problem_with(
    _status: StatusCode,
    code: &str,
    message: impl Into<String>,
    _retryable: bool,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    traced_problem_for_code(code, message, trace_id)
}

/// Builds a Problem Details body tuple using the full `&Request` (used by
/// middleware that already owns the request). Prefer [`problem_with`] in
/// handlers.
pub fn problem(
    status: StatusCode,
    code: &str,
    message: impl Into<String>,
    retryable: bool,
    request: &Request,
) -> ProblemJsonBody {
    problem_with(status, code, message, retryable, trace_id(request))
}

/// Renders a Problem Details JSON response (used by middleware).
pub fn problem_response(
    _status: StatusCode,
    code: &str,
    message: impl Into<String>,
    _retryable: bool,
    request: &Request,
) -> Response {
    traced_problem_for_code(code, message, trace_id(request)).into_response()
}

/// Axum middleware that authenticates commerce requests with a BirdCoder API key
/// (`Authorization: Bearer bc_...`). Delegates to [`api_keys::api_key_auth`].
pub async fn commerce_auth_middleware(
    State(state): State<CommerceAppState>,
    request: Request,
    next: Next,
) -> Response {
    api_keys::api_key_auth(state, request, next).await
}

/// Inserts the rate-limit subject into request extensions so downstream layers
/// can enforce per-tenant / per-API-key quotas.
pub fn insert_rate_limit_subject(request: &mut Request, principal: &CommercePrincipal) {
    request.extensions_mut().insert(RateLimitSubject {
        tenant_id: principal.tenant_id.clone(),
        api_key_id: Some(principal.api_key_id.clone()),
    });
}

// ---------------------------------------------------------------------------
// Axum extractors
// ---------------------------------------------------------------------------

/// Extracts the [`CommercePrincipal`] from request extensions. Inserted by the
/// [`api_keys::api_key_auth`] middleware. Returns a 401 Problem Details body
/// when the principal is missing (auth middleware did not run).
impl<S> FromRequestParts<S> for CommercePrincipal
where
    S: Send + Sync,
{
    type Rejection = ProblemJsonBody;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<CommercePrincipal>()
            .cloned()
            .ok_or_else(|| {
                problem_with(
                    StatusCode::UNAUTHORIZED,
                    "unauthorized",
                    "valid api key required",
                    false,
                    trace_id_from_parts(parts),
                )
            })
    }
}

/// Extracts the BirdCoder request context (request_id + trace_id) from request
/// extensions. Infallible: falls back to empty strings when the web request
/// context is absent.
#[derive(Clone, Debug, Default)]
pub struct CommerceRequestContext {
    pub request_id: String,
    pub trace_id: Option<String>,
}

impl CommerceRequestContext {
    /// Returns the trace id as `Option<&str>` for use with [`problem_with`].
    pub fn trace_id_opt(&self) -> Option<&str> {
        self.trace_id.as_deref()
    }
}

impl<S> FromRequestParts<S> for CommerceRequestContext
where
    S: Send + Sync,
{
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let web = parts.extensions.get::<WebRequestContext>();
        let request_id = web.map(|ctx| ctx.request_id.0.clone()).unwrap_or_default();
        let trace_id = web
            .and_then(|ctx| trace_id_from_request_id(ctx.request_id.0.as_str()))
            .map(|s| s.to_string());
        Ok(Self {
            request_id,
            trace_id,
        })
    }
}
