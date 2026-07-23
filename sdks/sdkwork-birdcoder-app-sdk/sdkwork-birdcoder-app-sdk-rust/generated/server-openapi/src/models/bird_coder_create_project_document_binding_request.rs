use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateProjectDocumentBindingRequest {
    /// Stable sdkwork-documents identifier.
    #[serde(rename = "documentId")]
    pub document_id: String,

    /// Lower-snake-case binding purpose.
    #[serde(rename = "bindingKind")]
    pub binding_kind: String,
}
