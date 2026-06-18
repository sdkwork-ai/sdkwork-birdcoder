use std::sync::Arc;

use crate::api::paths::app_path;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderBooleanSuccessEnvelope, BirdCoderIamCreateSessionRequest, BirdCoderIamPasswordResetCreateRequest, BirdCoderIamPasswordResetRequestCreateRequest, BirdCoderIamRefreshSessionRequest, BirdCoderIamRegistrationCreateRequest, BirdCoderIamSessionEnvelope, BirdCoderIamUpdateCurrentSessionRequest};

#[derive(Clone)]
pub struct AuthApi {
    client: Arc<SdkworkHttpClient>,
}

impl AuthApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// Create SDKWork IAM password reset request
    pub async fn password_reset_requests_create(&self, body: &BirdCoderIamPasswordResetRequestCreateRequest) -> Result<BirdCoderBooleanSuccessEnvelope, SdkworkError> {
        let path = app_path(&"/auth/password_reset_requests".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Reset SDKWork IAM password
    pub async fn password_resets_create(&self, body: &BirdCoderIamPasswordResetCreateRequest) -> Result<BirdCoderBooleanSuccessEnvelope, SdkworkError> {
        let path = app_path(&"/auth/password_resets".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Register SDKWork IAM user
    pub async fn registrations_create(&self, body: &BirdCoderIamRegistrationCreateRequest) -> Result<BirdCoderIamSessionEnvelope, SdkworkError> {
        let path = app_path(&"/auth/registrations".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Create SDKWork IAM session
    pub async fn sessions_create(&self, body: &BirdCoderIamCreateSessionRequest) -> Result<BirdCoderIamSessionEnvelope, SdkworkError> {
        let path = app_path(&"/auth/sessions".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Get current SDKWork IAM session
    pub async fn sessions_current_retrieve(&self) -> Result<BirdCoderIamSessionEnvelope, SdkworkError> {
        let path = app_path(&"/auth/sessions/current".to_string());
        self.client.get(&path, None, None).await
    }

    /// Update current SDKWork IAM session
    pub async fn sessions_current_update(&self, body: &BirdCoderIamUpdateCurrentSessionRequest) -> Result<BirdCoderIamSessionEnvelope, SdkworkError> {
        let path = app_path(&"/auth/sessions/current".to_string());
        self.client.patch(&path, Some(body), None, None, Some("application/json")).await
    }

    /// Delete current SDKWork IAM session
    pub async fn sessions_current_delete(&self) -> Result<BirdCoderBooleanSuccessEnvelope, SdkworkError> {
        let path = app_path(&"/auth/sessions/current".to_string());
        self.client.delete(&path, None, None).await
    }

    /// Refresh SDKWork IAM session
    pub async fn sessions_refresh(&self, body: &BirdCoderIamRefreshSessionRequest) -> Result<BirdCoderIamSessionEnvelope, SdkworkError> {
        let path = app_path(&"/auth/sessions/refresh".to_string());
        self.client.post(&path, Some(body), None, None, Some("application/json")).await
    }

}
