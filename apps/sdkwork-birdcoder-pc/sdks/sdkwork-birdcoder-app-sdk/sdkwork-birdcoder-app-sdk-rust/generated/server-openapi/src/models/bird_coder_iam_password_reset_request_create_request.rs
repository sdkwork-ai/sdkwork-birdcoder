use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamPasswordResetRequestCreateRequest {
    pub account: String,

    pub channel: String,
}
