//! List pagination constants and helpers.
//!
//! IMPORTANT: This module previously exposed `paginate_vec`, which performed
//! in-memory `skip`/`take` over already-materialized `Vec<T>`. That pattern
//! is forbidden by `PAGINATION_SPEC.md` §2 ("unbounded collect then skip/take
//! in process memory"). The function has been removed; list repositories now
//! accept `offset`/`limit` parameters and push them down to SQL
//! `LIMIT ? OFFSET ?` (or keyset pagination for high-volume tables).
//!
//! HTTP route handlers must strictly validate standard `page`/`page_size`
//! parameters before calling services. `clamp_list_page_size` is retained only
//! as a defensive bound for internal repository inputs; it is not an HTTP
//! parser and must not turn invalid client input into a successful request.

pub const DEFAULT_LIST_PAGE_SIZE: usize = 20;
pub const MAX_LIST_PAGE_SIZE: usize = 200;

/// Defensively bounds internal repository pagination arguments.
///
/// HTTP callers must reject invalid pagination before reaching this helper.
/// The returned `(offset, limit)` pair is suitable for bounded SQL
/// `LIMIT ? OFFSET ?` execution.
pub fn clamp_list_page_size(offset: Option<usize>, limit: Option<usize>) -> (usize, usize) {
    let normalized_offset = offset.unwrap_or(0).min(MAX_LIST_PAGE_SIZE * 1_000);
    let page_size = limit
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_LIST_PAGE_SIZE)
        .clamp(1, MAX_LIST_PAGE_SIZE);
    (normalized_offset, page_size)
}
