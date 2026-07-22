use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
    pub code: Option<String>,
    pub icon_url: Option<String>,
    pub color: Option<String>,
    pub visibility: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub code: Option<String>,
    pub icon_url: Option<String>,
    pub color: Option<String>,
    pub visibility: Option<String>,
    pub status: Option<String>,
    #[serde(skip)]
    pub expected_version: i64,
}
