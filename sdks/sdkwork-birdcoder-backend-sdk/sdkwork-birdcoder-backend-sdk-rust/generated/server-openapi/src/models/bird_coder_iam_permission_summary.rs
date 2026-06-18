use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamPermissionSummary {
    pub id: String,

    pub code: String,

    pub name: String,

    pub resource: String,

    pub action: String,

    #[serde(rename = "createdAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}
