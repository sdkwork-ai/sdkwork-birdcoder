//! Notification service for the BirdCoder commerce surface.
//!
//! Backed by the `commerce_notification` table (P0 schema). Implements:
//! - Sending notifications (HTTP `POST` and the internal [`create_notification`]
//!   helper used by the usage metering quota-warning integration)
//! - Listing notifications for the authenticated user with optional `status`
//!   filter (`unread` / `read`)
//! - Marking a single notification or all notifications as read
//!
//! Supported notification types: [`NOTIFICATION_TYPE_QUOTA_WARNING`],
//! [`NOTIFICATION_TYPE_PAYMENT_RECEIVED`],
//! [`NOTIFICATION_TYPE_SUBSCRIPTION_RENEWED`],
//! [`NOTIFICATION_TYPE_API_KEY_EXPIRING`].

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use sdkwork_birdcoder_errors::{build_data_envelope, build_offset_list_envelope, ApiDataEnvelope, ApiListEnvelope};
use sdkwork_utils_rust::{OffsetListPageParams, SdkWorkResultCode, validated_offset_list_params};

use crate::routes::api_keys::now_rfc3339;
use crate::routes::{problem_with, CommerceAppState, CommercePrincipal, CommerceRequestContext, ProblemJsonBody};

const TABLE: &str = "commerce_notification";
const ALL_COLUMNS: &str = "id, tenant_id, workspace_id, user_id, type, title, content, status, read_at, sent_at, metadata, created_at, updated_at";

/// Notification type: usage quota has reached the warning threshold (80%).
pub const NOTIFICATION_TYPE_QUOTA_WARNING: &str = "quota_warning";
/// Notification type: a payment has been received and recorded.
pub const NOTIFICATION_TYPE_PAYMENT_RECEIVED: &str = "payment_received";
/// Notification type: a subscription has been renewed.
pub const NOTIFICATION_TYPE_SUBSCRIPTION_RENEWED: &str = "subscription_renewed";
/// Notification type: an API key is approaching its expiry date.
pub const NOTIFICATION_TYPE_API_KEY_EXPIRING: &str = "api_key_expiring";

/// Notification status: not yet read by the user.
pub const STATUS_UNREAD: &str = "unread";
/// Notification status: read by the user.
pub const STATUS_READ: &str = "read";

/// Returns true when `notification_type` is a supported commerce notification type.
pub fn is_valid_notification_type(notification_type: &str) -> bool {
    matches!(
        notification_type,
        NOTIFICATION_TYPE_QUOTA_WARNING
            | NOTIFICATION_TYPE_PAYMENT_RECEIVED
            | NOTIFICATION_TYPE_SUBSCRIPTION_RENEWED
            | NOTIFICATION_TYPE_API_KEY_EXPIRING
    )
}

// ---------------------------------------------------------------------------
// Row model
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct NotificationRow {
    pub id: i64,
    pub tenant_id: i64,
    pub workspace_id: Option<String>,
    pub user_id: i64,
    pub notification_type: String,
    pub title: String,
    pub content: String,
    pub status: String,
    pub read_at: Option<String>,
    pub sent_at: Option<String>,
    pub metadata: String,
    pub created_at: String,
    pub updated_at: String,
}

