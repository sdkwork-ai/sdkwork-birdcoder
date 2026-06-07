use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderUpdateCurrentUserProfileRequest {
    #[serde(rename = "avatarUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bio: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,

    #[serde(rename = "displayName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
}
