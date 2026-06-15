use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamAuditEventSummary {
    pub id: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "organizationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,

    #[serde(rename = "actorUserId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,

    pub action: String,

    #[serde(rename = "resourceType")]
    pub resource_type: String,

    #[serde(rename = "resourceId")]
    pub resource_id: String,

    #[serde(rename = "requestId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,

    #[serde(rename = "appId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,

    #[serde(rename = "shardingKey")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sharding_key: Option<String>,

    pub detail: std::collections::HashMap<String, serde_json::Value>,

    #[serde(rename = "createdAt")]
    pub created_at: String,
}
