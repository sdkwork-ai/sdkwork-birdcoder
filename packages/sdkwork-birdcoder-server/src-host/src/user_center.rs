use std::{sync::Arc, time::Duration};

use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::http::HeaderMap;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{Map, Value};

pub const BIRDCODER_SESSION_HEADER_NAME: &str = "x-birdcoder-session-id";

const BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV: &str = "BIRDCODER_USER_CENTER_LOGIN_PROVIDER";
const BIRDCODER_USER_CENTER_PROVIDER_KEY_ENV: &str = "BIRDCODER_USER_CENTER_PROVIDER_KEY";
const BIRDCODER_USER_CENTER_EXTERNAL_ID_HEADER_ENV: &str =
    "BIRDCODER_USER_CENTER_EXTERNAL_ID_HEADER";
const BIRDCODER_USER_CENTER_EXTERNAL_EMAIL_HEADER_ENV: &str =
    "BIRDCODER_USER_CENTER_EXTERNAL_EMAIL_HEADER";
const BIRDCODER_USER_CENTER_EXTERNAL_NAME_HEADER_ENV: &str =
    "BIRDCODER_USER_CENTER_EXTERNAL_NAME_HEADER";
const BIRDCODER_USER_CENTER_EXTERNAL_AVATAR_HEADER_ENV: &str =
    "BIRDCODER_USER_CENTER_EXTERNAL_AVATAR_HEADER";
const BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV: &str = "BIRDCODER_USER_CENTER_APP_API_BASE_URL";
const BIRDCODER_USER_CENTER_APP_API_TIMEOUT_MS_ENV: &str =
    "BIRDCODER_USER_CENTER_APP_API_TIMEOUT_MS";
const BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD_ENV: &str = "BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD";

