use std::sync::Arc;

use crate::api::{IntelligenceApi, SystemApi, RuntimeApi, AuthApi, IamApi, OpenPlatformApi, TemplatesApi, PlatformApi, ContentApi, SkillsApi, CollaborationApi, CommerceApi};
use crate::http::{SdkworkConfig, SdkworkError, SdkworkHttpClient};

#[derive(Clone)]
pub struct SdkworkAppClient {
    http: Arc<SdkworkHttpClient>,
}

impl SdkworkAppClient {
    pub fn new(config: SdkworkConfig) -> Result<Self, SdkworkError> {
        Ok(Self {
            http: Arc::new(SdkworkHttpClient::new(config)?),
        })
    }

    pub fn new_with_base_url(base_url: impl Into<String>) -> Result<Self, SdkworkError> {
        Self::new(SdkworkConfig::new(base_url))
    }

    pub fn set_api_key(&self, api_key: impl Into<String>) -> &Self {
        self.http.set_api_key(api_key);
        self
    }

    pub fn set_auth_token(&self, token: impl Into<String>) -> &Self {
        self.http.set_auth_token(token);
        self
    }

    pub fn set_access_token(&self, token: impl Into<String>) -> &Self {
        self.http.set_access_token(token);
        self
    }

    pub fn set_header(&self, key: impl Into<String>, value: impl Into<String>) -> &Self {
        self.http.set_header(key, value);
        self
    }

    pub fn http_client(&self) -> Arc<SdkworkHttpClient> {
        Arc::clone(&self.http)
    }

    pub fn intelligence(&self) -> IntelligenceApi {
            IntelligenceApi::new(Arc::clone(&self.http))
        }

    pub fn system(&self) -> SystemApi {
            SystemApi::new(Arc::clone(&self.http))
        }

    pub fn runtime(&self) -> RuntimeApi {
            RuntimeApi::new(Arc::clone(&self.http))
        }

    pub fn auth(&self) -> AuthApi {
            AuthApi::new(Arc::clone(&self.http))
        }

    pub fn iam(&self) -> IamApi {
            IamApi::new(Arc::clone(&self.http))
        }

    pub fn open_platform(&self) -> OpenPlatformApi {
            OpenPlatformApi::new(Arc::clone(&self.http))
        }

    pub fn templates(&self) -> TemplatesApi {
            TemplatesApi::new(Arc::clone(&self.http))
        }

    pub fn platform(&self) -> PlatformApi {
            PlatformApi::new(Arc::clone(&self.http))
        }

    pub fn content(&self) -> ContentApi {
            ContentApi::new(Arc::clone(&self.http))
        }

    pub fn skills(&self) -> SkillsApi {
            SkillsApi::new(Arc::clone(&self.http))
        }

    pub fn collaboration(&self) -> CollaborationApi {
            CollaborationApi::new(Arc::clone(&self.http))
        }

    pub fn commerce(&self) -> CommerceApi {
            CommerceApi::new(Arc::clone(&self.http))
        }
}
