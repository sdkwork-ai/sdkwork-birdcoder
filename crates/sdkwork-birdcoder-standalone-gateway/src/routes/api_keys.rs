//! API key management for the BirdCoder commerce surface.
//!
//! Backed by the `commerce_api_key` table (P0 schema). Implements:
//! - CRUD endpoints (`POST/GET/DELETE` and `POST .../rotate`)
//! - Key generation: 32 random bytes, `bc_` prefix, base62 encoded, stored as
//!   SHA-256 hex hash (plaintext returned exactly once)
//! - The shared [`api_key_auth`] middleware that validates `Bearer bc_...`
//!   tokens and injects [`CommercePrincipal`]
//! - Scope enforcement (`read`/`write`/`admin`)

#[cfg(test)]
use std::sync::OnceLock;

use axum::extract::{Path, Request, State};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::Response;
use axum::routing::{delete, post};
use axum::{Json, Router};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use sdkwork_birdcoder_errors::{build_data_envelope, build_list_envelope, ApiDataEnvelope, ApiListEnvelope};

use crate::routes::{
    insert_rate_limit_subject, problem_response, problem_with, CommerceAppState, CommercePrincipal,
    CommerceRequestContext, ProblemJsonBody,
};

const TABLE: &str = "commerce_api_key";
const DEFAULT_KEY_SECRET_BYTES: usize = 32;
const KEY_PREFIX: &str = "bc_";
const PREFIX_DISPLAY_LEN: usize = 12;

/// Generates an RFC3339 UTC timestamp string suitable for the TEXT instant columns.
pub fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

// ---------------------------------------------------------------------------
// Key generation and hashing
// ---------------------------------------------------------------------------

/// Generates a new BirdCoder API key. Returns `(plaintext, key_hash, prefix)`
/// where `plaintext` is shown to the user exactly once, `key_hash` is the
/// SHA-256 hex digest stored in the database, and `prefix` is a short display
/// prefix (safe to leak in lists).
pub fn generate_api_key() -> (String, String, String) {
    let mut bytes = [0u8; DEFAULT_KEY_SECRET_BYTES];
    rand::thread_rng().fill_bytes(&mut bytes);
    let body = encode_base62(&bytes);
    let plaintext = format!("{KEY_PREFIX}{body}");
    let key_hash = hash_api_key(&plaintext);
    let prefix = plaintext.chars().take(PREFIX_DISPLAY_LEN).collect();
    (plaintext, key_hash, prefix)
}

/// Returns the SHA-256 hex digest of the plaintext key. This is what is stored
/// in `commerce_api_key.key_hash`; the plaintext is never persisted.
pub fn hash_api_key(plaintext: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(plaintext.as_bytes());
    hex::encode(hasher.finalize())
}

/// Base62 alphabet: `0-9A-Za-z`.
const BASE62_ALPHABET: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/// Encodes an arbitrary byte slice as a base62 string (big-endian number
/// conversion). Used for API key bodies; the input is treated as one large
/// unsigned integer.
pub fn encode_base62(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    let mut digits: Vec<u8> = bytes.to_vec();
    let mut output: Vec<u8> = Vec::with_capacity(bytes.len() * 2);
    while !digits.iter().all(|&d| d == 0) {
        let mut remainder: u32 = 0;
        for byte in digits.iter_mut() {
            let acc = (remainder << 8) | (*byte as u32);
            *byte = (acc / 62) as u8;
            remainder = acc % 62;
        }
        output.push(BASE62_ALPHABET[remainder as usize]);
        // Strip a single leading zero byte to avoid reprocessing it.
        if digits.first().is_some_and(|&b| b == 0) {
            digits.remove(0);
        }
    }
    output.reverse();
    // Preserve leading-zero significance by prefixing with the alphabet's first
    // char per leading zero byte of the input.
    let leading_zeros = bytes.iter().take_while(|&&b| b == 0).count();
    let mut result = String::from_utf8(output).unwrap_or_default();
    for _ in 0..leading_zeros {
        result.insert(0, BASE62_ALPHABET[0] as char);
    }
    result
}

