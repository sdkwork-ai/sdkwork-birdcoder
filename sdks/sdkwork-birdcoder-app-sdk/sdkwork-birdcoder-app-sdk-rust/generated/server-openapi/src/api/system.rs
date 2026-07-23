use std::sync::Arc;

use crate::api::paths::app_path;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderApplicationDescriptor, BirdCoderCoreHealthSummary, BirdCoderCoreRuntimeSummary};

#[derive(Clone)]
pub struct SystemApi {
    client: Arc<SdkworkHttpClient>,
}

impl SystemApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// Get BirdCoder application descriptor
    pub async fn descriptor_retrieve(&self) -> Result<BirdCoderApplicationDescriptor, SdkworkError> {
        let path = app_path(&"/system/descriptor".to_string());
        self.client.get(&path, None, None).await
    }

    /// Get BirdCoder application health
    pub async fn health_retrieve(&self) -> Result<BirdCoderCoreHealthSummary, SdkworkError> {
        let path = app_path(&"/system/health".to_string());
        self.client.get(&path, None, None).await
    }

    /// List unified API routes
    pub async fn routes_list(&self) -> Result<serde_json::Value, SdkworkError> {
        let path = app_path(&"/system/routes".to_string());
        self.client.get(&path, None, None).await
    }

    /// Get runtime metadata
    pub async fn runtime_retrieve(&self) -> Result<BirdCoderCoreRuntimeSummary, SdkworkError> {
        let path = app_path(&"/system/runtime".to_string());
        self.client.get(&path, None, None).await
    }

}
