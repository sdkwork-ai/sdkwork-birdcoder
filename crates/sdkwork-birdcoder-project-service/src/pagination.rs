//! List pagination constants and helpers.
//!
//! IMPORTANT: This module previously exposed `paginate_vec`, which performed
//! in-memory `skip`/`take` over already-materialized `Vec<T>`. That pattern
//! is forbidden by `PAGINATION_SPEC.md` §2 ("unbounded collect then skip/take
//! in process memory"). The function has been removed; list repositories now
//! accept `offset`/`limit` parameters and push them down to SQL
//! `LIMIT ? OFFSET ?` (or keyset pagination for high-volume tables).
//!
//! Route handlers normalize `page`/`page_size` (or `cursor`/`page_size`)
//! into `offset`/`limit` via `clamp_list_page_size` and pass them to the
//! service/repository layer.

pub const DEFAULT_LIST_PAGE_SIZE: usize = 20;
pub const MAX_LIST_PAGE_SIZE: usize = 200;

/// Clamp `page_size` to the SDKWORK bounds (`1..=MAX_LIST_PAGE_SIZE`) with
/// default fallback when `None` or zero. Returns the normalized
/// `(offset, limit)` pair suitable for SQL `LIMIT ? OFFSET ?`.
///
/// Aligns with `PAGINATION_SPEC.md` §3 and `API_SPEC.md` §16.2 — default
/// `page_size = 20`, max `200`, `page_size > 200` is rejected with
/// `40003 INVALID_PARAMETER` at the route layer.
pub fn clamp_list_page_size(
    offset: Option<usize>,
    limit: Option<usize>,
) -> (usize, usize) {
    let normalized_offset = offset.unwrap_or(0).min(MAX_LIST_PAGE_SIZE * 1_000);
    let page_size = limit
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_LIST_PAGE_SIZE)
        .min(MAX_LIST_PAGE_SIZE)
        .max(1);
    (normalized_offset, page_size)
}
