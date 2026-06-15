use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub data_scope: Option<String>,
    pub code: Option<String>,
    pub title: Option<String>,
    pub owner_id: Option<String>,
    pub leader_id: Option<String>,
    pub created_by_user_id: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub max_members: Option<i64>,
    pub current_members: Option<i64>,
    pub member_count: Option<i64>,
    pub max_storage: Option<String>,
    pub used_storage: Option<String>,
    pub settings: Option<Value>,
    pub is_public: Option<bool>,
    pub is_template: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkspaceRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub data_scope: Option<String>,
    pub code: Option<String>,
    pub title: Option<String>,
    pub owner_id: Option<String>,
    pub leader_id: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub max_members: Option<i64>,
    pub current_members: Option<i64>,
    pub member_count: Option<i64>,
    pub max_storage: Option<String>,
    pub used_storage: Option<String>,
    pub settings: Option<Value>,
    pub is_public: Option<bool>,
    pub is_template: Option<bool>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertWorkspaceMemberRequest {
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub team_id: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub created_by_user_id: Option<String>,
    pub granted_by_user_id: Option<String>,
}
