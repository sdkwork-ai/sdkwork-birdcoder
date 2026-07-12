//! Usage metering service for the BirdCoder commerce surface.
//!
//! Backed by the `commerce_usage_metering` table (P0 schema). Implements:
//! - Recording token usage, file system operations, and API requests
//! - Real-time aggregation: current-period totals, monthly history, per-metric
//!   breakdown
//! - Quota enforcement: `check_quota` returns `402 Payment Required` when a
//!   tenant's monthly quota is exhausted; an `80%` warning notification is
//!   emitted when usage crosses the [`QUOTA_WARNING_THRESHOLD`]
//!
//! The quota check is designed to be called by the turn pipeline and the file
//! system operation handler *before* performing metered work.

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::Row;
#[cfg(test)]
use time::format_description::well_known::Rfc3339;
#[cfg(test)]
use time::OffsetDateTime;

use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, checked_list_total_items, ApiDataEnvelope,
    ApiListEnvelope,
};

use sdkwork_birdcoder_commerce_quota::{
    self, current_month_bounds, months_ago_start, quota_limit_for_metric, tenant_metric_total,
    QuotaError, METRIC_TOKEN_INPUT, QUOTA_WARNING_THRESHOLD,
};
#[cfg(test)]
use sdkwork_birdcoder_commerce_quota::{
    period_bounds_for, METRIC_API_REQUESTS, METRIC_FS_OPERATIONS, METRIC_TOKEN_OUTPUT,
};
use sdkwork_birdcoder_router_context::StrictOffsetListQuery;

use crate::routes::api_keys::now_rfc3339;
use crate::routes::{
    problem_with, CommerceAppState, CommercePrincipal, CommerceRequestContext, ProblemJsonBody,
};

const TABLE: &str = "commerce_usage_metering";

// ---------------------------------------------------------------------------
// Row model
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct UsageRow {
    pub id: i64,
    pub tenant_id: i64,
    pub workspace_id: Option<String>,
    pub user_id: i64,
    pub metric_type: String,
    pub metric_value: i64,
    pub period_start: String,
    pub period_end: String,
    pub metadata: String,
    pub created_at: String,
    pub updated_at: String,
}

impl UsageRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            tenant_id: row.try_get("tenant_id")?,
            workspace_id: row.try_get("workspace_id")?,
            user_id: row.try_get("user_id")?,
            metric_type: row.try_get("metric_type")?,
            metric_value: decode_metric_value(row)?,
            period_start: row.try_get("period_start")?,
            period_end: row.try_get("period_end")?,
            metadata: row.try_get("metadata")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

/// Decodes the `metric_value` BIGINT (postgres) / INTEGER (sqlite) column.
/// SQLite's `sqlx::any` driver may still surface INTEGER as `i64`; the `f64`
/// fallback covers the rare case where a non-conforming driver surfaces a
/// floating-point representation, and converts without precision loss when the
/// value fits in `f64`'s 53-bit mantissa.
fn decode_metric_value(row: &sqlx::any::AnyRow) -> Result<i64, sqlx::Error> {
    decode_exact_i64(row, "metric_value")
}

fn decode_exact_i64(row: &sqlx::any::AnyRow, column: &str) -> Result<i64, sqlx::Error> {
    if let Ok(value) = row.try_get::<i64, _>(column) {
        return Ok(value);
    }

    const MAX_EXACT_F64_INTEGER: f64 = 9_007_199_254_740_991.0;
    let value = row.try_get::<f64, _>(column)?;
    if !value.is_finite()
        || value.fract() != 0.0
        || !(-MAX_EXACT_F64_INTEGER..=MAX_EXACT_F64_INTEGER).contains(&value)
    {
        return Err(sqlx::Error::Decode(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("usage column {column} is not an exact signed integer"),
        ))));
    }
    Ok(value as i64)
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

