use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamSecurityEventSummary {
    pub id: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "userId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,

    #[serde(rename = "sessionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,

    #[serde(rename = "eventType")]
    pub event_type: String,

    pub severity: String,

    pub detail: std::collections::HashMap<String, serde_json::Value>,

    #[serde(rename = "createdAt")]
    pub created_at: String,
}
