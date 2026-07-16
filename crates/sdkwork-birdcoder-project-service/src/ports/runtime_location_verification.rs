use crate::context::ProjectContext;
use crate::domain::runtime_location::{
    StoredProjectRuntimeLocation, TrustedProjectRuntimeLocationVerification,
};
use crate::error::ProjectError;

/// A trusted runtime target proves ownership before a location can become
/// executable. User-facing app APIs must not substitute for this boundary.
pub trait RuntimeLocationVerificationAuthority: Send + Sync {
    fn authorize_verification(
        &self,
        context: &ProjectContext,
        location: &StoredProjectRuntimeLocation,
        verification: &TrustedProjectRuntimeLocationVerification,
    ) -> Result<(), ProjectError>;
}

/// Queues a verification request to a target control plane. The app-api only
/// requests work; it cannot include target-observed health, capability, Git,
/// or filesystem facts in that request.
#[async_trait::async_trait]
pub trait RuntimeLocationVerificationRequestDispatcher: Send + Sync {
    async fn request_verification(
        &self,
        context: &ProjectContext,
        location: &StoredProjectRuntimeLocation,
        expected_version: i64,
    ) -> Result<(), ProjectError>;
}

/// Safe default for deployments that have not yet registered a mutually
/// authenticated runtime target control plane.
#[derive(Clone, Default)]
pub struct DenyRuntimeLocationVerificationAuthority;

impl RuntimeLocationVerificationAuthority for DenyRuntimeLocationVerificationAuthority {
    fn authorize_verification(
        &self,
        _context: &ProjectContext,
        _location: &StoredProjectRuntimeLocation,
        _verification: &TrustedProjectRuntimeLocationVerification,
    ) -> Result<(), ProjectError> {
        Err(ProjectError::Unavailable(
            "Project runtime-location verification is unavailable.".to_owned(),
        ))
    }
}

#[derive(Clone, Default)]
pub struct DenyRuntimeLocationVerificationRequestDispatcher;

#[async_trait::async_trait]
impl RuntimeLocationVerificationRequestDispatcher
    for DenyRuntimeLocationVerificationRequestDispatcher
{
    async fn request_verification(
        &self,
        _context: &ProjectContext,
        _location: &StoredProjectRuntimeLocation,
        _expected_version: i64,
    ) -> Result<(), ProjectError> {
        Err(ProjectError::Unavailable(
            "Project runtime-location verification is unavailable.".to_owned(),
        ))
    }
}
