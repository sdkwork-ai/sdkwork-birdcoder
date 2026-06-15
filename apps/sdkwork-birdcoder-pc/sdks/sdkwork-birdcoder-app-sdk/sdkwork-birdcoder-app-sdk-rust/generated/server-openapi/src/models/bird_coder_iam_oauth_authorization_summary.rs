use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamOAuthAuthorizationSummary {
    #[serde(rename = "authUrl")]
    pub auth_url: String,
}
