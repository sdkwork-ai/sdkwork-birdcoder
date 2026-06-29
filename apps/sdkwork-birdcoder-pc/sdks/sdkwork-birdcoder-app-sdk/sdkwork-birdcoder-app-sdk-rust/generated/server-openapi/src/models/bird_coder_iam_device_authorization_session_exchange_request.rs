use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamDeviceAuthorizationSessionExchangeRequest {
    #[serde(rename = "pollSecret")]
    pub poll_secret: String,
}
