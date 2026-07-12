use serde::Deserialize;

/// Pagination input shared by workspace/project/team list queries.
///
/// Aligns with `PAGINATION_SPEC.md` §3: the HTTP route strictly validates
/// `page`/`page_size` and projects them into an internal offset/page-size pair.
/// Repositories push that bounded pair down to SQL `LIMIT ? OFFSET ?`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPagination {
    pub offset: Option<i64>,
    pub page_size: Option<i64>,
}

impl ListPagination {
    /// Normalize to non-negative `offset` and bounded `limit`.
    ///
    /// `page_size` defaults to `DEFAULT_LIST_PAGE_SIZE` (20) and is clamped to
    /// `MAX_LIST_PAGE_SIZE` (200). `offset` is clamped to non-negative.
    pub fn normalize(&self, default_page_size: i64, max_page_size: i64) -> (i64, i64) {
        let offset = self.offset.unwrap_or(0).max(0);
        let limit = self
            .page_size
            .filter(|v| *v > 0)
            .unwrap_or(default_page_size)
            .min(max_page_size)
            .max(1);
        (offset, limit)
    }
}

#[derive(Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceScopedQuery {
    pub root_path: Option<String>,
    pub user_id: Option<String>,
    pub workspace_id: Option<String>,
    #[serde(flatten)]
    pub pagination: ListPagination,
}
