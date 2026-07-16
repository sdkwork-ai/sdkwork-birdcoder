use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectRuntimeLocationPreference {
    pub id: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    #[serde(rename = "subjectUserId")]
    pub subject_user_id: String,

    pub capability: String,

    #[serde(rename = "runtimeLocationId")]
    pub runtime_location_id: String,

    /// Optimistic concurrency version used with the If-Match request header.
    pub version: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
