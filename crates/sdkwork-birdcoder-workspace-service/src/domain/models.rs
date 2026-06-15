use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceScopedQuery {
    pub root_path: Option<String>,
    pub user_id: Option<String>,
    pub workspace_id: Option<String>,
}