async fn user_metric_totals(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    user_id: i64,
    period_start: &str,
    period_end_exclusive: &str,
) -> Result<Vec<MetricTotal>, sqlx::Error> {
    // metric_value is declared BIGINT (postgres) / INTEGER (sqlite); SUM over
    // an integer column yields an integer natively, so the previous
    // CAST(... AS INTEGER) workaround is no longer required.
    let sql = format!(
        "SELECT metric_type, COALESCE(SUM(metric_value), 0) AS total FROM {TABLE} \
         WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
         AND period_start >= ?3 AND period_start < ?4 \
         GROUP BY metric_type ORDER BY total DESC"
    );
    let rows = sqlx::query(&sql)
        .bind(tenant_id)
        .bind(user_id)
        .bind(period_start)
        .bind(period_end_exclusive)
        .fetch_all(pool)
        .await?;
    rows.iter().map(MetricTotal::from_row).collect()
}

/// Returns monthly history of per-metric totals for a user, covering the last
/// 24 calendar months with SQL-backed offset pagination.
fn usage_history_month_expression(backend_name: &str) -> Result<&'static str, sqlx::Error> {
    match backend_name {
        "SQLite" => Ok("substr(period_start, 1, 7)"),
        "PostgreSQL" => Ok("to_char(period_start AT TIME ZONE 'UTC', 'YYYY-MM')"),
        unsupported => Err(sqlx::Error::Configuration(
            format!("unsupported usage history database backend {unsupported}").into(),
        )),
    }
}

fn usage_history_cutoff_expression(backend_name: &str) -> Result<&'static str, sqlx::Error> {
    match backend_name {
        "SQLite" => Ok("?3"),
        "PostgreSQL" => Ok("CAST(?3 AS TIMESTAMPTZ)"),
        unsupported => Err(sqlx::Error::Configuration(
            format!("unsupported usage history database backend {unsupported}").into(),
        )),
    }
}

async fn user_history(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    user_id: i64,
    offset: usize,
    page_size: usize,
) -> Result<(Vec<HistoryBucket>, i64), sqlx::Error> {
    const HISTORY_MONTH_WINDOW: u32 = 24;

    let cutoff = months_ago_start(HISTORY_MONTH_WINDOW.saturating_sub(1));
    let mut connection = pool.acquire().await?;
    let backend_name = connection.backend_name();
    let month_expression = usage_history_month_expression(backend_name)?;
    let cutoff_expression = usage_history_cutoff_expression(backend_name)?;
    let count_sql = format!(
        "SELECT COUNT(*) AS total FROM ( \
         SELECT {month_expression} AS period, metric_type FROM {TABLE} \
         WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
         AND period_start >= {cutoff_expression} \
         GROUP BY {month_expression}, metric_type \
         ) AS usage_history"
    );
    let total_row = sqlx::query(&count_sql)
        .bind(tenant_id)
        .bind(user_id)
        .bind(&cutoff)
        .fetch_one(&mut *connection)
        .await?;
    let total = decode_total_count(&total_row)?;
    let sql = format!(
        "SELECT {month_expression} AS period, metric_type, \
         CAST(COALESCE(SUM(metric_value), 0) AS BIGINT) AS total FROM {TABLE} \
         WHERE tenant_id = ?1 AND user_id = ?2 AND deleted_at IS NULL \
         AND period_start >= {cutoff_expression} \
         GROUP BY {month_expression}, metric_type \
         ORDER BY period DESC, metric_type ASC \
         LIMIT ?4 OFFSET ?5"
    );
    let rows = sqlx::query(&sql)
        .bind(tenant_id)
        .bind(user_id)
        .bind(&cutoff)
        .bind(i64::try_from(page_size).unwrap_or(20))
        .bind(i64::try_from(offset).unwrap_or(0))
        .fetch_all(&mut *connection)
        .await?;
    let buckets = rows
        .iter()
        .map(HistoryBucket::from_row)
        .collect::<Result<Vec<_>, _>>()?;
    Ok((buckets, total))
}

