use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectDocumentSummary {
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

    #[serde(rename = "projectId")]
    pub project_id: String,

    #[serde(rename = "documentKind")]
    pub document_kind: String,

    pub title: String,

    pub slug: String,

    #[serde(rename = "bodyRef")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body_ref: Option<String>,

    pub status: String,
}