const USER_CENTER_SQLITE_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS plus_tenant (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_user (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id TEXT NULL,
    organization_id TEXT NULL,
    username TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    password TEXT NOT NULL,
    salt TEXT NULL,
    platform TEXT NOT NULL,
    type TEXT NOT NULL,
    scene TEXT NULL,
    email TEXT NULL UNIQUE,
    phone TEXT NULL,
    country_code TEXT NULL,
    province_code TEXT NULL,
    city_code TEXT NULL,
    district_code TEXT NULL,
    address TEXT NULL,
    bio TEXT NULL,
    avatar_url TEXT NULL,
    provider_key TEXT NOT NULL,
    external_subject TEXT NULL,
    metadata_json TEXT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_oauth_account (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    oauth_provider TEXT NOT NULL,
    open_id TEXT NOT NULL,
    union_id TEXT NULL,
    app_id TEXT NULL,
    oauth_user_info_json TEXT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (oauth_provider, open_id)
);

CREATE TABLE IF NOT EXISTS plus_vip_user (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL UNIQUE,
    vip_level_id TEXT NULL,
    vip_level_name TEXT NULL,
    status TEXT NOT NULL,
    point_balance INTEGER NOT NULL DEFAULT 0,
    total_recharged_points INTEGER NOT NULL DEFAULT 0,
    monthly_credits INTEGER NOT NULL DEFAULT 0,
    seat_limit INTEGER NOT NULL DEFAULT 1,
    valid_from TEXT NULL,
    valid_to TEXT NULL,
    last_active_time TEXT NULL,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_user_auth_session (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    provider_key TEXT NOT NULL,
    provider_mode TEXT NOT NULL,
    upstream_auth_token TEXT NULL,
    upstream_access_token TEXT NULL,
    upstream_refresh_token TEXT NULL,
    upstream_token_type TEXT NULL,
    upstream_user_id TEXT NULL,
    upstream_payload_json TEXT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);
"#;

const DEFAULT_PROFILE_BIO: &str =
    "Build and ship professional AI-native development systems with unified engine governance.";
const DEFAULT_PROFILE_COMPANY: &str = "SDKWork";
const DEFAULT_PROFILE_LOCATION: &str = "Shanghai";
const DEFAULT_PROFILE_WEBSITE: &str = "https://sdkwork.com";
const DEFAULT_LOCAL_BOOTSTRAP_PASSWORD: &str = "dev123456";
const DEFAULT_EXTERNAL_APP_API_TIMEOUT_MS: u64 = 8_000;
const DEFAULT_LOCAL_TENANT_ID: &str = "tenant-local-default";
const DEFAULT_LOCAL_TENANT_CODE: &str = "birdcoder-local";

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
enum ExternalUserCenterIntegrationKind {
    Headers,
    SdkworkAppApi,
}

impl ExternalUserCenterIntegrationKind {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Headers => "external-header",
            Self::SdkworkAppApi => "sdkwork-app-api",
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
struct ExternalAppApiConfig {
    base_url: String,
    timeout: Duration,
}

#[derive(Clone)]
struct UserCenterResolvedConfig {
    external_app_api: Option<ExternalAppApiConfig>,
    external_headers: ExternalHeaderConfig,
    external_integration: ExternalUserCenterIntegrationKind,
    mode: UserCenterMode,
    provider_key: String,
}

#[derive(Clone)]
struct UserRecord {
    avatar_url: Option<String>,
    display_name: String,
    email: String,
    external_subject: Option<String>,
    id: String,
    metadata_json: Option<String>,
    provider_key: String,
    status: String,
}

#[derive(Clone)]
struct UserSessionRecord {
    created_at: String,
    id: String,
    user_id: String,
    provider_key: String,
    status: String,
    upstream_access_token: Option<String>,
    upstream_auth_token: Option<String>,
    upstream_payload_json: Option<String>,
    upstream_refresh_token: Option<String>,
    upstream_token_type: Option<String>,
    upstream_user_id: Option<String>,
    updated_at: String,
}

#[derive(Clone)]
struct LocalCredentialRecord {
    password_hash: String,
    status: String,
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
    user_id: String,
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
    pub user_id: Option<String>,
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
    pub integration_kind: String,
    pub mode: String,
    pub provider_key: String,
    pub session_header_name: &'static str,
    pub supports_local_credentials: bool,
    pub supports_membership_write: bool,
    pub supports_profile_write: bool,
    pub supports_session_exchange: bool,
    pub upstream_base_url: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterProfilePayload {
    pub avatar_url: Option<String>,
    pub bio: String,
    pub company: String,
    pub display_name: String,
    pub email: String,
    pub user_id: String,
    pub location: String,
    pub website: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterVipMembershipPayload {
    pub credits_per_month: i64,
    pub user_id: String,
    pub plan_id: String,
    pub plan_title: String,
    pub renew_at: Option<String>,
    pub seats: i64,
    pub status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamPlusApiEnvelope<T> {
    code: Option<String>,
    data: Option<T>,
    error_name: Option<String>,
    msg: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiLoginPayload {
    access_token: Option<String>,
    auth_token: Option<String>,
    expires_in: Option<i64>,
    refresh_token: Option<String>,
    token_type: Option<String>,
    user_info: Option<UpstreamAppApiUserInfoPayload>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiUserInfoPayload {
    avatar: Option<String>,
    email: Option<String>,
    id: Option<Value>,
    nickname: Option<String>,
    phone: Option<String>,
    status: Option<String>,
    username: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiUserProfilePayload {
    avatar: Option<String>,
    bio: Option<String>,
    email: Option<String>,
    interests: Option<String>,
    nickname: Option<String>,
    occupation: Option<String>,
    phone: Option<String>,
    region: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiVipInfoPayload {
    expire_time: Option<String>,
    vip_level: Option<i64>,
    vip_level_name: Option<String>,
    vip_points: Option<i64>,
    vip_status: Option<String>,
}

#[derive(Clone)]
struct PersistedUpstreamSessionState {
    access_token: Option<String>,
    auth_token: Option<String>,
    payload_json: Option<String>,
    refresh_token: Option<String>,
    token_type: Option<String>,
    user_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiLoginRequestPayload {
    password: String,
    username: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiRefreshRequestPayload {
    refresh_token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiRegisterRequestPayload {
    confirm_password: String,
    email: Option<String>,
    password: String,
    #[serde(rename = "type")]
    user_type: String,
    username: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiUpdateProfileRequestPayload {
    avatar: Option<String>,
    bio: Option<String>,
    email: Option<String>,
    nickname: Option<String>,
    region: Option<String>,
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

    fn logout(&self, connection: &mut Connection, session_id: Option<&str>) -> Result<(), String>;

    fn metadata(&self) -> UserCenterMetadataPayload;

    fn read_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String>;

    fn read_vip_membership(
        &self,
        connection: &mut Connection,
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
            UserCenterMode::Local => {
                Arc::new(LocalUserCenterProvider::new(resolved.provider_key.clone()))
            }
            UserCenterMode::External => match resolved.external_integration {
                ExternalUserCenterIntegrationKind::Headers => {
                    Arc::new(HeaderExternalUserCenterProvider::new(
                        resolved.provider_key.clone(),
                        resolved.external_headers.clone(),
                    ))
                }
                ExternalUserCenterIntegrationKind::SdkworkAppApi => {
                    if let Some(config) = resolved.external_app_api.clone() {
                        Arc::new(SdkworkAppApiExternalUserCenterProvider::new(
                            resolved.provider_key.clone(),
                            config,
                        ))
                    } else {
                        Arc::new(MisconfiguredUserCenterProvider::new(
                            UserCenterMode::External,
                            resolved.provider_key.clone(),
                            resolved.external_integration.as_str().to_owned(),
                            format!(
                                "{} is required when sdkwork-app-api integration is enabled.",
                                BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV
                            ),
                        ))
                    }
                }
            },
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

    pub fn ensure_user_account(
        &self,
        connection: &mut Connection,
        user_id: Option<&str>,
        email: Option<&str>,
        name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<UserCenterUserPayload, String> {
        let normalized_user_id = normalize_optional_text(user_id);
        let normalized_email = normalize_optional_text(email).map(|value| normalize_email(&value));

        if normalized_user_id.is_none() && normalized_email.is_none() {
            return Err("userId or email is required.".to_owned());
        }

        if let (Some(existing_user_id), None) =
            (normalized_user_id.as_deref(), normalized_email.as_deref())
        {
            let user = load_user_by_id(connection, existing_user_id)?
                .ok_or_else(|| format!("User {existing_user_id} was not found."))?;
            ensure_default_profile_and_membership(connection, &user.id)?;
            return Ok(map_user_record_to_user_payload(user));
        }

        let normalized_email = normalized_email.ok_or_else(|| {
            "email is required when userId cannot be resolved directly.".to_owned()
        })?;
        let metadata = self.metadata();
        let preferred_user_id = normalized_user_id.unwrap_or_else(|| {
            if metadata.mode.eq_ignore_ascii_case("external") {
                build_external_user_id(&metadata.provider_key, None, &normalized_email)
            } else {
                build_local_user_id(&normalized_email)
            }
        });
        let resolved_display_name = resolve_display_name(&normalized_email, name);
        let user = upsert_user_shadow(
            connection,
            &preferred_user_id,
            &normalized_email,
            &resolved_display_name,
            avatar_url,
            &metadata.provider_key,
            None,
        )?;
        ensure_default_profile_and_membership(connection, &user.id)?;
        Ok(map_user_record_to_user_payload(user))
    }

    pub fn read_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String> {
        self.provider.read_profile(connection, session)
    }

    pub fn read_vip_membership(
        &self,
        connection: &mut Connection,
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

fn ensure_default_local_tenant(connection: &mut Connection) -> Result<(), String> {
    let now = crate::current_storage_timestamp();
    connection
        .execute(
            r#"
            INSERT INTO plus_tenant (
                id, uuid, code, name, description, status, created_at, updated_at, version, is_deleted
            )
            VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7, 0, 0)
            ON CONFLICT(id) DO UPDATE SET
                uuid = excluded.uuid,
                code = excluded.code,
                name = excluded.name,
                description = excluded.description,
                status = 'active',
                updated_at = excluded.updated_at,
                is_deleted = 0
            "#,
            params![
                DEFAULT_LOCAL_TENANT_ID,
                stable_entity_uuid("plus_tenant", DEFAULT_LOCAL_TENANT_ID),
                DEFAULT_LOCAL_TENANT_CODE,
                "BirdCoder Local Tenant",
                "Default local tenant aligned with spring-ai-plus style multi-tenant storage.",
                &now,
                &now,
            ],
        )
        .map_err(|error| format!("ensure default plus_tenant failed: {error}"))?;
    Ok(())
}

pub fn ensure_sqlite_user_center_schema(connection: &mut Connection) -> Result<(), String> {
    connection
        .execute_batch(USER_CENTER_SQLITE_SCHEMA)
        .map_err(|error| format!("create sqlite user center schema failed: {error}"))?;

    ensure_default_local_tenant(connection)?;
    Ok(())
}

pub fn ensure_sqlite_user_center_bootstrap_user(connection: &mut Connection) -> Result<(), String> {
    ensure_default_local_tenant(connection)?;

    let bootstrap_email = "local-default@sdkwork-birdcoder.local";
    let bootstrap_name = "BirdCoder Local Owner";
    let bootstrap_avatar = Some(build_avatar_url(bootstrap_email));
    let bootstrap_user = upsert_user_shadow(
        connection,
        crate::BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
        bootstrap_email,
        bootstrap_name,
        bootstrap_avatar.as_deref(),
        "local",
        None,
    )?;
    ensure_default_profile_and_membership(connection, &bootstrap_user.id)?;
    ensure_local_credentials(
        connection,
        &bootstrap_user.id,
        resolve_local_bootstrap_password().as_str(),
        true,
    )?;
    Ok(())
}

fn resolve_user_center_config_from_env() -> UserCenterResolvedConfig {
    let external_app_api = resolve_external_app_api_config_from_env();
    let configured_login_provider = std::env::var(BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());

    let (mode, external_integration) = match configured_login_provider.as_deref() {
        Some("local") => (
            UserCenterMode::Local,
            ExternalUserCenterIntegrationKind::Headers,
        ),
        Some("sdkwork-app-api" | "sdkwork_app_api" | "app-sdk" | "app_api" | "app-api") => (
            UserCenterMode::External,
            ExternalUserCenterIntegrationKind::SdkworkAppApi,
        ),
        Some("headers" | "header" | "external") => (
            UserCenterMode::External,
            ExternalUserCenterIntegrationKind::Headers,
        ),
        _ if external_app_api.is_some() => (
            UserCenterMode::External,
            ExternalUserCenterIntegrationKind::SdkworkAppApi,
        ),
        _ => (
            UserCenterMode::Local,
            ExternalUserCenterIntegrationKind::Headers,
        ),
    };

    let provider_key = std::env::var(BIRDCODER_USER_CENTER_PROVIDER_KEY_ENV)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| match mode {
            UserCenterMode::Local => "local".to_owned(),
            UserCenterMode::External => match external_integration {
                ExternalUserCenterIntegrationKind::Headers => "external".to_owned(),
                ExternalUserCenterIntegrationKind::SdkworkAppApi => "sdkwork-app-api".to_owned(),
            },
        });

    UserCenterResolvedConfig {
        external_app_api,
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
        external_integration,
        mode,
        provider_key,
    }
}

fn resolve_external_app_api_config_from_env() -> Option<ExternalAppApiConfig> {
    let base_url = std::env::var(BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV)
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_owned())
        .filter(|value| !value.is_empty())?;
    let timeout_ms = std::env::var(BIRDCODER_USER_CENTER_APP_API_TIMEOUT_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_EXTERNAL_APP_API_TIMEOUT_MS);
    Some(ExternalAppApiConfig {
        base_url,
        timeout: Duration::from_millis(timeout_ms),
    })
}

fn resolve_local_bootstrap_password() -> String {
    std::env::var(BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD_ENV)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_LOCAL_BOOTSTRAP_PASSWORD.to_owned())
}

fn normalize_email(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_owned())
        .filter(|entry| !entry.is_empty())
}

fn is_active_status(value: &str) -> bool {
    value.trim().eq_ignore_ascii_case("active")
}

fn stable_entity_uuid(entity_name: &str, id: &str) -> String {
    let normalized = sanitize_identifier_segment(id);
    if normalized.is_empty() {
        format!("{entity_name}-{}", uuid::Uuid::new_v4())
    } else {
        format!("{entity_name}-{normalized}")
    }
}

fn parse_metadata_object(metadata_json: Option<&str>) -> Result<Map<String, Value>, String> {
    let Some(raw_value) = metadata_json
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(Map::new());
    };
    serde_json::from_str::<Map<String, Value>>(raw_value)
        .map_err(|error| format!("parse plus_user.metadata_json failed: {error}"))
}

fn metadata_string_value(metadata: &Map<String, Value>, key: &str) -> Option<String> {
    metadata.get(key).and_then(|value| match value {
        Value::String(inner) => normalize_optional_text(Some(inner.as_str())),
        Value::Number(inner) => Some(inner.to_string()),
        Value::Bool(inner) => Some(inner.to_string()),
        _ => None,
    })
}

fn merge_local_user_metadata_json(
    existing_metadata_json: Option<&str>,
    company: Option<&str>,
    location: Option<&str>,
    website: Option<&str>,
) -> Result<Option<String>, String> {
    let mut metadata = parse_metadata_object(existing_metadata_json)?;

    for (key, value) in [
        ("company", company),
        ("location", location),
        ("website", website),
    ] {
        if let Some(normalized_value) = normalize_optional_text(value) {
            metadata.insert(key.to_owned(), Value::String(normalized_value));
        }
    }

    if metadata.is_empty() {
        return Ok(None);
    }

    serde_json::to_string(&metadata)
        .map(Some)
        .map_err(|error| format!("serialize plus_user.metadata_json failed: {error}"))
}

fn project_profile_record_from_user(
    bio: Option<String>,
    metadata_json: Option<String>,
) -> Result<UserProfileRecord, String> {
    let metadata = parse_metadata_object(metadata_json.as_deref())?;
    Ok(UserProfileRecord {
        bio,
        company: metadata_string_value(&metadata, "company"),
        location: metadata_string_value(&metadata, "location"),
        website: metadata_string_value(&metadata, "website"),
    })
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

fn build_local_user_id(email: &str) -> String {
    let normalized = sanitize_identifier_segment(email);
    format!(
        "user-{}",
        if normalized.is_empty() {
            "local-user"
        } else {
            normalized.as_str()
        }
    )
}

fn build_external_user_id(provider_key: &str, subject: Option<&str>, email: &str) -> String {
    let subject_segment = sanitize_identifier_segment(subject.unwrap_or(email));
    let provider_segment = sanitize_identifier_segment(provider_key);
    format!(
        "user-{}-{}",
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

fn hash_local_password(password: &str) -> Result<String, String> {
    let normalized_password = password.trim();
    if normalized_password.is_empty() {
        return Err("Password is required.".to_owned());
    }
    let salt = SaltString::encode_b64(uuid::Uuid::new_v4().as_bytes())
        .map_err(|error| format!("create password salt failed: {error}"))?;
    Argon2::default()
        .hash_password(normalized_password.as_bytes(), &salt)
        .map(|value| value.to_string())
        .map_err(|error| format!("hash local password failed: {error}"))
}

fn verify_local_password(password_hash: &str, candidate_password: &str) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|error| format!("parse local password hash failed: {error}"))?;
    Ok(Argon2::default()
        .verify_password(candidate_password.trim().as_bytes(), &parsed_hash)
        .is_ok())
}

fn map_user_record_to_user_payload(user: UserRecord) -> UserCenterUserPayload {
    UserCenterUserPayload {
        avatar_url: user.avatar_url,
        email: user.email,
        id: user.id,
        name: user.display_name,
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

fn load_user_by_id(connection: &Connection, user_id: &str) -> Result<Option<UserRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT
                id,
                email,
                nickname,
                avatar_url,
                provider_key,
                external_subject,
                status,
                metadata_json
            FROM plus_user
            WHERE id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![user_id],
            |row| {
                Ok(UserRecord {
                    id: row.get(0)?,
                    email: row.get(1)?,
                    display_name: row.get(2)?,
                    avatar_url: row.get(3)?,
                    provider_key: row.get(4)?,
                    external_subject: row.get(5)?,
                    status: row.get(6)?,
                    metadata_json: row.get(7)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load user {user_id} failed: {error}"))
}

fn load_user_by_email(connection: &Connection, email: &str) -> Result<Option<UserRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT
                id,
                email,
                nickname,
                avatar_url,
                provider_key,
                external_subject,
                status,
                metadata_json
            FROM plus_user
            WHERE (email = ?1 OR username = ?1) AND is_deleted = 0
            LIMIT 1
            "#,
            params![email],
            |row| {
                Ok(UserRecord {
                    id: row.get(0)?,
                    email: row.get(1)?,
                    display_name: row.get(2)?,
                    avatar_url: row.get(3)?,
                    provider_key: row.get(4)?,
                    external_subject: row.get(5)?,
                    status: row.get(6)?,
                    metadata_json: row.get(7)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load user by email {email} failed: {error}"))
}

fn load_local_credentials(
    connection: &Connection,
    user_id: &str,
) -> Result<Option<LocalCredentialRecord>, String> {
    let record = connection
        .query_row(
            r#"
            SELECT password, status
            FROM plus_user
            WHERE id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![user_id],
            |row| {
                Ok(LocalCredentialRecord {
                    password_hash: row.get(0)?,
                    status: row.get(1)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load local credentials for {user_id} failed: {error}"))?;

    Ok(record.and_then(|record| {
        normalize_optional_text(Some(record.password_hash.as_str())).map(|password_hash| {
            LocalCredentialRecord {
                password_hash,
                status: record.status,
            }
        })
    }))
}

fn load_session_record(
    connection: &Connection,
    session_id: &str,
) -> Result<Option<UserSessionRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT
                id,
                user_id,
                provider_key,
                status,
                created_at,
                updated_at,
                upstream_auth_token,
                upstream_access_token,
                upstream_refresh_token,
                upstream_token_type,
                upstream_user_id,
                upstream_payload_json
            FROM plus_user_auth_session
            WHERE id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![session_id],
            |row| {
                Ok(UserSessionRecord {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    provider_key: row.get(2)?,
                    status: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    upstream_auth_token: row.get(6)?,
                    upstream_access_token: row.get(7)?,
                    upstream_refresh_token: row.get(8)?,
                    upstream_token_type: row.get(9)?,
                    upstream_user_id: row.get(10)?,
                    upstream_payload_json: row.get(11)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load user session {session_id} failed: {error}"))
}

fn load_profile_record(
    connection: &Connection,
    user_id: &str,
) -> Result<Option<UserProfileRecord>, String> {
    let record = connection
        .query_row(
            r#"
            SELECT bio, metadata_json
            FROM plus_user
            WHERE id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![user_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .optional()
        .map_err(|error| format!("load user profile {user_id} failed: {error}"))?;

    record
        .map(|(bio, metadata_json)| project_profile_record_from_user(bio, metadata_json))
        .transpose()
}

fn load_vip_subscription_record(
    connection: &Connection,
    user_id: &str,
) -> Result<Option<VipSubscriptionRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT
                user_id,
                vip_level_id,
                vip_level_name,
                status,
                monthly_credits,
                seat_limit,
                valid_to
            FROM plus_vip_user
            WHERE user_id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![user_id],
            |row| {
                Ok(VipSubscriptionRecord {
                    user_id: row.get(0)?,
                    plan_id: row
                        .get::<_, Option<String>>(1)?
                        .unwrap_or_else(|| "free".to_owned()),
                    plan_title: row
                        .get::<_, Option<String>>(2)?
                        .unwrap_or_else(|| "Free".to_owned()),
                    status: row.get(3)?,
                    credits_per_month: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                    seats: row.get::<_, Option<i64>>(5)?.unwrap_or(1),
                    renew_at: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load vip subscription {user_id} failed: {error}"))
}

fn upsert_user_shadow(
    connection: &mut Connection,
    preferred_user_id: &str,
    email: &str,
    display_name: &str,
    avatar_url: Option<&str>,
    provider_key: &str,
    external_subject: Option<&str>,
) -> Result<UserRecord, String> {
    let normalized_email = normalize_email(email);
    if normalized_email.is_empty() {
        return Err("Email is required.".to_owned());
    }

    let existing_user = if let Some(user) = load_user_by_id(connection, preferred_user_id)? {
        Some(user)
    } else {
        load_user_by_email(connection, &normalized_email)?
    };
    let resolved_user_id = existing_user
        .as_ref()
        .map(|user| user.id.clone())
        .unwrap_or_else(|| preferred_user_id.to_owned());
    let now = crate::current_storage_timestamp();
    let resolved_display_name = if display_name.trim().is_empty() {
        resolve_display_name(&normalized_email, None)
    } else {
        display_name.trim().to_owned()
    };
    let resolved_avatar_url =
        normalize_optional_text(avatar_url).unwrap_or_else(|| build_avatar_url(&normalized_email));
    let resolved_provider_key = existing_user
        .as_ref()
        .and_then(|user| normalize_optional_text(Some(user.provider_key.as_str())))
        .unwrap_or_else(|| provider_key.trim().to_owned());

    connection
        .execute(
            r#"
            INSERT INTO plus_user (
                id, uuid, tenant_id, organization_id, username, nickname, password, salt,
                platform, type, scene, email, phone, country_code, province_code, city_code,
                district_code, address, bio, avatar_url, provider_key, external_subject,
                metadata_json, status, created_at, updated_at, version, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, NULL, ?4, ?5, '', NULL, 'default', 'default', 'birdcoder',
                ?6, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?7, ?8, ?9, ?10, 'active',
                ?11, ?12, 0, 0
            )
            ON CONFLICT(id) DO UPDATE SET
                tenant_id = COALESCE(plus_user.tenant_id, excluded.tenant_id),
                updated_at = excluded.updated_at,
                is_deleted = 0,
                username = excluded.username,
                email = excluded.email,
                nickname = excluded.nickname,
                avatar_url = excluded.avatar_url,
                provider_key = COALESCE(NULLIF(plus_user.provider_key, ''), excluded.provider_key),
                external_subject = COALESCE(excluded.external_subject, plus_user.external_subject),
                metadata_json = COALESCE(plus_user.metadata_json, excluded.metadata_json),
                status = 'active'
            "#,
            params![
                &resolved_user_id,
                stable_entity_uuid("plus_user", &resolved_user_id),
                DEFAULT_LOCAL_TENANT_ID,
                &normalized_email,
                &resolved_display_name,
                &normalized_email,
                &resolved_avatar_url,
                &resolved_provider_key,
                &normalize_optional_text(external_subject),
                existing_user
                    .as_ref()
                    .and_then(|user| user.metadata_json.clone()),
                &now,
                &now,
            ],
        )
        .map_err(|error| format!("upsert user {resolved_user_id} failed: {error}"))?;

    if let Some(normalized_subject) = normalize_optional_text(external_subject) {
        connection
            .execute(
                r#"
                INSERT INTO plus_oauth_account (
                    id, uuid, user_id, oauth_provider, open_id, union_id, app_id, oauth_user_info_json,
                    status, created_at, updated_at, version, is_deleted
                )
                VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, 'active', ?6, ?7, 0, 0)
                ON CONFLICT(oauth_provider, open_id) DO UPDATE SET
                    user_id = excluded.user_id,
                    status = 'active',
                    updated_at = excluded.updated_at,
                    is_deleted = 0
                "#,
                params![
                    format!("oauth-{provider_key}-{resolved_user_id}"),
                    stable_entity_uuid(
                        "plus_oauth_account",
                        format!("{provider_key}:{normalized_subject}").as_str(),
                    ),
                    &resolved_user_id,
                    provider_key,
                    &normalized_subject,
                    &now,
                    &now,
                ],
            )
            .map_err(|error| {
                format!(
                    "upsert plus_oauth_account for {resolved_user_id} failed: {error}"
                )
            })?;
    }

    load_user_by_id(connection, &resolved_user_id)?
        .ok_or_else(|| format!("user {resolved_user_id} was not found after upsert"))
}

fn ensure_default_profile_and_membership(
    connection: &mut Connection,
    user_id: &str,
) -> Result<(), String> {
    upsert_profile_shadow(connection, user_id, None, None, None, None)?;
    upsert_vip_subscription_shadow(connection, user_id, None, None, None, None, None, None)?;
    Ok(())
}

fn ensure_local_credentials(
    connection: &mut Connection,
    user_id: &str,
    password: &str,
    overwrite_existing: bool,
) -> Result<(), String> {
    let existing = load_local_credentials(connection, user_id)?;
    if existing.as_ref().is_some() && !overwrite_existing {
        return Ok(());
    }
    let now = crate::current_storage_timestamp();
    let password_hash = hash_local_password(password)?;
    connection
        .execute(
            r#"
            UPDATE plus_user
            SET
                updated_at = ?2,
                password = ?3,
                status = 'active',
                is_deleted = 0,
                tenant_id = COALESCE(tenant_id, ?4)
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![user_id, &now, &password_hash, DEFAULT_LOCAL_TENANT_ID,],
        )
        .map_err(|error| format!("upsert local credentials for {user_id} failed: {error}"))?;
    Ok(())
}

fn create_persisted_session(
    connection: &mut Connection,
    user: &UserRecord,
    provider_mode: &UserCenterMode,
    provider_key: &str,
    upstream_state: Option<&PersistedUpstreamSessionState>,
) -> Result<UserCenterSessionPayload, String> {
    let session_id = crate::create_identifier("user-session");
    let now = crate::current_storage_timestamp();
    let upstream_auth_token = upstream_state.and_then(|state| state.auth_token.clone());
    let upstream_access_token = upstream_state.and_then(|state| state.access_token.clone());
    let upstream_refresh_token = upstream_state.and_then(|state| state.refresh_token.clone());
    let upstream_token_type = upstream_state.and_then(|state| state.token_type.clone());
    let upstream_user_id = upstream_state.and_then(|state| state.user_id.clone());
    let upstream_payload_json = upstream_state.and_then(|state| state.payload_json.clone());

    connection
        .execute(
            r#"
            INSERT INTO plus_user_auth_session (
                id, uuid, user_id, provider_key, provider_mode,
                upstream_auth_token, upstream_access_token, upstream_refresh_token,
                upstream_token_type, upstream_user_id, upstream_payload_json, status,
                created_at, updated_at, version, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'active',
                ?12, ?13, 0, 0
            )
            "#,
            params![
                &session_id,
                stable_entity_uuid("plus_user_auth_session", &session_id),
                &user.id,
                provider_key,
                provider_mode.as_str(),
                &upstream_auth_token,
                &upstream_access_token,
                &upstream_refresh_token,
                &upstream_token_type,
                &upstream_user_id,
                &upstream_payload_json,
                &now,
                &now,
            ],
        )
        .map_err(|error| format!("create user session {session_id} failed: {error}"))?;

    Ok(UserCenterSessionPayload {
        created_at: now.clone(),
        provider_key: provider_key.to_owned(),
        provider_mode: provider_mode.as_str().to_owned(),
        session_id,
        updated_at: now,
        user: UserCenterUserPayload {
            avatar_url: user.avatar_url.clone(),
            email: user.email.clone(),
            id: user.id.clone(),
            name: user.display_name.clone(),
        },
    })
}

fn session_record_to_upstream_state(
    session: &UserSessionRecord,
) -> Option<PersistedUpstreamSessionState> {
    if session.upstream_auth_token.is_none()
        && session.upstream_access_token.is_none()
        && session.upstream_refresh_token.is_none()
        && session.upstream_token_type.is_none()
        && session.upstream_user_id.is_none()
        && session.upstream_payload_json.is_none()
    {
        return None;
    }

    Some(PersistedUpstreamSessionState {
        access_token: session.upstream_access_token.clone(),
        auth_token: session.upstream_auth_token.clone(),
        payload_json: session.upstream_payload_json.clone(),
        refresh_token: session.upstream_refresh_token.clone(),
        token_type: session.upstream_token_type.clone(),
        user_id: session.upstream_user_id.clone(),
    })
}

fn update_session_upstream_state(
    connection: &mut Connection,
    session_id: &str,
    upstream_state: &PersistedUpstreamSessionState,
) -> Result<(), String> {
    let now = crate::current_storage_timestamp();
    connection
        .execute(
            r#"
            UPDATE plus_user_auth_session
            SET
                updated_at = ?2,
                upstream_auth_token = ?3,
                upstream_access_token = ?4,
                upstream_refresh_token = ?5,
                upstream_token_type = ?6,
                upstream_user_id = ?7,
                upstream_payload_json = ?8
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![
                session_id,
                &now,
                &upstream_state.auth_token,
                &upstream_state.access_token,
                &upstream_state.refresh_token,
                &upstream_state.token_type,
                &upstream_state.user_id,
                &upstream_state.payload_json,
            ],
        )
        .map_err(|error| format!("update upstream session state {session_id} failed: {error}"))?;
    Ok(())
}

fn require_normalized_email(email: &str) -> Result<String, String> {
    let normalized_email = normalize_email(email);
    if normalized_email.is_empty() {
        return Err("Email is required.".to_owned());
    }
    Ok(normalized_email)
}

fn require_password_input(password: Option<&str>, operation_name: &str) -> Result<String, String> {
    let normalized_password = normalize_optional_text(password)
        .ok_or_else(|| format!("Password is required to {operation_name}."))?;
    if normalized_password.len() < 6 {
        return Err("Password must be at least 6 characters.".to_owned());
    }
    Ok(normalized_password)
}

fn build_user_center_metadata(
    mode: &UserCenterMode,
    provider_key: &str,
    integration_kind: &str,
    supports_local_credentials: bool,
    supports_session_exchange: bool,
    supports_profile_write: bool,
    supports_membership_write: bool,
    upstream_base_url: Option<String>,
) -> UserCenterMetadataPayload {
    UserCenterMetadataPayload {
        integration_kind: integration_kind.to_owned(),
        mode: mode.as_str().to_owned(),
        provider_key: provider_key.to_owned(),
        session_header_name: BIRDCODER_SESSION_HEADER_NAME,
        supports_local_credentials,
        supports_membership_write,
        supports_profile_write,
        supports_session_exchange,
        upstream_base_url,
    }
}

fn normalize_value_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(inner)) => normalize_optional_text(Some(inner.as_str())),
        Some(Value::Number(inner)) => Some(inner.to_string()),
        Some(Value::Bool(inner)) => Some(inner.to_string()),
        _ => None,
    }
}

fn format_upstream_http_error(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "The upstream user-center request failed.".to_owned();
    }

    if let Ok(parsed) = serde_json::from_str::<UpstreamPlusApiEnvelope<Value>>(trimmed) {
        return parsed
            .msg
            .or(parsed.error_name)
            .or_else(|| normalize_value_string(parsed.data.as_ref()))
            .unwrap_or_else(|| trimmed.to_owned());
    }

    trimmed.to_owned()
}

fn is_upstream_success_code(code: Option<&str>) -> bool {
    let Some(normalized_code) = code.map(str::trim) else {
        return true;
    };
    normalized_code.is_empty()
        || normalized_code == "2000"
        || normalized_code == "200"
        || normalized_code == "0"
        || normalized_code.starts_with('2')
}

fn build_external_app_api_url(base_url: &str, path: &str) -> String {
    let normalized_base_url = base_url.trim_end_matches('/');
    if normalized_base_url.ends_with("/app/v3/api") {
        return format!("{normalized_base_url}{path}");
    }
    if normalized_base_url.ends_with("/app/v3") {
        return format!("{normalized_base_url}/api{path}");
    }
    if normalized_base_url.ends_with("/api") {
        return format!("{normalized_base_url}{path}");
    }
    format!("{normalized_base_url}/app/v3/api{path}")
}

fn upstream_request_json<TResponse: DeserializeOwned>(
    config: &ExternalAppApiConfig,
    method: &str,
    path: &str,
    authorization_header: Option<&str>,
    body: Option<Value>,
) -> Result<Option<TResponse>, String> {
    let url = build_external_app_api_url(&config.base_url, path);
    let agent = ureq::agent();
    let request = match method {
        "GET" => agent.get(url.as_str()),
        "POST" => agent.post(url.as_str()),
        "PUT" => agent.put(url.as_str()),
        _ => {
            return Err(format!(
                "Unsupported upstream app-api method \"{method}\" for {path}."
            ))
        }
    };
    let request = request.set("Accept", "application/json");
    let request = if let Some(authorization_header) = authorization_header {
        request.set("Authorization", authorization_header)
    } else {
        request
    };

    let response = match body {
        Some(body) => {
            let serialized_body = body.to_string();
            request
                .set("Content-Type", "application/json")
                .send_string(serialized_body.as_str())
        }
        None => request.call(),
    };

    match response {
        Ok(response) => {
            let response_body = response.into_string().map_err(|error| {
                format!("read upstream user-center response body for {path} failed: {error}")
            })?;
            if response_body.trim().is_empty() {
                return Ok(None);
            }
            let envelope =
                serde_json::from_str::<UpstreamPlusApiEnvelope<TResponse>>(response_body.as_str())
                    .map_err(|error| {
                        format!(
                            "parse upstream user-center response body for {path} failed: {error}"
                        )
                    })?;
            if !is_upstream_success_code(envelope.code.as_deref()) {
                return Err(envelope
                    .msg
                    .or(envelope.error_name)
                    .unwrap_or_else(|| format!("Upstream user center rejected {method} {path}.")));
            }
            Ok(envelope.data)
        }
        Err(ureq::Error::Status(status, response)) => {
            let response_body = response.into_string().unwrap_or_default();
            Err(format!(
                "Upstream user center request {method} {path} failed with status {status}: {}",
                format_upstream_http_error(response_body.as_str())
            ))
        }
        Err(ureq::Error::Transport(error)) => Err(format!(
            "Upstream user center request {method} {path} failed after {:?}: {error}",
            config.timeout
        )),
    }
}

fn build_upstream_authorization_header(
    upstream_state: &PersistedUpstreamSessionState,
) -> Option<String> {
    let token = upstream_state
        .auth_token
        .as_deref()
        .or(upstream_state.access_token.as_deref())?;
    let normalized_token = token.trim();
    if normalized_token.is_empty() {
        return None;
    }
    if normalized_token.contains(' ') {
        return Some(normalized_token.to_owned());
    }
    let token_type = upstream_state
        .token_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Bearer");
    Some(format!("{token_type} {normalized_token}"))
}

fn upsert_profile_shadow(
    connection: &mut Connection,
    user_id: &str,
    bio: Option<&str>,
    company: Option<&str>,
    location: Option<&str>,
    website: Option<&str>,
) -> Result<UserProfileRecord, String> {
    let now = crate::current_storage_timestamp();
    let existing = load_profile_record(connection, user_id)?;
    let resolved_bio = normalize_optional_text(bio)
        .or_else(|| existing.as_ref().and_then(|record| record.bio.clone()))
        .unwrap_or_else(|| DEFAULT_PROFILE_BIO.to_owned());
    let resolved_company = normalize_optional_text(company)
        .or_else(|| existing.as_ref().and_then(|record| record.company.clone()))
        .unwrap_or_else(|| DEFAULT_PROFILE_COMPANY.to_owned());
    let resolved_location = normalize_optional_text(location)
        .or_else(|| existing.as_ref().and_then(|record| record.location.clone()))
        .unwrap_or_else(|| DEFAULT_PROFILE_LOCATION.to_owned());
    let resolved_website = normalize_optional_text(website)
        .or_else(|| existing.as_ref().and_then(|record| record.website.clone()))
        .unwrap_or_else(|| DEFAULT_PROFILE_WEBSITE.to_owned());
    let existing_metadata_json =
        load_user_by_id(connection, user_id)?.and_then(|user| user.metadata_json);
    let metadata_json = merge_local_user_metadata_json(
        existing_metadata_json.as_deref(),
        Some(resolved_company.as_str()),
        Some(resolved_location.as_str()),
        Some(resolved_website.as_str()),
    )?;

    connection
        .execute(
            r#"
            UPDATE plus_user
            SET
                updated_at = ?2,
                bio = ?3,
                metadata_json = ?4,
                status = 'active',
                is_deleted = 0
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![user_id, &now, &resolved_bio, &metadata_json,],
        )
        .map_err(|error| format!("upsert profile shadow {user_id} failed: {error}"))?;

    load_profile_record(connection, user_id)?
        .ok_or_else(|| format!("profile shadow {user_id} was not found after upsert"))
}

fn upsert_vip_subscription_shadow(
    connection: &mut Connection,
    user_id: &str,
    plan_id: Option<&str>,
    plan_title: Option<&str>,
    status: Option<&str>,
    credits_per_month: Option<i64>,
    seats: Option<i64>,
    renew_at: Option<&str>,
) -> Result<VipSubscriptionRecord, String> {
    let now = crate::current_storage_timestamp();
    let existing = load_vip_subscription_record(connection, user_id)?;
    let resolved_plan_id = normalize_optional_text(plan_id)
        .or_else(|| existing.as_ref().map(|record| record.plan_id.clone()))
        .unwrap_or_else(|| "free".to_owned());
    let resolved_plan_title = normalize_optional_text(plan_title)
        .or_else(|| existing.as_ref().map(|record| record.plan_title.clone()))
        .unwrap_or_else(|| "Free".to_owned());
    let resolved_status = normalize_optional_text(status)
        .or_else(|| existing.as_ref().map(|record| record.status.clone()))
        .unwrap_or_else(|| "inactive".to_owned());
    let resolved_credits_per_month = credits_per_month
        .or_else(|| existing.as_ref().map(|record| record.credits_per_month))
        .unwrap_or(0);
    let resolved_seats = seats
        .or_else(|| existing.as_ref().map(|record| record.seats))
        .unwrap_or(1);
    let resolved_renew_at =
        normalize_optional_text(renew_at).or_else(|| existing.and_then(|record| record.renew_at));

    connection
        .execute(
            r#"
            INSERT INTO plus_vip_user (
                id, uuid, user_id, vip_level_id, vip_level_name, status, point_balance,
                total_recharged_points, monthly_credits, seat_limit, valid_from, valid_to,
                last_active_time, remark, created_at, updated_at, version, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, ?8, NULL, ?9, ?10, NULL, ?11, ?12, 0, 0
            )
            ON CONFLICT(user_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0,
                vip_level_id = excluded.vip_level_id,
                vip_level_name = excluded.vip_level_name,
                status = excluded.status,
                monthly_credits = excluded.monthly_credits,
                seat_limit = excluded.seat_limit,
                valid_to = excluded.valid_to,
                last_active_time = excluded.last_active_time
            "#,
            params![
                format!("plus-vip-user-{user_id}"),
                stable_entity_uuid("plus_vip_user", user_id),
                user_id,
                &resolved_plan_id,
                &resolved_plan_title,
                &resolved_status,
                resolved_credits_per_month,
                resolved_seats,
                &resolved_renew_at,
                &now,
                &now,
                &now,
            ],
        )
        .map_err(|error| format!("upsert vip membership shadow {user_id} failed: {error}"))?;

    load_vip_subscription_record(connection, user_id)?
        .ok_or_else(|| format!("vip membership shadow {user_id} was not found after upsert"))
}

fn build_profile_payload_from_user(
    user: &UserRecord,
    profile: Option<UserProfileRecord>,
) -> UserCenterProfilePayload {
    UserCenterProfilePayload {
        avatar_url: user.avatar_url.clone(),
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
        display_name: user.display_name.clone(),
        email: user.email.clone(),
        user_id: user.id.clone(),
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

fn read_persisted_session_payload(
    connection: &Connection,
    session_id: &str,
    provider_mode: &UserCenterMode,
) -> Result<Option<UserCenterSessionPayload>, String> {
    let Some(session) = load_session_record(connection, session_id)? else {
        return Ok(None);
    };
    if !is_active_status(&session.status) {
        return Ok(None);
    }

    let Some(user) = load_user_by_id(connection, &session.user_id)? else {
        return Ok(None);
    };
    if !is_active_status(&user.status) {
        return Ok(None);
    }

    Ok(Some(UserCenterSessionPayload {
        created_at: session.created_at,
        provider_key: session.provider_key,
        provider_mode: provider_mode.as_str().to_owned(),
        session_id: session.id,
        updated_at: session.updated_at,
        user: UserCenterUserPayload {
            avatar_url: user.avatar_url,
            email: user.email,
            id: user.id,
            name: user.display_name,
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
        user_id: session.user.id.clone(),
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
    user_id: &str,
    membership: Option<VipSubscriptionRecord>,
) -> UserCenterVipMembershipPayload {
    let resolved = membership.unwrap_or(VipSubscriptionRecord {
        user_id: user_id.to_owned(),
        plan_id: "free".to_owned(),
        plan_title: "Free".to_owned(),
        status: "inactive".to_owned(),
        credits_per_month: 0,
        seats: 1,
        renew_at: None,
    });

    UserCenterVipMembershipPayload {
        credits_per_month: resolved.credits_per_month,
        user_id: resolved.user_id,
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
            UPDATE plus_user_auth_session
            SET updated_at = ?2, is_deleted = 1, status = 'revoked'
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![session_id, &now],
        )
        .map_err(|error| format!("revoke user auth session {session_id} failed: {error}"))?;
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
            UPDATE plus_user
            SET updated_at = ?2, nickname = ?3, avatar_url = ?4, is_deleted = 0, status = 'active'
            WHERE id = ?1
            "#,
            params![&session.user.id, &now, &display_name, &avatar_url],
        )
        .map_err(|error| {
            format!(
                "update user profile shell {} failed: {error}",
                session.user.id
            )
        })?;

    upsert_profile_shadow(
        connection,
        &session.user.id,
        request.bio.as_deref(),
        request.company.as_deref(),
        request.location.as_deref(),
        request.website.as_deref(),
    )?;

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
    upsert_vip_subscription_shadow(
        connection,
        &session.user.id,
        request.plan_id.as_deref(),
        request.plan_title.as_deref(),
        request.status.as_deref(),
        request.credits_per_month,
        request.seats,
        request.renew_at.as_deref(),
    )?;

    Ok(build_vip_membership_payload(
        &session.user.id,
        load_vip_subscription_record(connection, &session.user.id)?,
    ))
}

#[derive(Clone)]
struct MisconfiguredUserCenterProvider {
    message: String,
    metadata: UserCenterMetadataPayload,
}

impl MisconfiguredUserCenterProvider {
    fn new(
        mode: UserCenterMode,
        provider_key: String,
        integration_kind: String,
        message: String,
    ) -> Self {
        Self {
            message,
            metadata: build_user_center_metadata(
                &mode,
                &provider_key,
                &integration_kind,
                false,
                false,
                false,
                false,
                None,
            ),
        }
    }
}

impl UserCenterProvider for MisconfiguredUserCenterProvider {
    fn exchange_session(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err(self.message.clone())
    }

    fn login(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err(self.message.clone())
    }

    fn logout(
        &self,
        _connection: &mut Connection,
        _session_id: Option<&str>,
    ) -> Result<(), String> {
        Ok(())
    }

    fn metadata(&self) -> UserCenterMetadataPayload {
        self.metadata.clone()
    }

    fn read_profile(
        &self,
        _connection: &mut Connection,
        _session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String> {
        Err(self.message.clone())
    }

    fn read_vip_membership(
        &self,
        _connection: &mut Connection,
        _session: &UserCenterSessionPayload,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        Err(self.message.clone())
    }

    fn register(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterRegisterRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err(self.message.clone())
    }

    fn resolve_session(
        &self,
        _connection: &Connection,
        _headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String> {
        Ok(None)
    }

    fn update_profile(
        &self,
        _connection: &mut Connection,
        _session: &UserCenterSessionPayload,
        _request: &UpdateUserCenterProfileRequest,
    ) -> Result<UserCenterProfilePayload, String> {
        Err(self.message.clone())
    }

    fn update_vip_membership(
        &self,
        _connection: &mut Connection,
        _session: &UserCenterSessionPayload,
        _request: &UpdateUserCenterVipMembershipRequest,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        Err(self.message.clone())
    }
}

#[derive(Clone)]
struct LocalUserCenterProvider {
    provider_key: String,
}

impl LocalUserCenterProvider {
    fn new(provider_key: String) -> Self {
        Self { provider_key }
    }

    fn register_local_user(
        &self,
        connection: &mut Connection,
        email: &str,
        explicit_name: Option<&str>,
        password: &str,
    ) -> Result<UserRecord, String> {
        let normalized_email = require_normalized_email(email)?;
        if let Some(existing_user) = load_user_by_email(connection, &normalized_email)? {
            if existing_user.provider_key != self.provider_key {
                return Err(format!(
                    "The account {normalized_email} is already managed by provider {}.",
                    existing_user.provider_key
                ));
            }
            if load_local_credentials(connection, &existing_user.id)?.is_some() {
                return Err(format!("The account {normalized_email} already exists."));
            }
        }

        let preferred_user_id = load_user_by_email(connection, &normalized_email)?
            .map(|user| user.id)
            .unwrap_or_else(|| build_local_user_id(&normalized_email));
        let display_name = resolve_display_name(&normalized_email, explicit_name);
        let avatar_url = build_avatar_url(&normalized_email);
        let user = upsert_user_shadow(
            connection,
            &preferred_user_id,
            &normalized_email,
            &display_name,
            Some(avatar_url.as_str()),
            &self.provider_key,
            None,
        )?;
        ensure_default_profile_and_membership(connection, &user.id)?;
        ensure_local_credentials(connection, &user.id, password, false)?;
        Ok(user)
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
        let normalized_email = require_normalized_email(&request.email)?;
        let password = require_password_input(request.password.as_deref(), "sign in")?;
        let invalid_credentials_error = || "Invalid email or password.".to_owned();
        let user = load_user_by_email(connection, &normalized_email)?
            .ok_or_else(invalid_credentials_error)?;
        let credentials =
            load_local_credentials(connection, &user.id)?.ok_or_else(invalid_credentials_error)?;
        if !is_active_status(&user.status) || !is_active_status(&credentials.status) {
            return Err(invalid_credentials_error());
        }
        if !verify_local_password(&credentials.password_hash, &password)? {
            return Err(invalid_credentials_error());
        }
        ensure_default_profile_and_membership(connection, &user.id)?;
        create_persisted_session(
            connection,
            &user,
            &UserCenterMode::Local,
            &self.provider_key,
            None,
        )
    }

    fn logout(&self, connection: &mut Connection, session_id: Option<&str>) -> Result<(), String> {
        if let Some(normalized_session_id) = session_id
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            revoke_session(connection, normalized_session_id)?;
        }
        Ok(())
    }

    fn metadata(&self) -> UserCenterMetadataPayload {
        build_user_center_metadata(
            &UserCenterMode::Local,
            &self.provider_key,
            "local",
            true,
            false,
            true,
            true,
            None,
        )
    }

    fn read_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String> {
        Ok(build_profile_payload(
            session,
            load_profile_record(connection, &session.user.id)?,
        ))
    }

    fn read_vip_membership(
        &self,
        connection: &mut Connection,
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
        let password = require_password_input(request.password.as_deref(), "register")?;
        let user = self.register_local_user(
            connection,
            &request.email,
            request.name.as_deref(),
            &password,
        )?;
        create_persisted_session(
            connection,
            &user,
            &UserCenterMode::Local,
            &self.provider_key,
            None,
        )
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
struct HeaderExternalUserCenterProvider {
    external_headers: ExternalHeaderConfig,
    provider_key: String,
}

impl HeaderExternalUserCenterProvider {
    fn new(provider_key: String, external_headers: ExternalHeaderConfig) -> Self {
        Self {
            external_headers,
            provider_key,
        }
    }

    fn resolve_header_backed_session(
        &self,
        headers: &HeaderMap,
    ) -> Option<UserCenterSessionPayload> {
        let email = read_header_value(headers, &self.external_headers.email_header)?;
        let user_id = read_header_value(headers, &self.external_headers.id_header)
            .unwrap_or_else(|| build_external_user_id(&self.provider_key, None, &email));
        let name = read_header_value(headers, &self.external_headers.name_header)
            .unwrap_or_else(|| resolve_display_name(&email, None));
        let avatar_url = read_header_value(headers, &self.external_headers.avatar_header);
        let now = crate::current_storage_timestamp();

        Some(UserCenterSessionPayload {
            created_at: now.clone(),
            provider_key: self.provider_key.clone(),
            provider_mode: UserCenterMode::External.as_str().to_owned(),
            session_id: format!("external-header:{user_id}"),
            updated_at: now,
            user: UserCenterUserPayload {
                avatar_url,
                email,
                id: user_id,
                name,
            },
        })
    }

    fn ensure_shadow_user_for_session(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<(), String> {
        upsert_user_shadow(
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

impl UserCenterProvider for HeaderExternalUserCenterProvider {
    fn exchange_session(
        &self,
        connection: &mut Connection,
        request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_email = require_normalized_email(&request.email)?;
        let provider_key = normalize_optional_text(request.provider_key.as_deref())
            .unwrap_or_else(|| self.provider_key.clone());
        let preferred_user_id =
            normalize_optional_text(request.user_id.as_deref()).unwrap_or_else(|| {
                build_external_user_id(
                    provider_key.as_str(),
                    request.subject.as_deref(),
                    normalized_email.as_str(),
                )
            });
        let display_name = resolve_display_name(&normalized_email, request.name.as_deref());
        let user = upsert_user_shadow(
            connection,
            &preferred_user_id,
            &normalized_email,
            &display_name,
            request.avatar_url.as_deref(),
            provider_key.as_str(),
            request.subject.as_deref(),
        )?;
        ensure_default_profile_and_membership(connection, &user.id)?;
        create_persisted_session(
            connection,
            &user,
            &UserCenterMode::External,
            provider_key.as_str(),
            None,
        )
    }

    fn login(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err("Login is delegated to the configured third-party header-based user center.".to_owned())
    }

    fn logout(&self, connection: &mut Connection, session_id: Option<&str>) -> Result<(), String> {
        if let Some(normalized_session_id) = session_id
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            revoke_session(connection, normalized_session_id)?;
        }
        Ok(())
    }

    fn metadata(&self) -> UserCenterMetadataPayload {
        build_user_center_metadata(
            &UserCenterMode::External,
            &self.provider_key,
            ExternalUserCenterIntegrationKind::Headers.as_str(),
            false,
            true,
            true,
            true,
            None,
        )
    }

    fn read_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String> {
        Ok(build_profile_payload(
            session,
            load_profile_record(connection, &session.user.id)?,
        ))
    }

    fn read_vip_membership(
        &self,
        connection: &mut Connection,
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
        Err(
            "Registration is delegated to the configured third-party header-based user center."
                .to_owned(),
        )
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
        self.ensure_shadow_user_for_session(connection, session)?;
        upsert_profile_record(connection, session, request)
    }

    fn update_vip_membership(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterVipMembershipRequest,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        self.ensure_shadow_user_for_session(connection, session)?;
        upsert_vip_membership_record(connection, session, request)
    }
}

#[derive(Clone)]
struct SdkworkAppApiExternalUserCenterProvider {
    config: ExternalAppApiConfig,
    provider_key: String,
}

impl SdkworkAppApiExternalUserCenterProvider {
    fn new(provider_key: String, config: ExternalAppApiConfig) -> Self {
        Self {
            config,
            provider_key,
        }
    }

    fn build_upstream_session_state(
        &self,
        login_payload: &UpstreamAppApiLoginPayload,
    ) -> PersistedUpstreamSessionState {
        PersistedUpstreamSessionState {
            access_token: login_payload.access_token.clone(),
            auth_token: login_payload.auth_token.clone(),
            payload_json: serde_json::to_string(login_payload).ok(),
            refresh_token: login_payload.refresh_token.clone(),
            token_type: login_payload
                .token_type
                .clone()
                .or_else(|| Some("Bearer".to_owned())),
            user_id: login_payload
                .user_info
                .as_ref()
                .and_then(|user_info| normalize_value_string(user_info.id.as_ref())),
        }
    }

    fn request_login(
        &self,
        email: &str,
        password: &str,
    ) -> Result<UpstreamAppApiLoginPayload, String> {
        upstream_request_json::<UpstreamAppApiLoginPayload>(
            &self.config,
            "POST",
            "/auth/login",
            None,
            Some(
                serde_json::to_value(UpstreamAppApiLoginRequestPayload {
                    password: password.to_owned(),
                    username: email.to_owned(),
                })
                .map_err(|error| format!("serialize upstream login request failed: {error}"))?,
            ),
        )?
        .ok_or_else(|| "Upstream user center returned an empty login payload.".to_owned())
    }

    fn refresh_session_state(
        &self,
        connection: &mut Connection,
        session_record: &UserSessionRecord,
    ) -> Result<PersistedUpstreamSessionState, String> {
        let refresh_token = session_record
            .upstream_refresh_token
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                "The external user-center session cannot be refreshed because no refresh token is stored.".to_owned()
            })?;
        let refreshed = upstream_request_json::<UpstreamAppApiLoginPayload>(
            &self.config,
            "POST",
            "/auth/refresh",
            None,
            Some(
                serde_json::to_value(UpstreamAppApiRefreshRequestPayload {
                    refresh_token: refresh_token.to_owned(),
                })
                .map_err(|error| format!("serialize upstream refresh request failed: {error}"))?,
            ),
        )?
        .ok_or_else(|| "Upstream user center returned an empty refresh payload.".to_owned())?;
        let refreshed_state = self.build_upstream_session_state(&refreshed);
        update_session_upstream_state(connection, &session_record.id, &refreshed_state)?;
        Ok(refreshed_state)
    }

    fn request_profile_with_state(
        &self,
        upstream_state: &PersistedUpstreamSessionState,
    ) -> Result<UpstreamAppApiUserProfilePayload, String> {
        let authorization_header =
            build_upstream_authorization_header(upstream_state).ok_or_else(|| {
                "The external user-center session does not contain a valid auth token.".to_owned()
            })?;
        upstream_request_json::<UpstreamAppApiUserProfilePayload>(
            &self.config,
            "GET",
            "/user/profile",
            Some(authorization_header.as_str()),
            None,
        )?
        .ok_or_else(|| "Upstream user center returned an empty profile payload.".to_owned())
    }

    fn request_vip_info_with_state(
        &self,
        upstream_state: &PersistedUpstreamSessionState,
    ) -> Result<UpstreamAppApiVipInfoPayload, String> {
        let authorization_header =
            build_upstream_authorization_header(upstream_state).ok_or_else(|| {
                "The external user-center session does not contain a valid auth token.".to_owned()
            })?;
        upstream_request_json::<UpstreamAppApiVipInfoPayload>(
            &self.config,
            "GET",
            "/vip/info",
            Some(authorization_header.as_str()),
            None,
        )?
        .ok_or_else(|| "Upstream user center returned an empty VIP payload.".to_owned())
    }

    fn update_profile_with_state(
        &self,
        upstream_state: &PersistedUpstreamSessionState,
        request: &UpdateUserCenterProfileRequest,
    ) -> Result<UpstreamAppApiUserProfilePayload, String> {
        let authorization_header =
            build_upstream_authorization_header(upstream_state).ok_or_else(|| {
                "The external user-center session does not contain a valid auth token.".to_owned()
            })?;
        upstream_request_json::<UpstreamAppApiUserProfilePayload>(
            &self.config,
            "PUT",
            "/user/profile",
            Some(authorization_header.as_str()),
            Some(
                serde_json::to_value(UpstreamAppApiUpdateProfileRequestPayload {
                    avatar: normalize_optional_text(request.avatar_url.as_deref()),
                    bio: normalize_optional_text(request.bio.as_deref()),
                    email: None,
                    nickname: normalize_optional_text(request.display_name.as_deref()),
                    region: normalize_optional_text(request.location.as_deref()),
                })
                .map_err(|error| {
                    format!("serialize upstream profile update request failed: {error}")
                })?,
            ),
        )?
        .ok_or_else(|| "Upstream user center returned an empty updated profile payload.".to_owned())
    }

    fn sync_user_from_login_payload(
        &self,
        connection: &mut Connection,
        email_fallback: &str,
        display_name_hint: Option<&str>,
        login_payload: &UpstreamAppApiLoginPayload,
    ) -> Result<UserRecord, String> {
        let user_info = login_payload.user_info.as_ref();
        let resolved_email = user_info
            .and_then(|payload| payload.email.as_deref())
            .map(normalize_email)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| normalize_email(email_fallback));
        let resolved_subject = user_info
            .and_then(|payload| normalize_value_string(payload.id.as_ref()))
            .or_else(|| {
                user_info.and_then(|payload| normalize_optional_text(payload.username.as_deref()))
            });
        let preferred_user_id = build_external_user_id(
            &self.provider_key,
            resolved_subject.as_deref(),
            &resolved_email,
        );
        let display_name = resolve_display_name(
            &resolved_email,
            user_info
                .and_then(|payload| payload.nickname.as_deref())
                .or(display_name_hint),
        );
        let avatar_url = user_info.and_then(|payload| payload.avatar.as_deref());
        let user = upsert_user_shadow(
            connection,
            &preferred_user_id,
            &resolved_email,
            &display_name,
            avatar_url,
            &self.provider_key,
            resolved_subject.as_deref(),
        )?;
        ensure_default_profile_and_membership(connection, &user.id)?;
        Ok(user)
    }

    fn sync_user_from_profile_payload(
        &self,
        connection: &mut Connection,
        existing_user: &UserRecord,
        profile_payload: &UpstreamAppApiUserProfilePayload,
        upstream_state: &PersistedUpstreamSessionState,
    ) -> Result<UserRecord, String> {
        let resolved_email = profile_payload
            .email
            .as_deref()
            .map(normalize_email)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| existing_user.email.clone());
        let display_name = resolve_display_name(
            &resolved_email,
            profile_payload
                .nickname
                .as_deref()
                .or(Some(existing_user.display_name.as_str())),
        );
        let user = upsert_user_shadow(
            connection,
            &existing_user.id,
            &resolved_email,
            &display_name,
            profile_payload
                .avatar
                .as_deref()
                .or(existing_user.avatar_url.as_deref()),
            &self.provider_key,
            upstream_state
                .user_id
                .as_deref()
                .or(existing_user.external_subject.as_deref()),
        )?;
        ensure_default_profile_and_membership(connection, &user.id)?;
        Ok(user)
    }
}

impl UserCenterProvider for SdkworkAppApiExternalUserCenterProvider {
    fn exchange_session(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err("Session exchange is not supported for sdkwork-app-api integration.".to_owned())
    }

    fn login(
        &self,
        connection: &mut Connection,
        request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_email = require_normalized_email(&request.email)?;
        let password = require_password_input(request.password.as_deref(), "sign in")?;
        let login_payload = self.request_login(&normalized_email, &password)?;
        let user =
            self.sync_user_from_login_payload(connection, &normalized_email, None, &login_payload)?;
        let upstream_state = self.build_upstream_session_state(&login_payload);
        create_persisted_session(
            connection,
            &user,
            &UserCenterMode::External,
            &self.provider_key,
            Some(&upstream_state),
        )
    }

    fn logout(&self, connection: &mut Connection, session_id: Option<&str>) -> Result<(), String> {
        let Some(normalized_session_id) = session_id
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        else {
            return Ok(());
        };

        if let Some(session_record) = load_session_record(connection, normalized_session_id)? {
            if let Some(upstream_state) = session_record_to_upstream_state(&session_record) {
                if let Some(authorization_header) =
                    build_upstream_authorization_header(&upstream_state)
                {
                    let _ = upstream_request_json::<Value>(
                        &self.config,
                        "POST",
                        "/auth/logout",
                        Some(authorization_header.as_str()),
                        None,
                    );
                }
            }
        }

        revoke_session(connection, normalized_session_id)?;
        Ok(())
    }

    fn metadata(&self) -> UserCenterMetadataPayload {
        build_user_center_metadata(
            &UserCenterMode::External,
            &self.provider_key,
            ExternalUserCenterIntegrationKind::SdkworkAppApi.as_str(),
            true,
            false,
            true,
            false,
            Some(self.config.base_url.clone()),
        )
    }

    fn read_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterProfilePayload, String> {
        let session_record = load_session_record(connection, &session.session_id)?
            .ok_or_else(|| format!("Session {} was not found.", session.session_id))?;
        let existing_user = load_user_by_id(connection, &session_record.user_id)?
            .ok_or_else(|| format!("User {} was not found.", session_record.user_id))?;
        let mut upstream_state =
            session_record_to_upstream_state(&session_record).ok_or_else(|| {
                "The external user-center session does not contain upstream token state.".to_owned()
            })?;

        let profile_payload = match self.request_profile_with_state(&upstream_state) {
            Ok(profile_payload) => profile_payload,
            Err(error) if error.contains("status 401") || error.contains("status 403") => {
                upstream_state = self.refresh_session_state(connection, &session_record)?;
                self.request_profile_with_state(&upstream_state)?
            }
            Err(error) => return Err(error),
        };

        let user = self.sync_user_from_profile_payload(
            connection,
            &existing_user,
            &profile_payload,
            &upstream_state,
        )?;
        let profile = upsert_profile_shadow(
            connection,
            &user.id,
            profile_payload.bio.as_deref(),
            None,
            profile_payload.region.as_deref(),
            None,
        )?;
        Ok(build_profile_payload_from_user(&user, Some(profile)))
    }

    fn read_vip_membership(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        let session_record = load_session_record(connection, &session.session_id)?
            .ok_or_else(|| format!("Session {} was not found.", session.session_id))?;
        let mut upstream_state =
            session_record_to_upstream_state(&session_record).ok_or_else(|| {
                "The external user-center session does not contain upstream token state.".to_owned()
            })?;
        let vip_payload = match self.request_vip_info_with_state(&upstream_state) {
            Ok(vip_payload) => vip_payload,
            Err(error) if error.contains("status 401") || error.contains("status 403") => {
                upstream_state = self.refresh_session_state(connection, &session_record)?;
                self.request_vip_info_with_state(&upstream_state)?
            }
            Err(error) => return Err(error),
        };
        let vip_level = vip_payload.vip_level.unwrap_or(0);
        let normalized_status = normalize_optional_text(vip_payload.vip_status.as_deref())
            .map(|value| value.to_ascii_lowercase())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| {
                if vip_level > 0 {
                    "active".to_owned()
                } else {
                    "inactive".to_owned()
                }
            });
        let membership = upsert_vip_subscription_shadow(
            connection,
            &session_record.user_id,
            Some(
                if vip_level > 0 {
                    format!("vip-level-{vip_level}")
                } else {
                    "free".to_owned()
                }
                .as_str(),
            ),
            vip_payload
                .vip_level_name
                .as_deref()
                .or(Some(if vip_level > 0 { "VIP" } else { "Free" })),
            Some(normalized_status.as_str()),
            Some(vip_payload.vip_points.unwrap_or(0)),
            Some(1),
            vip_payload.expire_time.as_deref(),
        )?;
        Ok(build_vip_membership_payload(
            &session_record.user_id,
            Some(membership),
        ))
    }

    fn register(
        &self,
        connection: &mut Connection,
        request: &UserCenterRegisterRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_email = require_normalized_email(&request.email)?;
        let password = require_password_input(request.password.as_deref(), "register")?;
        let _ = upstream_request_json::<UpstreamAppApiUserInfoPayload>(
            &self.config,
            "POST",
            "/auth/register",
            None,
            Some(
                serde_json::to_value(UpstreamAppApiRegisterRequestPayload {
                    confirm_password: password.clone(),
                    email: Some(normalized_email.clone()),
                    password: password.clone(),
                    user_type: "EMAIL".to_owned(),
                    username: normalized_email.clone(),
                })
                .map_err(|error| format!("serialize upstream register request failed: {error}"))?,
            ),
        )?;
        let login_payload = self.request_login(&normalized_email, &password)?;
        let user = self.sync_user_from_login_payload(
            connection,
            &normalized_email,
            request.name.as_deref(),
            &login_payload,
        )?;
        let upstream_state = self.build_upstream_session_state(&login_payload);
        create_persisted_session(
            connection,
            &user,
            &UserCenterMode::External,
            &self.provider_key,
            Some(&upstream_state),
        )
    }

    fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String> {
        let Some(session_id) = read_session_header(headers) else {
            return Ok(None);
        };
        read_persisted_session_payload(connection, &session_id, &UserCenterMode::External)
    }

    fn update_profile(
        &self,
        connection: &mut Connection,
        session: &UserCenterSessionPayload,
        request: &UpdateUserCenterProfileRequest,
    ) -> Result<UserCenterProfilePayload, String> {
        let session_record = load_session_record(connection, &session.session_id)?
            .ok_or_else(|| format!("Session {} was not found.", session.session_id))?;
        let existing_user = load_user_by_id(connection, &session_record.user_id)?
            .ok_or_else(|| format!("User {} was not found.", session_record.user_id))?;
        let mut upstream_state =
            session_record_to_upstream_state(&session_record).ok_or_else(|| {
                "The external user-center session does not contain upstream token state.".to_owned()
            })?;

        let updated_profile_payload = match self.update_profile_with_state(&upstream_state, request)
        {
            Ok(updated_profile_payload) => updated_profile_payload,
            Err(error) if error.contains("status 401") || error.contains("status 403") => {
                upstream_state = self.refresh_session_state(connection, &session_record)?;
                self.update_profile_with_state(&upstream_state, request)?
            }
            Err(error) => return Err(error),
        };

        let user = self.sync_user_from_profile_payload(
            connection,
            &existing_user,
            &updated_profile_payload,
            &upstream_state,
        )?;
        let profile = upsert_profile_shadow(
            connection,
            &user.id,
            updated_profile_payload
                .bio
                .as_deref()
                .or(request.bio.as_deref()),
            request.company.as_deref(),
            updated_profile_payload
                .region
                .as_deref()
                .or(request.location.as_deref()),
            request.website.as_deref(),
        )?;
        Ok(build_profile_payload_from_user(&user, Some(profile)))
    }

    fn update_vip_membership(
        &self,
        _connection: &mut Connection,
        _session: &UserCenterSessionPayload,
        _request: &UpdateUserCenterVipMembershipRequest,
    ) -> Result<UserCenterVipMembershipPayload, String> {
        Err("VIP membership is managed by the external sdkwork-app-api user center.".to_owned())
    }
}
