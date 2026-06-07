use std::sync::Arc;

use crate::api::paths::app_path;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderAppTemplateSummaryListEnvelope};

#[derive(Clone)]
pub struct TemplatesApi {
    client: Arc<SdkworkHttpClient>,
}

impl TemplatesApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// List app templates
    pub async fn app_templates_list(&self) -> Result<BirdCoderAppTemplateSummaryListEnvelope, SdkworkError> {
        let path = app_path(&"/app_templates".to_string());
        self.client.get(&path, None, None).await
    }

}
