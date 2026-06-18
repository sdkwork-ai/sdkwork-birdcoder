use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderIamVerificationPolicySummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamRuntimeSettingsSummary {
    #[serde(rename = "leftRailMode")]
    pub left_rail_mode: String,

    #[serde(rename = "loginMethods")]
    pub login_methods: Vec<String>,

    #[serde(rename = "oauthLoginEnabled")]
    pub oauth_login_enabled: bool,

    #[serde(rename = "oauthProviders")]
    pub oauth_providers: Vec<String>,

    #[serde(rename = "qrLoginEnabled")]
    pub qr_login_enabled: bool,

    #[serde(rename = "qrLoginType")]
    pub qr_login_type: String,

    #[serde(rename = "recoveryMethods")]
    pub recovery_methods: Vec<String>,

    #[serde(rename = "registerMethods")]
    pub register_methods: Vec<String>,

    #[serde(rename = "verificationPolicy")]
    pub verification_policy: BirdCoderIamVerificationPolicySummary,
}
