//! Fail-closed tenant id parsing for repository SQL scoping (`SECURITY_SPEC`).

/// Returned when `tenant_id` is missing, blank, or not a positive integer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TenantScopeViolation;

/// Parse IAM tenant id into the positive `i64` used by SQLite tenant columns.
///
/// Returns [`TenantScopeViolation`] instead of silently skipping tenant filters.
pub fn require_scoped_tenant_id(tenant_id: &str) -> Result<i64, TenantScopeViolation> {
    let trimmed = tenant_id.trim();
    if trimmed.is_empty() {
        return Err(TenantScopeViolation);
    }

    trimmed
        .parse::<i64>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or(TenantScopeViolation)
}

/// Parse IAM user id into the `i64` used by workspace membership columns.
pub fn require_scoped_user_id(user_id: &str) -> Result<i64, TenantScopeViolation> {
    require_scoped_tenant_id(user_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_positive_integer_tenant_ids() {
        assert_eq!(require_scoped_tenant_id("100001").expect("tenant"), 100001);
    }

    #[test]
    fn rejects_blank_or_non_positive_tenant_ids() {
        assert_eq!(require_scoped_tenant_id(""), Err(TenantScopeViolation));
        assert_eq!(require_scoped_tenant_id("0"), Err(TenantScopeViolation));
        assert_eq!(require_scoped_tenant_id("abc"), Err(TenantScopeViolation));
    }
}
