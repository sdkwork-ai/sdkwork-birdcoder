use std::sync::Arc;

use axum::http::HeaderMap;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub const BIRDCODER_SESSION_HEADER_NAME: &str = "x-birdcoder-session-id";

const BIRDCODER_USER_CENTER_MODE_ENV: &str = "BIRDCODER_USER_CENTER_MODE";
const BIRDCODER_USER_CENTER_PROVIDER_KEY_ENV: &str = "BIRDCODER_USER_CENTER_PROVIDER_KEY";
const BIRDCODER_USER_CENTER_EXTERNAL_ID_HEADER_ENV: &str =
    "BIRDCODER_USER_CENTER_EXTERNAL_ID_HEADER";
const BIRDCODER_USER_CENTER_EXTERNAL_EMAIL_HEADER_ENV: &str =
    "BIRDCODER_USER_CENTER_EXTERNAL_EMAIL_HEADER";
const BIRDCODER_USER_CENTER_EXTERNAL_NAME_HEADER_ENV: &str =
    "BIRDCODER_USER_CENTER_EXTERNAL_NAME_HEADER";
const BIRDCODER_USER_CENTER_EXTERNAL_AVATAR_HEADER_ENV: &str =
    "BIRDCODER_USER_CENTER_EXTERNAL_AVATAR_HEADER";

const USER_CENTER_SQLITE_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT NULL,
    provider_key TEXT NOT NULL,
    external_subject TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    identity_id TEXT NOT NULL UNIQUE,
    bio TEXT NULL,
    company TEXT NULL,
    location TEXT NULL,
    website TEXT NULL
);

CREATE TABLE IF NOT EXISTS vip_subscriptions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    identity_id TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL,
    plan_title TEXT NOT NULL,
    status TEXT NOT NULL,
    credits_per_month INTEGER NOT NULL DEFAULT 0,
    seats INTEGER NOT NULL DEFAULT 1,
    renew_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS identity_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    identity_id TEXT NOT NULL,
    provider_key TEXT NOT NULL,
    status TEXT NOT NULL
);
"#;

const DEFAULT_PROFILE_BIO: &str =
    "Build and ship professional AI-native development systems with unified engine governance.";
const DEFAULT_PROFILE_COMPANY: &str = "SDKWork";
const DEFAULT_PROFILE_LOCATION: &str = "Shanghai";
const DEFAULT_PROFILE_WEBSITE: &str = "https://sdkwork.com";

#[derive(Clone)]
enum UserCenterMode {
    Local,
    External,
}

impl UserCenterMode {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Local => "local",
            Self::External => "external",
        }
    }
}

#[derive(Clone)]
struct ExternalHeaderConfig {
    avatar_header: String,
    email_header: String,
    id_header: String,
    name_header: String,
}

#[derive(Clone)]
struct UserCenterResolvedConfig {
    external_headers: ExternalHeaderConfig,
    mode: UserCenterMode,
    provider_key: String,
}

#[derive(Clone)]
struct IdentityRecord {
    avatar_url: Option<String>,
    display_name: String,
    email: String,
    id: String,
    status: String,
}

#[derive(Clone)]
struct IdentitySessionRecord {
    created_at: String,
    id: String,
    identity_id: String,
    provider_key: String,
    status: String,
    updated_at: String,
}

#[derive(Clone)]
struct UserProfileRecord {
    bio: Option<String>,
    company: Option<String>,
    location: Option<String>,
    website: Option<String>,
}

