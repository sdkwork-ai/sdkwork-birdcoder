use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderUpsertProjectCollaboratorRequest {
    #[serde(rename = "userId")]
    pub user_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}