impl NotificationRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            tenant_id: row.try_get("tenant_id")?,
            workspace_id: row.try_get("workspace_id")?,
            user_id: row.try_get("user_id")?,
            notification_type: row.try_get("type")?,
            title: row.try_get("title")?,
            content: row.try_get("content")?,
            status: row.try_get("status")?,
            read_at: row.try_get("read_at")?,
            sent_at: row.try_get("sent_at")?,
            metadata: row.try_get("metadata")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }

    pub fn to_response(&self) -> NotificationResponse {
        NotificationResponse {
            id: self.id.to_string(),
            notification_type: self.notification_type.clone(),
            title: self.title.clone(),
            content: self.content.clone(),
            status: self.status.clone(),
            read_at: self.read_at.clone(),
            sent_at: self.sent_at.clone(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

/// Inserts a notification row. This is the internal entry point used by other
/// services (e.g. usage metering quota-warning integration) to emit a
/// notification without going through the HTTP layer.
pub async fn create_notification(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    workspace_id: Option<&str>,
    user_id: i64,
    notification_type: &str,
    title: &str,
    content: &str,
    metadata: Option<&str>,
) -> Result<(), sqlx::Error> {
    let now = now_rfc3339();
    let metadata_json = metadata.unwrap_or("{}");
    let sql = format!(
        "INSERT INTO {TABLE} \
         (tenant_id, workspace_id, user_id, type, title, content, status, sent_at, metadata, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"
    );
    sqlx::query(&sql)
        .bind(tenant_id)
        .bind(workspace_id)
        .bind(user_id)
        .bind(notification_type)
        .bind(title)
        .bind(content)
        .bind(STATUS_UNREAD)
        .bind(&now)
        .bind(metadata_json)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;
    Ok(())
}

/// Fetches a single notification by id, scoped to the tenant and user.
async fn find_notification_by_id(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    user_id: i64,
    notification_id: i64,
) -> Result<Option<NotificationRow>, sqlx::Error> {
    let sql = format!(
        "SELECT {ALL_COLUMNS} FROM {TABLE} \
         WHERE id = ?1 AND tenant_id = ?2 AND user_id = ?3 AND deleted_at IS NULL LIMIT 1"
    );
    let row = sqlx::query(&sql)
        .bind(notification_id)
        .bind(tenant_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
    row.as_ref().map(NotificationRow::from_row).transpose()
}

/// Lists notifications for a user, optionally filtered by status. Ordered by
/// `created_at` descending (newest first). Uses an empty-string sentinel for
/// the optional status filter so a single SQL plan serves both cases (sqlx
/// `Any` does not implement `Encode` for `Option<T>`).
async fn list_notifications_for_user(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    user_id: i64,
    status_filter: Option<&str>,
    params: OffsetListPageParams,
) -> Result<(Vec<NotificationRow>, i64), sqlx::Error> {
    let status_value = status_filter.unwrap_or("");
    let count_sql = format!(
        "SELECT COUNT(*) AS total FROM {TABLE} \
         WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
         AND (?3 = '' OR status = ?3)"
    );
    let total: i64 = sqlx::query(&count_sql)
        .bind(tenant_id)
        .bind(user_id)
        .bind(status_value)
        .fetch_one(pool)
        .await?
        .try_get("total")?;

    let sql = format!(
        "SELECT {ALL_COLUMNS} FROM {TABLE} \
         WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
         AND (?3 = '' OR status = ?3) \
         ORDER BY created_at DESC LIMIT ?4 OFFSET ?5"
    );
    let rows = sqlx::query(&sql)
        .bind(tenant_id)
        .bind(user_id)
        .bind(status_value)
        .bind(params.page_size)
        .bind(params.offset)
        .fetch_all(pool)
        .await?;
    let items = rows.iter().map(NotificationRow::from_row).collect::<Result<Vec<_>, _>>()?;
    Ok((items, total))
}

/// Marks a single notification as read. Returns the updated row when the
/// notification existed and belonged to the caller.
async fn mark_notification_as_read(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    user_id: i64,
    notification_id: i64,
) -> Result<Option<NotificationRow>, sqlx::Error> {
    let now = now_rfc3339();
    let sql = format!(
        "UPDATE {TABLE} SET status = ?1, read_at = ?2, updated_at = ?3 \
         WHERE id = ?4 AND tenant_id = ?5 AND user_id = ?6 AND status = ?7 AND deleted_at IS NULL"
    );
    let result = sqlx::query(&sql)
        .bind(STATUS_READ)
        .bind(&now)
        .bind(&now)
        .bind(notification_id)
        .bind(tenant_id)
        .bind(user_id)
        .bind(STATUS_UNREAD)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Ok(None);
    }
    find_notification_by_id(pool, tenant_id, user_id, notification_id).await
}

/// Marks all unread notifications for a user as read. Returns the number of
/// notifications updated.
async fn mark_all_notifications_as_read(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    user_id: i64,
) -> Result<u64, sqlx::Error> {
    let now = now_rfc3339();
    let sql = format!(
        "UPDATE {TABLE} SET status = ?1, read_at = ?2, updated_at = ?3 \
         WHERE tenant_id = ?4 AND user_id = ?5 AND status = ?6 AND deleted_at IS NULL"
    );
    let result = sqlx::query(&sql)
        .bind(STATUS_READ)
        .bind(&now)
        .bind(&now)
        .bind(tenant_id)
        .bind(user_id)
        .bind(STATUS_UNREAD)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

/// Counts unread notifications for a user.
async fn count_unread_notifications(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    user_id: i64,
) -> Result<i64, sqlx::Error> {
    let sql = format!(
        "SELECT COUNT(*) AS count FROM {TABLE} \
         WHERE tenant_id = ?1 AND user_id = ?2 AND status = ?3 AND deleted_at IS NULL"
    );
    let row = sqlx::query(&sql)
        .bind(tenant_id)
        .bind(user_id)
        .bind(STATUS_UNREAD)
        .fetch_one(pool)
        .await?;
    let count: i64 = row
        .try_get::<i64, _>("count")
        .or_else(|_| row.try_get::<f64, _>("count").map(|value| value as i64))?;
    Ok(count)
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NotificationResponse {
    pub id: String,
    pub notification_type: String,
    pub title: String,
    pub content: String,
    pub status: String,
    pub read_at: Option<String>,
    pub sent_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NotificationCreatedResponse {
    pub id: String,
    pub notification_type: String,
    pub title: String,
    pub status: String,
    pub sent_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NotificationReadResponse {
    pub id: String,
    pub status: String,
    pub read_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MarkAllReadResponse {
    pub updated: u64,
    pub status: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UnreadCountResponse {
    pub unread_count: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNotificationRequest {
    pub notification_type: String,
    pub title: String,
    pub content: String,
    pub workspace_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListNotificationsQuery {
    pub status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

pub async fn send_notification(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Json(body): Json<CreateNotificationRequest>,
) -> Result<Json<ApiDataEnvelope<NotificationCreatedResponse>>, ProblemJsonBody> {
    if !principal.has_scope("write") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "sending notifications requires the 'write' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    if body.title.trim().is_empty() || body.content.trim().is_empty() {
        return Err(problem_with(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "notification title and content must not be empty",
            false,
            ctx.trace_id_opt(),
        ));
    }
    if !is_valid_notification_type(body.notification_type.trim()) {
        return Err(problem_with(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            format!("unsupported notification type: {}", body.notification_type),
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let metadata = body
        .metadata
        .as_ref()
        .map(|value| serde_json::to_string(value).unwrap_or_else(|_| "{}".to_string()));
    if let Err(error) = create_notification(
        &state.pool,
        tenant_id,
        body.workspace_id.as_deref(),
        user_id,
        body.notification_type.trim(),
        body.title.trim(),
        body.content.trim(),
        metadata.as_deref(),
    )
    .await
    {
        tracing::warn!(%error, "failed to create notification");
        return Err(problem_with(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal",
            "failed to create notification",
            true,
            ctx.trace_id_opt(),
        ));
    }
    let now = now_rfc3339();
    let response = NotificationCreatedResponse {
        id: uuid::Uuid::new_v4().to_string(),
        notification_type: body.notification_type.trim().to_string(),
        title: body.title.trim().to_string(),
        status: STATUS_UNREAD.to_string(),
        sent_at: now,
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

pub async fn list_notifications(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Query(query): Query<ListNotificationsQuery>,
) -> Result<Json<ApiListEnvelope<NotificationResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "listing notifications requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let status = query.status.as_deref().filter(|s| !s.is_empty());
    if let Some(status) = status {
        if status != STATUS_UNREAD && status != STATUS_READ {
            return Err(problem_with(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "status filter must be 'unread' or 'read'",
                false,
                ctx.trace_id_opt(),
            ));
        }
    }
    let params = match validated_offset_list_params(query.page, query.page_size) {
        Ok(params) => params,
        Err(SdkWorkResultCode::InvalidParameter) => {
            return Err(problem_with(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "page must be >= 1 and page_size must be between 1 and 200",
                false,
                ctx.trace_id_opt(),
            ));
        }
        Err(_) => {
            return Err(problem_with(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "invalid pagination parameters",
                false,
                ctx.trace_id_opt(),
            ));
        }
    };
    let (rows, total) = list_notifications_for_user(
        &state.pool,
        tenant_id,
        user_id,
        status,
        params,
    )
    .await
    .map_err(|error| {
        tracing::warn!(%error, "failed to list notifications");
        problem_with(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal",
            "failed to list notifications",
            true,
            ctx.trace_id_opt(),
        )
    })?;
    let items: Vec<NotificationResponse> = rows.iter().map(NotificationRow::to_response).collect();
    let offset = usize::try_from(params.offset).unwrap_or(0);
    let page_size = usize::try_from(params.page_size).unwrap_or(1);
    let total_items = usize::try_from(total).unwrap_or(0);
    Ok(Json(build_offset_list_envelope(
        items,
        offset,
        page_size,
        total_items,
        &ctx.request_id,
    )))
}

pub async fn get_notification(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Path(notification_id): Path<i64>,
) -> Result<Json<ApiDataEnvelope<NotificationResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "reading notifications requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let row = find_notification_by_id(&state.pool, tenant_id, user_id, notification_id)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to fetch notification");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to fetch notification",
                true,
                ctx.trace_id_opt(),
            )
        })?;
    let row = row.ok_or_else(|| {
        problem_with(
            StatusCode::NOT_FOUND,
            "not_found",
            "notification not found",
            false,
            ctx.trace_id_opt(),
        )
    })?;
    Ok(Json(build_data_envelope(row.to_response(), &ctx.request_id)))
}

pub async fn mark_as_read(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Path(notification_id): Path<i64>,
) -> Result<Json<ApiDataEnvelope<NotificationReadResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "marking notifications as read requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let row = mark_notification_as_read(&state.pool, tenant_id, user_id, notification_id)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to mark notification as read");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to mark notification as read",
                true,
                ctx.trace_id_opt(),
            )
        })?;
    let row = row.ok_or_else(|| {
        problem_with(
            StatusCode::NOT_FOUND,
            "not_found",
            "unread notification not found for this user",
            false,
            ctx.trace_id_opt(),
        )
    })?;
    let response = NotificationReadResponse {
        id: row.id.to_string(),
        status: row.status.clone(),
        read_at: row.read_at.unwrap_or_else(now_rfc3339),
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

pub async fn mark_all_as_read(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
) -> Result<Json<ApiDataEnvelope<MarkAllReadResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "marking notifications as read requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let updated = mark_all_notifications_as_read(&state.pool, tenant_id, user_id)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to mark all notifications as read");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to mark all notifications as read",
                true,
                ctx.trace_id_opt(),
            )
        })?;
    let response = MarkAllReadResponse {
        updated,
        status: STATUS_READ.to_string(),
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

pub async fn unread_count(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
) -> Result<Json<ApiDataEnvelope<UnreadCountResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "reading notification count requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let count = count_unread_notifications(&state.pool, tenant_id, user_id)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to count unread notifications");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to count unread notifications",
                true,
                ctx.trace_id_opt(),
            )
        })?;
    let response = UnreadCountResponse { unread_count: count };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn parse_principal_ids(
    principal: &CommercePrincipal,
    trace_id: Option<&str>,
) -> Result<(i64, i64), ProblemJsonBody> {
    match (
        principal.tenant_id.parse::<i64>(),
        principal.user_id.parse::<i64>(),
    ) {
        (Ok(t), Ok(u)) => Ok((t, u)),
        _ => Err(problem_with(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "principal tenant_id/user_id must be numeric",
            false,
            trace_id,
        )),
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/// Builds the `/api/v1/notifications/*` router. Requires the commerce API key
/// auth middleware to be applied at the commerce router level to populate
/// [`CommercePrincipal`].
pub fn build_notifications_router() -> Router<CommerceAppState> {
    Router::new()
        .route("/api/v1/notifications", post(send_notification).get(list_notifications))
        .route("/api/v1/notifications/unread-count", get(unread_count))
        .route("/api/v1/notifications/read-all", post(mark_all_as_read))
        .route("/api/v1/notifications/{id}", get(get_notification))
        .route("/api/v1/notifications/{id}/read", post(mark_as_read))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_notification_types_are_recognized() {
        assert!(is_valid_notification_type(NOTIFICATION_TYPE_QUOTA_WARNING));
        assert!(is_valid_notification_type(NOTIFICATION_TYPE_PAYMENT_RECEIVED));
        assert!(is_valid_notification_type(NOTIFICATION_TYPE_SUBSCRIPTION_RENEWED));
        assert!(is_valid_notification_type(NOTIFICATION_TYPE_API_KEY_EXPIRING));
    }

    #[test]
    fn invalid_notification_type_is_rejected() {
        assert!(!is_valid_notification_type("unknown"));
        assert!(!is_valid_notification_type(""));
        assert!(!is_valid_notification_type("quota"));
    }

    #[test]
    fn status_constants_are_distinct() {
        assert_ne!(STATUS_UNREAD, STATUS_READ);
    }

    #[test]
    fn notification_type_constants_are_distinct() {
        let types = [
            NOTIFICATION_TYPE_QUOTA_WARNING,
            NOTIFICATION_TYPE_PAYMENT_RECEIVED,
            NOTIFICATION_TYPE_SUBSCRIPTION_RENEWED,
            NOTIFICATION_TYPE_API_KEY_EXPIRING,
        ];
        for i in 0..types.len() {
            for j in (i + 1)..types.len() {
                assert_ne!(types[i], types[j], "notification types must be distinct");
            }
        }
    }

    #[test]
    fn notification_row_to_response_maps_fields() {
        let row = NotificationRow {
            id: 42,
            tenant_id: 1,
            workspace_id: Some("ws-1".into()),
            user_id: 7,
            notification_type: NOTIFICATION_TYPE_QUOTA_WARNING.into(),
            title: "Quota warning".into(),
            content: "You have used 80% of your quota".into(),
            status: STATUS_UNREAD.into(),
            read_at: None,
            sent_at: Some("2025-06-26T10:00:00Z".into()),
            metadata: "{}".into(),
            created_at: "2025-06-26T10:00:00Z".into(),
            updated_at: "2025-06-26T10:00:00Z".into(),
        };
        let response = row.to_response();
        assert_eq!(response.id, "42");
        assert_eq!(response.notification_type, NOTIFICATION_TYPE_QUOTA_WARNING);
        assert_eq!(response.title, "Quota warning");
        assert_eq!(response.status, STATUS_UNREAD);
        assert!(response.read_at.is_none());
        assert!(response.sent_at.is_some());
    }
}
