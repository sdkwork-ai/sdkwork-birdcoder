use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderWorkspaceMemberSummary {
    pub id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,

    #[serde(rename = "tenantId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,

    #[serde(rename = "organizationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,

    #[serde(rename = "workspaceId")]
    pub workspace_id: String,

    #[serde(rename = "userId")]
    pub user_id: String,

    #[serde(rename = "userEmail")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_email: Option<String>,

    #[serde(rename = "userDisplayName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_display_name: Option<String>,

    #[serde(rename = "userAvatarUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_avatar_url: Option<String>,

    #[serde(rename = "teamId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_id: Option<String>,

    pub role: String,

    pub status: String,

    #[serde(rename = "createdByUserId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by_user_id: Option<String>,

    #[serde(rename = "grantedByUserId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub granted_by_user_id: Option<String>,

    #[serde(rename = "createdAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    #[serde(rename = "updatedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}
