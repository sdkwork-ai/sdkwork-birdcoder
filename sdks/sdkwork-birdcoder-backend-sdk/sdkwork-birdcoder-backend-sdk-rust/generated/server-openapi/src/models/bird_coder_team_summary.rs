use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderTeamSummary {
    pub id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,

    #[serde(rename = "tenantId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,

    #[serde(rename = "organizationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,

    #[serde(rename = "createdAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    #[serde(rename = "updatedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,

    #[serde(rename = "workspaceId")]
    pub workspace_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(rename = "ownerId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<String>,

    #[serde(rename = "leaderId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub leader_id: Option<String>,

    #[serde(rename = "createdByUserId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by_user_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<std::collections::HashMap<String, serde_json::Value>>,

    pub status: String,
}
