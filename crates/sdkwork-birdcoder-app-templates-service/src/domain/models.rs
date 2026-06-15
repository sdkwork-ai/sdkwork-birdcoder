use serde::{Deserialize, Serialize};

// ── App template ─────────────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppTemplatePayload {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    pub slug: String,
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    pub version_id: String,
    pub version_label: String,
    pub preset_key: String,
    pub category: String,
    pub tags: Vec<String>,
    pub target_profiles: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloads: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stars: Option<usize>,
    pub status: String,
}
