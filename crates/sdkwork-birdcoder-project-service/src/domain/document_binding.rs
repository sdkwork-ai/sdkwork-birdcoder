use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpsertProjectDocumentBindingRequest {
    pub document_id: String,
    pub binding_kind: String,
}

#[derive(Clone, Debug)]
pub struct NewProjectDocumentBinding {
    pub project_id: String,
    pub document_id: String,
    pub binding_kind: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDocumentBindingPayload {
    pub id: String,
    pub uuid: String,
    pub project_id: String,
    pub document_id: String,
    pub binding_kind: String,
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
}
