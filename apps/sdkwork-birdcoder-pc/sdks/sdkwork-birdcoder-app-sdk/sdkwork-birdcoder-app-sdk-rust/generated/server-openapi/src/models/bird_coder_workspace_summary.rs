use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderWorkspaceSummary {
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

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,

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
    pub r#type: Option<String>,

    #[serde(rename = "startTime")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_time: Option<String>,

    #[serde(rename = "endTime")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_time: Option<String>,

    #[serde(rename = "maxMembers")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_members: Option<i64>,

    #[serde(rename = "currentMembers")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_members: Option<i64>,

    #[serde(rename = "memberCount")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub member_count: Option<i64>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "maxStorage")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_storage: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "usedStorage")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub used_storage: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<std::collections::HashMap<String, serde_json::Value>>,

    #[serde(rename = "isPublic")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_public: Option<bool>,

    #[serde(rename = "isTemplate")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_template: Option<bool>,

    pub status: String,

    #[serde(rename = "viewerRole")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub viewer_role: Option<String>,
}
