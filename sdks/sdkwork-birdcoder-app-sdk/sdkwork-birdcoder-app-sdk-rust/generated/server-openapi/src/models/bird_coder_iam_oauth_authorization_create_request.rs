use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamOAuthAuthorizationCreateRequest {
    pub provider: String,

    #[serde(rename = "redirectUri")]
    pub redirect_uri: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
}
