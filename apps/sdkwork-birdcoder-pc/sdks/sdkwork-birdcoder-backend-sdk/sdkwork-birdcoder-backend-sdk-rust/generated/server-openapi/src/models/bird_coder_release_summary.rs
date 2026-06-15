use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderReleaseSummary {
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

    #[serde(rename = "releaseVersion")]
    pub release_version: String,

    /// Known values include formal, canary, hotfix, rollback.
    #[serde(rename = "releaseKind")]
    pub release_kind: String,

    #[serde(rename = "rolloutStage")]
    pub rollout_stage: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manifest: Option<std::collections::HashMap<String, serde_json::Value>>,

    /// Known values include pending, ready, running, succeeded, failed, rolled_back.
    pub status: String,
}
