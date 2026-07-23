use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fmt::{Display, Formatter};
use std::sync::{Mutex, MutexGuard};

const CREDENTIAL_SERVICE: &str = "com.sdkwork.birdcoder.desktop.session";
const ACTIVE_SLOT_ACCOUNT: &str = "session.v1.active";
const MAX_SESSION_BYTES: usize = 128 * 1024;
const MAX_CHUNK_COUNT: usize = 64;
const SECRET_CHUNK_BYTES: usize = 2 * 1024;
const SESSION_SCHEMA_VERSION: u8 = 1;
const CLEAN_SLOT_MARKER: &[u8] = b"1";
static CREDENTIAL_OPERATION_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SessionSlot {
    A,
    B,
}

impl SessionSlot {
    fn as_bytes(self) -> &'static [u8] {
        match self {
            Self::A => b"a",
            Self::B => b"b",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::A => "a",
            Self::B => "b",
        }
    }

    fn other(self) -> Self {
        match self {
            Self::A => Self::B,
            Self::B => Self::A,
        }
    }

    fn parse(value: &[u8]) -> Result<Self, SecureAppSessionStoreError> {
        match value {
            b"a" => Ok(Self::A),
            b"b" => Ok(Self::B),
            _ => Err(SecureAppSessionStoreError::CorruptCredential),
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SlotManifest {
    schema_version: u8,
    byte_length: usize,
    chunk_count: usize,
    sha256: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecureAppSessionStoreError {
    CredentialStoreUnavailable,
    CorruptCredential,
    InvalidSessionPayload,
    SessionPayloadTooLarge,
}

impl Display for SecureAppSessionStoreError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        let message = match self {
            Self::CredentialStoreUnavailable => {
                "the operating-system credential store is unavailable"
            }
            Self::CorruptCredential => "the stored application session is invalid",
            Self::InvalidSessionPayload => "the application session payload is invalid",
            Self::SessionPayloadTooLarge => "the application session payload exceeds its limit",
        };
        formatter.write_str(message)
    }
}

impl std::error::Error for SecureAppSessionStoreError {}

trait CredentialSecretStore {
    fn read(&self, account: &str) -> Result<Option<Vec<u8>>, SecureAppSessionStoreError>;
    fn write(&self, account: &str, value: &[u8]) -> Result<(), SecureAppSessionStoreError>;
    fn delete(&self, account: &str) -> Result<(), SecureAppSessionStoreError>;
}

#[derive(Debug, Default)]
struct OsCredentialSecretStore;

impl OsCredentialSecretStore {
    fn entry(account: &str) -> Result<Entry, SecureAppSessionStoreError> {
        Entry::new(CREDENTIAL_SERVICE, account)
            .map_err(|_| SecureAppSessionStoreError::CredentialStoreUnavailable)
    }
}

impl CredentialSecretStore for OsCredentialSecretStore {
    fn read(&self, account: &str) -> Result<Option<Vec<u8>>, SecureAppSessionStoreError> {
        match Self::entry(account)?.get_secret() {
            Ok(value) => Ok(Some(value)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(_) => Err(SecureAppSessionStoreError::CredentialStoreUnavailable),
        }
    }

    fn write(&self, account: &str, value: &[u8]) -> Result<(), SecureAppSessionStoreError> {
        Self::entry(account)?
            .set_secret(value)
            .map_err(|_| SecureAppSessionStoreError::CredentialStoreUnavailable)
    }

    fn delete(&self, account: &str) -> Result<(), SecureAppSessionStoreError> {
        match Self::entry(account)?.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(_) => Err(SecureAppSessionStoreError::CredentialStoreUnavailable),
        }
    }
}

struct SecureAppSessionStore<S> {
    credentials: S,
}

impl<S: CredentialSecretStore> SecureAppSessionStore<S> {
    fn new(credentials: S) -> Self {
        Self { credentials }
    }

    fn read(&self) -> Result<Option<String>, SecureAppSessionStoreError> {
        let Some(active_slot) = self.read_active_slot()? else {
            return Ok(None);
        };
        self.read_slot(active_slot).map(Some)
    }

    fn write(&self, raw: &str) -> Result<(), SecureAppSessionStoreError> {
        validate_session_payload(raw)?;
        let bytes = raw.as_bytes();
        if bytes.len() > MAX_SESSION_BYTES {
            return Err(SecureAppSessionStoreError::SessionPayloadTooLarge);
        }

        let previous_slot = self.read_active_slot()?;
        // Removing the pointer first prevents a failed account switch or token
        // rotation from restoring stale credentials on the next launch.
        self.credentials.delete(ACTIVE_SLOT_ACCOUNT)?;
        let target_slot = previous_slot
            .map(SessionSlot::other)
            .unwrap_or(SessionSlot::A);
        self.cleanup_slot(target_slot)?;
        self.credentials
            .delete(&clean_marker_account(target_slot))?;

        let chunks = bytes.chunks(SECRET_CHUNK_BYTES).collect::<Vec<_>>();
        if chunks.is_empty() || chunks.len() > MAX_CHUNK_COUNT {
            return Err(SecureAppSessionStoreError::SessionPayloadTooLarge);
        }
        let manifest = SlotManifest {
            schema_version: SESSION_SCHEMA_VERSION,
            byte_length: bytes.len(),
            chunk_count: chunks.len(),
            sha256: hex::encode(Sha256::digest(bytes)),
        };
        let manifest_bytes = serde_json::to_vec(&manifest)
            .map_err(|_| SecureAppSessionStoreError::InvalidSessionPayload)?;

        self.credentials
            .write(&manifest_account(target_slot), &manifest_bytes)?;
        for (index, chunk) in chunks.into_iter().enumerate() {
            if let Err(error) = self
                .credentials
                .write(&chunk_account(target_slot, index), chunk)
            {
                let _ = self.cleanup_slot(target_slot);
                return Err(error);
            }
        }

        if self.read_slot(target_slot)? != raw {
            let _ = self.cleanup_slot(target_slot);
            return Err(SecureAppSessionStoreError::CorruptCredential);
        }
        if let Err(error) = self
            .credentials
            .write(ACTIVE_SLOT_ACCOUNT, target_slot.as_bytes())
        {
            let _ = self.cleanup_slot(target_slot);
            return Err(error);
        }

        if let Some(previous_slot) = previous_slot {
            if previous_slot != target_slot {
                self.cleanup_slot(previous_slot)?;
            }
        }
        Ok(())
    }

    fn delete(&self) -> Result<(), SecureAppSessionStoreError> {
        self.credentials.delete(ACTIVE_SLOT_ACCOUNT)?;
        let first_result = self.purge_slot(SessionSlot::A);
        let second_result = self.purge_slot(SessionSlot::B);
        first_result.and(second_result)
    }

    fn read_active_slot(&self) -> Result<Option<SessionSlot>, SecureAppSessionStoreError> {
        self.credentials
            .read(ACTIVE_SLOT_ACCOUNT)?
            .map(|value| SessionSlot::parse(&value))
            .transpose()
    }

    fn read_slot(&self, slot: SessionSlot) -> Result<String, SecureAppSessionStoreError> {
        let manifest_bytes = self
            .credentials
            .read(&manifest_account(slot))?
            .ok_or(SecureAppSessionStoreError::CorruptCredential)?;
        let manifest: SlotManifest = serde_json::from_slice(&manifest_bytes)
            .map_err(|_| SecureAppSessionStoreError::CorruptCredential)?;
        if manifest.schema_version != SESSION_SCHEMA_VERSION
            || manifest.byte_length == 0
            || manifest.byte_length > MAX_SESSION_BYTES
            || manifest.chunk_count == 0
            || manifest.chunk_count > MAX_CHUNK_COUNT
        {
            return Err(SecureAppSessionStoreError::CorruptCredential);
        }

        let mut bytes = Vec::with_capacity(manifest.byte_length);
        for index in 0..manifest.chunk_count {
            let chunk = self
                .credentials
                .read(&chunk_account(slot, index))?
                .ok_or(SecureAppSessionStoreError::CorruptCredential)?;
            bytes.extend_from_slice(&chunk);
        }
        if bytes.len() != manifest.byte_length
            || hex::encode(Sha256::digest(&bytes)) != manifest.sha256
        {
            return Err(SecureAppSessionStoreError::CorruptCredential);
        }

        let raw =
            String::from_utf8(bytes).map_err(|_| SecureAppSessionStoreError::CorruptCredential)?;
        validate_session_payload(&raw)
            .map_err(|_| SecureAppSessionStoreError::CorruptCredential)?;
        Ok(raw)
    }

    fn cleanup_slot(&self, slot: SessionSlot) -> Result<(), SecureAppSessionStoreError> {
        if self
            .credentials
            .read(&clean_marker_account(slot))?
            .is_some_and(|value| value == CLEAN_SLOT_MARKER)
        {
            return Ok(());
        }
        let chunk_count = match self.credentials.read(&manifest_account(slot))? {
            Some(value) => serde_json::from_slice::<SlotManifest>(&value)
                .ok()
                .filter(|manifest| {
                    manifest.chunk_count > 0 && manifest.chunk_count <= MAX_CHUNK_COUNT
                })
                .map(|manifest| manifest.chunk_count)
                .unwrap_or(MAX_CHUNK_COUNT),
            None => MAX_CHUNK_COUNT,
        };
        self.delete_slot_accounts(slot, chunk_count)?;
        self.credentials
            .write(&clean_marker_account(slot), CLEAN_SLOT_MARKER)
    }

    fn purge_slot(&self, slot: SessionSlot) -> Result<(), SecureAppSessionStoreError> {
        let account_result = self.delete_slot_accounts(slot, MAX_CHUNK_COUNT);
        let marker_result = self.credentials.delete(&clean_marker_account(slot));
        account_result.and(marker_result)
    }

    fn delete_slot_accounts(
        &self,
        slot: SessionSlot,
        chunk_count: usize,
    ) -> Result<(), SecureAppSessionStoreError> {
        let mut first_error = None;
        for index in 0..chunk_count {
            if let Err(error) = self.credentials.delete(&chunk_account(slot, index)) {
                first_error.get_or_insert(error);
            }
        }
        if let Err(error) = self.credentials.delete(&manifest_account(slot)) {
            first_error.get_or_insert(error);
        }
        match first_error {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}

fn manifest_account(slot: SessionSlot) -> String {
    format!("session.v1.slot-{}.manifest", slot.label())
}

fn chunk_account(slot: SessionSlot, index: usize) -> String {
    format!("session.v1.slot-{}.chunk.{index:03}", slot.label())
}

fn clean_marker_account(slot: SessionSlot) -> String {
    format!("session.v1.slot-{}.clean", slot.label())
}

fn lock_credential_operations() -> Result<MutexGuard<'static, ()>, SecureAppSessionStoreError> {
    CREDENTIAL_OPERATION_LOCK
        .lock()
        .map_err(|_| SecureAppSessionStoreError::CredentialStoreUnavailable)
}

fn validate_session_payload(raw: &str) -> Result<(), SecureAppSessionStoreError> {
    let value: Value =
        serde_json::from_str(raw).map_err(|_| SecureAppSessionStoreError::InvalidSessionPayload)?;
    let object = value
        .as_object()
        .ok_or(SecureAppSessionStoreError::InvalidSessionPayload)?;
    for key in ["accessToken", "authToken"] {
        if object
            .get(key)
            .and_then(Value::as_str)
            .is_none_or(|value| value.trim().is_empty())
        {
            return Err(SecureAppSessionStoreError::InvalidSessionPayload);
        }
    }
    if object
        .get("storedAt")
        .and_then(Value::as_f64)
        .is_none_or(|value| !value.is_finite() || value < 0.0)
    {
        return Err(SecureAppSessionStoreError::InvalidSessionPayload);
    }
    for key in ["refreshToken", "sessionId"] {
        if object
            .get(key)
            .is_some_and(|value| value.as_str().is_none_or(|value| value.trim().is_empty()))
        {
            return Err(SecureAppSessionStoreError::InvalidSessionPayload);
        }
    }
    Ok(())
}

pub fn read_secure_app_session() -> Result<Option<String>, SecureAppSessionStoreError> {
    let _guard = lock_credential_operations()?;
    SecureAppSessionStore::new(OsCredentialSecretStore).read()
}

pub fn write_secure_app_session(raw: &str) -> Result<(), SecureAppSessionStoreError> {
    let _guard = lock_credential_operations()?;
    SecureAppSessionStore::new(OsCredentialSecretStore).write(raw)
}

pub fn delete_secure_app_session() -> Result<(), SecureAppSessionStoreError> {
    let _guard = lock_credential_operations()?;
    SecureAppSessionStore::new(OsCredentialSecretStore).delete()
}

#[cfg(test)]
mod tests {
    use super::{
        chunk_account, manifest_account, CredentialSecretStore, SecureAppSessionStore,
        SecureAppSessionStoreError, SessionSlot, ACTIVE_SLOT_ACCOUNT,
    };
    use std::cell::RefCell;
    use std::collections::{HashMap, HashSet};

    #[derive(Default)]
    struct MemoryCredentialStore {
        values: RefCell<HashMap<String, Vec<u8>>>,
        write_failures: RefCell<HashSet<String>>,
    }

    impl CredentialSecretStore for MemoryCredentialStore {
        fn read(&self, account: &str) -> Result<Option<Vec<u8>>, SecureAppSessionStoreError> {
            Ok(self.values.borrow().get(account).cloned())
        }

        fn write(&self, account: &str, value: &[u8]) -> Result<(), SecureAppSessionStoreError> {
            if self.write_failures.borrow_mut().remove(account) {
                return Err(SecureAppSessionStoreError::CredentialStoreUnavailable);
            }
            self.values
                .borrow_mut()
                .insert(account.to_owned(), value.to_vec());
            Ok(())
        }

        fn delete(&self, account: &str) -> Result<(), SecureAppSessionStoreError> {
            self.values.borrow_mut().remove(account);
            Ok(())
        }
    }

    fn session_payload(marker: &str) -> String {
        serde_json::json!({
            "accessToken": format!("access-{marker}"),
            "authToken": format!("auth-{marker}"),
            "refreshToken": format!("refresh-{marker}"),
            "sessionId": format!("session-{marker}"),
            "storedAt": 1_700_000_000,
            "context": { "padding": "x".repeat(5_000) }
        })
        .to_string()
    }

    #[test]
    fn round_trip_chunks_and_rotates_secure_session() {
        let credentials = MemoryCredentialStore::default();
        let store = SecureAppSessionStore::new(credentials);
        let first = session_payload("first");
        let second = session_payload("second");

        store.write(&first).expect("write first session");
        assert_eq!(store.read().expect("read first session"), Some(first));
        store.write(&second).expect("rotate session");
        assert_eq!(store.read().expect("read second session"), Some(second));
        assert!(store
            .credentials
            .read(&chunk_account(SessionSlot::A, 0))
            .expect("read inactive chunk")
            .is_none());

        store.delete().expect("delete session");
        assert_eq!(store.read().expect("read deleted session"), None);
    }

    #[test]
    fn invalid_payload_is_rejected_before_credential_write() {
        let store = SecureAppSessionStore::new(MemoryCredentialStore::default());
        let error = store
            .write(r#"{"refreshToken":"secret"}"#)
            .expect_err("invalid session must fail");
        assert_eq!(error, SecureAppSessionStoreError::InvalidSessionPayload);
        assert!(store.credentials.values.borrow().is_empty());
    }

    #[test]
    fn corrupt_credentials_fail_closed_and_delete_purges_every_slot_account() {
        let credentials = MemoryCredentialStore::default();
        let store = SecureAppSessionStore::new(credentials);
        store
            .write(&session_payload("corrupt"))
            .expect("write session");
        store
            .credentials
            .values
            .borrow_mut()
            .insert(manifest_account(SessionSlot::A), b"invalid".to_vec());

        assert_eq!(
            store.read().expect_err("corrupt session must fail"),
            SecureAppSessionStoreError::CorruptCredential,
        );
        store.delete().expect("purge corrupt session");
        assert!(store.credentials.values.borrow().is_empty());
    }

    #[test]
    fn failed_rotation_never_reactivates_previous_credentials() {
        let credentials = MemoryCredentialStore::default();
        let store = SecureAppSessionStore::new(credentials);
        store
            .write(&session_payload("previous"))
            .expect("write previous session");
        store
            .credentials
            .write_failures
            .borrow_mut()
            .insert(chunk_account(SessionSlot::B, 0));
        assert_eq!(
            store
                .write(&session_payload("next"))
                .expect_err("failed rotation must fail closed"),
            SecureAppSessionStoreError::CredentialStoreUnavailable,
        );
        assert!(store
            .credentials
            .read(ACTIVE_SLOT_ACCOUNT)
            .expect("read active pointer")
            .is_none());
        assert_eq!(store.read().expect("read after failed rotation"), None);
        assert!(store
            .credentials
            .read(&chunk_account(SessionSlot::A, 0))
            .expect("read previous inactive credential")
            .is_some());
        store.delete().expect("purge failed rotation remnants");
        assert!(store.credentials.values.borrow().is_empty());
    }
}
