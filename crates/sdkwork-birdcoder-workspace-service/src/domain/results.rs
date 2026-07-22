use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePayload {
    pub id: String,
    pub uuid: String,
    pub tenant_id: String,
    pub organization_id: String,
    pub owner_user_id: String,
    pub created_by_user_id: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub color: Option<String>,
    pub visibility: String,
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
