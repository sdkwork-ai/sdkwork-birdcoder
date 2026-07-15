//! Shared commerce usage quota helpers for BirdCoder metered surfaces.
//!
//! Used by the standalone-gateway commerce routes and the coding-session turn
//! pipeline so quota enforcement stays in one place.

use sqlx::Row;
use time::OffsetDateTime;

const TABLE: &str = "commerce_usage_metering";

/// Metric type: input tokens consumed by a turn.
pub const METRIC_TOKEN_INPUT: &str = "token_input";
/// Metric type: output tokens produced by a turn.
pub const METRIC_TOKEN_OUTPUT: &str = "token_output";
/// Metric type: file system operations (read/write/delete) performed.
pub const METRIC_FS_OPERATIONS: &str = "fs_operations";
/// Metric type: API requests received.
pub const METRIC_API_REQUESTS: &str = "api_requests";

/// Default monthly token quota per tenant (env-configurable via
/// `BIRDCODER_QUOTA_TOKENS_PER_MONTH`).
pub const DEFAULT_TOKEN_QUOTA_PER_MONTH: i64 = 1_000_000;
/// Default monthly file system operation quota per tenant (env-configurable
/// via `BIRDCODER_QUOTA_FS_OPERATIONS_PER_MONTH`).
pub const DEFAULT_FS_OPERATIONS_QUOTA_PER_MONTH: i64 = 100_000;
/// Fraction of the quota at which a warning notification is emitted.
pub const QUOTA_WARNING_THRESHOLD: f64 = 0.8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QuotaError {
    Exceeded { metric_type: String },
    Internal,
    InvalidTenantId,
}

/// Returns `(start_inclusive_rfc3339, end_exclusive_rfc3339)` for the current
/// calendar month in UTC.
pub fn current_month_bounds() -> (String, String) {
    period_bounds_for(OffsetDateTime::now_utc())
}

pub fn period_bounds_for(reference: OffsetDateTime) -> (String, String) {
    let year = reference.year();
    let month_num = u8::from(reference.month());
    let start = format!("{year:04}-{month_num:02}-01T00:00:00Z");
    let (next_year, next_month) = if month_num == 12 {
        (year + 1, 1u8)
    } else {
        (year, month_num + 1)
    };
    let end_exclusive = format!("{next_year:04}-{next_month:02}-01T00:00:00Z");
    (start, end_exclusive)
}

pub fn months_ago_start(months_ago: u32) -> String {
    let now = OffsetDateTime::now_utc();
    let total_months =
        (now.year() as i64) * 12 + (u8::from(now.month()) as i64) - 1 - months_ago as i64;
    let year = (total_months.div_euclid(12)) as i32;
    let month = (total_months.rem_euclid(12) + 1) as u8;
    format!("{year:04}-{month:02}-01T00:00:00Z")
}

pub fn quota_limit_for_metric(metric_type: &str) -> i64 {
    match metric_type {
        METRIC_TOKEN_INPUT | METRIC_TOKEN_OUTPUT => {
            std::env::var("BIRDCODER_QUOTA_TOKENS_PER_MONTH")
                .ok()
                .and_then(|value| value.trim().parse().ok())
                .filter(|value: &i64| *value > 0)
                .unwrap_or(DEFAULT_TOKEN_QUOTA_PER_MONTH)
        }
        METRIC_FS_OPERATIONS => std::env::var("BIRDCODER_QUOTA_FS_OPERATIONS_PER_MONTH")
            .ok()
            .and_then(|value| value.trim().parse().ok())
            .filter(|value: &i64| *value > 0)
            .unwrap_or(DEFAULT_FS_OPERATIONS_QUOTA_PER_MONTH),
        _ => 0,
    }
}

pub fn parse_numeric_tenant_id(tenant_id: &str) -> Result<i64, QuotaError> {
    tenant_id
        .trim()
        .parse::<i64>()
        .map_err(|_| QuotaError::InvalidTenantId)
}

pub async fn tenant_metric_total(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    metric_type: &str,
    period_start: &str,
    period_end_exclusive: &str,
) -> Result<i64, sqlx::Error> {
    // metric_value is declared BIGINT (postgres) / INTEGER (sqlite), so the
    // CAST(... AS INTEGER) workaround from the NUMERIC(20,4) era is no longer
    // required — SUM over an INTEGER column yields an INTEGER natively.
    let sql = format!(
        "SELECT COALESCE(SUM(metric_value), 0) AS total FROM {TABLE} \
         WHERE tenant_id = ?1 AND metric_type = ?2 AND deleted_at IS NULL \
         AND period_start >= ?3 AND period_start < ?4"
    );
    let row = sqlx::query(&sql)
        .bind(tenant_id)
        .bind(metric_type)
        .bind(period_start)
        .bind(period_end_exclusive)
        .fetch_one(pool)
        .await?;
    row.try_get::<i64, _>("total")
        .or_else(|_| row.try_get::<f64, _>("total").map(|value| value as i64))
}

pub async fn check_tenant_quota(
    pool: &sqlx::AnyPool,
    tenant_id: i64,
    metric_type: &str,
) -> Result<(), QuotaError> {
    let limit = quota_limit_for_metric(metric_type);
    if limit <= 0 {
        return Ok(());
    }
    let (period_start, period_end) = current_month_bounds();
    let used = tenant_metric_total(pool, tenant_id, metric_type, &period_start, &period_end)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "failed to check usage quota");
            QuotaError::Internal
        })?;
    if used >= limit {
        return Err(QuotaError::Exceeded {
            metric_type: metric_type.to_string(),
        });
    }
    Ok(())
}

fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

/// Persists a tenant-scoped usage metering row for the current UTC month.
pub async fn record_tenant_usage(
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
    Ok(())
}

pub fn parse_numeric_user_id(user_id: &str) -> Result<i64, QuotaError> {
    user_id
        .trim()
        .parse::<i64>()
        .map_err(|_| QuotaError::InvalidTenantId)
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::format_description::well_known::Rfc3339;

    #[test]
    fn current_month_bounds_are_well_formed_rfc3339() {
        let (start, end) = current_month_bounds();
        assert!(OffsetDateTime::parse(&start, &Rfc3339).is_ok());
        assert!(OffsetDateTime::parse(&end, &Rfc3339).is_ok());
        let start_ts = OffsetDateTime::parse(&start, &Rfc3339).unwrap();
        let end_ts = OffsetDateTime::parse(&end, &Rfc3339).unwrap();
        assert!(start_ts < end_ts);
    }

    #[test]
    fn quota_limit_defaults_are_positive() {
        assert!(quota_limit_for_metric(METRIC_TOKEN_INPUT) > 0);
        assert!(quota_limit_for_metric(METRIC_FS_OPERATIONS) > 0);
        assert_eq!(quota_limit_for_metric("unknown_metric"), 0);
    }
}
