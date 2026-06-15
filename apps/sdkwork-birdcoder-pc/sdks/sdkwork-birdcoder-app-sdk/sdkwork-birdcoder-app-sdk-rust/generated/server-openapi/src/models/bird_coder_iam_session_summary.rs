use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderAuthenticatedUserSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamSessionSummary {
    #[serde(rename = "accessToken")]
    pub access_token: String,

    #[serde(rename = "authToken")]
    pub auth_token: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<std::collections::HashMap<String, serde_json::Value>>,

    #[serde(rename = "expiresAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,

    #[serde(rename = "refreshToken")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,

    #[serde(rename = "sessionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<BirdCoderAuthenticatedUserSummary>,
}
