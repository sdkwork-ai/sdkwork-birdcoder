use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderUpsertProjectCollaboratorRequest {
    #[serde(rename = "userId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,

    #[serde(rename = "teamId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdByUserId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by_user_id: Option<String>,

    #[serde(rename = "grantedByUserId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub granted_by_user_id: Option<String>,
}
