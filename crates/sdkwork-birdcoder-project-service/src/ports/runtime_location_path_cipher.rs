use sdkwork_utils_rust::{
    aes_gcm_decrypt, aes_gcm_encrypt, derive_aes_256_key, hmac_sha256, is_blank,
};

use crate::context::ProjectContext;
use crate::domain::runtime_location::{PATH_FLAVOR_POSIX, PATH_FLAVOR_WINDOWS};
use crate::error::ProjectError;

const PATH_ENCRYPTION_SALT: &[u8] = b"sdkwork-birdcoder/project-runtime-location/v1";
const PATH_ENCRYPTION_INFO_PREFIX: &str = "absolute-path";
const PATH_FINGERPRINT_INFO_PREFIX: &str = "path-fingerprint";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuntimeLocationPathFingerprintScope {
    pub project_id: String,
    pub runtime_target_id: String,
    pub path_flavor: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EncryptedRuntimeLocationPath {
    pub ciphertext: String,
    pub encryption_key_id: String,
    pub fingerprint: String,
}

/// Encryption boundary for persisted project roots. The database receives only
/// ciphertext, key id, and a scoped duplicate-detection fingerprint. The
/// fingerprint key is intentionally independent from the location UUID so the
/// same active project root on the same target produces one stable value.
pub trait RuntimeLocationPathCipher: Send + Sync {
    fn encrypt(
        &self,
        context: &ProjectContext,
        location_uuid: &str,
        fingerprint_scope: &RuntimeLocationPathFingerprintScope,
        absolute_path: &str,
    ) -> Result<EncryptedRuntimeLocationPath, ProjectError>;

    fn decrypt(
        &self,
        context: &ProjectContext,
        location_uuid: &str,
        encryption_key_id: &str,
        ciphertext: &str,
    ) -> Result<String, ProjectError>;
}

/// AES-256-GCM implementation using an application master secret. Encryption
/// keys are per tenant/organization/location. Fingerprint keys are per
/// tenant/organization/project/target/path-flavor so they are useful for
/// uniqueness without allowing a ciphertext to move between locations.
#[derive(Clone, Debug)]
pub struct AesGcmRuntimeLocationPathCipher {
    master_secret: Vec<u8>,
    key_id: String,
}

impl AesGcmRuntimeLocationPathCipher {
    pub fn new(
        master_secret: impl AsRef<[u8]>,
        key_id: impl Into<String>,
    ) -> Result<Self, ProjectError> {
        let master_secret = master_secret.as_ref();
        let key_id = key_id.into();
        if master_secret.len() < 32 || is_blank(Some(key_id.as_str())) {
            return Err(ProjectError::Unavailable(
                "Project runtime-location path encryption is unavailable.".to_owned(),
            ));
        }
        Ok(Self {
            master_secret: master_secret.to_vec(),
            key_id,
        })
    }

    fn derive_encryption_key(
        &self,
        context: &ProjectContext,
        location_uuid: &str,
    ) -> Result<[u8; 32], ProjectError> {
        require_context_scope(context)?;
        if is_blank(Some(location_uuid)) {
            return Err(unavailable_cipher_error());
        }
        let info = format!(
            "{PATH_ENCRYPTION_INFO_PREFIX}/tenant/{}/organization/{}/location/{location_uuid}",
            context.tenant_id, context.organization_id,
        );
        Ok(derive_aes_256_key(
            &self.master_secret,
            PATH_ENCRYPTION_SALT,
            info.as_bytes(),
        ))
    }

    fn derive_fingerprint_key(
        &self,
        context: &ProjectContext,
        scope: &RuntimeLocationPathFingerprintScope,
    ) -> Result<[u8; 32], ProjectError> {
        require_context_scope(context)?;
        if is_blank(Some(scope.project_id.as_str()))
            || is_blank(Some(scope.runtime_target_id.as_str()))
            || !matches!(
                scope.path_flavor.as_str(),
                PATH_FLAVOR_WINDOWS | PATH_FLAVOR_POSIX
            )
        {
            return Err(unavailable_cipher_error());
        }
        let info = format!(
            "{PATH_FINGERPRINT_INFO_PREFIX}/tenant/{}/organization/{}/project/{}/target/{}/path-flavor/{}",
            context.tenant_id,
            context.organization_id,
            scope.project_id,
            scope.runtime_target_id,
            scope.path_flavor,
        );
        Ok(derive_aes_256_key(
            &self.master_secret,
            PATH_ENCRYPTION_SALT,
            info.as_bytes(),
        ))
    }
}

impl RuntimeLocationPathCipher for AesGcmRuntimeLocationPathCipher {
    fn encrypt(
        &self,
        context: &ProjectContext,
        location_uuid: &str,
        fingerprint_scope: &RuntimeLocationPathFingerprintScope,
        absolute_path: &str,
    ) -> Result<EncryptedRuntimeLocationPath, ProjectError> {
        let normalized_path =
            normalize_absolute_path(absolute_path, &fingerprint_scope.path_flavor)?;
        let encryption_key = self.derive_encryption_key(context, location_uuid)?;
        let fingerprint_key = self.derive_fingerprint_key(context, fingerprint_scope)?;
        let fingerprint_path = if fingerprint_scope.path_flavor == PATH_FLAVOR_WINDOWS {
            normalized_path.to_ascii_lowercase()
        } else {
            normalized_path.clone()
        };
        let ciphertext = aes_gcm_encrypt(&encryption_key, normalized_path.as_bytes())
            .map_err(|_| unavailable_cipher_error())?;
        Ok(EncryptedRuntimeLocationPath {
            ciphertext,
            encryption_key_id: self.key_id.clone(),
            // HMAC, rather than a bare digest, avoids turning a common path
            // dictionary into an offline fingerprint oracle.
            fingerprint: hmac_sha256(fingerprint_path.as_bytes(), &fingerprint_key),
        })
    }

    fn decrypt(
        &self,
        context: &ProjectContext,
        location_uuid: &str,
        encryption_key_id: &str,
        ciphertext: &str,
    ) -> Result<String, ProjectError> {
        if encryption_key_id != self.key_id {
            return Err(unavailable_cipher_error());
        }
        let encryption_key = self.derive_encryption_key(context, location_uuid)?;
        let plaintext =
            aes_gcm_decrypt(&encryption_key, ciphertext).map_err(|_| unavailable_cipher_error())?;
        String::from_utf8(plaintext).map_err(|_| unavailable_cipher_error())
    }
}

fn require_context_scope(context: &ProjectContext) -> Result<(), ProjectError> {
    if is_blank(Some(context.tenant_id.as_str()))
        || is_blank(Some(context.organization_id.as_str()))
    {
        return Err(unavailable_cipher_error());
    }
    Ok(())
}

fn unavailable_cipher_error() -> ProjectError {
    ProjectError::Unavailable("Project runtime-location path encryption is unavailable.".to_owned())
}

/// Normalize only the cross-platform lexical form needed to make duplicate
/// detection stable. The trusted target still canonicalizes and verifies the
/// path before executing against it.
pub fn normalize_absolute_path(
    absolute_path: &str,
    path_flavor: &str,
) -> Result<String, ProjectError> {
    let path = absolute_path.trim();
    if path.is_empty() || path.len() > 4096 || path.bytes().any(|byte| byte == 0 || byte < 0x20) {
        return Err(ProjectError::InvalidInput(
            "absolutePath must be a valid absolute path.".to_owned(),
        ));
    }

    match path_flavor {
        PATH_FLAVOR_WINDOWS => normalize_windows_path(path),
        PATH_FLAVOR_POSIX => normalize_posix_path(path),
        _ => Err(ProjectError::InvalidInput(
            "pathFlavor must be windows or posix.".to_owned(),
        )),
    }
}

fn normalize_windows_path(path: &str) -> Result<String, ProjectError> {
    let normalized = path.replace('/', "\\");
    let bytes = normalized.as_bytes();
    let is_drive_absolute =
        bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\';
    let is_unc = normalized.starts_with("\\\\");
    if !is_drive_absolute && !is_unc {
        return Err(ProjectError::InvalidInput(
            "absolutePath must be a valid absolute path.".to_owned(),
        ));
    }

    let (prefix, rest) = if is_unc {
        ("\\\\", normalized.trim_start_matches('\\'))
    } else {
        (&normalized[..3], &normalized[3..])
    };
    let segments = normalize_segments(rest.split('\\'))?;
    if is_unc && segments.len() < 2 {
        return Err(ProjectError::InvalidInput(
            "absolutePath must be a valid absolute path.".to_owned(),
        ));
    }
    let suffix = segments.join("\\");
    let canonical = if is_unc {
        format!("{prefix}{suffix}")
    } else if suffix.is_empty() {
        prefix.to_owned()
    } else {
        format!("{prefix}{suffix}")
    };
    // Windows path identity is case-insensitive for the supported desktop
    // target contract. Store readable normalized text, but fingerprint its
    // lower-case form through the caller's HMAC key.
    Ok(canonical)
}

fn normalize_posix_path(path: &str) -> Result<String, ProjectError> {
    if !path.starts_with('/') {
        return Err(ProjectError::InvalidInput(
            "absolutePath must be a valid absolute path.".to_owned(),
        ));
    }
    let segments = normalize_segments(path.split('/'))?;
    if segments.is_empty() {
        Ok("/".to_owned())
    } else {
        Ok(format!("/{}", segments.join("/")))
    }
}

fn normalize_segments<'a>(
    segments: impl Iterator<Item = &'a str>,
) -> Result<Vec<&'a str>, ProjectError> {
    let mut normalized = Vec::new();
    for segment in segments {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            return Err(ProjectError::InvalidInput(
                "absolutePath must not contain parent traversal.".to_owned(),
            ));
        }
        normalized.push(segment);
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::{
        AesGcmRuntimeLocationPathCipher, RuntimeLocationPathCipher,
        RuntimeLocationPathFingerprintScope,
    };
    use crate::context::ProjectContext;

    fn context(tenant_id: &str, organization_id: &str) -> ProjectContext {
        ProjectContext {
            tenant_id: tenant_id.to_owned(),
            organization_id: organization_id.to_owned(),
            user_id: "200001".to_owned(),
        }
    }

    fn scope(project_id: &str, runtime_target_id: &str) -> RuntimeLocationPathFingerprintScope {
        RuntimeLocationPathFingerprintScope {
            project_id: project_id.to_owned(),
            runtime_target_id: runtime_target_id.to_owned(),
            path_flavor: "windows".to_owned(),
        }
    }

    #[test]
    fn cipher_encrypts_and_decrypts_a_tenant_scoped_path() {
        let cipher = AesGcmRuntimeLocationPathCipher::new(
            "test-master-secret-must-have-at-least-thirty-two-bytes",
            "test-key-v1",
        )
        .expect("construct cipher");
        let encrypted = cipher
            .encrypt(
                &context("100001", "0"),
                "location-a",
                &scope("300001", "desktop-a"),
                "E:\\workspace\\project",
            )
            .expect("encrypt path");

        assert_ne!(encrypted.ciphertext, "E:\\workspace\\project");
        assert_eq!(encrypted.fingerprint.len(), 64);
        assert_eq!(
            cipher
                .decrypt(
                    &context("100001", "0"),
                    "location-a",
                    &encrypted.encryption_key_id,
                    &encrypted.ciphertext,
                )
                .expect("decrypt path"),
            "E:\\workspace\\project"
        );
        assert!(cipher
            .decrypt(
                &context("100002", "0"),
                "location-a",
                &encrypted.encryption_key_id,
                &encrypted.ciphertext,
            )
            .is_err());
    }

    #[test]
    fn fingerprint_is_stable_across_location_ids_but_scoped_to_target_and_project() {
        let cipher = AesGcmRuntimeLocationPathCipher::new(
            "test-master-secret-must-have-at-least-thirty-two-bytes",
            "test-key-v1",
        )
        .expect("construct cipher");
        let ctx = context("100001", "0");
        let first = cipher
            .encrypt(
                &ctx,
                "location-a",
                &scope("300001", "desktop-a"),
                "E:/workspace/project",
            )
            .expect("first encrypt");
        let same_path_other_location = cipher
            .encrypt(
                &ctx,
                "location-b",
                &scope("300001", "desktop-a"),
                "E:\\workspace\\project",
            )
            .expect("second encrypt");
        let different_target = cipher
            .encrypt(
                &ctx,
                "location-c",
                &scope("300001", "desktop-b"),
                "E:\\workspace\\project",
            )
            .expect("third encrypt");
        let different_project = cipher
            .encrypt(
                &ctx,
                "location-d",
                &scope("300002", "desktop-a"),
                "E:\\workspace\\project",
            )
            .expect("fourth encrypt");

        assert_ne!(first.ciphertext, same_path_other_location.ciphertext);
        assert_eq!(first.fingerprint, same_path_other_location.fingerprint);
        assert_ne!(first.fingerprint, different_target.fingerprint);
        assert_ne!(first.fingerprint, different_project.fingerprint);
    }
}