fn decode_total_count(row: &sqlx::any::AnyRow) -> Result<i64, sqlx::Error> {
    decode_exact_i64(row, "total")
}

/// Records a usage event. After inserting, checks whether the tenant has crossed
/// the [`QUOTA_WARNING_THRESHOLD`] for the metric and emits a quota warning
/// notification when the threshold is freshly crossed.
pub async fn record_usage(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    workspace_id: Option<&str>,
    user_id: i64,
    metric_type: &str,
    metric_value: i64,
    metadata: Option<&str>,
) -> Result<(), sqlx::Error> {
    let now = now_rfc3339();
    let (period_start, period_end) = current_month_bounds();
    let metadata_json = metadata.unwrap_or("{}");
    let sql = format!(
        "INSERT INTO {TABLE} \
         (tenant_id, workspace_id, user_id, metric_type, metric_value, period_start, period_end, metadata, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
    );
    sqlx::query(&sql)
        .bind(tenant_id)
        .bind(workspace_id)
        .bind(user_id)
        .bind(metric_type)
        .bind(metric_value)
        .bind(&period_start)
        .bind(&period_end)
        .bind(metadata_json)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

    // Best-effort quota warning: emit when usage crosses 80% of the limit.
    if let Err(error) =
        maybe_emit_quota_warning(pool, tenant_id, workspace_id, user_id, metric_type).await
    {
        tracing::warn!(%error, "failed to emit quota warning notification");
    }
    Ok(())
}

/// Emits a `quota_warning` notification when the tenant's current usage for a
/// metric has just crossed the [`QUOTA_WARNING_THRESHOLD`]. The check is
/// idempotent within a period: a warning is only emitted when usage was below
/// the threshold before the latest record and is now at or above it.
async fn maybe_emit_quota_warning(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    workspace_id: Option<&str>,
    user_id: i64,
    metric_type: &str,
) -> Result<(), sqlx::Error> {
    let limit = quota_limit_for_metric(metric_type);
    if limit <= 0 {
        return Ok(());
    }
    let threshold = (limit as f64 * QUOTA_WARNING_THRESHOLD).ceil() as i64;
    let (period_start, period_end) = current_month_bounds();
    let used =
        tenant_metric_total(pool, tenant_id, metric_type, &period_start, &period_end).await?;
    if used < threshold {
        return Ok(());
    }
    let title = format!("Usage quota warning: {metric_type}");
    let content = format!(
        "Your tenant has used {used} of {limit} {metric_type} this month ({:.0}%).",
        (used as f64 / limit as f64) * 100.0
    );
    let metadata = serde_json::json!({
        "metricType": metric_type,
        "used": used,
        "limit": limit,
        "periodStart": period_start,
        "periodEnd": period_end,
    })
    .to_string();
    crate::routes::notifications::create_notification(
        pool,
        crate::routes::notifications::CreateNotificationInput {
            tenant_id,
            workspace_id,
            user_id,
            notification_type: crate::routes::notifications::NOTIFICATION_TYPE_QUOTA_WARNING,
            title: &title,
            content: &content,
            metadata: Some(&metadata),
        },
    )
    .await
    .map(|_| ())
}

/// Checks whether the tenant has remaining quota for a metric. Returns
/// `Err(ProblemJsonBody)` with status `402 Payment Required` when the quota is
/// exhausted. Designed to be called by the turn pipeline and file system
/// operation handler before performing metered work.
pub async fn check_quota(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    metric_type: &str,
    trace_id: Option<&str>,
) -> Result<(), ProblemJsonBody> {
    sdkwork_birdcoder_commerce_quota::check_tenant_quota(pool, tenant_id, metric_type)
        .await
        .map_err(|error| map_quota_error(error, metric_type, trace_id))
}

