use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateIamUserRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,

    pub email: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    pub password: String,

    #[serde(rename = "displayName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,

    #[serde(rename = "avatarUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}