#[derive(Clone)]
struct VipSubscriptionRecord {
    credits_per_month: i64,
    identity_id: String,
    plan_id: String,
    plan_title: String,
    renew_at: Option<String>,
    seats: i64,
    status: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterLoginRequest {
    pub email: String,
    pub password: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterRegisterRequest {
    pub email: String,
    pub name: Option<String>,
    pub password: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterSessionExchangeRequest {
    pub avatar_url: Option<String>,
    pub email: String,
    pub identity_id: Option<String>,
    pub name: Option<String>,
    pub provider_key: Option<String>,
    pub subject: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserCenterProfileRequest {
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub company: Option<String>,
    pub display_name: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserCenterVipMembershipRequest {
    pub credits_per_month: Option<i64>,
    pub plan_id: Option<String>,
    pub plan_title: Option<String>,
    pub renew_at: Option<String>,
    pub seats: Option<i64>,
    pub status: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterUserPayload {
    pub avatar_url: Option<String>,
    pub email: String,
    pub id: String,
    pub name: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterSessionPayload {
    pub created_at: String,
    pub provider_key: String,
    pub provider_mode: String,
    pub session_id: String,
    pub updated_at: String,
    pub user: UserCenterUserPayload,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterMetadataPayload {
    pub mode: String,
    pub provider_key: String,
    pub session_header_name: &'static str,
    pub supports_local_credentials: bool,
    pub supports_session_exchange: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterProfilePayload {
    pub avatar_url: Option<String>,
    pub bio: String,
    pub company: String,
    pub display_name: String,
    pub email: String,
    pub identity_id: String,
    pub location: String,
    pub website: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterVipMembershipPayload {
    pub credits_per_month: i64,
    pub identity_id: String,
    pub plan_id: String,
    pub plan_title: String,
    pub renew_at: Option<String>,
    pub seats: i64,
    pub status: String,
}

trait UserCenterProvider: Send + Sync {
    fn exchange_session(
        &self,
        connection: &mut Connection,
        request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String>;

    fn login(
        &self,
        connection: &mut Connection,
        request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String>;

    fn logout(
        &self,
        connection: &mut Connection,
        session_id: Option<&str>,
    ) -> Result<(), String>;

    fn metadata(&self) -> UserCenterMetadataPayload;

    fn read_profile(
        &self,
        connection: &Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String>;

    fn read_vip_membership(
        &self,
        connection: &Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterVipMembershipPayload, String>;

    fn register(
        &self,
        connection: &mut Connection,
        request: &UserCenterRegisterRequest,
    ) -> Result<UserCenterSessionPayload, String>;

    fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String>;

    fn update_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterProfileRequest,
    ) -> Result<UserCenterProfilePayload, String>;

    fn update_vip_membership(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterVipMembershipRequest,
    ) -> Result<UserCenterVipMembershipPayload, String>;
}

#[derive(Clone)]
pub struct UserCenterState {
    provider: Arc<dyn UserCenterProvider>,
}

impl UserCenterState {
    pub fn from_env() -> Self {
        let resolved = resolve_user_center_config_from_env();
        let provider: Arc<dyn UserCenterProvider> = match resolved.mode {
            UserCenterMode::Local => Arc::new(LocalUserCenterProvider::new(
                resolved.provider_key.clone(),
            )),
            UserCenterMode::External => Arc::new(ExternalUserCenterProvider::new(
                resolved.provider_key.clone(),
                resolved.external_headers.clone(),
            )),
        };

        Self { provider }
    }

    pub fn exchange_session(
        &self,
        connection: &mut Connection,
        request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        self.provider.exchange_session(connection, request)
    }

    pub fn login(
        &self,
        connection: &mut Connection,
        request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        self.provider.login(connection, request)
    }

    pub fn logout(
        &self,
        connection: &mut Connection,
        session_id: Option<&str>,
    ) -> Result<(), String> {
        self.provider.logout(connection, session_id)
    }

    pub fn metadata(&self) -> UserCenterMetadataPayload {
        self.provider.metadata()
    }

    pub fn ensure_identity_user(
        &self,
        connection: &mut Connection,
        identity_id: Option<&str>,
        email: Option<&str>,
        name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<UserCenterUserPayload, String> {
        let normalized_identity_id = normalize_optional_text(identity_id);
        let normalized_email = normalize_optional_text(email).map(|value| normalize_email(&value));

        if normalized_identity_id.is_none() && normalized_email.is_none() {
            return Err("identityId or email is required.".to_owned());
        }

        if let (Some(existing_identity_id), None) =
            (normalized_identity_id.as_deref(), normalized_email.as_deref())
        {
            let identity = load_identity_by_id(connection, existing_identity_id)?
                .ok_or_else(|| format!("Identity {existing_identity_id} was not found."))?;
            ensure_default_profile_and_membership(connection, &identity.id)?;
            return Ok(map_identity_record_to_user_payload(identity));
        }

        let normalized_email = normalized_email.ok_or_else(|| {
            "email is required when identityId cannot be resolved directly.".to_owned()
        })?;
        let metadata = self.metadata();
        let preferred_identity_id = normalized_identity_id.unwrap_or_else(|| {
            if metadata.mode.eq_ignore_ascii_case("external") {
                build_external_identity_id(&metadata.provider_key, None, &normalized_email)
            } else {
                build_local_identity_id(&normalized_email)
            }
        });
        let resolved_display_name = resolve_display_name(&normalized_email, name);
        let identity = upsert_identity_shadow(
            connection,
            &preferred_identity_id,
            &normalized_email,
            &resolved_display_name,
            avatar_url,
            &metadata.provider_key,
            None,
        )?;
        ensure_default_profile_and_membership(connection, &identity.id)?;
        Ok(map_identity_record_to_user_payload(identity))
    }

    pub fn read_profile(
        &self,
        connection: &Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String> {
        self.provider.read_profile(connection, session)
    }

    pub fn read_vip_membership(
        &self,
        connection: &Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        self.provider.read_vip_membership(connection, session)
    }

    pub fn register(
        &self,
        connection: &mut Connection,
        request: &UserCenterRegisterRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        self.provider.register(connection, request)
    }

    pub fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String> {
        self.provider.resolve_session(connection, headers)
    }

    pub fn update_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterProfileRequest,
    ) -> Result<UserCenterProfilePayload, String> {
        self.provider.update_profile(connection, session, request)
    }

    pub fn update_vip_membership(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterVipMembershipRequest,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        self.provider
            .update_vip_membership(connection, session, request)
    }
}

pub fn ensure_sqlite_user_center_schema(connection: &mut Connection) -> Result<(), String> {
    connection
        .execute_batch(USER_CENTER_SQLITE_SCHEMA)
        .map_err(|error| format!("create sqlite user center schema failed: {error}"))
}

pub fn ensure_sqlite_user_center_bootstrap_identity(
    connection: &mut Connection,
) -> Result<(), String> {
    let bootstrap_email = "local-default@sdkwork-birdcoder.local";
    let bootstrap_name = "BirdCoder Local Owner";
    let bootstrap_avatar = Some(build_avatar_url(bootstrap_email));
    let bootstrap_identity = upsert_identity_shadow(
        connection,
        crate::BOOTSTRAP_WORKSPACE_OWNER_IDENTITY_ID,
        bootstrap_email,
        bootstrap_name,
        bootstrap_avatar.as_deref(),
        "local",
        None,
    )?;
    ensure_default_profile_and_membership(connection, &bootstrap_identity.id)?;
    Ok(())
}

fn resolve_user_center_config_from_env() -> UserCenterResolvedConfig {
    let mode = match std::env::var(BIRDCODER_USER_CENTER_MODE_ENV)
        .ok()
        .unwrap_or_else(|| "local".to_owned())
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "external" | "third-party" | "third_party" | "proxy" => UserCenterMode::External,
        _ => UserCenterMode::Local,
    };

    let provider_key = std::env::var(BIRDCODER_USER_CENTER_PROVIDER_KEY_ENV)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| match mode {
            UserCenterMode::Local => "local".to_owned(),
            UserCenterMode::External => "external".to_owned(),
        });

    UserCenterResolvedConfig {
        external_headers: ExternalHeaderConfig {
            avatar_header: std::env::var(BIRDCODER_USER_CENTER_EXTERNAL_AVATAR_HEADER_ENV)
                .ok()
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "x-birdcoder-user-avatar".to_owned()),
            email_header: std::env::var(BIRDCODER_USER_CENTER_EXTERNAL_EMAIL_HEADER_ENV)
                .ok()
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "x-birdcoder-user-email".to_owned()),
            id_header: std::env::var(BIRDCODER_USER_CENTER_EXTERNAL_ID_HEADER_ENV)
                .ok()
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "x-birdcoder-user-id".to_owned()),
            name_header: std::env::var(BIRDCODER_USER_CENTER_EXTERNAL_NAME_HEADER_ENV)
                .ok()
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "x-birdcoder-user-name".to_owned()),
        },
        mode,
        provider_key,
    }
}

fn normalize_email(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_owned())
        .filter(|entry| !entry.is_empty())
}

fn resolve_display_name(email: &str, explicit_name: Option<&str>) -> String {
    normalize_optional_text(explicit_name)
        .or_else(|| email.split('@').next().map(|value| value.to_owned()))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "BirdCoder User".to_owned())
}

fn sanitize_identifier_segment(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());
    let mut previous_was_separator = false;

    for character in value.chars() {
        let lower = character.to_ascii_lowercase();
        if lower.is_ascii_alphanumeric() {
            normalized.push(lower);
            previous_was_separator = false;
        } else if !previous_was_separator {
            normalized.push('-');
            previous_was_separator = true;
        }
    }

    normalized.trim_matches('-').to_owned()
}

fn build_local_identity_id(email: &str) -> String {
    let normalized = sanitize_identifier_segment(email);
    format!(
        "identity-{}",
        if normalized.is_empty() {
            "local-user"
        } else {
            normalized.as_str()
        }
    )
}

fn build_external_identity_id(provider_key: &str, subject: Option<&str>, email: &str) -> String {
    let subject_segment = sanitize_identifier_segment(subject.unwrap_or(email));
    let provider_segment = sanitize_identifier_segment(provider_key);
    format!(
        "identity-{}-{}",
        if provider_segment.is_empty() {
            "external"
        } else {
            provider_segment.as_str()
        },
        if subject_segment.is_empty() {
            "user"
        } else {
            subject_segment.as_str()
        }
    )
}

fn build_avatar_url(seed: &str) -> String {
    format!(
        "https://api.dicebear.com/7.x/avataaars/svg?seed={}",
        seed.replace(' ', "%20")
    )
}

fn map_identity_record_to_user_payload(identity: IdentityRecord) -> UserCenterUserPayload {
    UserCenterUserPayload {
        avatar_url: identity.avatar_url,
        email: identity.email,
        id: identity.id,
        name: identity.display_name,
    }
}

fn read_header_value(headers: &HeaderMap, header_name: &str) -> Option<String> {
    headers
        .get(header_name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| normalize_optional_text(Some(value)))
}

fn read_session_header(headers: &HeaderMap) -> Option<String> {
    read_header_value(headers, BIRDCODER_SESSION_HEADER_NAME)
}

fn load_identity_by_id(
    connection: &Connection,
    identity_id: &str,
) -> Result<Option<IdentityRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT id, email, display_name, avatar_url, provider_key, external_subject, status
            FROM identities
            WHERE id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![identity_id],
            |row| {
                Ok(IdentityRecord {
                    id: row.get(0)?,
                    email: row.get(1)?,
                    display_name: row.get(2)?,
                    avatar_url: row.get(3)?,
                    status: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load identity {identity_id} failed: {error}"))
}

fn load_identity_by_email(
    connection: &Connection,
    email: &str,
) -> Result<Option<IdentityRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT id, email, display_name, avatar_url, provider_key, external_subject, status
            FROM identities
            WHERE email = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![email],
            |row| {
                Ok(IdentityRecord {
                    id: row.get(0)?,
                    email: row.get(1)?,
                    display_name: row.get(2)?,
                    avatar_url: row.get(3)?,
                    status: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load identity by email {email} failed: {error}"))
}

fn load_session_record(
    connection: &Connection,
    session_id: &str,
) -> Result<Option<IdentitySessionRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT id, identity_id, provider_key, status, created_at, updated_at
            FROM identity_sessions
            WHERE id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![session_id],
            |row| {
                Ok(IdentitySessionRecord {
                    id: row.get(0)?,
                    identity_id: row.get(1)?,
                    provider_key: row.get(2)?,
                    status: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load identity session {session_id} failed: {error}"))
}

fn load_profile_record(
    connection: &Connection,
    identity_id: &str,
) -> Result<Option<UserProfileRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT bio, company, location, website
            FROM user_profiles
            WHERE identity_id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![identity_id],
            |row| {
                Ok(UserProfileRecord {
                    bio: row.get(0)?,
                    company: row.get(1)?,
                    location: row.get(2)?,
                    website: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load user profile {identity_id} failed: {error}"))
}

fn load_vip_subscription_record(
    connection: &Connection,
    identity_id: &str,
) -> Result<Option<VipSubscriptionRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT identity_id, plan_id, plan_title, status, credits_per_month, seats, renew_at
            FROM vip_subscriptions
            WHERE identity_id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![identity_id],
            |row| {
                Ok(VipSubscriptionRecord {
                    identity_id: row.get(0)?,
                    plan_id: row.get(1)?,
                    plan_title: row.get(2)?,
                    status: row.get(3)?,
                    credits_per_month: row.get(4)?,
                    seats: row.get(5)?,
                    renew_at: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load vip subscription {identity_id} failed: {error}"))
}

fn upsert_identity_shadow(
    connection: &mut Connection,
    preferred_identity_id: &str,
    email: &str,
    display_name: &str,
    avatar_url: Option<&str>,
    provider_key: &str,
    external_subject: Option<&str>,
) -> Result<IdentityRecord, String> {
    let normalized_email = normalize_email(email);
    if normalized_email.is_empty() {
        return Err("Email is required.".to_owned());
    }

    let resolved_identity_id = if let Some(identity) =
        load_identity_by_id(connection, preferred_identity_id)?
    {
        identity.id
    } else if let Some(identity) = load_identity_by_email(connection, &normalized_email)? {
        identity.id
    } else {
        preferred_identity_id.to_owned()
    };
    let now = crate::current_storage_timestamp();
    let resolved_display_name = if display_name.trim().is_empty() {
        resolve_display_name(&normalized_email, None)
    } else {
        display_name.trim().to_owned()
    };
    let resolved_avatar_url = normalize_optional_text(avatar_url)
        .unwrap_or_else(|| build_avatar_url(&normalized_email));

    connection
        .execute(
            r#"
            INSERT INTO identities (
                id, created_at, updated_at, version, is_deleted, email, display_name, avatar_url, provider_key, external_subject, status
            )
            VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, 'active')
            ON CONFLICT(id) DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0,
                email = excluded.email,
                display_name = excluded.display_name,
                avatar_url = excluded.avatar_url,
                provider_key = excluded.provider_key,
                external_subject = COALESCE(excluded.external_subject, identities.external_subject),
                status = 'active'
            "#,
            params![
                &resolved_identity_id,
                &now,
                &now,
                &normalized_email,
                &resolved_display_name,
                &resolved_avatar_url,
                provider_key,
                &normalize_optional_text(external_subject),
            ],
        )
        .map_err(|error| format!("upsert identity {resolved_identity_id} failed: {error}"))?;

    load_identity_by_id(connection, &resolved_identity_id)?
        .ok_or_else(|| format!("identity {resolved_identity_id} was not found after upsert"))
}

fn ensure_default_profile_and_membership(
    connection: &mut Connection,
    identity_id: &str,
) -> Result<(), String> {
    let now = crate::current_storage_timestamp();

    connection
        .execute(
            r#"
            INSERT INTO user_profiles (
                id, created_at, updated_at, version, is_deleted, identity_id, bio, company, location, website
            )
            VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(identity_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0
            "#,
            params![
                format!("profile-{identity_id}"),
                &now,
                &now,
                identity_id,
                DEFAULT_PROFILE_BIO,
                DEFAULT_PROFILE_COMPANY,
                DEFAULT_PROFILE_LOCATION,
                DEFAULT_PROFILE_WEBSITE,
            ],
        )
        .map_err(|error| format!("ensure default user profile for {identity_id} failed: {error}"))?;

    connection
        .execute(
            r#"
            INSERT INTO vip_subscriptions (
                id, created_at, updated_at, version, is_deleted, identity_id, plan_id, plan_title, status, credits_per_month, seats, renew_at
            )
            VALUES (?1, ?2, ?3, 0, 0, ?4, 'free', 'Free', 'inactive', 0, 1, NULL)
            ON CONFLICT(identity_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0
            "#,
            params![format!("vip-{identity_id}"), &now, &now, identity_id],
        )
        .map_err(|error| format!("ensure default vip subscription for {identity_id} failed: {error}"))?;

    Ok(())
}

fn create_persisted_session(
    connection: &mut Connection,
    identity: &IdentityRecord,
    provider_mode: &UserCenterMode,
    provider_key: &str,
) -> Result<UserCenterSessionPayload, String> {
    let session_id = crate::create_identifier("identity-session");
    let now = crate::current_storage_timestamp();

    connection
        .execute(
            r#"
            INSERT INTO identity_sessions (
                id, created_at, updated_at, version, is_deleted, identity_id, provider_key, status
            )
            VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, 'active')
            "#,
            params![&session_id, &now, &now, &identity.id, provider_key],
        )
        .map_err(|error| format!("create identity session {session_id} failed: {error}"))?;

    Ok(UserCenterSessionPayload {
        created_at: now.clone(),
        provider_key: provider_key.to_owned(),
        provider_mode: provider_mode.as_str().to_owned(),
        session_id,
        updated_at: now,
        user: UserCenterUserPayload {
            avatar_url: identity.avatar_url.clone(),
            email: identity.email.clone(),
            id: identity.id.clone(),
            name: identity.display_name.clone(),
        },
    })
}

fn read_persisted_session_payload(
    connection: &Connection,
    session_id: &str,
    provider_mode: &UserCenterMode,
) -> Result<Option<UserCenterSessionPayload>, String> {
    let Some(session) = load_session_record(connection, session_id)? else {
        return Ok(None);
    };
    if session.status != "active" {
        return Ok(None);
    }

    let Some(identity) = load_identity_by_id(connection, &session.identity_id)? else {
        return Ok(None);
    };
    if identity.status != "active" {
        return Ok(None);
    }

    Ok(Some(UserCenterSessionPayload {
        created_at: session.created_at,
        provider_key: session.provider_key,
        provider_mode: provider_mode.as_str().to_owned(),
        session_id: session.id,
        updated_at: session.updated_at,
        user: UserCenterUserPayload {
            avatar_url: identity.avatar_url,
            email: identity.email,
            id: identity.id,
            name: identity.display_name,
        },
    }))
}

fn build_profile_payload(
    session: &UserCenterSessionPayload,
    profile: Option<UserProfileRecord>,
) -> UserCenterProfilePayload {
    UserCenterProfilePayload {
        avatar_url: session.user.avatar_url.clone(),
        bio: profile
            .as_ref()
            .and_then(|record| record.bio.clone())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_PROFILE_BIO.to_owned()),
        company: profile
            .as_ref()
            .and_then(|record| record.company.clone())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_PROFILE_COMPANY.to_owned()),
        display_name: session.user.name.clone(),
        email: session.user.email.clone(),
        identity_id: session.user.id.clone(),
        location: profile
            .as_ref()
            .and_then(|record| record.location.clone())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_PROFILE_LOCATION.to_owned()),
        website: profile
            .and_then(|record| record.website)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_PROFILE_WEBSITE.to_owned()),
    }
}

fn build_vip_membership_payload(
    identity_id: &str,
    membership: Option<VipSubscriptionRecord>,
) -> UserCenterVipMembershipPayload {
    let resolved = membership.unwrap_or(VipSubscriptionRecord {
        identity_id: identity_id.to_owned(),
        plan_id: "free".to_owned(),
        plan_title: "Free".to_owned(),
        status: "inactive".to_owned(),
        credits_per_month: 0,
        seats: 1,
        renew_at: None,
    });

    UserCenterVipMembershipPayload {
        credits_per_month: resolved.credits_per_month,
        identity_id: resolved.identity_id,
        plan_id: resolved.plan_id,
        plan_title: resolved.plan_title,
        renew_at: resolved.renew_at,
        seats: resolved.seats,
        status: resolved.status,
    }
}

fn revoke_session(connection: &mut Connection, session_id: &str) -> Result<(), String> {
    let now = crate::current_storage_timestamp();
    connection
        .execute(
            r#"
            UPDATE identity_sessions
            SET updated_at = ?2, is_deleted = 1, status = 'revoked'
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![session_id, &now],
        )
        .map_err(|error| format!("revoke identity session {session_id} failed: {error}"))?;
    Ok(())
}

fn upsert_profile_record(
    connection: &mut Connection,
    session: &UserCenterSessionPayload,
    request: &UpdateUserCenterProfileRequest,
) -> Result<UserCenterProfilePayload, String> {
    let now = crate::current_storage_timestamp();
    let display_name = normalize_optional_text(request.display_name.as_deref())
        .unwrap_or_else(|| session.user.name.clone());
    let avatar_url = normalize_optional_text(request.avatar_url.as_deref())
        .or_else(|| session.user.avatar_url.clone())
        .unwrap_or_else(|| build_avatar_url(&session.user.email));

    connection
        .execute(
            r#"
            UPDATE identities
            SET updated_at = ?2, display_name = ?3, avatar_url = ?4, is_deleted = 0, status = 'active'
            WHERE id = ?1
            "#,
            params![&session.user.id, &now, &display_name, &avatar_url],
        )
        .map_err(|error| format!("update identity profile shell {} failed: {error}", session.user.id))?;

    connection
        .execute(
            r#"
            INSERT INTO user_profiles (
                id, created_at, updated_at, version, is_deleted, identity_id, bio, company, location, website
            )
            VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(identity_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0,
                bio = excluded.bio,
                company = excluded.company,
                location = excluded.location,
                website = excluded.website
            "#,
            params![
                format!("profile-{}", session.user.id),
                &now,
                &now,
                &session.user.id,
                normalize_optional_text(request.bio.as_deref())
                    .unwrap_or_else(|| DEFAULT_PROFILE_BIO.to_owned()),
                normalize_optional_text(request.company.as_deref())
                    .unwrap_or_else(|| DEFAULT_PROFILE_COMPANY.to_owned()),
                normalize_optional_text(request.location.as_deref())
                    .unwrap_or_else(|| DEFAULT_PROFILE_LOCATION.to_owned()),
                normalize_optional_text(request.website.as_deref())
                    .unwrap_or_else(|| DEFAULT_PROFILE_WEBSITE.to_owned()),
            ],
        )
        .map_err(|error| format!("upsert user profile {} failed: {error}", session.user.id))?;

    let updated_session = UserCenterSessionPayload {
        created_at: session.created_at.clone(),
        provider_key: session.provider_key.clone(),
        provider_mode: session.provider_mode.clone(),
        session_id: session.session_id.clone(),
        updated_at: now,
        user: UserCenterUserPayload {
            avatar_url: Some(avatar_url),
            email: session.user.email.clone(),
            id: session.user.id.clone(),
            name: display_name,
        },
    };

    Ok(build_profile_payload(
        &updated_session,
        load_profile_record(connection, &session.user.id)?,
    ))
}

fn upsert_vip_membership_record(
    connection: &mut Connection,
    session: &UserCenterSessionPayload,
    request: &UpdateUserCenterVipMembershipRequest,
) -> Result<UserCenterVipMembershipPayload, String> {
    let now = crate::current_storage_timestamp();
    let existing = load_vip_subscription_record(connection, &session.user.id)?;

    connection
        .execute(
            r#"
            INSERT INTO vip_subscriptions (
                id, created_at, updated_at, version, is_deleted, identity_id, plan_id, plan_title, status, credits_per_month, seats, renew_at
            )
            VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(identity_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0,
                plan_id = excluded.plan_id,
                plan_title = excluded.plan_title,
                status = excluded.status,
                credits_per_month = excluded.credits_per_month,
                seats = excluded.seats,
                renew_at = excluded.renew_at
            "#,
            params![
                format!("vip-{}", session.user.id),
                &now,
                &now,
                &session.user.id,
                normalize_optional_text(request.plan_id.as_deref())
                    .or_else(|| existing.as_ref().map(|record| record.plan_id.clone()))
                    .unwrap_or_else(|| "free".to_owned()),
                normalize_optional_text(request.plan_title.as_deref())
                    .or_else(|| existing.as_ref().map(|record| record.plan_title.clone()))
                    .unwrap_or_else(|| "Free".to_owned()),
                normalize_optional_text(request.status.as_deref())
                    .or_else(|| existing.as_ref().map(|record| record.status.clone()))
                    .unwrap_or_else(|| "inactive".to_owned()),
                request
                    .credits_per_month
                    .or_else(|| existing.as_ref().map(|record| record.credits_per_month))
                    .unwrap_or(0),
                request
                    .seats
                    .or_else(|| existing.as_ref().map(|record| record.seats))
                    .unwrap_or(1),
                normalize_optional_text(request.renew_at.as_deref())
                    .or_else(|| existing.and_then(|record| record.renew_at)),
            ],
        )
        .map_err(|error| format!("upsert vip subscription {} failed: {error}", session.user.id))?;

    Ok(build_vip_membership_payload(
        &session.user.id,
        load_vip_subscription_record(connection, &session.user.id)?,
    ))
}

#[derive(Clone)]
struct LocalUserCenterProvider {
    provider_key: String,
}

impl LocalUserCenterProvider {
    fn new(provider_key: String) -> Self {
        Self { provider_key }
    }

    fn provision_identity_for_email(
        &self,
        connection: &mut Connection,
        email: &str,
        explicit_name: Option<&str>,
    ) -> Result<IdentityRecord, String> {
        let normalized_email = normalize_email(email);
        if normalized_email.is_empty() {
            return Err("Email is required.".to_owned());
        }

        let preferred_identity_id = load_identity_by_email(connection, &normalized_email)?
            .map(|identity| identity.id)
            .unwrap_or_else(|| build_local_identity_id(&normalized_email));
        let display_name = resolve_display_name(&normalized_email, explicit_name);
        let avatar_url = build_avatar_url(&normalized_email);
        let identity = upsert_identity_shadow(
            connection,
            &preferred_identity_id,
            &normalized_email,
            &display_name,
            Some(avatar_url.as_str()),
            &self.provider_key,
            None,
        )?;
        ensure_default_profile_and_membership(connection, &identity.id)?;
        Ok(identity)
    }
}

impl UserCenterProvider for LocalUserCenterProvider {
    fn exchange_session(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err("Session exchange is not supported for local user center mode.".to_owned())
    }

    fn login(
        &self,
        connection: &mut Connection,
        request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let _password = request.password.as_deref();
        let identity = self.provision_identity_for_email(connection, &request.email, None)?;
        create_persisted_session(connection, &identity, &UserCenterMode::Local, &self.provider_key)
    }

    fn logout(
        &self,
        connection: &mut Connection,
        session_id: Option<&str>,
    ) -> Result<(), String> {
        if let Some(normalized_session_id) = session_id
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            revoke_session(connection, normalized_session_id)?;
        }

        Ok(())
    }

    fn metadata(&self) -> UserCenterMetadataPayload {
        UserCenterMetadataPayload {
            mode: "local".to_owned(),
            provider_key: self.provider_key.clone(),
            session_header_name: BIRDCODER_SESSION_HEADER_NAME,
            supports_local_credentials: true,
            supports_session_exchange: false,
        }
    }

    fn read_profile(
        &self,
        connection: &Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String> {
        Ok(build_profile_payload(
            session,
            load_profile_record(connection, &session.user.id)?,
        ))
    }

    fn read_vip_membership(
        &self,
        connection: &Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        Ok(build_vip_membership_payload(
            &session.user.id,
            load_vip_subscription_record(connection, &session.user.id)?,
        ))
    }

    fn register(
        &self,
        connection: &mut Connection,
        request: &UserCenterRegisterRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let _password = request.password.as_deref();
        let identity =
            self.provision_identity_for_email(connection, &request.email, request.name.as_deref())?;
        create_persisted_session(connection, &identity, &UserCenterMode::Local, &self.provider_key)
    }

    fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String> {
        let Some(session_id) = read_session_header(headers) else {
            return Ok(None);
        };

        read_persisted_session_payload(connection, &session_id, &UserCenterMode::Local)
    }

    fn update_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterProfileRequest,
    ) -> Result<UserCenterProfilePayload, String> {
        upsert_profile_record(connection, session, request)
    }

    fn update_vip_membership(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterVipMembershipRequest,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        upsert_vip_membership_record(connection, session, request)
    }
}

#[derive(Clone)]
struct ExternalUserCenterProvider {
    external_headers: ExternalHeaderConfig,
    provider_key: String,
}

impl ExternalUserCenterProvider {
    fn new(provider_key: String, external_headers: ExternalHeaderConfig) -> Self {
        Self {
            external_headers,
            provider_key,
        }
    }

    fn resolve_header_backed_session(&self, headers: &HeaderMap) -> Option<UserCenterSessionPayload> {
        let email = read_header_value(headers, &self.external_headers.email_header)?;
        let identity_id = read_header_value(headers, &self.external_headers.id_header)
            .unwrap_or_else(|| build_external_identity_id(&self.provider_key, None, &email));
        let name = read_header_value(headers, &self.external_headers.name_header)
            .unwrap_or_else(|| resolve_display_name(&email, None));
        let avatar_url = read_header_value(headers, &self.external_headers.avatar_header);
        let now = crate::current_storage_timestamp();

        Some(UserCenterSessionPayload {
            created_at: now.clone(),
            provider_key: self.provider_key.clone(),
            provider_mode: "external".to_owned(),
            session_id: format!("external-header:{identity_id}"),
            updated_at: now,
            user: UserCenterUserPayload {
                avatar_url,
                email,
                id: identity_id,
                name,
            },
        })
    }

    fn ensure_shadow_identity_for_session(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<(), String> {
        upsert_identity_shadow(
            connection,
            &session.user.id,
            &session.user.email,
            &session.user.name,
            session.user.avatar_url.as_deref(),
            &self.provider_key,
            None,
        )?;
        ensure_default_profile_and_membership(connection, &session.user.id)?;
        Ok(())
    }
}

impl UserCenterProvider for ExternalUserCenterProvider {
    fn exchange_session(
        &self,
        connection: &mut Connection,
        request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_email = normalize_email(&request.email);
        if normalized_email.is_empty() {
            return Err("Email is required.".to_owned());
        }

        let provider_key = normalize_optional_text(request.provider_key.as_deref())
            .unwrap_or_else(|| self.provider_key.clone());
        let preferred_identity_id = normalize_optional_text(request.identity_id.as_deref())
            .unwrap_or_else(|| {
                build_external_identity_id(
                    provider_key.as_str(),
                    request.subject.as_deref(),
                    normalized_email.as_str(),
                )
            });
        let display_name = resolve_display_name(&normalized_email, request.name.as_deref());
        let identity = upsert_identity_shadow(
            connection,
            &preferred_identity_id,
            &normalized_email,
            &display_name,
            request.avatar_url.as_deref(),
            provider_key.as_str(),
            request.subject.as_deref(),
        )?;
        ensure_default_profile_and_membership(connection, &identity.id)?;
        create_persisted_session(connection, &identity, &UserCenterMode::External, provider_key.as_str())
    }

    fn login(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err("Login is delegated to the configured third-party user center.".to_owned())
    }

    fn logout(
        &self,
        connection: &mut Connection,
        session_id: Option<&str>,
    ) -> Result<(), String> {
        if let Some(normalized_session_id) = session_id
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            revoke_session(connection, normalized_session_id)?;
        }
        Ok(())
    }

    fn metadata(&self) -> UserCenterMetadataPayload {
        UserCenterMetadataPayload {
            mode: "external".to_owned(),
            provider_key: self.provider_key.clone(),
            session_header_name: BIRDCODER_SESSION_HEADER_NAME,
            supports_local_credentials: false,
            supports_session_exchange: true,
        }
    }

    fn read_profile(
        &self,
        connection: &Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String> {
        Ok(build_profile_payload(
            session,
            load_profile_record(connection, &session.user.id)?,
        ))
    }

    fn read_vip_membership(
        &self,
        connection: &Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        Ok(build_vip_membership_payload(
            &session.user.id,
            load_vip_subscription_record(connection, &session.user.id)?,
        ))
    }

    fn register(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterRegisterRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err("Registration is delegated to the configured third-party user center.".to_owned())
    }

    fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String> {
        if let Some(session_id) = read_session_header(headers) {
            if let Some(persisted_session) =
                read_persisted_session_payload(connection, &session_id, &UserCenterMode::External)?
            {
                return Ok(Some(persisted_session));
            }
        }

        Ok(self.resolve_header_backed_session(headers))
    }

    fn update_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterProfileRequest,
    ) -> Result<UserCenterProfilePayload, String> {
        self.ensure_shadow_identity_for_session(connection, session)?;
        upsert_profile_record(connection, session, request)
    }

    fn update_vip_membership(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterVipMembershipRequest,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        self.ensure_shadow_identity_for_session(connection, session)?;
        upsert_vip_membership_record(connection, session, request)
    }
}
