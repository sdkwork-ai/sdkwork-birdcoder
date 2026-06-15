use serde::Deserialize;

// ── Native session query params ──────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionQueryParams {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub engine_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionLookupQueryParams {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub engine_id: Option<String>,
}
