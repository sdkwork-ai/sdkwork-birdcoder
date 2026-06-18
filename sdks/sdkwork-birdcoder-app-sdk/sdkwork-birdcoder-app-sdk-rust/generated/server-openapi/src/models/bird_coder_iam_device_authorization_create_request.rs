use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamDeviceAuthorizationCreateRequest {
    pub purpose: String,

    #[serde(rename = "redirectUri")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub redirect_uri: Option<String>,
}
