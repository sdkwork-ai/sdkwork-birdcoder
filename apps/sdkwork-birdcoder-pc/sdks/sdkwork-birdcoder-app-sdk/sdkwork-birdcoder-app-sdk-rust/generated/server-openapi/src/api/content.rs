use std::sync::Arc;

use crate::api::paths::app_path;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderProjectDocumentSummaryListEnvelope};

#[derive(Clone)]
pub struct ContentApi {
    client: Arc<SdkworkHttpClient>,
}

impl ContentApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// List project documents
    pub async fn documents_list(&self) -> Result<BirdCoderProjectDocumentSummaryListEnvelope, SdkworkError> {
        let path = app_path(&"/documents".to_string());
        self.client.get(&path, None, None).await
    }

}
