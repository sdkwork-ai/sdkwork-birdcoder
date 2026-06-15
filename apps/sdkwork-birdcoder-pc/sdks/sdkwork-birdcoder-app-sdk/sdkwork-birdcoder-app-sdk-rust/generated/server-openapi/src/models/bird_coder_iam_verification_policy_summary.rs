use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamVerificationPolicySummary {
    #[serde(rename = "emailCodeLoginEnabled")]
    pub email_code_login_enabled: bool,

    #[serde(rename = "emailRegistrationVerificationRequired")]
    pub email_registration_verification_required: bool,

    #[serde(rename = "phoneCodeLoginEnabled")]
    pub phone_code_login_enabled: bool,

    #[serde(rename = "phoneRegistrationVerificationRequired")]
    pub phone_registration_verification_required: bool,
}
