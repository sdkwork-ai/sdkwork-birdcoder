use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectSummary {
    pub id: String,

    pub uuid: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "organizationId")]
    pub organization_id: String,

    #[serde(rename = "workspaceId")]
    pub workspace_id: String,

    #[serde(rename = "ownerUserId")]
    pub owner_user_id: String,

    #[serde(rename = "createdByUserId")]
    pub created_by_user_id: String,

    pub code: String,

    pub name: String,

    pub description: String,

    #[serde(rename = "projectKind")]
    pub project_kind: String,

    /// Stable sdkwork-agents project identifier; no cross-domain foreign key is created.
    #[serde(rename = "defaultAgentProjectId")]
    pub default_agent_project_id: String,

    pub status: String,

    /// Optimistic concurrency version used with the If-Match request header.
    pub version: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
