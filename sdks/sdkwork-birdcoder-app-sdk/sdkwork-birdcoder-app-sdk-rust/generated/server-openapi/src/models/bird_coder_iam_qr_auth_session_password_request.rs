use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamQrAuthSessionPasswordRequest {
    pub password: String,

    pub username: String,
}
