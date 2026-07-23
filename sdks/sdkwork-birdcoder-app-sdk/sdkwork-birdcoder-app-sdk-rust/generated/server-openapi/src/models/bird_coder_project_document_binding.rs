use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectDocumentBinding {
    pub id: String,

    pub uuid: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    /// Stable sdkwork-documents identifier; no cross-domain foreign key is created.
    #[serde(rename = "documentId")]
    pub document_id: String,

    /// Lower-snake-case binding purpose.
    #[serde(rename = "bindingKind")]
    pub binding_kind: String,

    /// Optimistic concurrency version used with the If-Match request header.
    pub version: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
