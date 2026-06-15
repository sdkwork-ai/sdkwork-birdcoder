use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectSummary {
    #[serde(rename = "createdAt")]
    pub created_at: String,

    pub id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,

    #[serde(rename = "tenantId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,

    #[serde(rename = "organizationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,

    /// DATABASE_SPEC.md standard data scope.
    #[serde(rename = "dataScope")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_scope: Option<String>,

    #[serde(rename = "workspaceId")]
    pub workspace_id: String,

    #[serde(rename = "workspaceUuid")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_uuid: Option<String>,

    #[serde(rename = "userId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,

    #[serde(rename = "parentId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,

    #[serde(rename = "parentUuid")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_uuid: Option<String>,

    #[serde(rename = "parentMetadata")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_metadata: Option<std::collections::HashMap<String, serde_json::Value>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(rename = "rootPath")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_path: Option<String>,

    #[serde(rename = "sitePath")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub site_path: Option<String>,

    #[serde(rename = "domainPrefix")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub domain_prefix: Option<String>,

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
    pub author: Option<String>,

    #[serde(rename = "fileId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<String>,

    #[serde(rename = "conversationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,

    #[serde(rename = "startTime")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_time: Option<String>,

    #[serde(rename = "endTime")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_time: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "budgetAmount")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub budget_amount: Option<String>,

    #[serde(rename = "coverImage")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_image: Option<std::collections::HashMap<String, serde_json::Value>>,

    #[serde(rename = "isTemplate")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_template: Option<bool>,

    #[serde(rename = "collaboratorCount")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collaborator_count: Option<i64>,

    pub status: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,

    #[serde(rename = "viewerRole")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub viewer_role: Option<String>,
}
