use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamRefreshSessionRequest {
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
}
