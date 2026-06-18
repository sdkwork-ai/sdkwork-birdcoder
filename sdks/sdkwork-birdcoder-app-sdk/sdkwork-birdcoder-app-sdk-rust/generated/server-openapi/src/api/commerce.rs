use std::sync::Arc;

use crate::api::paths::app_path;
use crate::http::{SdkworkError, SdkworkHttpClient};
use crate::models::{BirdCoderCommerceMembershipCurrentEnvelope, BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope};

#[derive(Clone)]
pub struct CommerceApi {
    client: Arc<SdkworkHttpClient>,
}

impl CommerceApi {
    pub fn new(client: Arc<SdkworkHttpClient>) -> Self {
        Self { client }
    }

    /// Get current SDKWork commerce membership
    pub async fn memberships_current_retrieve(&self) -> Result<BirdCoderCommerceMembershipCurrentEnvelope, SdkworkError> {
        let path = app_path(&"/memberships/current".to_string());
        self.client.get(&path, None, None).await
    }

    /// List SDKWork commerce membership package groups
    pub async fn memberships_package_groups_list(&self) -> Result<BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope, SdkworkError> {
        let path = app_path(&"/memberships/package_groups".to_string());
        self.client.get(&path, None, None).await
    }

}
