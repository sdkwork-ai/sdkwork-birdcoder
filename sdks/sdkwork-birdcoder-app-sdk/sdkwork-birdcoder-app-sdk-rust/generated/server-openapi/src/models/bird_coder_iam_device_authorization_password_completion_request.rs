use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamDeviceAuthorizationPasswordCompletionRequest {
    pub password: String,

    pub username: String,
}
