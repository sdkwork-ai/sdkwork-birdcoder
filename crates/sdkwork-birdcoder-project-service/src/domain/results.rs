use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPayload {
    pub id: String,
    pub uuid: String,
    pub tenant_id: String,
    pub organization_id: String,
    pub workspace_id: String,
    pub owner_user_id: String,
    pub created_by_user_id: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub project_kind: String,
    pub default_agent_project_id: Option<String>,
    pub status: String,
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntityPayload {
    pub id: String,
}
