use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderOperationDescriptor {
    #[serde(rename = "operationId")]
    pub operation_id: String,

    pub status: String,

    #[serde(rename = "artifactRefs")]
    pub artifact_refs: Vec<String>,

    #[serde(rename = "streamUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stream_url: Option<String>,

    #[serde(rename = "streamKind")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stream_kind: Option<String>,
}