/// Parses a `Bearer bc_...` token from the `Authorization` header, returning the
/// trimmed token string (without the `Bearer ` prefix).
pub fn extract_bearer_token(request: &Request) -> Option<&str> {
    let header = request.headers().get(axum::http::header::AUTHORIZATION)?;
    let value = header.to_str().ok()?;
    let token = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))?;
    let token = token.trim();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

// ---------------------------------------------------------------------------
// Row model
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct ApiKeyRow {
    pub id: i64,
    pub tenant_id: i64,
    pub workspace_id: Option<String>,
    pub key_id: String,
    pub user_id: i64,
    pub name: String,
    pub key_hash: String,
    pub prefix: String,
    pub scopes: String,
    pub status: String,
    pub last_used_at: Option<String>,
    pub expires_at: Option<String>,
    pub revoked_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl ApiKeyRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            tenant_id: row.try_get("tenant_id")?,
            workspace_id: row.try_get("workspace_id")?,
            key_id: row.try_get("key_id")?,
            user_id: row.try_get("user_id")?,
            name: row.try_get("name")?,
            key_hash: row.try_get("key_hash")?,
            prefix: row.try_get("prefix")?,
            scopes: row.try_get("scopes")?,
            status: row.try_get("status")?,
            last_used_at: row.try_get("last_used_at")?,
            expires_at: row.try_get("expires_at")?,
            revoked_at: row.try_get("revoked_at")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }

    pub fn scopes_vec(&self) -> Vec<String> {
        serde_json::from_str::<Vec<String>>(&self.scopes).unwrap_or_default()
    }

    pub fn to_response(&self) -> ApiKeyResponse {
        ApiKeyResponse {
            id: self.key_id.clone(),
            name: self.name.clone(),
            prefix: self.prefix.clone(),
            scopes: self.scopes_vec(),
            status: self.status.clone(),
            last_used_at: self.last_used_at.clone(),
            expires_at: self.expires_at.clone(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }
}

const ALL_COLUMNS: &str = "id, tenant_id, workspace_id, key_id, user_id, name, key_hash, prefix, scopes, status, last_used_at, expires_at, revoked_at, created_at, updated_at";

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

/// Looks up an active, non-expired API key by its SHA-256 hash. Used by the auth
/// middleware. Returns `None` when no matching active key exists.
pub async fn resolve_api_key_by_hash(
    pool: &sqlx::AnyPool,
    key_hash: &str,
) -> Result<Option<ApiKeyRow>, sqlx::Error> {
    let now = now_rfc3339();
    let sql = format!(
        "SELECT {ALL_COLUMNS} FROM {TABLE} \
         WHERE key_hash = ?1 AND status = 'active' AND revoked_at IS NULL AND deleted_at IS NULL \
         AND (expires_at IS NULL OR expires_at > ?2) \
         LIMIT 1"
    );
    let row = sqlx::query(&sql)
        .bind(key_hash)
        .bind(&now)
        .fetch_optional(pool)
        .await?;
    row.as_ref().map(ApiKeyRow::from_row).transpose()
}

/// Records `last_used_at` for the given key id. Best-effort; errors are logged
/// but do not fail the request.
pub async fn touch_last_used_at(
    pool: &sqlx::AnyPool,
    key_id: &str,
    tenant_id: i64,
) -> Result<(), sqlx::Error> {
    let now = now_rfc3339();
    let sql = format!(
        "UPDATE {TABLE} SET last_used_at = ?1, updated_at = ?2 \
         WHERE key_id = ?3 AND tenant_id = ?4 AND deleted_at IS NULL"
    );
    sqlx::query(&sql)
        .bind(&now)
        .bind(&now)
        .bind(key_id)
        .bind(tenant_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Inserts a new API key row. Returns the persisted row keyed by `key_id`.
pub async fn insert_api_key(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    workspace_id: Option<&str>,
    key_id: &str,
    user_id: i64,
    name: &str,
    key_hash: &str,
    prefix: &str,
    scopes: &[String],
    expires_at: Option<&str>,
) -> Result<ApiKeyRow, sqlx::Error> {
    let now = now_rfc3339();
    let scopes_json = serde_json::to_string(scopes).unwrap_or_else(|_| "[]".to_string());
    let sql = format!(
        "INSERT INTO {TABLE} \
         (tenant_id, workspace_id, key_id, user_id, name, key_hash, prefix, scopes, status, expires_at, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'active', ?9, ?10, ?11)"
    );
    sqlx::query(&sql)
        .bind(tenant_id)
        .bind(workspace_id)
        .bind(key_id)
        .bind(user_id)
        .bind(name)
        .bind(key_hash)
        .bind(prefix)
        .bind(&scopes_json)
        .bind(expires_at)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;
    // Re-read by key_id to return a consistent row (avoids last_insert_rowid portability).
    find_api_key_by_id(pool, key_id, tenant_id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)
}

/// Fetches a single API key by its `key_id` (scoped to tenant).
pub async fn find_api_key_by_id(
    pool: &sqlx::AnyPool,
    key_id: &str,
    tenant_id: i64,
) -> Result<Option<ApiKeyRow>, sqlx::Error> {
    let sql = format!(
        "SELECT {ALL_COLUMNS} FROM {TABLE} \
         WHERE key_id = ?1 AND tenant_id = ?2 AND deleted_at IS NULL LIMIT 1"
    );
    let row = sqlx::query(&sql)
        .bind(key_id)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?;
    row.as_ref().map(ApiKeyRow::from_row).transpose()
}

/// Lists all non-deleted API keys for a user within a tenant.
pub async fn list_api_keys_for_user(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    user_id: i64,
) -> Result<Vec<ApiKeyRow>, sqlx::Error> {
    let sql = format!(
        "SELECT {ALL_COLUMNS} FROM {TABLE} \
         WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
         ORDER BY created_at DESC"
    );
    let rows = sqlx::query(&sql)
        .bind(tenant_id)
        .bind(user_id)
        .fetch_all(pool)
        .await?;
    rows.iter().map(ApiKeyRow::from_row).collect()
}

/// Revokes an API key (sets status, revoked_at). Returns the updated row when the
/// key existed and belonged to the caller's user.
pub async fn revoke_api_key(
    pool: &sqlx::AnyPool,
    key_id: &str,
    tenant_id: i64,
    user_id: i64,
) -> Result<Option<ApiKeyRow>, sqlx::Error> {
    let now = now_rfc3339();
    let sql = format!(
        "UPDATE {TABLE} SET status = 'revoked', revoked_at = ?1, updated_at = ?2 \
         WHERE key_id = ?3 AND tenant_id = ?4 AND user_id = ?5 AND status = 'active' AND deleted_at IS NULL"
    );
    let result = sqlx::query(&sql)
        .bind(&now)
        .bind(&now)
        .bind(key_id)
        .bind(tenant_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Ok(None);
    }
    find_api_key_by_id(pool, key_id, tenant_id).await
}

/// Rotates an API key: generates a new secret, updates `key_hash` and `prefix`.
/// Returns `(updated_row, new_plaintext)`.
pub async fn rotate_api_key(
    pool: &sqlx::AnyPool,
    key_id: &str,
    tenant_id: i64,
    user_id: i64,
) -> Result<Option<(ApiKeyRow, String)>, sqlx::Error> {
    let Some(existing) = find_api_key_by_id(pool, key_id, tenant_id).await? else {
        return Ok(None);
    };
    if existing.user_id != user_id || existing.status != "active" {
        return Ok(None);
    }
    let (plaintext, key_hash, prefix) = generate_api_key();
    let now = now_rfc3339();
    let sql = format!(
        "UPDATE {TABLE} SET key_hash = ?1, prefix = ?2, updated_at = ?3 \
         WHERE key_id = ?4 AND tenant_id = ?5 AND user_id = ?6 AND status = 'active' AND deleted_at IS NULL"
    );
    sqlx::query(&sql)
        .bind(&key_hash)
        .bind(&prefix)
        .bind(&now)
        .bind(key_id)
        .bind(tenant_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    let updated = find_api_key_by_id(pool, key_id, tenant_id).await?;
    Ok(updated.map(|row| (row, plaintext)))
}

// ---------------------------------------------------------------------------
// Authentication middleware
// ---------------------------------------------------------------------------

/// Axum middleware that authenticates a commerce request using a BirdCoder API
/// key. Validates the `Authorization: Bearer bc_...` token against the
/// `commerce_api_key` table, injects [`CommercePrincipal`] and the rate-limit
/// subject, and records `last_used_at`. Returns 401 when credentials are missing
/// or invalid.
pub async fn api_key_auth(
    state: CommerceAppState,
    mut request: Request,
    next: Next,
) -> Response {
    let Some(token) = extract_bearer_token(&request) else {
        return problem_response(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "missing or malformed authorization bearer token",
            false,
            &request,
        );
    };

    let key_hash = hash_api_key(token);
    let row = match resolve_api_key_by_hash(&state.pool, &key_hash).await {
        Ok(row) => row,
        Err(error) => {
            tracing::warn!(%error, "api key auth database lookup failed");
            return problem_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "api key validation failed",
                true,
                &request,
            );
        }
    };

    let Some(row) = row else {
        return problem_response(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "invalid or revoked api key",
            false,
            &request,
        );
    };

    let principal = CommercePrincipal {
        user_id: row.user_id.to_string(),
        tenant_id: row.tenant_id.to_string(),
        api_key_id: row.key_id.clone(),
        scopes: row.scopes_vec(),
    };
    request.extensions_mut().insert(principal.clone());
    insert_rate_limit_subject(&mut request, &principal);

    // Best-effort last_used_at update; do not fail the request on error.
    if let Err(error) = touch_last_used_at(&state.pool, &row.key_id, row.tenant_id).await {
        tracing::warn!(%error, "failed to update api key last_used_at");
    }

    next.run(request).await
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyResponse {
    pub id: String,
    pub name: String,
    pub prefix: String,
    pub scopes: Vec<String>,
    pub status: String,
    pub last_used_at: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyCreatedResponse {
    pub id: String,
    pub name: String,
    /// Plaintext API key. Returned exactly once; the caller must store it.
    pub key: String,
    pub prefix: String,
    pub scopes: Vec<String>,
    pub status: String,
    pub expires_at: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub scopes: Option<Vec<String>>,
    pub expires_in_days: Option<i64>,
    pub workspace_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyRevokedResponse {
    pub id: String,
    pub status: String,
    pub revoked_at: String,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

pub async fn create_api_key(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<Json<ApiDataEnvelope<ApiKeyCreatedResponse>>, ProblemJsonBody> {
    if !principal.has_scope("write") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "api key creation requires the 'write' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    if body.name.trim().is_empty() {
        return Err(problem_with(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "api key name must not be empty",
            false,
            ctx.trace_id_opt(),
        ));
    }

    let scopes = body.scopes.unwrap_or_else(|| vec!["read".to_string()]);
    let (tenant_id, user_id) = match (principal.tenant_id.parse::<i64>(), principal.user_id.parse::<i64>()) {
        (Ok(t), Ok(u)) => (t, u),
        _ => {
            return Err(problem_with(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "principal tenant_id/user_id must be numeric",
                false,
                ctx.trace_id_opt(),
            ));
        }
    };
    let expires_at = body
        .expires_in_days
        .filter(|days| *days > 0)
        .map(|days| {
            OffsetDateTime::now_utc()
                .checked_add(time::Duration::days(days))
                .and_then(|t| t.format(&Rfc3339).ok())
                .unwrap_or_else(|| now_rfc3339())
        });

    let key_id = uuid::Uuid::new_v4().to_string();
    let (plaintext, key_hash, prefix) = generate_api_key();

    let row = match insert_api_key(
        &state.pool,
        tenant_id,
        body.workspace_id.as_deref(),
        &key_id,
        user_id,
        body.name.trim(),
        &key_hash,
        &prefix,
        &scopes,
        expires_at.as_deref(),
    )
    .await
    {
        Ok(row) => row,
        Err(error) => {
            tracing::warn!(%error, "failed to insert api key");
            return Err(problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to create api key",
                true,
                ctx.trace_id_opt(),
            ));
        }
    };

    let response = ApiKeyCreatedResponse {
        id: row.key_id.clone(),
        name: row.name.clone(),
        key: plaintext,
        prefix: row.prefix.clone(),
        scopes: row.scopes_vec(),
        status: row.status.clone(),
        expires_at: row.expires_at.clone(),
        created_at: row.created_at.clone(),
        message: Some("Store this key securely; it will not be shown again.".to_string()),
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

pub async fn list_api_keys(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
) -> Result<Json<ApiListEnvelope<ApiKeyResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "listing api keys requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = match (principal.tenant_id.parse::<i64>(), principal.user_id.parse::<i64>()) {
        (Ok(t), Ok(u)) => (t, u),
        _ => {
            return Err(problem_with(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "principal tenant_id/user_id must be numeric",
                false,
                ctx.trace_id_opt(),
            ));
        }
    };
    let rows = match list_api_keys_for_user(&state.pool, tenant_id, user_id).await {
        Ok(rows) => rows,
        Err(error) => {
            tracing::warn!(%error, "failed to list api keys");
            return Err(problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to list api keys",
                true,
                ctx.trace_id_opt(),
            ));
        }
    };
    let items: Vec<ApiKeyResponse> = rows.iter().map(ApiKeyRow::to_response).collect();
    let total = items.len();
    Ok(Json(build_list_envelope(items, total, &ctx.request_id)))
}

pub async fn revoke_api_key_handler(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Path(key_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<ApiKeyRevokedResponse>>, ProblemJsonBody> {
    // Revoking is privileged; require admin scope (the owner of an admin key
    // revokes keys they own).
    if !principal.has_scope("admin") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "revoking api keys requires the 'admin' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = match (principal.tenant_id.parse::<i64>(), principal.user_id.parse::<i64>()) {
        (Ok(t), Ok(u)) => (t, u),
        _ => {
            return Err(problem_with(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "principal tenant_id/user_id must be numeric",
                false,
                ctx.trace_id_opt(),
            ));
        }
    };
    let Some(row) = revoke_api_key(&state.pool, &key_id, tenant_id, user_id)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to revoke api key");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to revoke api key",
                true,
                ctx.trace_id_opt(),
            )
        })?
    else {
        return Err(problem_with(
            StatusCode::NOT_FOUND,
            "not_found",
            "active api key not found for this user",
            false,
            ctx.trace_id_opt(),
        ));
    };
    let response = ApiKeyRevokedResponse {
        id: row.key_id.clone(),
        status: row.status.clone(),
        revoked_at: row.revoked_at.unwrap_or_else(now_rfc3339),
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

pub async fn rotate_api_key_handler(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Path(key_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<ApiKeyCreatedResponse>>, ProblemJsonBody> {
    if !principal.has_scope("admin") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "rotating api keys requires the 'admin' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = match (principal.tenant_id.parse::<i64>(), principal.user_id.parse::<i64>()) {
        (Ok(t), Ok(u)) => (t, u),
        _ => {
            return Err(problem_with(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "principal tenant_id/user_id must be numeric",
                false,
                ctx.trace_id_opt(),
            ));
        }
    };
    let Some((row, plaintext)) = rotate_api_key(&state.pool, &key_id, tenant_id, user_id)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to rotate api key");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to rotate api key",
                true,
                ctx.trace_id_opt(),
            )
        })?
    else {
        return Err(problem_with(
            StatusCode::NOT_FOUND,
            "not_found",
            "active api key not found for this user",
            false,
            ctx.trace_id_opt(),
        ));
    };
    let response = ApiKeyCreatedResponse {
        id: row.key_id.clone(),
        name: row.name.clone(),
        key: plaintext,
        prefix: row.prefix.clone(),
        scopes: row.scopes_vec(),
        status: row.status.clone(),
        expires_at: row.expires_at.clone(),
        created_at: row.created_at.clone(),
        message: Some("Rotated key. Store the new secret securely; it will not be shown again.".to_string()),
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Builds the `/api/v1/api-keys/*` router. Requires the [`api_key_auth`]
/// middleware to be applied at the commerce router level to populate
/// [`CommercePrincipal`].
pub fn build_api_keys_router() -> Router<CommerceAppState> {
    Router::new()
        .route("/api/v1/api-keys", post(create_api_key).get(list_api_keys))
        .route("/api/v1/api-keys/{id}", delete(revoke_api_key_handler))
        .route("/api/v1/api-keys/{id}/rotate", post(rotate_api_key_handler))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request as HttpRequest;

    static RNG_SEED: OnceLock<()> = OnceLock::new();

    fn ensure_rng() {
        RNG_SEED.get_or_init(|| ());
    }

    #[test]
    fn generated_key_has_prefix_and_is_unique() {
        ensure_rng();
        let (k1, h1, p1) = generate_api_key();
        let (k2, h2, _) = generate_api_key();
        assert!(k1.starts_with(KEY_PREFIX));
        assert!(k2.starts_with(KEY_PREFIX));
        assert_ne!(k1, k2, "generated keys must be unique");
        assert_ne!(h1, h2, "hashes must differ for different keys");
        assert!(p1.starts_with(KEY_PREFIX));
        assert!(p1.len() <= PREFIX_DISPLAY_LEN);
    }

    #[test]
    fn hash_is_sha256_hex_of_plaintext() {
        let plaintext = "bc_testkey";
        let hash = hash_api_key(plaintext);
        // SHA-256 hex digest is 64 chars.
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
        // Deterministic.
        assert_eq!(hash, hash_api_key(plaintext));
    }

    #[test]
    fn base62_encodes_known_value() {
        // empty -> empty
        assert_eq!(encode_base62(&[]), "");
        // single byte 0 -> "0"
        assert_eq!(encode_base62(&[0]), "0");
        // single byte 1 -> "1"
        assert_eq!(encode_base62(&[1]), "1");
        // 61 -> 'z' (last symbol)
        assert_eq!(encode_base62(&[61]), "z");
        // 62 -> "10"
        assert_eq!(encode_base62(&[62]), "10");
    }

    #[test]
    fn base62_output_uses_alphabet_only() {
        ensure_rng();
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let encoded = encode_base62(&bytes);
        assert!(!encoded.is_empty());
        assert!(
            encoded
                .chars()
                .all(|c| BASE62_ALPHABET.contains(&(c as u8)))
        );
    }

    #[test]
    fn extract_bearer_token_parses_header() {
        let request = HttpRequest::builder()
            .header(axum::http::header::AUTHORIZATION, "Bearer bc_abcdef")
            .body(Body::empty())
            .unwrap();
        assert_eq!(extract_bearer_token(&request), Some("bc_abcdef"));
    }

    #[test]
    fn extract_bearer_token_rejects_missing_header() {
        let request = HttpRequest::builder().body(Body::empty()).unwrap();
        assert!(extract_bearer_token(&request).is_none());
    }

    #[test]
    fn extract_bearer_token_rejects_non_bearer() {
        let request = HttpRequest::builder()
            .header(axum::http::header::AUTHORIZATION, "Basic abc")
            .body(Body::empty())
            .unwrap();
        assert!(extract_bearer_token(&request).is_none());
    }

    #[test]
    fn principal_admin_scope_satisfies_any() {
        let principal = CommercePrincipal {
            user_id: "1".into(),
            tenant_id: "1".into(),
            api_key_id: "k".into(),
            scopes: vec!["admin".into()],
        };
        assert!(principal.has_scope("read"));
        assert!(principal.has_scope("write"));
        assert!(principal.has_scope("admin"));
    }

    #[test]
    fn principal_explicit_scope_checked() {
        let principal = CommercePrincipal {
            user_id: "1".into(),
            tenant_id: "1".into(),
            api_key_id: "k".into(),
            scopes: vec!["read".into()],
        };
        assert!(principal.has_scope("read"));
        assert!(!principal.has_scope("write"));
    }

    #[test]
    fn now_rfc3339_is_parseable() {
        let ts = now_rfc3339();
        assert!(OffsetDateTime::parse(&ts, &Rfc3339).is_ok());
    }
}