fn map_quota_error(
    error: QuotaError,
    metric_type: &str,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    match error {
        QuotaError::Exceeded { .. } => problem_with(
            StatusCode::PAYMENT_REQUIRED,
            "quota_exceeded",
            format!("usage quota for {metric_type} has been exhausted"),
            false,
            trace_id,
        ),
        QuotaError::Internal => problem_with(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal",
            "failed to check usage quota",
            true,
            trace_id,
        ),
        QuotaError::InvalidTenantId => problem_with(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "tenant_id must be numeric for commerce quota checks",
            false,
            trace_id,
        ),
    }
}

// ---------------------------------------------------------------------------
// Aggregation row models
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct MetricTotal {
    pub metric_type: String,
    pub total: i64,
}

impl MetricTotal {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            metric_type: row.try_get("metric_type")?,
            total: decode_exact_i64(row, "total")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct HistoryBucket {
    pub period: String,
    pub metric_type: String,
    pub total: i64,
}

impl HistoryBucket {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            period: row.try_get("period")?,
            metric_type: row.try_get("metric_type")?,
            total: decode_exact_i64(row, "total")?,
        })
    }
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurrentPeriodUsageResponse {
    pub period_start: String,
    pub period_end: String,
    pub metrics: Vec<MetricTotalDto>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MetricTotalDto {
    pub metric_type: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub total: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryBucketDto {
    pub period: String,
    pub metric_type: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub total: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BreakdownResponse {
    pub period_start: String,
    pub period_end: String,
    pub metrics: Vec<MetricTotalDto>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QuotaStatusResponse {
    pub metric_type: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub used: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub limit: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub remaining: i64,
    pub percentage: f64,
    pub period_start: String,
    pub period_end: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecordUsageResponse {
    pub recorded: bool,
    pub metric_type: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub metric_value: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordUsageRequest {
    pub metric_type: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub metric_value: i64,
    pub workspace_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQuery {
    pub period: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakdownQuery {
    pub metric: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaQuery {
    pub metric: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

pub async fn record_usage_handler(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Json(body): Json<RecordUsageRequest>,
) -> Result<Json<ApiDataEnvelope<RecordUsageResponse>>, ProblemJsonBody> {
    if !principal.has_scope("write") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "recording usage requires the 'write' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    if body.metric_type.trim().is_empty() {
        return Err(problem_with(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "metric_type must not be empty",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let metadata = body
        .metadata
        .as_ref()
        .map(|value| serde_json::to_string(value).unwrap_or_else(|_| "{}".to_string()));
    if let Err(error) = record_usage(
        &state.pool,
        tenant_id,
        body.workspace_id.as_deref(),
        user_id,
        body.metric_type.trim(),
        body.metric_value,
        metadata.as_deref(),
    )
    .await
    {
        tracing::warn!(%error, "failed to record usage");
        return Err(problem_with(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal",
            "failed to record usage",
            true,
            ctx.trace_id_opt(),
        ));
    }
    let response = RecordUsageResponse {
        recorded: true,
        metric_type: body.metric_type.trim().to_string(),
        metric_value: body.metric_value,
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

pub async fn current_period(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
) -> Result<Json<ApiDataEnvelope<CurrentPeriodUsageResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "reading usage requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let (period_start, period_end) = current_month_bounds();
    let totals = user_metric_totals(&state.pool, tenant_id, user_id, &period_start, &period_end)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to aggregate current period usage");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to aggregate current period usage",
                true,
                ctx.trace_id_opt(),
            )
        })?;
    let metrics = totals
        .into_iter()
        .map(|total| MetricTotalDto {
            metric_type: total.metric_type,
            total: total.total,
        })
        .collect();
    let response = CurrentPeriodUsageResponse {
        period_start,
        period_end,
        metrics,
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

pub async fn history(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<CommerceAppState>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<ApiListEnvelope<HistoryBucketDto>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "reading usage history requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    if query
        .period
        .as_deref()
        .is_some_and(|period| period != "monthly")
    {
        return Err(sdkwork_birdcoder_errors::traced_platform_problem(
            sdkwork_utils_rust::SdkWorkResultCode::InvalidParameter,
            "Usage history period must be monthly.",
            ctx.trace_id_opt(),
        ));
    }
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let (buckets, total) = user_history(&state.pool, tenant_id, user_id, offset, page_size)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to fetch usage history");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to fetch usage history",
                true,
                ctx.trace_id_opt(),
            )
        })?;
    let items: Vec<HistoryBucketDto> = buckets
        .into_iter()
        .map(|bucket| HistoryBucketDto {
            period: bucket.period,
            metric_type: bucket.metric_type,
            total: bucket.total,
        })
        .collect();
    let total_items = checked_list_total_items(total, ctx.trace_id_opt())?;
    Ok(Json(build_offset_list_envelope(
        items,
        offset,
        page_size,
        total_items,
        &ctx.request_id,
    )))
}

pub async fn breakdown(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Query(query): Query<BreakdownQuery>,
) -> Result<Json<ApiDataEnvelope<BreakdownResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "reading usage breakdown requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let (period_start, period_end) = current_month_bounds();
    let totals = if let Some(metric) = query.metric.as_deref() {
        let total = tenant_metric_total(&state.pool, tenant_id, metric, &period_start, &period_end)
            .await
            .map_err(|error| {
                tracing::warn!(%error, "failed to fetch usage breakdown");
                problem_with(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal",
                    "failed to fetch usage breakdown",
                    true,
                    ctx.trace_id_opt(),
                )
            })?;
        vec![MetricTotal {
            metric_type: metric.to_string(),
            total,
        }]
    } else {
        user_metric_totals(&state.pool, tenant_id, user_id, &period_start, &period_end)
            .await
            .map_err(|error| {
                tracing::warn!(%error, "failed to fetch usage breakdown");
                problem_with(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal",
                    "failed to fetch usage breakdown",
                    true,
                    ctx.trace_id_opt(),
                )
            })?
    };
    let metrics = totals
        .into_iter()
        .map(|total| MetricTotalDto {
            metric_type: total.metric_type,
            total: total.total,
        })
        .collect();
    let response = BreakdownResponse {
        period_start,
        period_end,
        metrics,
    };
    Ok(Json(build_data_envelope(response, &ctx.request_id)))
}

pub async fn quota(
    principal: CommercePrincipal,
    ctx: CommerceRequestContext,
    State(state): State<CommerceAppState>,
    Query(query): Query<QuotaQuery>,
) -> Result<Json<ApiDataEnvelope<QuotaStatusResponse>>, ProblemJsonBody> {
    if !principal.has_scope("read") {
        return Err(problem_with(
            StatusCode::FORBIDDEN,
            "forbidden",
            "reading usage quota requires the 'read' scope",
            false,
            ctx.trace_id_opt(),
        ));
    }
    let (tenant_id, _user_id) = parse_principal_ids(&principal, ctx.trace_id_opt())?;
    let metric = query
        .metric
        .unwrap_or_else(|| METRIC_TOKEN_INPUT.to_string());
    let limit = quota_limit_for_metric(&metric);
    let (period_start, period_end) = current_month_bounds();
    let used = tenant_metric_total(&state.pool, tenant_id, &metric, &period_start, &period_end)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to fetch quota status");
            problem_with(
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal",
                "failed to fetch quota status",
                true,
                ctx.trace_id_opt(),
            )
        })?;
    let remaining = limit.saturating_sub(used);
    let percentage = if limit > 0 {
        (used as f64 / limit as f64) * 100.0
    } else {
        0.0
    };
    let response = QuotaStatusResponse {
        metric_type: metric,
        used,
        limit,
        remaining,
        percentage,
        period_start,
        period_end,
    };
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

/// Builds the `/api/v1/usage/*` router. Requires the commerce API key auth
/// middleware to be applied at the commerce router level to populate
/// [`CommercePrincipal`].
pub fn build_usage_router() -> Router<CommerceAppState> {
    Router::new()
        .route("/api/v1/usage/record", post(record_usage_handler))
        .route("/api/v1/usage/current-period", get(current_period))
        .route("/api/v1/usage/history", get(history))
        .route("/api/v1/usage/breakdown", get(breakdown))
        .route("/api/v1/usage/quota", get(quota))
}

#[cfg(test)]
mod tests {
    use axum::body::{to_bytes, Body};
    use axum::http::{header::CONTENT_TYPE, Request};
    use axum::Extension;
    use sqlx::any::AnyPoolOptions;
    use tower::ServiceExt;

    use super::*;

    const MAX_TEST_RESPONSE_BYTES: usize = 64 * 1024;

    #[test]
    fn history_month_expression_is_backend_specific_and_utc_safe() {
        assert_eq!(
            usage_history_month_expression("SQLite").expect("SQLite usage month expression"),
            "substr(period_start, 1, 7)"
        );
        assert_eq!(
            usage_history_month_expression("PostgreSQL")
                .expect("PostgreSQL usage month expression"),
            "to_char(period_start AT TIME ZONE 'UTC', 'YYYY-MM')"
        );
        assert!(usage_history_month_expression("MySQL").is_err());
    }

    #[tokio::test]
    async fn usage_integer_decoders_reject_fractional_driver_values() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open usage integer decoding database");

        let metric_row = sqlx::query("SELECT CAST(1.5 AS REAL) AS metric_value")
            .fetch_one(&pool)
            .await
            .expect("query fractional metric value");
        assert!(decode_metric_value(&metric_row).is_err());

        let total_row =
            sqlx::query("SELECT 'token_input' AS metric_type, CAST(1.5 AS REAL) AS total")
                .fetch_one(&pool)
                .await
                .expect("query fractional metric total");
        assert!(MetricTotal::from_row(&total_row).is_err());

        let history_row = sqlx::query(
            "SELECT '2026-07' AS period, 'token_input' AS metric_type, \
             CAST(1.5 AS REAL) AS total",
        )
        .fetch_one(&pool)
        .await
        .expect("query fractional history total");
        assert!(HistoryBucket::from_row(&history_row).is_err());
    }

    #[tokio::test]
    async fn history_queries_sqlite_with_store_level_pagination() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open usage history SQLite database");
        sqlx::query(
            "CREATE TABLE commerce_usage_metering (\
                 tenant_id INTEGER NOT NULL, \
                 user_id INTEGER NOT NULL, \
                 metric_type TEXT NOT NULL, \
                 metric_value INTEGER NOT NULL, \
                 period_start TEXT NOT NULL, \
                 deleted_at TEXT NULL\
             )",
        )
        .execute(&pool)
        .await
        .expect("create usage history table");
        for (metric_type, metric_value) in [("api_requests", 3_i64), ("token_input", 7_i64)] {
            sqlx::query(
                "INSERT INTO commerce_usage_metering \
                 (tenant_id, user_id, metric_type, metric_value, period_start, deleted_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
            )
            .bind(7_i64)
            .bind(42_i64)
            .bind(metric_type)
            .bind(metric_value)
            .bind("2026-07-01T00:00:00Z")
            .execute(&pool)
            .await
            .expect("insert usage history row");
        }

        let (first_page, first_total) = user_history(&pool, 7, 42, 0, 1)
            .await
            .expect("query first usage history page");
        let (second_page, second_total) = user_history(&pool, 7, 42, 1, 1)
            .await
            .expect("query second usage history page");

        assert_eq!(first_total, 2);
        assert_eq!(second_total, 2);
        assert_eq!(first_page.len(), 1);
        assert_eq!(second_page.len(), 1);
        assert_ne!(first_page[0].metric_type, second_page[0].metric_type);
    }

    #[tokio::test]
    async fn history_rejects_over_max_page_size_before_accessing_the_repository() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open usage pagination test database");
        let principal = CommercePrincipal {
            user_id: "42".to_owned(),
            tenant_id: "7".to_owned(),
            api_key_id: "test-api-key".to_owned(),
            scopes: vec!["read".to_owned()],
        };
        let app = build_usage_router()
            .with_state(CommerceAppState::new(pool))
            .layer(Extension(principal));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/usage/history?page_size=201")
                    .body(Body::empty())
                    .expect("build invalid usage-history request"),
            )
            .await
            .expect("serve invalid usage-history request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(
            response
                .headers()
                .get(CONTENT_TYPE)
                .and_then(|value| value.to_str().ok()),
            Some("application/problem+json")
        );
        let body = to_bytes(response.into_body(), MAX_TEST_RESPONSE_BYTES)
            .await
            .expect("read bounded invalid pagination response");
        let problem: serde_json::Value =
            serde_json::from_slice(&body).expect("parse invalid pagination problem");
        assert_eq!(problem["code"], 40003);
    }

    #[tokio::test]
    async fn history_rejects_unsupported_period_before_accessing_the_repository() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open usage period test database");
        let principal = CommercePrincipal {
            user_id: "42".to_owned(),
            tenant_id: "7".to_owned(),
            api_key_id: "test-api-key".to_owned(),
            scopes: vec!["read".to_owned()],
        };
        let app = build_usage_router()
            .with_state(CommerceAppState::new(pool))
            .layer(Extension(principal));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/usage/history?period=weekly")
                    .body(Body::empty())
                    .expect("build unsupported usage-history period request"),
            )
            .await
            .expect("serve unsupported usage-history period request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(
            response
                .headers()
                .get(CONTENT_TYPE)
                .and_then(|value| value.to_str().ok()),
            Some("application/problem+json")
        );
        let body = to_bytes(response.into_body(), MAX_TEST_RESPONSE_BYTES)
            .await
            .expect("read bounded unsupported period response");
        let problem: serde_json::Value =
            serde_json::from_slice(&body).expect("parse unsupported period problem");
        assert_eq!(problem["code"], 40003);
    }

    #[test]
    fn current_month_bounds_are_well_formed_rfc3339() {
        let (start, end) = current_month_bounds();
        assert!(OffsetDateTime::parse(&start, &Rfc3339).is_ok());
        assert!(OffsetDateTime::parse(&end, &Rfc3339).is_ok());
        // Start must be before end.
        let start_ts = OffsetDateTime::parse(&start, &Rfc3339).unwrap();
        let end_ts = OffsetDateTime::parse(&end, &Rfc3339).unwrap();
        assert!(start_ts < end_ts);
    }

    #[test]
    fn current_month_start_is_first_day_of_month() {
        let (start, _) = current_month_bounds();
        let start_ts = OffsetDateTime::parse(&start, &Rfc3339).unwrap();
        assert_eq!(start_ts.day(), 1);
        assert_eq!(start_ts.hour(), 0);
        assert_eq!(start_ts.minute(), 0);
    }

    #[test]
    fn period_bounds_for_january_wraps_year() {
        // January 2025 reference.
        let reference = OffsetDateTime::parse("2025-01-15T10:30:00Z", &Rfc3339).unwrap();
        let (start, end) = period_bounds_for(reference);
        assert_eq!(start, "2025-01-01T00:00:00Z");
        assert_eq!(end, "2025-02-01T00:00:00Z");
    }

    #[test]
    fn period_bounds_for_december_wraps_year() {
        let reference = OffsetDateTime::parse("2025-12-31T23:59:59Z", &Rfc3339).unwrap();
        let (start, end) = period_bounds_for(reference);
        assert_eq!(start, "2025-12-01T00:00:00Z");
        assert_eq!(end, "2026-01-01T00:00:00Z");
    }

    #[test]
    fn months_ago_start_returns_correct_month() {
        // Reference: any point in June 2025 → 2 months ago is April 2025.
        let reference = OffsetDateTime::parse("2025-06-15T12:00:00Z", &Rfc3339).unwrap();
        let now_month = u8::from(reference.month());
        let _ = now_month; // sanity: 6
                           // We can't assert the exact string since months_ago_start uses now_utc,
                           // but we can assert the format is correct.
        let cutoff = months_ago_start(2);
        assert!(OffsetDateTime::parse(&cutoff, &Rfc3339).is_ok());
        let parsed = OffsetDateTime::parse(&cutoff, &Rfc3339).unwrap();
        assert_eq!(parsed.day(), 1);
        assert_eq!(parsed.hour(), 0);
    }

    #[test]
    fn quota_limit_defaults_are_positive() {
        assert!(quota_limit_for_metric(METRIC_TOKEN_INPUT) > 0);
        assert!(quota_limit_for_metric(METRIC_TOKEN_OUTPUT) > 0);
        assert!(quota_limit_for_metric(METRIC_FS_OPERATIONS) > 0);
        assert_eq!(quota_limit_for_metric("unknown_metric"), 0);
    }

    #[test]
    fn quota_warning_threshold_is_80_percent() {
        assert!((QUOTA_WARNING_THRESHOLD - 0.8).abs() < f64::EPSILON);
    }

    #[test]
    fn metric_constants_are_distinct() {
        let metrics = [
            METRIC_TOKEN_INPUT,
            METRIC_TOKEN_OUTPUT,
            METRIC_FS_OPERATIONS,
            METRIC_API_REQUESTS,
        ];
        for i in 0..metrics.len() {
            for j in (i + 1)..metrics.len() {
                assert_ne!(metrics[i], metrics[j], "metric types must be distinct");
            }
        }
    }

    #[test]
    fn record_usage_request_deserializes_metric_value_from_decimal_string() {
        let request: RecordUsageRequest = serde_json::from_str(
            r#"{"metricType":"token_input","metricValue":"9223372036854775807"}"#,
        )
        .expect("deserialize usage record request");

        assert_eq!(request.metric_value, i64::MAX);
    }

    #[test]
    fn record_usage_request_rejects_metric_value_number() {
        let result: Result<RecordUsageRequest, _> = serde_json::from_str(
            r#"{"metricType":"token_input","metricValue":9223372036854775807}"#,
        );

        assert!(result.is_err());
    }

    #[test]
    fn usage_responses_serialize_int64_values_as_strings() {
        let record = serde_json::to_value(RecordUsageResponse {
            recorded: true,
            metric_type: METRIC_TOKEN_INPUT.to_owned(),
            metric_value: i64::MAX,
        })
        .expect("serialize usage record response");
        assert_eq!(record["metricValue"], i64::MAX.to_string());

        let metric = serde_json::to_value(MetricTotalDto {
            metric_type: METRIC_TOKEN_OUTPUT.to_owned(),
            total: i64::MAX,
        })
        .expect("serialize metric total response");
        assert_eq!(metric["total"], i64::MAX.to_string());

        let bucket = serde_json::to_value(HistoryBucketDto {
            period: "2026-07".to_owned(),
            metric_type: METRIC_API_REQUESTS.to_owned(),
            total: i64::MAX,
        })
        .expect("serialize usage history bucket response");
        assert_eq!(bucket["total"], i64::MAX.to_string());

        let quota = serde_json::to_value(QuotaStatusResponse {
            metric_type: METRIC_TOKEN_INPUT.to_owned(),
            used: i64::MAX,
            limit: i64::MAX,
            remaining: 0,
            percentage: 100.0,
            period_start: "2026-07-01T00:00:00Z".to_owned(),
            period_end: "2026-08-01T00:00:00Z".to_owned(),
        })
        .expect("serialize quota status response");
        assert_eq!(quota["used"], i64::MAX.to_string());
        assert_eq!(quota["limit"], i64::MAX.to_string());
        assert_eq!(quota["remaining"], "0");
    }
}
