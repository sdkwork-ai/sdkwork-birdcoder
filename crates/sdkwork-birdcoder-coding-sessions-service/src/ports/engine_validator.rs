use crate::domain::models::AuthoritativeEngineRuntimeProfile;
use crate::error::CodingSessionError;

#[async_trait::async_trait]
pub trait EngineValidator: Send + Sync {
    fn validate_engine_runtime_profile(
        &self,
        engine_id: &str,
        host_mode: &str,
    ) -> Result<AuthoritativeEngineRuntimeProfile, CodingSessionError>;
}
