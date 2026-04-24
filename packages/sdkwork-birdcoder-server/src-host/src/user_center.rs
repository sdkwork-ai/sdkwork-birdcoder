use std::{collections::BTreeMap, sync::Arc, time::Duration};

use crate::user_center_validation::{
    build_external_app_api_request_headers, resolve_external_app_api_handshake_config,
    ExternalAppApiConfig, ExternalAppApiRequestContext, PersistedUpstreamSessionState,
};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::http::HeaderMap;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use hmac::{Hmac, Mac};
use rusqlite::{params, types::ValueRef, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

pub use crate::user_center_validation::USER_CENTER_SESSION_HEADER_NAME as BIRDCODER_SESSION_HEADER_NAME;

const BIRDCODER_USER_CENTER_NAMESPACE: &str = "sdkwork-birdcoder";
pub const BIRDCODER_AUTHORIZATION_HEADER_NAME: &str = "Authorization";
pub const BIRDCODER_ACCESS_TOKEN_HEADER_NAME: &str = "Access-Token";
pub const BIRDCODER_AUTHORIZATION_SCHEME: &str = "Bearer";

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
const BIRDCODER_USER_CENTER_APP_API_APP_ID_ENV: &str = "BIRDCODER_USER_CENTER_APP_API_APP_ID";
const BIRDCODER_USER_CENTER_APP_API_SECRET_ID_ENV: &str = "BIRDCODER_USER_CENTER_APP_API_SECRET_ID";
const BIRDCODER_USER_CENTER_APP_API_SHARED_SECRET_ENV: &str =
    "BIRDCODER_USER_CENTER_APP_API_SHARED_SECRET";
const BIRDCODER_USER_CENTER_APP_API_OAUTH_PROVIDERS_ENV: &str =
    "BIRDCODER_USER_CENTER_APP_API_OAUTH_PROVIDERS";
const BIRDCODER_LOCAL_OAUTH_PROVIDERS_ENV: &str = "BIRDCODER_LOCAL_OAUTH_PROVIDERS";
const BIRDCODER_LOCAL_OAUTH_CODE_SECRET_ENV: &str = "BIRDCODER_LOCAL_OAUTH_CODE_SECRET";
const BIRDCODER_LOCAL_OAUTH_CODE_TTL_SECONDS_ENV: &str = "BIRDCODER_LOCAL_OAUTH_CODE_TTL_SECONDS";
const BIRDCODER_LOCAL_BOOTSTRAP_EMAIL_ENV: &str = "BIRDCODER_LOCAL_BOOTSTRAP_EMAIL";
const BIRDCODER_LOCAL_BOOTSTRAP_PHONE_ENV: &str = "BIRDCODER_LOCAL_BOOTSTRAP_PHONE";
const BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD_ENV: &str = "BIRDCODER_LOCAL_BOOTSTRAP_PASSWORD";
const BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV: &str = "BIRDCODER_LOCAL_VERIFY_CODE_FIXED";
const BIRDCODER_LOCAL_VERIFY_CODE_TTL_SECONDS_ENV: &str = "BIRDCODER_LOCAL_VERIFY_CODE_TTL_SECONDS";

const USER_CENTER_SQLITE_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS plus_tenant (
    id INTEGER PRIMARY KEY,
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
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NULL,
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
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NULL,
    organization_id TEXT NULL,
    user_id INTEGER NOT NULL,
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
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NULL,
    organization_id TEXT NULL,
    user_id INTEGER NOT NULL UNIQUE,
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
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NULL,
    organization_id TEXT NULL,
    user_id INTEGER NOT NULL,
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

CREATE TABLE IF NOT EXISTS plus_user_verify_code (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NULL,
    organization_id TEXT NULL,
    provider_key TEXT NOT NULL,
    verify_type TEXT NOT NULL,
    scene TEXT NOT NULL,
    target TEXT NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT NULL,
    metadata_json TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plus_user_verify_code_target
ON plus_user_verify_code(target, verify_type, scene, status, is_deleted);

CREATE TABLE IF NOT EXISTS plus_user_login_qr (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NULL,
    organization_id TEXT NULL,
    provider_key TEXT NOT NULL,
    qr_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    session_id INTEGER NULL,
    user_id INTEGER NULL,
    scanned_at TEXT NULL,
    confirmed_at TEXT NULL,
    expires_at TEXT NOT NULL,
    metadata_json TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plus_user_login_qr_lookup
ON plus_user_login_qr(qr_key, status, expires_at, is_deleted);
"#;

const DEFAULT_PROFILE_BIO: &str =
    "Build and ship professional AI-native development systems with unified engine governance.";
const DEFAULT_PROFILE_COMPANY: &str = "SDKWork";
const DEFAULT_PROFILE_LOCATION: &str = "Shanghai";
const DEFAULT_PROFILE_WEBSITE: &str = "https://sdkwork.com";
const DEFAULT_LOCAL_BOOTSTRAP_EMAIL: &str = "local-default@sdkwork-birdcoder.local";
const DEFAULT_LOCAL_BOOTSTRAP_PHONE: &str = "13800000000";
const DEFAULT_LOCAL_BOOTSTRAP_PASSWORD: &str = "dev123456";
const DEFAULT_EXTERNAL_APP_API_TIMEOUT_MS: u64 = 8_000;
const DEFAULT_EXTERNAL_APP_API_OAUTH_PROVIDERS: &[&str] = &["wechat", "douyin", "github"];
const DEFAULT_LOCAL_OAUTH_PROVIDERS: &[&str] = &["wechat", "douyin", "github"];
const DEFAULT_LOCAL_TENANT_ID: &str = "0";
const DEFAULT_LOCAL_TENANT_CODE: &str = "birdcoder-local";
const DEFAULT_LOGIN_QR_TTL_SECONDS: u64 = 300;
const DEFAULT_LOCAL_OAUTH_CODE_TTL_SECONDS: u64 = 300;
const DEFAULT_LOCAL_VERIFY_CODE_TTL_SECONDS: u64 = 600;
const LOCAL_PHONE_SHADOW_EMAIL_SUFFIX: &str = "@sms.sdkwork-birdcoder.local";
const EXTERNAL_ACCOUNT_SHADOW_EMAIL_SUFFIX: &str = "@external.sdkwork-birdcoder.local";
const LOCAL_OAUTH_SHADOW_EMAIL_SUFFIX: &str = "@oauth.sdkwork-birdcoder.local";

#[derive(Clone)]
enum UserCenterMode {
    Local,
    External,
}

#[derive(Clone)]
enum ExternalUserCenterIntegrationKind {
    Headers,
    SdkworkCloudAppApi,
}

fn resolve_user_center_public_mode(
    mode: &UserCenterMode,
    external_integration: &ExternalUserCenterIntegrationKind,
) -> &'static str {
    match mode {
        UserCenterMode::Local => "builtin-local",
        UserCenterMode::External => match external_integration {
            ExternalUserCenterIntegrationKind::Headers => "external-user-center",
            ExternalUserCenterIntegrationKind::SdkworkCloudAppApi => "sdkwork-cloud-app-api",
        },
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
    configuration_error: Option<String>,
    external_app_api: Option<ExternalAppApiConfig>,
    external_headers: ExternalHeaderConfig,
    external_integration: ExternalUserCenterIntegrationKind,
    mode: UserCenterMode,
    provider_key: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct UserCenterSeedPolicy {
    authority_seed_enabled: bool,
    auth_development_seed_enabled: bool,
    fixed_verification_code_enabled: bool,
}

#[derive(Clone)]
struct UserRecord {
    avatar_url: Option<String>,
    created_at: String,
    display_name: String,
    email: String,
    external_subject: Option<String>,
    id: String,
    metadata_json: Option<String>,
    organization_id: Option<String>,
    phone: Option<String>,
    provider_key: String,
    status: String,
    tenant_id: Option<String>,
    updated_at: String,
    uuid: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalOAuthAuthorizationCodeClaims {
    avatar_url: Option<String>,
    email: String,
    expires_at: i64,
    issued_at: i64,
    name: String,
    phone: Option<String>,
    provider: String,
    subject: String,
}

#[derive(Clone)]
struct LocalOAuthProviderProfile {
    avatar_url: Option<String>,
    email: String,
    name: String,
    phone: Option<String>,
    provider: String,
    subject: String,
}

#[derive(Clone)]
struct LocalOAuthAuthority {
    code_secret: String,
    code_ttl: Duration,
    provider_order: Vec<String>,
    providers: BTreeMap<String, LocalOAuthProviderProfile>,
}

#[derive(Clone)]
struct UserSessionRecord {
    created_at: String,
    id: String,
    provider_mode: String,
    provider_key: String,
    status: String,
    upstream_access_token: Option<String>,
    upstream_auth_token: Option<String>,
    upstream_payload_json: Option<String>,
    upstream_refresh_token: Option<String>,
    upstream_token_type: Option<String>,
    upstream_user_id: Option<String>,
    updated_at: String,
    user_id: String,
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
    created_at: String,
    organization_id: Option<String>,
    user_id: String,
    plan_id: String,
    plan_title: String,
    renew_at: Option<String>,
    seats: i64,
    status: String,
    tenant_id: Option<String>,
    updated_at: String,
    uuid: String,
}

#[derive(Clone)]
struct VerifyCodeRecord {
    code: String,
    expires_at: String,
    id: String,
}

#[derive(Clone)]
struct LoginQrRecord {
    expires_at: String,
    id: String,
    qr_key: String,
    session_id: Option<String>,
    status: String,
    user_id: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterLoginRequest {
    pub account: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterRegisterRequest {
    pub channel: Option<String>,
    pub confirm_password: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
    pub password: Option<String>,
    pub phone: Option<String>,
    pub username: Option<String>,
    pub verification_code: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterSendVerifyCodeRequest {
    pub scene: String,
    pub target: String,
    pub verify_type: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterEmailCodeLoginRequest {
    pub app_version: Option<String>,
    pub code: String,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub device_type: Option<String>,
    pub email: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterPhoneCodeLoginRequest {
    pub app_version: Option<String>,
    pub code: String,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub device_type: Option<String>,
    pub phone: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterPasswordResetChallengeRequest {
    pub account: String,
    pub channel: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterPasswordResetRequest {
    pub account: String,
    pub code: String,
    pub confirm_password: Option<String>,
    pub new_password: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterOAuthAuthorizationRequest {
    pub provider: String,
    pub redirect_uri: String,
    pub scope: Option<String>,
    pub state: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterOAuthLoginRequest {
    pub code: String,
    pub device_id: Option<String>,
    pub device_type: Option<String>,
    pub provider: String,
    pub state: Option<String>,
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
pub struct UserCenterLoginQrConfirmRequest {
    pub qr_key: String,
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
    pub uuid: String,
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub avatar_url: Option<String>,
    pub email: String,
    pub id: String,
    pub name: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterSessionPayload {
    pub access_token: String,
    pub auth_token: String,
    pub uuid: String,
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub created_at: String,
    pub provider_key: String,
    pub provider_mode: String,
    pub refresh_token: Option<String>,
    pub session_id: String,
    pub token_type: String,
    pub updated_at: String,
    pub user: UserCenterUserPayload,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterLoginQrCodePayload {
    pub description: Option<String>,
    pub expire_time: Option<i64>,
    pub qr_content: Option<String>,
    pub qr_key: String,
    pub qr_url: Option<String>,
    pub title: Option<String>,
    #[serde(rename = "type")]
    pub qr_type: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterLoginQrStatusPayload {
    pub session: Option<UserCenterSessionPayload>,
    pub status: String,
    pub user: Option<UserCenterUserPayload>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterOAuthUrlPayload {
    pub auth_url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCenterMetadataPayload {
    pub integration_kind: String,
    pub login_methods: Vec<String>,
    pub mode: String,
    pub oauth_login_enabled: bool,
    pub oauth_providers: Vec<String>,
    pub provider_key: String,
    pub qr_login_enabled: bool,
    pub recovery_methods: Vec<String>,
    pub register_methods: Vec<String>,
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
    pub uuid: String,
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
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
    pub uuid: String,
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
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
    phone: Option<String>,
    #[serde(rename = "type")]
    user_type: String,
    username: String,
    verification_code: Option<String>,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiVerifyCodeSendRequestPayload {
    device_id: Option<String>,
    target: String,
    #[serde(rename = "type")]
    scene: String,
    verify_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiEmailCodeLoginRequestPayload {
    app_version: Option<String>,
    code: String,
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    email: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiPhoneCodeLoginRequestPayload {
    app_version: Option<String>,
    code: String,
    device_id: Option<String>,
    device_name: Option<String>,
    device_type: Option<String>,
    phone: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiPasswordResetChallengeRequestPayload {
    account: String,
    channel: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiPasswordResetRequestPayload {
    account: String,
    code: String,
    confirm_password: Option<String>,
    new_password: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiOAuthUrlPayload {
    auth_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiOAuthAuthorizationRequestPayload {
    provider: String,
    redirect_uri: String,
    scope: Option<String>,
    state: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpstreamAppApiOAuthLoginRequestPayload {
    code: String,
    device_id: Option<String>,
    device_type: Option<String>,
    provider: String,
    state: Option<String>,
}

trait UserCenterProvider: Send + Sync {
    fn exchange_session(
        &self,
        connection: &mut Connection,
        request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String>;

    fn get_oauth_authorization_url(
        &self,
        _request: &UserCenterOAuthAuthorizationRequest,
    ) -> Result<UserCenterOAuthUrlPayload, String> {
        Err("OAuth authorization is not enabled for the configured user center.".to_owned())
    }

    fn login_with_email_code(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterEmailCodeLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err(
            "Email verification-code login is not enabled for the configured user center."
                .to_owned(),
        )
    }

    fn login_with_oauth(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterOAuthLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err("OAuth login is not enabled for the configured user center.".to_owned())
    }

    fn login_with_phone_code(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterPhoneCodeLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err(
            "Phone verification-code login is not enabled for the configured user center."
                .to_owned(),
        )
    }

    fn login(
        &self,
        connection: &mut Connection,
        request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String>;

    fn logout(&self, connection: &mut Connection, session_id: Option<&str>) -> Result<(), String>;

    fn metadata(&self) -> UserCenterMetadataPayload;

    fn request_password_reset(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterPasswordResetChallengeRequest,
    ) -> Result<(), String> {
        Err("Password reset is not enabled for the configured user center.".to_owned())
    }

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

    fn reset_password(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterPasswordResetRequest,
    ) -> Result<(), String> {
        Err("Password reset confirmation is not enabled for the configured user center.".to_owned())
    }

    fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String>;

    fn send_verify_code(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterSendVerifyCodeRequest,
    ) -> Result<(), String> {
        Err("Verification-code delivery is not enabled for the configured user center.".to_owned())
    }

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
        if let Some(configuration_error) = resolved.configuration_error.clone() {
            return Self {
                provider: Arc::new(MisconfiguredUserCenterProvider::new(
                    resolved.mode,
                    resolved.external_integration,
                    resolved.provider_key,
                    configuration_error,
                )),
            };
        }

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
                ExternalUserCenterIntegrationKind::SdkworkCloudAppApi => {
                    if let Some(config) = resolved.external_app_api.clone() {
                        Arc::new(SdkworkCloudAppApiExternalUserCenterProvider::new(
                            resolved.provider_key.clone(),
                            config,
                        ))
                    } else {
                        Arc::new(MisconfiguredUserCenterProvider::new(
                            UserCenterMode::External,
                            ExternalUserCenterIntegrationKind::SdkworkCloudAppApi,
                            resolved.provider_key.clone(),
                            format!(
                                "{} is required when sdkwork-cloud-app-api integration is enabled.",
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

    pub fn get_oauth_authorization_url(
        &self,
        request: &UserCenterOAuthAuthorizationRequest,
    ) -> Result<UserCenterOAuthUrlPayload, String> {
        self.provider.get_oauth_authorization_url(request)
    }

    pub fn login(
        &self,
        connection: &mut Connection,
        request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        self.provider.login(connection, request)
    }

    pub fn login_with_email_code(
        &self,
        connection: &mut Connection,
        request: &UserCenterEmailCodeLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        self.provider.login_with_email_code(connection, request)
    }

    pub fn login_with_oauth(
        &self,
        connection: &mut Connection,
        request: &UserCenterOAuthLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        self.provider.login_with_oauth(connection, request)
    }

    pub fn login_with_phone_code(
        &self,
        connection: &mut Connection,
        request: &UserCenterPhoneCodeLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        self.provider.login_with_phone_code(connection, request)
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

    pub fn generate_login_qr_code(
        &self,
        connection: &mut Connection,
        request_base_url: Option<&str>,
    ) -> Result<UserCenterLoginQrCodePayload, String> {
        let metadata = self.metadata();
        let record = create_login_qr_record(
            connection,
            &metadata.provider_key,
            Duration::from_secs(DEFAULT_LOGIN_QR_TTL_SECONDS),
        )?;
        Ok(build_login_qr_code_payload(&record, request_base_url))
    }

    pub fn resolve_login_qr_status(
        &self,
        connection: &mut Connection,
        qr_key: &str,
    ) -> Result<UserCenterLoginQrStatusPayload, String> {
        resolve_login_qr_status_payload(connection, qr_key)
    }

    pub fn mark_login_qr_scanned(
        &self,
        connection: &mut Connection,
        qr_key: &str,
    ) -> Result<UserCenterLoginQrStatusPayload, String> {
        let normalized_qr_key = normalize_login_qr_key(qr_key)?;
        let Some(record) = load_login_qr_record(connection, &normalized_qr_key)? else {
            return Err(format!("Login QR code {normalized_qr_key} was not found."));
        };

        if record.status != "confirmed" {
            let expires_at_millis =
                crate::parse_storage_timestamp_millis(&record.expires_at).unwrap_or_default();
            if expires_at_millis < current_epoch_millis()? {
                expire_login_qr_record(connection, &record.id)?;
                return Ok(UserCenterLoginQrStatusPayload {
                    session: None,
                    status: "expired".to_owned(),
                    user: None,
                });
            }

            touch_login_qr_scanned(connection, &record.id)?;
        }

        let refreshed_record = load_login_qr_record(connection, &normalized_qr_key)?
            .ok_or_else(|| format!("Login QR code {normalized_qr_key} was not found."))?;
        build_login_qr_status_payload(connection, &refreshed_record)
    }

    pub fn confirm_login_qr(
        &self,
        connection: &mut Connection,
        headers: &HeaderMap,
        qr_key: &str,
    ) -> Result<UserCenterLoginQrStatusPayload, String> {
        let session = self
            .resolve_session(connection, headers)?
            .ok_or_else(|| "A valid signed-in user-center session is required.".to_owned())?;
        let normalized_qr_key = normalize_login_qr_key(qr_key)?;
        let Some(record) = load_login_qr_record(connection, &normalized_qr_key)? else {
            return Err(format!("Login QR code {normalized_qr_key} was not found."));
        };

        if record.status != "confirmed" {
            let expires_at_millis =
                crate::parse_storage_timestamp_millis(&record.expires_at).unwrap_or_default();
            if expires_at_millis < current_epoch_millis()? {
                expire_login_qr_record(connection, &record.id)?;
                return Err("Login QR code has expired.".to_owned());
            }
        }

        if record.status == "confirmed" {
            return build_login_qr_status_payload(connection, &record);
        }

        confirm_login_qr_record(connection, &record.id, &session)?;
        let refreshed_record = load_login_qr_record(connection, &normalized_qr_key)?
            .ok_or_else(|| format!("Login QR code {normalized_qr_key} was not found."))?;
        build_login_qr_status_payload(connection, &refreshed_record)
    }

    pub fn request_password_reset(
        &self,
        connection: &mut Connection,
        request: &UserCenterPasswordResetChallengeRequest,
    ) -> Result<(), String> {
        self.provider.request_password_reset(connection, request)
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
            if !metadata.mode.eq_ignore_ascii_case("builtin-local") {
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

    pub fn reset_password(
        &self,
        connection: &mut Connection,
        request: &UserCenterPasswordResetRequest,
    ) -> Result<(), String> {
        self.provider.reset_password(connection, request)
    }

    pub fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String> {
        self.provider.resolve_session(connection, headers)
    }

    pub fn send_verify_code(
        &self,
        connection: &mut Connection,
        request: &UserCenterSendVerifyCodeRequest,
    ) -> Result<(), String> {
        self.provider.send_verify_code(connection, request)
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

fn backfill_global_business_columns(
    connection: &mut Connection,
    table_name: &str,
) -> Result<(), String> {
    let query = format!(
        r#"
        SELECT id, uuid, tenant_id, organization_id
        FROM {table_name}
        WHERE is_deleted = 0
        "#
    );
    let rows = {
        let mut statement = connection
            .prepare(&query)
            .map_err(|error| format!("prepare {table_name} canonical migration failed: {error}"))?;
        let mut rows = statement
            .query([])
            .map_err(|error| format!("query {table_name} canonical migration failed: {error}"))?;
        let mut records = Vec::new();
        while let Some(row) = rows
            .next()
            .map_err(|error| format!("read {table_name} canonical migration row failed: {error}"))?
        {
            records.push((
                sqlite_row_required_string_value(row, 0, &format!("{table_name}.id"))
                    .map_err(|error| format!("read {table_name} id failed: {error}"))?,
                row.get::<_, Option<String>>(1)
                    .map_err(|error| format!("read {table_name} uuid failed: {error}"))?,
                sqlite_row_optional_string_value(row, 2, &format!("{table_name}.tenant_id"))
                    .map_err(|error| format!("read {table_name} tenant_id failed: {error}"))?,
                row.get::<_, Option<String>>(3).map_err(|error| {
                    format!("read {table_name} organization_id failed: {error}")
                })?,
            ));
        }
        records
    };

    let update_statement = format!(
        r#"
        UPDATE {table_name}
        SET uuid = ?2, tenant_id = ?3, organization_id = ?4
        WHERE id = ?1
        "#
    );
    for (id, uuid, tenant_id, organization_id) in rows {
        let resolved_uuid = normalize_optional_text(uuid.as_deref())
            .unwrap_or_else(|| stable_entity_uuid(table_name, &id));
        let resolved_tenant_id = normalize_optional_text(tenant_id.as_deref())
            .unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned());
        let resolved_organization_id = normalize_optional_text(organization_id.as_deref());
        connection
            .execute(
                &update_statement,
                params![
                    &id,
                    &resolved_uuid,
                    &resolved_tenant_id,
                    &resolved_organization_id
                ],
            )
            .map_err(|error| {
                format!("backfill {table_name} canonical fields {id} failed: {error}")
            })?;
    }

    Ok(())
}

fn backfill_plus_user_business_columns(connection: &mut Connection) -> Result<(), String> {
    backfill_global_business_columns(connection, "plus_user")
}

fn backfill_user_owned_business_columns(
    connection: &mut Connection,
    table_name: &str,
    user_id_column: &str,
) -> Result<(), String> {
    let query = format!(
        r#"
        SELECT
            child.id,
            child.uuid,
            child.tenant_id,
            child.organization_id,
            plus_user.tenant_id,
            plus_user.organization_id
        FROM {table_name} child
        LEFT JOIN plus_user
            ON plus_user.id = child.{user_id_column}
           AND plus_user.is_deleted = 0
        WHERE child.is_deleted = 0
        "#
    );
    let rows = {
        let mut statement = connection
            .prepare(&query)
            .map_err(|error| format!("prepare {table_name} canonical migration failed: {error}"))?;
        let mut rows = statement
            .query([])
            .map_err(|error| format!("query {table_name} canonical migration failed: {error}"))?;
        let mut records = Vec::new();
        while let Some(row) = rows
            .next()
            .map_err(|error| format!("read {table_name} canonical migration row failed: {error}"))?
        {
            records.push((
                sqlite_row_required_string_value(row, 0, &format!("{table_name}.id"))
                    .map_err(|error| format!("read {table_name} id failed: {error}"))?,
                row.get::<_, Option<String>>(1)
                    .map_err(|error| format!("read {table_name} uuid failed: {error}"))?,
                sqlite_row_optional_string_value(row, 2, &format!("{table_name}.tenant_id"))
                    .map_err(|error| format!("read {table_name} tenant_id failed: {error}"))?,
                row.get::<_, Option<String>>(3).map_err(|error| {
                    format!("read {table_name} organization_id failed: {error}")
                })?,
                sqlite_row_optional_string_value(row, 4, &format!("{table_name}.parent_tenant_id"))
                    .map_err(|error| {
                    format!("read {table_name} parent tenant_id failed: {error}")
                })?,
                row.get::<_, Option<String>>(5).map_err(|error| {
                    format!("read {table_name} parent organization_id failed: {error}")
                })?,
            ));
        }
        records
    };

    let update_statement = format!(
        r#"
        UPDATE {table_name}
        SET uuid = ?2, tenant_id = ?3, organization_id = ?4
        WHERE id = ?1
        "#
    );
    for (id, uuid, tenant_id, organization_id, parent_tenant_id, parent_organization_id) in rows {
        let resolved_uuid = normalize_optional_text(uuid.as_deref())
            .unwrap_or_else(|| stable_entity_uuid(table_name, &id));
        let resolved_tenant_id = normalize_optional_text(tenant_id.as_deref())
            .or_else(|| normalize_optional_text(parent_tenant_id.as_deref()))
            .unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned());
        let resolved_organization_id = normalize_optional_text(organization_id.as_deref())
            .or_else(|| normalize_optional_text(parent_organization_id.as_deref()));
        connection
            .execute(
                &update_statement,
                params![
                    &id,
                    &resolved_uuid,
                    &resolved_tenant_id,
                    &resolved_organization_id
                ],
            )
            .map_err(|error| {
                format!("backfill {table_name} canonical fields {id} failed: {error}")
            })?;
    }

    Ok(())
}

fn backfill_login_qr_business_columns(connection: &mut Connection) -> Result<(), String> {
    let rows = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT
                    plus_user_login_qr.id,
                    plus_user_login_qr.uuid,
                    plus_user_login_qr.tenant_id,
                    plus_user_login_qr.organization_id,
                    plus_user.tenant_id,
                    plus_user.organization_id
                FROM plus_user_login_qr
                LEFT JOIN plus_user
                    ON plus_user.id = plus_user_login_qr.user_id
                   AND plus_user.is_deleted = 0
                WHERE plus_user_login_qr.is_deleted = 0
                "#,
            )
            .map_err(|error| {
                format!("prepare plus_user_login_qr canonical migration failed: {error}")
            })?;
        let mut rows = statement.query([]).map_err(|error| {
            format!("query plus_user_login_qr canonical migration failed: {error}")
        })?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().map_err(|error| {
            format!("read plus_user_login_qr canonical migration row failed: {error}")
        })? {
            records.push((
                sqlite_row_required_string_value(row, 0, "plus_user_login_qr.id")
                    .map_err(|error| format!("read plus_user_login_qr id failed: {error}"))?,
                row.get::<_, Option<String>>(1)
                    .map_err(|error| format!("read plus_user_login_qr uuid failed: {error}"))?,
                sqlite_row_optional_string_value(row, 2, "plus_user_login_qr.tenant_id").map_err(|error| {
                    format!("read plus_user_login_qr tenant_id failed: {error}")
                })?,
                row.get::<_, Option<String>>(3).map_err(|error| {
                    format!("read plus_user_login_qr organization_id failed: {error}")
                })?,
                sqlite_row_optional_string_value(row, 4, "plus_user_login_qr.parent_tenant_id").map_err(|error| {
                    format!("read plus_user_login_qr parent tenant_id failed: {error}")
                })?,
                row.get::<_, Option<String>>(5).map_err(|error| {
                    format!("read plus_user_login_qr parent organization_id failed: {error}")
                })?,
            ));
        }
        records
    };

    for (id, uuid, tenant_id, organization_id, user_tenant_id, user_organization_id) in rows {
        let resolved_uuid = normalize_optional_text(uuid.as_deref())
            .unwrap_or_else(|| stable_entity_uuid("plus_user_login_qr", &id));
        let resolved_tenant_id = normalize_optional_text(tenant_id.as_deref())
            .or_else(|| normalize_optional_text(user_tenant_id.as_deref()))
            .unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned());
        let resolved_organization_id = normalize_optional_text(organization_id.as_deref())
            .or_else(|| normalize_optional_text(user_organization_id.as_deref()));
        connection
            .execute(
                r#"
                UPDATE plus_user_login_qr
                SET uuid = ?2, tenant_id = ?3, organization_id = ?4
                WHERE id = ?1
                "#,
                params![
                    &id,
                    &resolved_uuid,
                    &resolved_tenant_id,
                    &resolved_organization_id
                ],
            )
            .map_err(|error| {
                format!("backfill plus_user_login_qr canonical fields {id} failed: {error}")
            })?;
    }

    Ok(())
}

const USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES: [(&str, &[(&str, bool)]); 7] = [
    ("plus_tenant", &[("id", false)]),
    ("plus_user", &[("id", false), ("tenant_id", true)]),
    (
        "plus_oauth_account",
        &[("id", false), ("tenant_id", true), ("user_id", false)],
    ),
    (
        "plus_vip_user",
        &[("id", false), ("tenant_id", true), ("user_id", false)],
    ),
    (
        "plus_user_auth_session",
        &[("id", false), ("tenant_id", true), ("user_id", false)],
    ),
    ("plus_user_verify_code", &[("id", false), ("tenant_id", true)]),
    (
        "plus_user_login_qr",
        &[
            ("id", false),
            ("tenant_id", true),
            ("session_id", true),
            ("user_id", true),
        ],
    ),
];

fn load_sqlite_table_column_types(
    connection: &Connection,
    table_name: &str,
) -> Result<BTreeMap<String, String>, String> {
    let pragma = format!("PRAGMA table_info({table_name})");
    let mut statement = connection
        .prepare(&pragma)
        .map_err(|error| format!("prepare sqlite table info for {table_name} failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            ))
        })
        .map_err(|error| format!("query sqlite table info for {table_name} failed: {error}"))?;
    let mut columns = BTreeMap::new();
    for row in rows {
        let (column_name, column_type) =
            row.map_err(|error| format!("read sqlite table info for {table_name} failed: {error}"))?;
        columns.insert(column_name, column_type);
    }
    Ok(columns)
}

fn sqlite_declared_type_is_integer(column_type: &str) -> bool {
    column_type.trim().eq_ignore_ascii_case("INTEGER")
}

fn sqlite_user_center_table_requires_integer_identifier_upgrade(
    connection: &Connection,
    table_name: &str,
    required_columns: &[(&str, bool)],
) -> Result<bool, String> {
    if !crate::sqlite_table_exists(connection, table_name)? {
        return Ok(false);
    }

    let column_types = load_sqlite_table_column_types(connection, table_name)?;
    for (column_name, _) in required_columns {
        let Some(column_type) = column_types.get(*column_name) else {
            continue;
        };
        if !sqlite_declared_type_is_integer(column_type) {
            return Ok(true);
        }
    }

    Ok(false)
}

fn sqlite_user_center_identifier_columns_are_decimal_compatible(
    connection: &Connection,
    table_name: &str,
    required_columns: &[(&str, bool)],
) -> Result<bool, String> {
    for (column_name, allow_nullish) in required_columns {
        let query = format!("SELECT {column_name} FROM {table_name} WHERE {column_name} IS NOT NULL");
        let mut statement = connection.prepare(&query).map_err(|error| {
            format!("prepare identifier compatibility probe for {table_name}.{column_name} failed: {error}")
        })?;
        let mut rows = statement.query([]).map_err(|error| {
            format!("query identifier compatibility probe for {table_name}.{column_name} failed: {error}")
        })?;

        while let Some(row) = rows.next().map_err(|error| {
            format!("read identifier compatibility row for {table_name}.{column_name} failed: {error}")
        })? {
            let Some(raw_value) = sqlite_value_ref_to_string(row.get_ref(0).map_err(|error| {
                format!("read identifier compatibility value for {table_name}.{column_name} failed: {error}")
            })?) else {
                return Ok(false);
            };
            let trimmed_value = raw_value.trim();
            if trimmed_value.is_empty() && *allow_nullish {
                continue;
            }
            if normalize_decimal_string_identifier(Some(trimmed_value)).is_none() {
                return Ok(false);
            }
        }
    }

    Ok(true)
}

fn upgrade_sqlite_user_center_integer_identifier_table(
    connection: &mut Connection,
    table_name: &str,
    required_columns: &[(&str, bool)],
    recreate_schema_sql: &str,
    insert_select_sql: String,
) -> Result<bool, String> {
    if !sqlite_user_center_table_requires_integer_identifier_upgrade(connection, table_name, required_columns)?
    {
        return Ok(false);
    }

    if !sqlite_user_center_identifier_columns_are_decimal_compatible(connection, table_name, required_columns)?
    {
        return Err(format!(
            "sqlite user center table {table_name} contains non-decimal identifiers and cannot be upgraded to INTEGER storage."
        ));
    }

    let legacy_table_name = format!("{table_name}__legacy_integer_identifiers");
    let transaction = connection.transaction().map_err(|error| {
        format!("open integer identifier upgrade transaction for {table_name} failed: {error}")
    })?;

    transaction
        .execute(
            &format!("ALTER TABLE {table_name} RENAME TO {legacy_table_name}"),
            [],
        )
        .map_err(|error| format!("rename legacy {table_name} table failed: {error}"))?;
    transaction
        .execute_batch(recreate_schema_sql)
        .map_err(|error| format!("recreate {table_name} schema during integer identifier upgrade failed: {error}"))?;
    transaction
        .execute(&insert_select_sql, [])
        .map_err(|error| format!("copy upgraded {table_name} rows failed: {error}"))?;
    transaction
        .execute(&format!("DROP TABLE {legacy_table_name}"), [])
        .map_err(|error| format!("drop legacy {table_name} table failed: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("commit integer identifier upgrade for {table_name} failed: {error}"))?;

    Ok(true)
}

fn ensure_sqlite_user_center_integer_identifier_upgrade(
    connection: &mut Connection,
) -> Result<(), String> {
    let plus_tenant_legacy_table = "plus_tenant__legacy_integer_identifiers";
    let plus_user_legacy_table = "plus_user__legacy_integer_identifiers";
    let plus_oauth_account_legacy_table = "plus_oauth_account__legacy_integer_identifiers";
    let plus_vip_user_legacy_table = "plus_vip_user__legacy_integer_identifiers";
    let plus_user_auth_session_legacy_table =
        "plus_user_auth_session__legacy_integer_identifiers";
    let plus_user_verify_code_legacy_table =
        "plus_user_verify_code__legacy_integer_identifiers";
    let plus_user_login_qr_legacy_table = "plus_user_login_qr__legacy_integer_identifiers";

    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_tenant",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[0].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_tenant (
                id, uuid, code, name, description, status, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER), uuid, code, name, description, status, created_at, updated_at, version, is_deleted
            FROM {plus_tenant_legacy_table}
            "#
        ),
    )?;
    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_user",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[1].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_user (
                id, uuid, tenant_id, organization_id, username, nickname, password, salt, platform, type, scene,
                email, phone, country_code, province_code, city_code, district_code, address, bio, avatar_url,
                provider_key, external_subject, metadata_json, status, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER),
                uuid,
                CASE
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                organization_id, username, nickname, password, salt, platform, type, scene, email, phone,
                country_code, province_code, city_code, district_code, address, bio, avatar_url, provider_key,
                external_subject, metadata_json, status, created_at, updated_at, version, is_deleted
            FROM {plus_user_legacy_table}
            "#
        ),
    )?;
    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_oauth_account",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[2].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_oauth_account (
                id, uuid, tenant_id, organization_id, user_id, oauth_provider, open_id, union_id, app_id,
                oauth_user_info_json, status, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER),
                uuid,
                CASE
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                organization_id,
                CAST(user_id AS INTEGER),
                oauth_provider, open_id, union_id, app_id, oauth_user_info_json, status,
                created_at, updated_at, version, is_deleted
            FROM {plus_oauth_account_legacy_table}
            "#
        ),
    )?;
    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_vip_user",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[3].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_vip_user (
                id, uuid, tenant_id, organization_id, user_id, vip_level_id, vip_level_name, status,
                point_balance, total_recharged_points, monthly_credits, seat_limit, valid_from, valid_to,
                last_active_time, remark, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER),
                uuid,
                CASE
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                organization_id,
                CAST(user_id AS INTEGER),
                vip_level_id, vip_level_name, status, point_balance, total_recharged_points, monthly_credits,
                seat_limit, valid_from, valid_to, last_active_time, remark, created_at, updated_at, version, is_deleted
            FROM {plus_vip_user_legacy_table}
            "#
        ),
    )?;
    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_user_auth_session",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[4].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_user_auth_session (
                id, uuid, tenant_id, organization_id, user_id, provider_key, provider_mode,
                upstream_auth_token, upstream_access_token, upstream_refresh_token, upstream_token_type,
                upstream_user_id, upstream_payload_json, status, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER),
                uuid,
                CASE
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                organization_id,
                CAST(user_id AS INTEGER),
                provider_key, provider_mode, upstream_auth_token, upstream_access_token, upstream_refresh_token,
                upstream_token_type, upstream_user_id, upstream_payload_json, status,
                created_at, updated_at, version, is_deleted
            FROM {plus_user_auth_session_legacy_table}
            "#
        ),
    )?;
    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_user_verify_code",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[5].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_user_verify_code (
                id, uuid, tenant_id, organization_id, provider_key, verify_type, scene, target, code,
                status, expires_at, consumed_at, metadata_json, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER),
                uuid,
                CASE
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                organization_id, provider_key, verify_type, scene, target, code, status, expires_at,
                consumed_at, metadata_json, created_at, updated_at, version, is_deleted
            FROM {plus_user_verify_code_legacy_table}
            "#
        ),
    )?;
    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_user_login_qr",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[6].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_user_login_qr (
                id, uuid, tenant_id, organization_id, provider_key, qr_key, status, session_id, user_id,
                scanned_at, confirmed_at, expires_at, metadata_json, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER),
                uuid,
                CASE
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                organization_id, provider_key, qr_key, status,
                CASE
                    WHEN session_id IS NULL OR TRIM(CAST(session_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(session_id AS INTEGER)
                END,
                CASE
                    WHEN user_id IS NULL OR TRIM(CAST(user_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(user_id AS INTEGER)
                END,
                scanned_at, confirmed_at, expires_at, metadata_json, created_at, updated_at, version, is_deleted
            FROM {plus_user_login_qr_legacy_table}
            "#
        ),
    )?;

    Ok(())
}

pub fn ensure_sqlite_user_center_schema(connection: &mut Connection) -> Result<(), String> {
    connection
        .execute_batch(USER_CENTER_SQLITE_SCHEMA)
        .map_err(|error| format!("create sqlite user center schema failed: {error}"))?;
    ensure_sqlite_user_center_integer_identifier_upgrade(connection)?;

    if crate::sqlite_table_exists(connection, "plus_user")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_user",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NULL"),
                ("organization_id", "organization_id TEXT NULL"),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_oauth_account")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_oauth_account",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NULL"),
                ("organization_id", "organization_id TEXT NULL"),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_vip_user")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_vip_user",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NULL"),
                ("organization_id", "organization_id TEXT NULL"),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_user_auth_session")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_user_auth_session",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NULL"),
                ("organization_id", "organization_id TEXT NULL"),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_user_verify_code")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_user_verify_code",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NULL"),
                ("organization_id", "organization_id TEXT NULL"),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_user_login_qr")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_user_login_qr",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NULL"),
                ("organization_id", "organization_id TEXT NULL"),
            ],
        )?;
    }

    ensure_default_local_tenant(connection)?;
    backfill_plus_user_business_columns(connection)?;
    backfill_user_owned_business_columns(connection, "plus_oauth_account", "user_id")?;
    backfill_user_owned_business_columns(connection, "plus_vip_user", "user_id")?;
    backfill_user_owned_business_columns(connection, "plus_user_auth_session", "user_id")?;
    backfill_global_business_columns(connection, "plus_user_verify_code")?;
    backfill_login_qr_business_columns(connection)?;
    Ok(())
}

pub fn ensure_sqlite_user_center_bootstrap_user(connection: &mut Connection) -> Result<(), String> {
    let seed_policy = resolve_user_center_seed_policy_from_env();
    if !seed_policy.authority_seed_enabled {
        return Ok(());
    }

    ensure_default_local_tenant(connection)?;

    let bootstrap_email_value = resolve_local_bootstrap_email();
    let bootstrap_email = bootstrap_email_value.as_str();
    let bootstrap_phone = resolve_local_bootstrap_phone();
    let bootstrap_name = "BirdCoder Local Owner";
    let bootstrap_avatar = Some(build_avatar_url(bootstrap_email));
    let bootstrap_user = upsert_user_shadow_with_phone(
        connection,
        crate::BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
        bootstrap_email,
        bootstrap_phone.as_deref(),
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

fn read_env_trimmed(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn resolve_local_bootstrap_email() -> String {
    read_env_trimmed(BIRDCODER_LOCAL_BOOTSTRAP_EMAIL_ENV)
        .filter(|value| value.contains('@'))
        .unwrap_or_else(|| DEFAULT_LOCAL_BOOTSTRAP_EMAIL.to_owned())
}

fn resolve_local_bootstrap_phone() -> Option<String> {
    read_env_trimmed(BIRDCODER_LOCAL_BOOTSTRAP_PHONE_ENV)
        .or(Some(DEFAULT_LOCAL_BOOTSTRAP_PHONE.to_owned()))
        .and_then(|value| require_normalized_phone(value.as_str()).ok())
}

fn create_user_center_seed_policy(resolved: &UserCenterResolvedConfig) -> UserCenterSeedPolicy {
    let builtin_local_enabled = matches!(resolved.mode, UserCenterMode::Local);

    UserCenterSeedPolicy {
        authority_seed_enabled: builtin_local_enabled,
        auth_development_seed_enabled: builtin_local_enabled,
        fixed_verification_code_enabled: builtin_local_enabled,
    }
}

fn resolve_user_center_seed_policy_from_env() -> UserCenterSeedPolicy {
    create_user_center_seed_policy(&resolve_user_center_config_from_env())
}

fn resolve_local_fixed_verify_code(seed_policy: &UserCenterSeedPolicy) -> Option<String> {
    if !seed_policy.fixed_verification_code_enabled {
        return None;
    }

    read_env_trimmed(BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV)
}

fn resolve_default_provider_key(
    mode: &UserCenterMode,
    external_integration: &ExternalUserCenterIntegrationKind,
) -> &'static str {
    match mode {
        UserCenterMode::Local => "sdkwork-birdcoder-local",
        UserCenterMode::External => match external_integration {
            ExternalUserCenterIntegrationKind::Headers => "sdkwork-birdcoder-header",
            ExternalUserCenterIntegrationKind::SdkworkCloudAppApi => "sdkwork-birdcoder-remote",
        },
    }
}

fn resolve_external_app_api_base_url_from_env() -> Option<String> {
    read_env_trimmed(BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV)
        .map(|value| value.trim_end_matches('/').to_owned())
        .filter(|value| !value.is_empty())
}

fn resolve_user_center_config_from_env() -> UserCenterResolvedConfig {
    let external_app_api_base_url = resolve_external_app_api_base_url_from_env();
    let configured_login_provider = std::env::var(BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV)
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());

    let explicit_provider_error =
        configured_login_provider
            .as_deref()
            .and_then(|value| match value {
                "builtin-local" | "sdkwork-cloud-app-api" | "external-user-center" => None,
                _ => Some(format!(
                "{} must be one of: builtin-local, sdkwork-cloud-app-api, external-user-center.",
                BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV
            )),
            });

    let (mode, external_integration) = match configured_login_provider
        .as_deref()
        .filter(|_| explicit_provider_error.is_none())
    {
        Some("builtin-local") => (
            UserCenterMode::Local,
            ExternalUserCenterIntegrationKind::Headers,
        ),
        Some("sdkwork-cloud-app-api") => (
            UserCenterMode::External,
            ExternalUserCenterIntegrationKind::SdkworkCloudAppApi,
        ),
        Some("external-user-center") => (
            UserCenterMode::External,
            ExternalUserCenterIntegrationKind::Headers,
        ),
        _ if external_app_api_base_url.is_some() => (
            UserCenterMode::External,
            ExternalUserCenterIntegrationKind::SdkworkCloudAppApi,
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
        .unwrap_or_else(|| resolve_default_provider_key(&mode, &external_integration).to_owned());

    let (external_app_api, external_app_api_error) = if matches!(mode, UserCenterMode::External)
        && matches!(
            external_integration,
            ExternalUserCenterIntegrationKind::SdkworkCloudAppApi
        ) {
        match resolve_external_app_api_config_from_env(external_app_api_base_url) {
            Ok(config) => (Some(config), None),
            Err(error) => (None, Some(error)),
        }
    } else {
        (None, None)
    };

    let configuration_error = explicit_provider_error.or(external_app_api_error);

    UserCenterResolvedConfig {
        configuration_error,
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

fn resolve_external_app_api_config_from_env(
    base_url: Option<String>,
) -> Result<ExternalAppApiConfig, String> {
    let resolved_base_url = base_url.ok_or_else(|| {
        format!(
            "{} is required when sdkwork-cloud-app-api integration is enabled.",
            BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV
        )
    })?;
    let timeout_ms = std::env::var(BIRDCODER_USER_CENTER_APP_API_TIMEOUT_MS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_EXTERNAL_APP_API_TIMEOUT_MS);
    let handshake = resolve_external_app_api_handshake_config(
        read_env_trimmed(BIRDCODER_USER_CENTER_APP_API_APP_ID_ENV).as_deref(),
        read_env_trimmed(BIRDCODER_USER_CENTER_APP_API_SECRET_ID_ENV).as_deref(),
        read_env_trimmed(BIRDCODER_USER_CENTER_APP_API_SHARED_SECRET_ENV).as_deref(),
        BIRDCODER_USER_CENTER_NAMESPACE,
        BIRDCODER_USER_CENTER_APP_API_SECRET_ID_ENV,
        BIRDCODER_USER_CENTER_APP_API_SHARED_SECRET_ENV,
    )?;

    Ok(ExternalAppApiConfig {
        base_url: resolved_base_url,
        handshake,
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

fn sqlite_value_ref_to_string(value: ValueRef<'_>) -> Option<String> {
    match value {
        ValueRef::Null => None,
        ValueRef::Integer(integer) => Some(integer.to_string()),
        ValueRef::Real(real) => {
            if real.fract() == 0.0 {
                Some((real as i64).to_string())
            } else {
                Some(real.to_string())
            }
        }
        ValueRef::Text(text) => Some(String::from_utf8_lossy(text).into_owned()),
        ValueRef::Blob(_) => None,
    }
}

fn sqlite_row_required_string_value(
    row: &rusqlite::Row<'_>,
    index: usize,
    column_name: &str,
) -> rusqlite::Result<String> {
    let value = row.get_ref(index)?;
    let data_type = value.data_type();
    sqlite_value_ref_to_string(value).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            index,
            data_type,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("sqlite column {column_name} could not be normalized as string"),
            )),
        )
    })
}

fn sqlite_row_optional_string_value(
    row: &rusqlite::Row<'_>,
    index: usize,
    column_name: &str,
) -> rusqlite::Result<Option<String>> {
    let value = row.get_ref(index)?;
    let data_type = value.data_type();
    match value {
        ValueRef::Null => Ok(None),
        _ => sqlite_value_ref_to_string(value).map(Some).ok_or_else(|| {
            rusqlite::Error::FromSqlConversionFailure(
                index,
                data_type,
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("sqlite column {column_name} could not be normalized as optional string"),
                )),
            )
        }),
    }
}

fn normalize_decimal_string_identifier(value: Option<&str>) -> Option<String> {
    let normalized = normalize_optional_text(value)?;
    normalized
        .parse::<i64>()
        .ok()
        .filter(|candidate| *candidate >= 0)
        .map(|candidate| candidate.to_string())
}

fn is_active_status(value: &str) -> bool {
    value.trim().eq_ignore_ascii_case("active")
}

fn stable_entity_uuid(entity_name: &str, id: &str) -> String {
    let normalized = sanitize_identifier_segment(id);
    if normalized.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        let identity_seed = format!("sdkwork-birdcoder:{entity_name}:{normalized}");
        uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_OID, identity_seed.as_bytes()).to_string()
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

fn resolve_phone_display_name(phone: &str, explicit_name: Option<&str>) -> String {
    normalize_optional_text(explicit_name)
        .or_else(|| {
            let normalized_phone = normalize_phone(phone);
            let suffix = normalized_phone
                .chars()
                .rev()
                .take(4)
                .collect::<String>()
                .chars()
                .rev()
                .collect::<String>();
            if suffix.is_empty() {
                None
            } else {
                Some(format!("BirdCoder User {}", suffix))
            }
        })
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

fn build_local_phone_user_id(phone: &str) -> String {
    let _ = phone;
    crate::create_identifier("user")
}

fn build_local_phone_shadow_email(phone: &str) -> String {
    let normalized = sanitize_identifier_segment(phone);
    format!(
        "phone-{}{}",
        if normalized.is_empty() {
            "local-user"
        } else {
            normalized.as_str()
        },
        LOCAL_PHONE_SHADOW_EMAIL_SUFFIX,
    )
}

fn build_external_account_shadow_email(account: &str) -> String {
    let normalized = sanitize_identifier_segment(account);
    format!(
        "account-{}{}",
        if normalized.is_empty() {
            "user"
        } else {
            normalized.as_str()
        },
        EXTERNAL_ACCOUNT_SHADOW_EMAIL_SUFFIX,
    )
}

fn resolve_shadow_email_for_account(
    email_hint: Option<&str>,
    phone_hint: Option<&str>,
    account_hint: Option<&str>,
) -> String {
    if let Some(normalized_email) = email_hint
        .map(normalize_email)
        .filter(|value| !value.is_empty())
    {
        return normalized_email;
    }

    if let Some(normalized_phone) = phone_hint
        .map(normalize_phone)
        .filter(|value| !value.is_empty())
    {
        return build_local_phone_shadow_email(&normalized_phone);
    }

    if let Some(account) = account_hint {
        let normalized_account = account.trim();
        if !normalized_account.is_empty() {
            if looks_like_phone_account(normalized_account) {
                return build_local_phone_shadow_email(normalized_account);
            }

            let normalized_email = normalize_email(normalized_account);
            if !normalized_email.is_empty() {
                return normalized_email;
            }

            return build_external_account_shadow_email(normalized_account);
        }
    }

    build_external_account_shadow_email("user")
}

fn build_external_user_id(provider_key: &str, subject: Option<&str>, email: &str) -> String {
    let _ = (provider_key, subject, email);
    crate::create_identifier("user")
}

fn build_avatar_url(seed: &str) -> String {
    format!(
        "https://api.dicebear.com/7.x/avataaars/svg?seed={}",
        seed.replace(' ', "%20")
    )
}

fn normalize_phone(phone: &str) -> String {
    let trimmed = phone.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let mut normalized = String::with_capacity(trimmed.len());
    for (index, character) in trimmed.chars().enumerate() {
        if character.is_ascii_digit() {
            normalized.push(character);
            continue;
        }

        if index == 0 && character == '+' {
            normalized.push(character);
        }
    }

    if normalized.starts_with('+') && normalized.len() == 1 {
        return String::new();
    }

    normalized
}

fn is_local_phone_shadow_email(email: &str) -> bool {
    normalize_email(email).ends_with(LOCAL_PHONE_SHADOW_EMAIL_SUFFIX)
}

fn resolve_user_public_identity(email: &str, phone: Option<&str>) -> String {
    if is_local_phone_shadow_email(email) {
        if let Some(normalized_phone) = phone.map(normalize_phone).filter(|value| !value.is_empty())
        {
            return normalized_phone;
        }
    }

    email.to_owned()
}

fn require_normalized_phone(phone: &str) -> Result<String, String> {
    let normalized_phone = normalize_phone(phone);
    let digit_count = normalized_phone
        .chars()
        .filter(|character| character.is_ascii_digit())
        .count();
    if digit_count < 6 {
        return Err("Phone is required.".to_owned());
    }
    Ok(normalized_phone)
}

fn looks_like_phone_account(account: &str) -> bool {
    !account.contains('@') && require_normalized_phone(account).is_ok()
}

fn normalize_oauth_provider_identifier(provider: &str) -> Result<String, String> {
    let normalized = provider.trim().replace('_', "-").to_lowercase();
    if normalized.is_empty() {
        return Err("OAuth provider is required.".to_owned());
    }

    if normalized
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Ok(normalized);
    }

    Err("OAuth provider contains unsupported characters.".to_owned())
}

fn collect_normalized_oauth_provider_identifiers(raw_value: &str) -> Vec<String> {
    raw_value
        .split(|character: char| character == ',' || character == ';' || character.is_whitespace())
        .filter_map(|segment| normalize_oauth_provider_identifier(segment).ok())
        .fold(Vec::new(), |mut providers, provider| {
            if !providers.contains(&provider) {
                providers.push(provider);
            }
            providers
        })
}

fn resolve_default_oauth_provider_identifiers(providers: &[&str]) -> Vec<String> {
    providers
        .iter()
        .filter_map(|provider| normalize_oauth_provider_identifier(provider).ok())
        .collect()
}

fn resolve_cloud_app_api_oauth_providers_from_env() -> Vec<String> {
    match std::env::var(BIRDCODER_USER_CENTER_APP_API_OAUTH_PROVIDERS_ENV) {
        Ok(value) => collect_normalized_oauth_provider_identifiers(&value),
        Err(_) => {
            resolve_default_oauth_provider_identifiers(DEFAULT_EXTERNAL_APP_API_OAUTH_PROVIDERS)
        }
    }
}

fn map_oauth_provider_to_upstream(provider: &str) -> Result<String, String> {
    Ok(normalize_oauth_provider_identifier(provider)?
        .replace('-', "_")
        .to_ascii_uppercase())
}

fn resolve_local_oauth_providers_from_env() -> Vec<String> {
    match std::env::var(BIRDCODER_LOCAL_OAUTH_PROVIDERS_ENV) {
        Ok(value) => collect_normalized_oauth_provider_identifiers(&value),
        Err(_) => resolve_default_oauth_provider_identifiers(DEFAULT_LOCAL_OAUTH_PROVIDERS),
    }
}

fn resolve_local_oauth_code_secret(provider_key: &str) -> String {
    read_env_trimmed(BIRDCODER_LOCAL_OAUTH_CODE_SECRET_ENV)
        .unwrap_or_else(|| format!("{provider_key}:local-oauth"))
}

fn resolve_local_oauth_code_ttl() -> Duration {
    std::env::var(BIRDCODER_LOCAL_OAUTH_CODE_TTL_SECONDS_ENV)
        .ok()
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .map(Duration::from_secs)
        .unwrap_or_else(|| Duration::from_secs(DEFAULT_LOCAL_OAUTH_CODE_TTL_SECONDS))
}

fn current_unix_timestamp_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn encode_uri_query_component(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        let character = byte as char;
        if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | '~') {
            encoded.push(character);
        } else {
            encoded.push('%');
            encoded.push_str(format!("{byte:02X}").as_str());
        }
    }
    encoded
}

fn append_query_parameters_to_url(base_url: &str, params: &[(String, String)]) -> String {
    if params.is_empty() {
        return base_url.to_owned();
    }

    let (before_fragment, fragment_suffix) = match base_url.split_once('#') {
        Some((url, fragment)) => (url, Some(fragment)),
        None => (base_url, None),
    };
    let separator = if before_fragment.contains('?') {
        if before_fragment.ends_with('?') || before_fragment.ends_with('&') {
            ""
        } else {
            "&"
        }
    } else {
        "?"
    };
    let query_suffix = params
        .iter()
        .enumerate()
        .map(|(index, (key, value))| {
            format!(
                "{}{}={}",
                if index == 0 { "" } else { "&" },
                encode_uri_query_component(key),
                encode_uri_query_component(value),
            )
        })
        .collect::<String>();
    let mut resolved_url = format!("{before_fragment}{separator}{query_suffix}");
    if let Some(fragment) = fragment_suffix {
        resolved_url.push('#');
        resolved_url.push_str(fragment);
    }
    resolved_url
}

fn local_oauth_provider_env_key(provider: &str, suffix: &str) -> Result<String, String> {
    let normalized_provider = normalize_oauth_provider_identifier(provider)?;
    let provider_segment = normalized_provider.replace('-', "_").to_ascii_uppercase();
    Ok(format!("BIRDCODER_LOCAL_OAUTH_{provider_segment}_{suffix}"))
}

fn format_local_oauth_provider_name(provider: &str) -> &'static str {
    match provider {
        "github" => "GitHub",
        "wechat" => "WeChat",
        "douyin" => "Douyin",
        _ => "BirdCoder",
    }
}

fn build_local_oauth_default_email(provider: &str) -> String {
    let normalized_provider = sanitize_identifier_segment(provider);
    format!(
        "{}{}",
        if normalized_provider.is_empty() {
            "oauth-user"
        } else {
            normalized_provider.as_str()
        },
        LOCAL_OAUTH_SHADOW_EMAIL_SUFFIX,
    )
}

fn build_local_oauth_default_subject(provider: &str) -> String {
    format!("{provider}-sample-user")
}

fn build_local_oauth_user_id(provider: &str, subject: &str) -> String {
    let _ = (provider, subject);
    crate::create_identifier("user")
}

fn read_local_oauth_provider_profile(provider: &str) -> Result<LocalOAuthProviderProfile, String> {
    let normalized_provider = normalize_oauth_provider_identifier(provider)?;
    let subject_env = local_oauth_provider_env_key(&normalized_provider, "SUBJECT")?;
    let email_env = local_oauth_provider_env_key(&normalized_provider, "EMAIL")?;
    let phone_env = local_oauth_provider_env_key(&normalized_provider, "PHONE")?;
    let name_env = local_oauth_provider_env_key(&normalized_provider, "NAME")?;
    let avatar_env = local_oauth_provider_env_key(&normalized_provider, "AVATAR_URL")?;

    let subject = read_env_trimmed(&subject_env)
        .unwrap_or_else(|| build_local_oauth_default_subject(&normalized_provider));
    let phone = read_env_trimmed(&phone_env)
        .map(|value| normalize_phone(&value))
        .filter(|value| !value.is_empty());
    let email = read_env_trimmed(&email_env)
        .map(|value| normalize_email(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            phone
                .as_deref()
                .map(build_local_phone_shadow_email)
                .unwrap_or_else(|| build_local_oauth_default_email(&normalized_provider))
        });
    let name = read_env_trimmed(&name_env).unwrap_or_else(|| {
        format!(
            "{} BirdCoder",
            format_local_oauth_provider_name(&normalized_provider)
        )
    });
    let avatar_url =
        read_env_trimmed(&avatar_env).or_else(|| Some(build_avatar_url(email.as_str())));

    Ok(LocalOAuthProviderProfile {
        avatar_url,
        email,
        name,
        phone,
        provider: normalized_provider,
        subject,
    })
}

fn sign_local_oauth_authorization_code(
    secret: &str,
    claims: &LocalOAuthAuthorizationCodeClaims,
) -> Result<String, String> {
    type HmacSha256 = Hmac<Sha256>;

    let normalized_secret = normalize_optional_text(Some(secret))
        .ok_or_else(|| "Local OAuth code secret is required.".to_owned())?;
    let payload_json = serde_json::to_vec(claims)
        .map_err(|error| format!("serialize local OAuth authorization payload failed: {error}"))?;
    let encoded_payload = URL_SAFE_NO_PAD.encode(payload_json);
    let mut signer = HmacSha256::new_from_slice(normalized_secret.as_bytes())
        .map_err(|error| format!("initialize local OAuth signer failed: {error}"))?;
    signer.update(encoded_payload.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(signer.finalize().into_bytes());
    Ok(format!("{encoded_payload}.{signature}"))
}

fn verify_local_oauth_authorization_code(
    secret: &str,
    code: &str,
) -> Result<LocalOAuthAuthorizationCodeClaims, String> {
    type HmacSha256 = Hmac<Sha256>;

    let normalized_secret = normalize_optional_text(Some(secret))
        .ok_or_else(|| "Local OAuth code secret is required.".to_owned())?;
    let normalized_code =
        normalize_optional_text(Some(code)).ok_or_else(|| "OAuth code is required.".to_owned())?;
    let (encoded_payload, encoded_signature) = normalized_code
        .split_once('.')
        .ok_or_else(|| "OAuth authorization code is invalid.".to_owned())?;
    let signature = URL_SAFE_NO_PAD
        .decode(encoded_signature.as_bytes())
        .map_err(|_| "OAuth authorization code signature is invalid.".to_owned())?;
    let mut signer = HmacSha256::new_from_slice(normalized_secret.as_bytes())
        .map_err(|error| format!("initialize local OAuth signer failed: {error}"))?;
    signer.update(encoded_payload.as_bytes());
    signer
        .verify_slice(signature.as_slice())
        .map_err(|_| "OAuth authorization code signature is invalid.".to_owned())?;
    let payload = URL_SAFE_NO_PAD
        .decode(encoded_payload.as_bytes())
        .map_err(|_| "OAuth authorization code payload is invalid.".to_owned())?;
    let claims = serde_json::from_slice::<LocalOAuthAuthorizationCodeClaims>(&payload)
        .map_err(|error| format!("parse local OAuth authorization payload failed: {error}"))?;
    if claims.expires_at < current_unix_timestamp_seconds() {
        return Err("OAuth authorization code has expired.".to_owned());
    }
    Ok(claims)
}

impl LocalOAuthAuthority {
    fn new(provider_key: &str) -> Self {
        let mut provider_order = Vec::new();
        let providers = resolve_local_oauth_providers_from_env()
            .into_iter()
            .filter_map(|provider| {
                read_local_oauth_provider_profile(&provider)
                    .ok()
                    .map(|profile| {
                        provider_order.push(provider.clone());
                        (provider, profile)
                    })
            })
            .collect();

        Self {
            code_secret: resolve_local_oauth_code_secret(provider_key),
            code_ttl: resolve_local_oauth_code_ttl(),
            provider_order,
            providers,
        }
    }

    fn enabled_provider_ids(&self) -> Vec<String> {
        self.provider_order.clone()
    }

    fn require_provider_profile(
        &self,
        provider: &str,
    ) -> Result<&LocalOAuthProviderProfile, String> {
        let normalized_provider = normalize_oauth_provider_identifier(provider)?;
        self.providers.get(&normalized_provider).ok_or_else(|| {
            format!(
                "OAuth provider {} is not enabled for the configured local user center.",
                normalized_provider
            )
        })
    }

    fn issue_authorization_code(
        &self,
        profile: &LocalOAuthProviderProfile,
    ) -> Result<String, String> {
        let issued_at = current_unix_timestamp_seconds();
        let expires_at = issued_at + self.code_ttl.as_secs() as i64;
        sign_local_oauth_authorization_code(
            &self.code_secret,
            &LocalOAuthAuthorizationCodeClaims {
                avatar_url: profile.avatar_url.clone(),
                email: profile.email.clone(),
                expires_at,
                issued_at,
                name: profile.name.clone(),
                phone: profile.phone.clone(),
                provider: profile.provider.clone(),
                subject: profile.subject.clone(),
            },
        )
    }

    fn build_authorization_url(
        &self,
        request: &UserCenterOAuthAuthorizationRequest,
    ) -> Result<UserCenterOAuthUrlPayload, String> {
        let redirect_uri = normalize_optional_text(Some(request.redirect_uri.as_str()))
            .ok_or_else(|| "OAuth redirectUri is required.".to_owned())?;
        let profile = self.require_provider_profile(&request.provider)?;
        let code = self.issue_authorization_code(profile)?;
        let mut query_params = vec![("code".to_owned(), code)];
        if let Some(state) = normalize_optional_text(request.state.as_deref()) {
            query_params.push(("state".to_owned(), state));
        }

        Ok(UserCenterOAuthUrlPayload {
            auth_url: append_query_parameters_to_url(&redirect_uri, &query_params),
        })
    }

    fn resolve_authorization_code(
        &self,
        code: &str,
        expected_provider: &str,
    ) -> Result<LocalOAuthAuthorizationCodeClaims, String> {
        let claims = verify_local_oauth_authorization_code(&self.code_secret, code)?;
        let normalized_provider = normalize_oauth_provider_identifier(expected_provider)?;
        if claims.provider != normalized_provider {
            return Err("OAuth authorization code provider does not match the request.".to_owned());
        }
        self.require_provider_profile(&normalized_provider)?;
        Ok(claims)
    }
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
        uuid: user.uuid,
        tenant_id: user.tenant_id,
        organization_id: user.organization_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        avatar_url: user.avatar_url,
        email: resolve_user_public_identity(&user.email, user.phone.as_deref()),
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

fn read_authorization_token(headers: &HeaderMap) -> Option<String> {
    let authorization_value = read_header_value(headers, BIRDCODER_AUTHORIZATION_HEADER_NAME)?;
    let mut authorization_parts = authorization_value.split_whitespace();
    let scheme_or_token = authorization_parts.next()?;
    let token = authorization_parts.next();

    if scheme_or_token.eq_ignore_ascii_case(BIRDCODER_AUTHORIZATION_SCHEME) {
        return token.and_then(|value| normalize_optional_text(Some(value)));
    }

    normalize_optional_text(Some(scheme_or_token))
}

fn read_session_header(headers: &HeaderMap) -> Option<String> {
    read_header_value(headers, BIRDCODER_SESSION_HEADER_NAME)
        .or_else(|| read_authorization_token(headers))
        .or_else(|| read_header_value(headers, BIRDCODER_ACCESS_TOKEN_HEADER_NAME))
}

fn build_user_center_session_payload(
    created_at: String,
    provider_key: String,
    provider_mode: String,
    refresh_token: Option<String>,
    session_id: String,
    token_type: Option<String>,
    updated_at: String,
    user: UserCenterUserPayload,
) -> UserCenterSessionPayload {
    let synthetic_token = session_id.clone();
    let session_uuid = stable_entity_uuid("plus_user_auth_session", &session_id);

    UserCenterSessionPayload {
        access_token: synthetic_token.clone(),
        auth_token: synthetic_token,
        uuid: session_uuid,
        tenant_id: user.tenant_id.clone(),
        organization_id: user.organization_id.clone(),
        created_at,
        provider_key,
        provider_mode,
        refresh_token,
        session_id,
        token_type: token_type.unwrap_or_else(|| BIRDCODER_AUTHORIZATION_SCHEME.to_owned()),
        updated_at,
        user,
    }
}

fn load_user_by_id(connection: &Connection, user_id: &str) -> Result<Option<UserRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT
                id,
                uuid,
                tenant_id,
                organization_id,
                created_at,
                updated_at,
                email,
                phone,
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
                    id: sqlite_row_required_string_value(row, 0, "plus_user.id")?,
                    uuid: row.get(1)?,
                    tenant_id: sqlite_row_optional_string_value(row, 2, "plus_user.tenant_id")?,
                    organization_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    email: row.get(6)?,
                    phone: row.get(7)?,
                    display_name: row.get(8)?,
                    avatar_url: row.get(9)?,
                    provider_key: row.get(10)?,
                    external_subject: row.get(11)?,
                    status: row.get(12)?,
                    metadata_json: row.get(13)?,
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
                uuid,
                tenant_id,
                organization_id,
                created_at,
                updated_at,
                email,
                phone,
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
                    id: sqlite_row_required_string_value(row, 0, "plus_user.id")?,
                    uuid: row.get(1)?,
                    tenant_id: sqlite_row_optional_string_value(row, 2, "plus_user.tenant_id")?,
                    organization_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    email: row.get(6)?,
                    phone: row.get(7)?,
                    display_name: row.get(8)?,
                    avatar_url: row.get(9)?,
                    provider_key: row.get(10)?,
                    external_subject: row.get(11)?,
                    status: row.get(12)?,
                    metadata_json: row.get(13)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load user by email {email} failed: {error}"))
}

fn load_user_by_phone(connection: &Connection, phone: &str) -> Result<Option<UserRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT
                id,
                uuid,
                tenant_id,
                organization_id,
                created_at,
                updated_at,
                email,
                phone,
                nickname,
                avatar_url,
                provider_key,
                external_subject,
                status,
                metadata_json
            FROM plus_user
            WHERE phone = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![phone],
            |row| {
                Ok(UserRecord {
                    id: sqlite_row_required_string_value(row, 0, "plus_user.id")?,
                    uuid: row.get(1)?,
                    tenant_id: sqlite_row_optional_string_value(row, 2, "plus_user.tenant_id")?,
                    organization_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    email: row.get(6)?,
                    phone: row.get(7)?,
                    display_name: row.get(8)?,
                    avatar_url: row.get(9)?,
                    provider_key: row.get(10)?,
                    external_subject: row.get(11)?,
                    status: row.get(12)?,
                    metadata_json: row.get(13)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load user by phone {phone} failed: {error}"))
}

fn load_user_by_oauth_account(
    connection: &Connection,
    oauth_provider: &str,
    open_id: &str,
) -> Result<Option<UserRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT
                plus_user.id,
                plus_user.uuid,
                plus_user.tenant_id,
                plus_user.organization_id,
                plus_user.created_at,
                plus_user.updated_at,
                plus_user.email,
                plus_user.phone,
                plus_user.nickname,
                plus_user.avatar_url,
                plus_user.provider_key,
                plus_user.external_subject,
                plus_user.status,
                plus_user.metadata_json
            FROM plus_oauth_account
            INNER JOIN plus_user ON plus_user.id = plus_oauth_account.user_id
            WHERE plus_oauth_account.oauth_provider = ?1
              AND plus_oauth_account.open_id = ?2
              AND plus_oauth_account.is_deleted = 0
              AND plus_user.is_deleted = 0
            LIMIT 1
            "#,
            params![oauth_provider, open_id],
            |row| {
                Ok(UserRecord {
                    id: sqlite_row_required_string_value(row, 0, "plus_user.id")?,
                    uuid: row.get(1)?,
                    tenant_id: sqlite_row_optional_string_value(row, 2, "plus_user.tenant_id")?,
                    organization_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    email: row.get(6)?,
                    phone: row.get(7)?,
                    display_name: row.get(8)?,
                    avatar_url: row.get(9)?,
                    provider_key: row.get(10)?,
                    external_subject: row.get(11)?,
                    status: row.get(12)?,
                    metadata_json: row.get(13)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load OAuth account {oauth_provider}:{open_id} failed: {error}"))
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
                provider_mode,
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
                    id: sqlite_row_required_string_value(row, 0, "plus_user_auth_session.id")?,
                    user_id: sqlite_row_required_string_value(
                        row,
                        1,
                        "plus_user_auth_session.user_id",
                    )?,
                    provider_key: row.get(2)?,
                    provider_mode: row.get(3)?,
                    status: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                    upstream_auth_token: row.get(7)?,
                    upstream_access_token: row.get(8)?,
                    upstream_refresh_token: row.get(9)?,
                    upstream_token_type: row.get(10)?,
                    upstream_user_id: row.get(11)?,
                    upstream_payload_json: row.get(12)?,
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
                uuid,
                tenant_id,
                organization_id,
                created_at,
                updated_at,
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
                    uuid: row.get(0)?,
                    tenant_id: sqlite_row_optional_string_value(row, 1, "plus_vip_user.tenant_id")?,
                    organization_id: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    user_id: sqlite_row_required_string_value(row, 5, "plus_vip_user.user_id")?,
                    plan_id: row
                        .get::<_, Option<String>>(6)?
                        .unwrap_or_else(|| "free".to_owned()),
                    plan_title: row
                        .get::<_, Option<String>>(7)?
                        .unwrap_or_else(|| "Free".to_owned()),
                    status: row.get(8)?,
                    credits_per_month: row.get::<_, Option<i64>>(9)?.unwrap_or(0),
                    seats: row.get::<_, Option<i64>>(10)?.unwrap_or(1),
                    renew_at: row.get(11)?,
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
    upsert_user_shadow_with_phone(
        connection,
        preferred_user_id,
        email,
        None,
        display_name,
        avatar_url,
        provider_key,
        external_subject,
    )
}

fn upsert_user_shadow_with_phone(
    connection: &mut Connection,
    preferred_user_id: &str,
    email: &str,
    phone: Option<&str>,
    display_name: &str,
    avatar_url: Option<&str>,
    provider_key: &str,
    external_subject: Option<&str>,
) -> Result<UserRecord, String> {
    let normalized_email = normalize_email(email);
    if normalized_email.is_empty() {
        return Err("Email is required.".to_owned());
    }
    let normalized_phone = phone.and_then(|value| {
        let normalized = normalize_phone(value);
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    });
    let resolved_username = normalized_phone
        .clone()
        .unwrap_or_else(|| normalized_email.clone());

    let existing_user = if let Some(user) = load_user_by_id(connection, preferred_user_id)? {
        Some(user)
    } else if let Some(phone_value) = normalized_phone.as_deref() {
        load_user_by_phone(connection, phone_value)?
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
    let resolved_tenant_id = existing_user
        .as_ref()
        .and_then(|user| user.tenant_id.clone())
        .unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned());
    let resolved_organization_id = existing_user
        .as_ref()
        .and_then(|user| user.organization_id.clone());

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
                ?6, ?7, NULL, NULL, NULL, NULL, NULL, NULL, ?8, ?9, ?10, ?11, 'active',
                ?12, ?13, 0, 0
            )
            ON CONFLICT(id) DO UPDATE SET
                tenant_id = COALESCE(plus_user.tenant_id, excluded.tenant_id),
                updated_at = excluded.updated_at,
                is_deleted = 0,
                username = excluded.username,
                email = excluded.email,
                phone = COALESCE(excluded.phone, plus_user.phone),
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
                &resolved_username,
                &resolved_display_name,
                &normalized_email,
                &normalized_phone,
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
                    id, uuid, tenant_id, organization_id, user_id, oauth_provider, open_id, union_id, app_id,
                    oauth_user_info_json, status, created_at, updated_at, version, is_deleted
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, NULL, 'active', ?8, ?9, 0, 0)
                ON CONFLICT(oauth_provider, open_id) DO UPDATE SET
                    tenant_id = excluded.tenant_id,
                    organization_id = excluded.organization_id,
                    user_id = excluded.user_id,
                    status = 'active',
                    updated_at = excluded.updated_at,
                    is_deleted = 0
                "#,
                params![
                    crate::create_identifier("oauth-account"),
                    stable_entity_uuid(
                        "plus_oauth_account",
                        format!("{provider_key}:{normalized_subject}").as_str(),
                    ),
                    &resolved_tenant_id,
                    &resolved_organization_id,
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

fn upsert_oauth_account_record(
    connection: &mut Connection,
    user_id: &str,
    oauth_provider: &str,
    open_id: &str,
    union_id: Option<&str>,
    app_id: Option<&str>,
    oauth_user_info_json: Option<&str>,
) -> Result<(), String> {
    let normalized_provider = normalize_oauth_provider_identifier(oauth_provider)?;
    let normalized_open_id = normalize_optional_text(Some(open_id))
        .ok_or_else(|| "OAuth openId is required.".to_owned())?;
    let normalized_union_id = normalize_optional_text(union_id);
    let normalized_app_id = normalize_optional_text(app_id);
    let normalized_user_info_json = normalize_optional_text(oauth_user_info_json);
    let user = load_user_by_id(connection, user_id)?
        .ok_or_else(|| format!("user {user_id} was not found for oauth account upsert"))?;
    let record_id = crate::create_identifier("oauth-account");
    let now = crate::current_storage_timestamp();

    connection
        .execute(
            r#"
            INSERT INTO plus_oauth_account (
                id, uuid, tenant_id, organization_id, user_id, oauth_provider, open_id, union_id, app_id,
                oauth_user_info_json, status, created_at, updated_at, version, is_deleted
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'active', ?11, ?12, 0, 0)
            ON CONFLICT(oauth_provider, open_id) DO UPDATE SET
                tenant_id = excluded.tenant_id,
                organization_id = excluded.organization_id,
                user_id = excluded.user_id,
                union_id = COALESCE(excluded.union_id, plus_oauth_account.union_id),
                app_id = COALESCE(excluded.app_id, plus_oauth_account.app_id),
                oauth_user_info_json =
                    COALESCE(excluded.oauth_user_info_json, plus_oauth_account.oauth_user_info_json),
                status = 'active',
                updated_at = excluded.updated_at,
                is_deleted = 0
            "#,
            params![
                &record_id,
                stable_entity_uuid(
                    "plus_oauth_account",
                    format!("{normalized_provider}:{normalized_open_id}").as_str(),
                ),
                user.tenant_id.clone().unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned()),
                &user.organization_id,
                user_id,
                &normalized_provider,
                &normalized_open_id,
                &normalized_union_id,
                &normalized_app_id,
                &normalized_user_info_json,
                &now,
                &now,
            ],
        )
        .map_err(|error| {
            format!(
                "upsert OAuth account {normalized_provider}:{normalized_open_id} failed: {error}"
            )
        })?;

    Ok(())
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
    provider_mode: &str,
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
                id, uuid, tenant_id, organization_id, user_id, provider_key, provider_mode,
                upstream_auth_token, upstream_access_token, upstream_refresh_token,
                upstream_token_type, upstream_user_id, upstream_payload_json, status,
                created_at, updated_at, version, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'active',
                ?14, ?15, 0, 0
            )
            "#,
            params![
                &session_id,
                stable_entity_uuid("plus_user_auth_session", &session_id),
                user.tenant_id
                    .clone()
                    .unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned()),
                &user.organization_id,
                &user.id,
                provider_key,
                provider_mode,
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

    Ok(build_user_center_session_payload(
        now.clone(),
        provider_key.to_owned(),
        provider_mode.to_owned(),
        None,
        session_id,
        None,
        now,
        map_user_record_to_user_payload(user.clone()),
    ))
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

fn normalize_verify_type(value: &str) -> Result<&'static str, String> {
    match value.trim().to_ascii_uppercase().as_str() {
        "EMAIL" => Ok("EMAIL"),
        "PHONE" => Ok("PHONE"),
        _ => Err("verifyType must be EMAIL or PHONE.".to_owned()),
    }
}

fn normalize_verify_scene(value: &str) -> Result<&'static str, String> {
    match value.trim().to_ascii_uppercase().as_str() {
        "LOGIN" => Ok("LOGIN"),
        "REGISTER" => Ok("REGISTER"),
        "RESET_PASSWORD" => Ok("RESET_PASSWORD"),
        _ => Err("scene must be LOGIN, REGISTER, or RESET_PASSWORD.".to_owned()),
    }
}

fn normalize_password_reset_channel(value: &str) -> Result<&'static str, String> {
    match value.trim().to_ascii_uppercase().as_str() {
        "EMAIL" => Ok("EMAIL"),
        "SMS" => Ok("SMS"),
        _ => Err("channel must be EMAIL or SMS.".to_owned()),
    }
}

fn require_password_confirmation(
    password: &str,
    confirm_password: Option<&str>,
) -> Result<(), String> {
    if let Some(normalized_confirmation) = normalize_optional_text(confirm_password) {
        if normalized_confirmation != password {
            return Err("Password confirmation does not match.".to_owned());
        }
    }
    Ok(())
}

fn resolve_login_account(request: &UserCenterLoginRequest) -> Result<String, String> {
    normalize_optional_text(request.account.as_deref())
        .or_else(|| normalize_optional_text(request.email.as_deref()))
        .ok_or_else(|| "Account is required.".to_owned())
}

fn resolve_user_by_account(
    connection: &Connection,
    account: &str,
) -> Result<Option<UserRecord>, String> {
    if looks_like_phone_account(account) {
        let normalized_phone = require_normalized_phone(account)?;
        return load_user_by_phone(connection, &normalized_phone);
    }

    let normalized_email = require_normalized_email(account)?;
    load_user_by_email(connection, &normalized_email)
}

fn create_verify_code_record(
    connection: &mut Connection,
    provider_key: &str,
    verify_type: &str,
    scene: &str,
    target: &str,
    code: &str,
    ttl: Duration,
) -> Result<VerifyCodeRecord, String> {
    let id = crate::create_identifier("user-verify-code");
    let now_millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("read system time failed: {error}"))?
        .as_millis() as i64;
    let now = crate::storage_timestamp_from_millis(now_millis);
    let expires_at =
        crate::storage_timestamp_from_millis(now_millis.saturating_add(ttl.as_millis() as i64));

    connection
        .execute(
            r#"
            UPDATE plus_user_verify_code
            SET updated_at = ?4, status = 'superseded', is_deleted = 1
            WHERE target = ?1
              AND verify_type = ?2
              AND scene = ?3
              AND status = 'pending'
              AND is_deleted = 0
            "#,
            params![target, verify_type, scene, &now],
        )
        .map_err(|error| format!("supersede previous verify codes for {target} failed: {error}"))?;

    connection
        .execute(
            r#"
            INSERT INTO plus_user_verify_code (
                id, uuid, tenant_id, organization_id, provider_key, verify_type, scene, target, code, status,
                expires_at, consumed_at, metadata_json, created_at, updated_at, version, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10, NULL, NULL, ?11, ?12, 0, 0
            )
            "#,
            params![
                &id,
                stable_entity_uuid("plus_user_verify_code", &id),
                DEFAULT_LOCAL_TENANT_ID,
                Option::<&str>::None,
                provider_key,
                verify_type,
                scene,
                target,
                code,
                &expires_at,
                &now,
                &now,
            ],
        )
        .map_err(|error| format!("create verify code record for {target} failed: {error}"))?;

    Ok(VerifyCodeRecord {
        code: code.to_owned(),
        expires_at,
        id,
    })
}

fn load_latest_pending_verify_code(
    connection: &Connection,
    target: &str,
    verify_type: &str,
    scene: &str,
) -> Result<Option<VerifyCodeRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT id, verify_type, scene, target, code, status, expires_at
            FROM plus_user_verify_code
            WHERE target = ?1
              AND verify_type = ?2
              AND scene = ?3
              AND status = 'pending'
              AND is_deleted = 0
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            params![target, verify_type, scene],
            |row| {
                Ok(VerifyCodeRecord {
                    id: sqlite_row_required_string_value(row, 0, "plus_user_verify_code.id")?,
                    code: row.get(4)?,
                    expires_at: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load verify code record for {target} failed: {error}"))
}

fn consume_verify_code(
    connection: &mut Connection,
    target: &str,
    verify_type: &str,
    scene: &str,
    code: &str,
) -> Result<(), String> {
    let normalized_code = normalize_optional_text(Some(code))
        .ok_or_else(|| "Verification code is required.".to_owned())?;
    let Some(record) = load_latest_pending_verify_code(connection, target, verify_type, scene)?
    else {
        return Err("Verification code is invalid.".to_owned());
    };

    if record.code != normalized_code {
        return Err("Verification code is invalid.".to_owned());
    }

    let now_millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("read system time failed: {error}"))?
        .as_millis() as i64;
    let expires_at_millis =
        crate::parse_storage_timestamp_millis(&record.expires_at).unwrap_or_default();
    let now = crate::storage_timestamp_from_millis(now_millis);

    if expires_at_millis < now_millis {
        connection
            .execute(
                r#"
                UPDATE plus_user_verify_code
                SET updated_at = ?2, status = 'expired', is_deleted = 1
                WHERE id = ?1 AND is_deleted = 0
                "#,
                params![record.id, &now],
            )
            .map_err(|error| format!("expire verify code {} failed: {error}", record.id))?;
        return Err("Verification code has expired.".to_owned());
    }

    connection
        .execute(
            r#"
            UPDATE plus_user_verify_code
            SET updated_at = ?2, consumed_at = ?2, status = 'consumed'
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![record.id, &now],
        )
        .map_err(|error| format!("consume verify code {} failed: {error}", record.id))?;
    Ok(())
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
    external_integration: &ExternalUserCenterIntegrationKind,
    provider_key: &str,
    login_methods: &[&str],
    register_methods: &[&str],
    recovery_methods: &[&str],
    oauth_login_enabled: bool,
    qr_login_enabled: bool,
    oauth_providers: &[&str],
    supports_local_credentials: bool,
    supports_session_exchange: bool,
    supports_profile_write: bool,
    supports_membership_write: bool,
    upstream_base_url: Option<String>,
) -> UserCenterMetadataPayload {
    UserCenterMetadataPayload {
        integration_kind: resolve_user_center_public_mode(mode, external_integration).to_owned(),
        login_methods: login_methods
            .iter()
            .map(|value| value.to_string())
            .collect(),
        mode: resolve_user_center_public_mode(mode, external_integration).to_owned(),
        oauth_login_enabled,
        oauth_providers: oauth_providers
            .iter()
            .map(|value| value.to_string())
            .collect(),
        provider_key: provider_key.to_owned(),
        qr_login_enabled,
        recovery_methods: recovery_methods
            .iter()
            .map(|value| value.to_string())
            .collect(),
        register_methods: register_methods
            .iter()
            .map(|value| value.to_string())
            .collect(),
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
    headers: &BTreeMap<String, String>,
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
    let request = headers.iter().fold(
        request.set("Accept", "application/json"),
        |request, (header_name, header_value)| {
            request.set(header_name.as_str(), header_value.as_str())
        },
    );

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
    let membership_scope_user = load_user_by_id(connection, user_id)?
        .ok_or_else(|| format!("user {user_id} was not found for vip membership upsert"))?;

    connection
        .execute(
            r#"
            INSERT INTO plus_vip_user (
                id, uuid, tenant_id, organization_id, user_id, vip_level_id, vip_level_name, status, point_balance,
                total_recharged_points, monthly_credits, seat_limit, valid_from, valid_to,
                last_active_time, remark, created_at, updated_at, version, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, 0, ?9, ?10, NULL, ?11, ?12, NULL, ?13, ?14, 0, 0
            )
            ON CONFLICT(user_id) DO UPDATE SET
                tenant_id = excluded.tenant_id,
                organization_id = excluded.organization_id,
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
                crate::create_identifier("vip-user"),
                stable_entity_uuid("plus_vip_user", user_id),
                membership_scope_user
                    .tenant_id
                    .clone()
                    .unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned()),
                &membership_scope_user.organization_id,
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
        uuid: user.uuid.clone(),
        tenant_id: user.tenant_id.clone(),
        organization_id: user.organization_id.clone(),
        created_at: user.created_at.clone(),
        updated_at: user.updated_at.clone(),
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
        email: resolve_user_public_identity(&user.email, user.phone.as_deref()),
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
    provider_mode: &str,
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

    Ok(Some(build_user_center_session_payload(
        session.created_at,
        session.provider_key,
        provider_mode.to_owned(),
        None,
        session.id,
        None,
        session.updated_at,
        map_user_record_to_user_payload(user),
    )))
}

fn current_epoch_millis() -> Result<i64, String> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| format!("read system time failed: {error}"))
        .map(|duration| duration.as_millis() as i64)
}

fn normalize_login_qr_key(qr_key: &str) -> Result<String, String> {
    normalize_optional_text(Some(qr_key)).ok_or_else(|| "qrKey is required.".to_owned())
}

fn join_base_url_path(base_url: Option<&str>, path: &str) -> String {
    let normalized_path = if path.starts_with('/') {
        path.to_owned()
    } else {
        format!("/{path}")
    };

    match base_url.and_then(|value| normalize_optional_text(Some(value))) {
        Some(base_url) => format!("{}{}", base_url.trim_end_matches('/'), normalized_path),
        None => normalized_path,
    }
}

fn create_login_qr_record(
    connection: &mut Connection,
    provider_key: &str,
    ttl: Duration,
) -> Result<LoginQrRecord, String> {
    let qr_key = crate::create_identifier("user-login-qr");
    let now_millis = current_epoch_millis()?;
    let now = crate::storage_timestamp_from_millis(now_millis);
    let expires_at =
        crate::storage_timestamp_from_millis(now_millis.saturating_add(ttl.as_millis() as i64));

    connection
        .execute(
            r#"
            INSERT INTO plus_user_login_qr (
                id, uuid, tenant_id, organization_id, provider_key, qr_key, status, session_id, user_id,
                scanned_at, confirmed_at, expires_at, metadata_json,
                created_at, updated_at, version, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, 'pending', NULL, NULL,
                NULL, NULL, ?7, NULL,
                ?8, ?9, 0, 0
            )
            "#,
            params![
                &qr_key,
                stable_entity_uuid("plus_user_login_qr", &qr_key),
                DEFAULT_LOCAL_TENANT_ID,
                Option::<&str>::None,
                provider_key,
                &qr_key,
                &expires_at,
                &now,
                &now,
            ],
        )
        .map_err(|error| format!("create login qr {qr_key} failed: {error}"))?;

    Ok(LoginQrRecord {
        expires_at,
        id: qr_key.clone(),
        qr_key,
        session_id: None,
        status: "pending".to_owned(),
        user_id: None,
    })
}

fn load_login_qr_record(
    connection: &Connection,
    qr_key: &str,
) -> Result<Option<LoginQrRecord>, String> {
    connection
        .query_row(
            r#"
            SELECT
                id,
                qr_key,
                status,
                session_id,
                user_id,
                scanned_at,
                confirmed_at,
                expires_at,
                created_at,
                updated_at
            FROM plus_user_login_qr
            WHERE qr_key = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![qr_key],
            |row| {
                Ok(LoginQrRecord {
                    id: sqlite_row_required_string_value(row, 0, "plus_user_login_qr.id")?,
                    qr_key: row.get(1)?,
                    status: row.get(2)?,
                    session_id: sqlite_row_optional_string_value(
                        row,
                        3,
                        "plus_user_login_qr.session_id",
                    )?,
                    user_id: sqlite_row_optional_string_value(
                        row,
                        4,
                        "plus_user_login_qr.user_id",
                    )?,
                    expires_at: row.get(7)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load login qr {qr_key} failed: {error}"))
}

fn expire_login_qr_record(connection: &mut Connection, record_id: &str) -> Result<(), String> {
    let now = crate::current_storage_timestamp();
    connection
        .execute(
            r#"
            UPDATE plus_user_login_qr
            SET updated_at = ?2, status = 'expired'
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![record_id, &now],
        )
        .map_err(|error| format!("expire login qr {record_id} failed: {error}"))?;
    Ok(())
}

fn touch_login_qr_scanned(connection: &mut Connection, record_id: &str) -> Result<(), String> {
    let now = crate::current_storage_timestamp();
    connection
        .execute(
            r#"
            UPDATE plus_user_login_qr
            SET
                updated_at = ?2,
                status = CASE WHEN status = 'pending' THEN 'scanned' ELSE status END,
                scanned_at = COALESCE(scanned_at, ?2)
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![record_id, &now],
        )
        .map_err(|error| format!("mark login qr {record_id} scanned failed: {error}"))?;
    Ok(())
}

fn confirm_login_qr_record(
    connection: &mut Connection,
    record_id: &str,
    session: &UserCenterSessionPayload,
) -> Result<(), String> {
    let now = crate::current_storage_timestamp();
    connection
        .execute(
            r#"
            UPDATE plus_user_login_qr
            SET
                updated_at = ?2,
                status = 'confirmed',
                session_id = ?3,
                user_id = ?4,
                scanned_at = COALESCE(scanned_at, ?2),
                confirmed_at = ?2
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![record_id, &now, &session.session_id, &session.user.id],
        )
        .map_err(|error| format!("confirm login qr {record_id} failed: {error}"))?;
    Ok(())
}

fn build_login_qr_code_payload(
    record: &LoginQrRecord,
    request_base_url: Option<&str>,
) -> UserCenterLoginQrCodePayload {
    UserCenterLoginQrCodePayload {
        description: Some(
            "Scan with another signed-in SDKWork BirdCoder session to confirm login quickly."
                .to_owned(),
        ),
        expire_time: crate::parse_storage_timestamp_millis(&record.expires_at),
        qr_content: Some(join_base_url_path(
            request_base_url,
            &format!("/api/app/v1/auth/qr/entry/{}", record.qr_key),
        )),
        qr_key: record.qr_key.clone(),
        qr_url: None,
        title: Some("Scan To Sign In".to_owned()),
        qr_type: Some("session-transfer".to_owned()),
    }
}

fn build_login_qr_status_payload(
    connection: &Connection,
    record: &LoginQrRecord,
) -> Result<UserCenterLoginQrStatusPayload, String> {
    let session = if record.status == "confirmed" {
        let Some(session_id) = record.session_id.as_deref() else {
            return Ok(UserCenterLoginQrStatusPayload {
                session: None,
                status: "expired".to_owned(),
                user: None,
            });
        };
        let Some(session_record) = load_session_record(connection, session_id)? else {
            return Ok(UserCenterLoginQrStatusPayload {
                session: None,
                status: "expired".to_owned(),
                user: None,
            });
        };
        read_persisted_session_payload(
            connection,
            session_id,
            session_record.provider_mode.as_str(),
        )?
    } else {
        None
    };

    let user = match session.as_ref() {
        Some(session) => Some(session.user.clone()),
        None => match record.user_id.as_deref() {
            Some(user_id) => {
                load_user_by_id(connection, user_id)?.map(map_user_record_to_user_payload)
            }
            None => None,
        },
    };

    Ok(UserCenterLoginQrStatusPayload {
        session,
        status: record.status.clone(),
        user,
    })
}

fn resolve_login_qr_status_payload(
    connection: &mut Connection,
    qr_key: &str,
) -> Result<UserCenterLoginQrStatusPayload, String> {
    let normalized_qr_key = normalize_login_qr_key(qr_key)?;
    let Some(record) = load_login_qr_record(connection, &normalized_qr_key)? else {
        return Err(format!("Login QR code {normalized_qr_key} was not found."));
    };

    if record.status != "confirmed" {
        let expires_at_millis =
            crate::parse_storage_timestamp_millis(&record.expires_at).unwrap_or_default();
        if expires_at_millis < current_epoch_millis()? {
            expire_login_qr_record(connection, &record.id)?;
            return Ok(UserCenterLoginQrStatusPayload {
                session: None,
                status: "expired".to_owned(),
                user: None,
            });
        }
    }

    build_login_qr_status_payload(connection, &record)
}

fn build_profile_payload(
    session: &UserCenterSessionPayload,
    profile: Option<UserProfileRecord>,
) -> UserCenterProfilePayload {
    UserCenterProfilePayload {
        uuid: session.user.uuid.clone(),
        tenant_id: session.user.tenant_id.clone(),
        organization_id: session.user.organization_id.clone(),
        created_at: session.user.created_at.clone(),
        updated_at: session.user.updated_at.clone(),
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
    user: &UserCenterUserPayload,
    membership: Option<VipSubscriptionRecord>,
) -> UserCenterVipMembershipPayload {
    let resolved = membership.unwrap_or(VipSubscriptionRecord {
        uuid: user.uuid.clone(),
        tenant_id: user.tenant_id.clone(),
        organization_id: user.organization_id.clone(),
        created_at: user.created_at.clone(),
        updated_at: user.updated_at.clone(),
        user_id: user.id.clone(),
        plan_id: "free".to_owned(),
        plan_title: "Free".to_owned(),
        status: "inactive".to_owned(),
        credits_per_month: 0,
        seats: 1,
        renew_at: None,
    });

    UserCenterVipMembershipPayload {
        uuid: resolved.uuid,
        tenant_id: resolved.tenant_id,
        organization_id: resolved.organization_id,
        created_at: resolved.created_at,
        updated_at: resolved.updated_at,
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

    let updated_session = build_user_center_session_payload(
        session.created_at.clone(),
        session.provider_key.clone(),
        session.provider_mode.clone(),
        session.refresh_token.clone(),
        session.session_id.clone(),
        Some(session.token_type.clone()),
        now,
        UserCenterUserPayload {
            uuid: session.user.uuid.clone(),
            tenant_id: session.user.tenant_id.clone(),
            organization_id: session.user.organization_id.clone(),
            created_at: session.user.created_at.clone(),
            updated_at: session.user.updated_at.clone(),
            avatar_url: Some(avatar_url),
            email: session.user.email.clone(),
            id: session.user.id.clone(),
            name: display_name,
        },
    );

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
        &session.user,
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
        external_integration: ExternalUserCenterIntegrationKind,
        provider_key: String,
        message: String,
    ) -> Self {
        Self {
            message,
            metadata: build_user_center_metadata(
                &mode,
                &external_integration,
                &provider_key,
                &[],
                &[],
                &[],
                false,
                false,
                &[],
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
    fixed_verify_code: Option<String>,
    oauth_authority: LocalOAuthAuthority,
    provider_key: String,
    verify_code_ttl: Duration,
}

impl LocalUserCenterProvider {
    fn new(provider_key: String) -> Self {
        let seed_policy = resolve_user_center_seed_policy_from_env();
        let fixed_verify_code = resolve_local_fixed_verify_code(&seed_policy);
        let verify_code_ttl = std::env::var(BIRDCODER_LOCAL_VERIFY_CODE_TTL_SECONDS_ENV)
            .ok()
            .and_then(|value| value.trim().parse::<u64>().ok())
            .filter(|value| *value > 0)
            .map(Duration::from_secs)
            .unwrap_or_else(|| Duration::from_secs(DEFAULT_LOCAL_VERIFY_CODE_TTL_SECONDS));

        Self {
            fixed_verify_code,
            oauth_authority: LocalOAuthAuthority::new(provider_key.as_str()),
            provider_key,
            verify_code_ttl,
        }
    }

    fn create_local_session(
        &self,
        connection: &mut Connection,
        user: &UserRecord,
    ) -> Result<UserCenterSessionPayload, String> {
        ensure_default_profile_and_membership(connection, &user.id)?;
        create_persisted_session(
            connection,
            user,
            resolve_user_center_public_mode(
                &UserCenterMode::Local,
                &ExternalUserCenterIntegrationKind::Headers,
            ),
            &self.provider_key,
            None,
        )
    }

    fn issue_verify_code(
        &self,
        connection: &mut Connection,
        verify_type: &str,
        scene: &str,
        target: &str,
    ) -> Result<(), String> {
        let normalized_target = match verify_type {
            "EMAIL" => require_normalized_email(target)?,
            "PHONE" => require_normalized_phone(target)?,
            _ => return Err("Unsupported verify type.".to_owned()),
        };
        let code = self.fixed_verify_code.clone().unwrap_or_else(|| {
            format!("{:06}", (uuid::Uuid::new_v4().as_u128() % 1_000_000) as u32)
        });
        create_verify_code_record(
            connection,
            &self.provider_key,
            verify_type,
            scene,
            &normalized_target,
            &code,
            self.verify_code_ttl,
        )?;
        Ok(())
    }

    fn register_local_email_user(
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

    fn register_local_phone_user(
        &self,
        connection: &mut Connection,
        phone: &str,
        explicit_name: Option<&str>,
        password: &str,
    ) -> Result<UserRecord, String> {
        let normalized_phone = require_normalized_phone(phone)?;
        let existing_user = load_user_by_phone(connection, &normalized_phone)?;

        if let Some(existing_user) = existing_user.as_ref() {
            if existing_user.provider_key != self.provider_key {
                return Err(format!(
                    "The account {normalized_phone} is already managed by provider {}.",
                    existing_user.provider_key
                ));
            }
            if load_local_credentials(connection, &existing_user.id)?.is_some() {
                return Err(format!("The account {normalized_phone} already exists."));
            }
        }

        let preferred_user_id = existing_user
            .as_ref()
            .map(|user| user.id.clone())
            .unwrap_or_else(|| build_local_phone_user_id(&normalized_phone));
        let resolved_email = existing_user
            .as_ref()
            .map(|user| user.email.clone())
            .unwrap_or_else(|| build_local_phone_shadow_email(&normalized_phone));
        let display_name = resolve_phone_display_name(&normalized_phone, explicit_name);
        let avatar_url = build_avatar_url(&normalized_phone);
        let user = upsert_user_shadow_with_phone(
            connection,
            &preferred_user_id,
            &resolved_email,
            Some(&normalized_phone),
            &display_name,
            Some(avatar_url.as_str()),
            &self.provider_key,
            None,
        )?;
        ensure_default_profile_and_membership(connection, &user.id)?;
        ensure_local_credentials(connection, &user.id, password, false)?;
        Ok(user)
    }

    fn resolve_or_create_oauth_user(
        &self,
        connection: &mut Connection,
        claims: &LocalOAuthAuthorizationCodeClaims,
    ) -> Result<UserRecord, String> {
        let normalized_provider = normalize_oauth_provider_identifier(&claims.provider)?;
        let normalized_subject = normalize_optional_text(Some(claims.subject.as_str()))
            .ok_or_else(|| "OAuth subject is required.".to_owned())?;
        let normalized_phone = claims
            .phone
            .as_deref()
            .map(normalize_phone)
            .filter(|value| !value.is_empty());
        let normalized_email = resolve_shadow_email_for_account(
            Some(claims.email.as_str()),
            normalized_phone.as_deref(),
            Some(normalized_subject.as_str()),
        );

        let existing_user = if let Some(bound_user) = load_user_by_oauth_account(
            connection,
            normalized_provider.as_str(),
            normalized_subject.as_str(),
        )? {
            Some(bound_user)
        } else if let Some(phone) = normalized_phone.as_deref() {
            match load_user_by_phone(connection, phone)? {
                Some(user) => Some(user),
                None => load_user_by_email(connection, normalized_email.as_str())?,
            }
        } else {
            load_user_by_email(connection, normalized_email.as_str())?
        };

        if let Some(existing_user) = existing_user.as_ref() {
            if existing_user.provider_key != self.provider_key {
                return Err(format!(
                    "The OAuth account {} is already managed by provider {}.",
                    normalized_provider, existing_user.provider_key
                ));
            }
            if !is_active_status(&existing_user.status) {
                return Err("The OAuth account is not active.".to_owned());
            }
        }

        let preferred_user_id = existing_user
            .as_ref()
            .map(|user| user.id.clone())
            .unwrap_or_else(|| {
                build_local_oauth_user_id(normalized_provider.as_str(), normalized_subject.as_str())
            });
        let display_name = match normalized_phone.as_deref() {
            Some(phone) => resolve_phone_display_name(phone, Some(claims.name.as_str())),
            None => resolve_display_name(&normalized_email, Some(claims.name.as_str())),
        };
        let user = upsert_user_shadow_with_phone(
            connection,
            preferred_user_id.as_str(),
            normalized_email.as_str(),
            normalized_phone.as_deref(),
            &display_name,
            claims.avatar_url.as_deref(),
            &self.provider_key,
            None,
        )?;
        let oauth_user_info_json = serde_json::to_string(claims)
            .map_err(|error| format!("serialize local OAuth user info failed: {error}"))?;
        upsert_oauth_account_record(
            connection,
            user.id.as_str(),
            normalized_provider.as_str(),
            normalized_subject.as_str(),
            None,
            None,
            Some(oauth_user_info_json.as_str()),
        )?;
        ensure_default_profile_and_membership(connection, &user.id)?;
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

    fn get_oauth_authorization_url(
        &self,
        request: &UserCenterOAuthAuthorizationRequest,
    ) -> Result<UserCenterOAuthUrlPayload, String> {
        self.oauth_authority.build_authorization_url(request)
    }

    fn login_with_email_code(
        &self,
        connection: &mut Connection,
        request: &UserCenterEmailCodeLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_email = require_normalized_email(&request.email)?;
        let user = load_user_by_email(connection, &normalized_email)?
            .ok_or_else(|| "Invalid email or verification code.".to_owned())?;
        if !is_active_status(&user.status) {
            return Err("Invalid email or verification code.".to_owned());
        }
        consume_verify_code(
            connection,
            &normalized_email,
            "EMAIL",
            "LOGIN",
            &request.code,
        )?;
        self.create_local_session(connection, &user)
    }

    fn login_with_oauth(
        &self,
        connection: &mut Connection,
        request: &UserCenterOAuthLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_provider = normalize_oauth_provider_identifier(&request.provider)?;
        let claims = self
            .oauth_authority
            .resolve_authorization_code(request.code.as_str(), normalized_provider.as_str())?;
        let user = self.resolve_or_create_oauth_user(connection, &claims)?;
        self.create_local_session(connection, &user)
    }

    fn login_with_phone_code(
        &self,
        connection: &mut Connection,
        request: &UserCenterPhoneCodeLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_phone = require_normalized_phone(&request.phone)?;
        let user = load_user_by_phone(connection, &normalized_phone)?
            .ok_or_else(|| "Invalid phone or verification code.".to_owned())?;
        if !is_active_status(&user.status) {
            return Err("Invalid phone or verification code.".to_owned());
        }
        consume_verify_code(
            connection,
            &normalized_phone,
            "PHONE",
            "LOGIN",
            &request.code,
        )?;
        self.create_local_session(connection, &user)
    }

    fn login(
        &self,
        connection: &mut Connection,
        request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let account = resolve_login_account(request)?;
        let password = require_password_input(request.password.as_deref(), "sign in")?;
        let invalid_credentials_error = || "Invalid account or password.".to_owned();
        let user =
            resolve_user_by_account(connection, &account)?.ok_or_else(invalid_credentials_error)?;
        let credentials =
            load_local_credentials(connection, &user.id)?.ok_or_else(invalid_credentials_error)?;
        if !is_active_status(&user.status) || !is_active_status(&credentials.status) {
            return Err(invalid_credentials_error());
        }
        if !verify_local_password(&credentials.password_hash, &password)? {
            return Err(invalid_credentials_error());
        }
        self.create_local_session(connection, &user)
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
        let oauth_providers = self.oauth_authority.enabled_provider_ids();
        build_user_center_metadata(
            &UserCenterMode::Local,
            &ExternalUserCenterIntegrationKind::Headers,
            &self.provider_key,
            &["password", "emailCode", "phoneCode"],
            &["email", "phone"],
            &["email", "phone"],
            !oauth_providers.is_empty(),
            true,
            oauth_providers
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>()
                .as_slice(),
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
            &session.user,
            load_vip_subscription_record(connection, &session.user.id)?,
        ))
    }

    fn register(
        &self,
        connection: &mut Connection,
        request: &UserCenterRegisterRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let password = require_password_input(request.password.as_deref(), "register")?;
        require_password_confirmation(&password, request.confirm_password.as_deref())?;
        let explicit_name = request.name.as_deref().or(request.username.as_deref());
        let verification_code = normalize_optional_text(request.verification_code.as_deref())
            .ok_or_else(|| "Verification code is required.".to_owned())?;
        let normalized_channel = normalize_optional_text(request.channel.as_deref())
            .map(|value| value.to_ascii_uppercase());

        let user = match normalized_channel.as_deref() {
            Some("PHONE") | Some("SMS") => {
                let normalized_phone = request
                    .phone
                    .as_deref()
                    .ok_or_else(|| "Phone is required for phone registration.".to_owned())
                    .and_then(require_normalized_phone)?;
                consume_verify_code(
                    connection,
                    &normalized_phone,
                    "PHONE",
                    "REGISTER",
                    &verification_code,
                )?;
                self.register_local_phone_user(
                    connection,
                    &normalized_phone,
                    explicit_name,
                    &password,
                )?
            }
            Some("EMAIL") => {
                let normalized_email = request
                    .email
                    .as_deref()
                    .ok_or_else(|| "Email is required for email registration.".to_owned())
                    .and_then(require_normalized_email)?;
                consume_verify_code(
                    connection,
                    &normalized_email,
                    "EMAIL",
                    "REGISTER",
                    &verification_code,
                )?;
                self.register_local_email_user(
                    connection,
                    &normalized_email,
                    explicit_name,
                    &password,
                )?
            }
            Some(_) => {
                return Err("channel must be EMAIL, PHONE, or SMS.".to_owned());
            }
            None if request.phone.is_some() && request.email.is_none() => {
                let normalized_phone = request
                    .phone
                    .as_deref()
                    .ok_or_else(|| "Phone is required for phone registration.".to_owned())
                    .and_then(require_normalized_phone)?;
                consume_verify_code(
                    connection,
                    &normalized_phone,
                    "PHONE",
                    "REGISTER",
                    &verification_code,
                )?;
                self.register_local_phone_user(
                    connection,
                    &normalized_phone,
                    explicit_name,
                    &password,
                )?
            }
            None => {
                let normalized_email = request
                    .email
                    .as_deref()
                    .ok_or_else(|| "Email is required for email registration.".to_owned())
                    .and_then(require_normalized_email)?;
                consume_verify_code(
                    connection,
                    &normalized_email,
                    "EMAIL",
                    "REGISTER",
                    &verification_code,
                )?;
                self.register_local_email_user(
                    connection,
                    &normalized_email,
                    explicit_name,
                    &password,
                )?
            }
        };
        self.create_local_session(connection, &user)
    }

    fn request_password_reset(
        &self,
        connection: &mut Connection,
        request: &UserCenterPasswordResetChallengeRequest,
    ) -> Result<(), String> {
        let account = normalize_optional_text(Some(request.account.as_str()))
            .ok_or_else(|| "Account is required.".to_owned())?;
        let user = resolve_user_by_account(connection, &account)?
            .ok_or_else(|| "The account was not found.".to_owned())?;

        match normalize_password_reset_channel(&request.channel)? {
            "EMAIL" => {
                let normalized_email = require_normalized_email(&user.email)?;
                if is_local_phone_shadow_email(&normalized_email) {
                    return Err(
                        "Email password reset is not available for this account.".to_owned()
                    );
                }
                self.issue_verify_code(connection, "EMAIL", "RESET_PASSWORD", &normalized_email)
            }
            "SMS" => {
                let normalized_phone = user
                    .phone
                    .as_deref()
                    .ok_or_else(|| {
                        "SMS password reset is not available for this account.".to_owned()
                    })
                    .and_then(require_normalized_phone)?;
                self.issue_verify_code(connection, "PHONE", "RESET_PASSWORD", &normalized_phone)
            }
            _ => Err("channel must be EMAIL or SMS.".to_owned()),
        }
    }

    fn reset_password(
        &self,
        connection: &mut Connection,
        request: &UserCenterPasswordResetRequest,
    ) -> Result<(), String> {
        let password =
            require_password_input(Some(request.new_password.as_str()), "reset password")?;
        require_password_confirmation(&password, request.confirm_password.as_deref())?;
        let account = normalize_optional_text(Some(request.account.as_str()))
            .ok_or_else(|| "Account is required.".to_owned())?;
        let user = resolve_user_by_account(connection, &account)?
            .ok_or_else(|| "The account was not found.".to_owned())?;

        let mut candidates = Vec::new();
        if !looks_like_phone_account(&account) {
            let normalized_email = require_normalized_email(&user.email)?;
            if !is_local_phone_shadow_email(&normalized_email) {
                candidates.push((normalized_email, "EMAIL"));
            }
        }
        if let Some(normalized_phone) = user
            .phone
            .as_deref()
            .and_then(|value| require_normalized_phone(value).ok())
        {
            candidates.push((normalized_phone, "PHONE"));
        }
        if candidates.is_empty() {
            return Err("No password-reset channel is configured for this account.".to_owned());
        }

        let mut last_error: Option<String> = None;
        for (target, verify_type) in candidates {
            match consume_verify_code(
                connection,
                &target,
                verify_type,
                "RESET_PASSWORD",
                &request.code,
            ) {
                Ok(()) => {
                    ensure_local_credentials(connection, &user.id, &password, true)?;
                    return Ok(());
                }
                Err(error) => {
                    last_error = Some(error);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| "Verification code is invalid.".to_owned()))
    }

    fn send_verify_code(
        &self,
        connection: &mut Connection,
        request: &UserCenterSendVerifyCodeRequest,
    ) -> Result<(), String> {
        let verify_type = normalize_verify_type(&request.verify_type)?;
        let scene = normalize_verify_scene(&request.scene)?;
        self.issue_verify_code(connection, verify_type, scene, &request.target)
    }

    fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String> {
        let Some(session_id) = read_session_header(headers) else {
            return Ok(None);
        };
        read_persisted_session_payload(
            connection,
            &session_id,
            resolve_user_center_public_mode(
                &UserCenterMode::Local,
                &ExternalUserCenterIntegrationKind::Headers,
            ),
        )
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
        let user_timestamp = now.clone();

        Some(build_user_center_session_payload(
            now.clone(),
            self.provider_key.clone(),
            resolve_user_center_public_mode(
                &UserCenterMode::External,
                &ExternalUserCenterIntegrationKind::Headers,
            )
            .to_owned(),
            None,
            format!("external-header:{user_id}"),
            None,
            now,
            UserCenterUserPayload {
                uuid: stable_entity_uuid("plus_user", &user_id),
                tenant_id: Some(DEFAULT_LOCAL_TENANT_ID.to_owned()),
                organization_id: None,
                created_at: user_timestamp.clone(),
                updated_at: user_timestamp,
                avatar_url,
                email,
                id: user_id,
                name,
            },
        ))
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
            resolve_user_center_public_mode(
                &UserCenterMode::External,
                &ExternalUserCenterIntegrationKind::Headers,
            ),
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
            &ExternalUserCenterIntegrationKind::Headers,
            &self.provider_key,
            &["sessionBridge"],
            &[],
            &[],
            false,
            true,
            &[],
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
            &session.user,
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
            if let Some(persisted_session) = read_persisted_session_payload(
                connection,
                &session_id,
                resolve_user_center_public_mode(
                    &UserCenterMode::External,
                    &ExternalUserCenterIntegrationKind::Headers,
                ),
            )? {
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
struct SdkworkCloudAppApiExternalUserCenterProvider {
    config: ExternalAppApiConfig,
    oauth_providers: Vec<String>,
    provider_key: String,
}

impl SdkworkCloudAppApiExternalUserCenterProvider {
    fn new(provider_key: String, config: ExternalAppApiConfig) -> Self {
        Self {
            config,
            oauth_providers: resolve_cloud_app_api_oauth_providers_from_env(),
            provider_key,
        }
    }

    fn require_enabled_oauth_provider(&self, provider: &str) -> Result<String, String> {
        let normalized_provider = normalize_oauth_provider_identifier(provider)?;
        if self.oauth_providers.contains(&normalized_provider) {
            return Ok(normalized_provider);
        }

        Err(format!(
            "OAuth provider {} is not enabled for the configured sdkwork-cloud-app-api integration.",
            normalized_provider
        ))
    }

    fn build_request_headers(
        &self,
        method: &str,
        path: &str,
        session_id: Option<&str>,
        upstream_state: Option<&PersistedUpstreamSessionState>,
    ) -> Result<BTreeMap<String, String>, String> {
        build_external_app_api_request_headers(
            &self.config,
            &ExternalAppApiRequestContext {
                method,
                path,
                provider_key: self.provider_key.as_str(),
                session_id,
                signed_at: None,
                upstream_state,
            },
        )
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

    fn provider_mode(&self) -> &'static str {
        resolve_user_center_public_mode(
            &UserCenterMode::External,
            &ExternalUserCenterIntegrationKind::SdkworkCloudAppApi,
        )
    }

    fn create_persisted_session_from_login_payload(
        &self,
        connection: &mut Connection,
        account_hint: &str,
        display_name_hint: Option<&str>,
        login_payload: &UpstreamAppApiLoginPayload,
    ) -> Result<UserCenterSessionPayload, String> {
        let user = self.sync_user_from_login_payload(
            connection,
            account_hint,
            display_name_hint,
            login_payload,
        )?;
        let upstream_state = self.build_upstream_session_state(login_payload);
        create_persisted_session(
            connection,
            &user,
            self.provider_mode(),
            &self.provider_key,
            Some(&upstream_state),
        )
    }

    fn request_login(
        &self,
        account: &str,
        password: &str,
    ) -> Result<UpstreamAppApiLoginPayload, String> {
        let headers = self.build_request_headers("POST", "/auth/login", None, None)?;

        upstream_request_json::<UpstreamAppApiLoginPayload>(
            &self.config,
            "POST",
            "/auth/login",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiLoginRequestPayload {
                    password: password.to_owned(),
                    username: account.to_owned(),
                })
                .map_err(|error| format!("serialize upstream login request failed: {error}"))?,
            ),
        )?
        .ok_or_else(|| "Upstream user center returned an empty login payload.".to_owned())
    }

    fn request_email_code_login(
        &self,
        request: &UserCenterEmailCodeLoginRequest,
    ) -> Result<UpstreamAppApiLoginPayload, String> {
        let headers = self.build_request_headers("POST", "/auth/email/login", None, None)?;

        upstream_request_json::<UpstreamAppApiLoginPayload>(
            &self.config,
            "POST",
            "/auth/email/login",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiEmailCodeLoginRequestPayload {
                    app_version: normalize_optional_text(request.app_version.as_deref()),
                    code: request.code.trim().to_owned(),
                    device_id: normalize_optional_text(request.device_id.as_deref()),
                    device_name: normalize_optional_text(request.device_name.as_deref()),
                    device_type: normalize_optional_text(request.device_type.as_deref()),
                    email: request.email.trim().to_owned(),
                })
                .map_err(|error| {
                    format!("serialize upstream email-code login request failed: {error}")
                })?,
            ),
        )?
        .ok_or_else(|| {
            "Upstream user center returned an empty email-code login payload.".to_owned()
        })
    }

    fn request_phone_code_login(
        &self,
        request: &UserCenterPhoneCodeLoginRequest,
    ) -> Result<UpstreamAppApiLoginPayload, String> {
        let headers = self.build_request_headers("POST", "/auth/phone/login", None, None)?;

        upstream_request_json::<UpstreamAppApiLoginPayload>(
            &self.config,
            "POST",
            "/auth/phone/login",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiPhoneCodeLoginRequestPayload {
                    app_version: normalize_optional_text(request.app_version.as_deref()),
                    code: request.code.trim().to_owned(),
                    device_id: normalize_optional_text(request.device_id.as_deref()),
                    device_name: normalize_optional_text(request.device_name.as_deref()),
                    device_type: normalize_optional_text(request.device_type.as_deref()),
                    phone: request.phone.trim().to_owned(),
                })
                .map_err(|error| {
                    format!("serialize upstream phone-code login request failed: {error}")
                })?,
            ),
        )?
        .ok_or_else(|| {
            "Upstream user center returned an empty phone-code login payload.".to_owned()
        })
    }

    fn request_oauth_authorization_url(
        &self,
        request: &UserCenterOAuthAuthorizationRequest,
    ) -> Result<UserCenterOAuthUrlPayload, String> {
        let normalized_provider = self.require_enabled_oauth_provider(&request.provider)?;
        let redirect_uri = normalize_optional_text(Some(request.redirect_uri.as_str()))
            .ok_or_else(|| "OAuth redirectUri is required.".to_owned())?;
        let headers = self.build_request_headers("POST", "/auth/oauth/url", None, None)?;
        let oauth_payload = upstream_request_json::<UpstreamAppApiOAuthUrlPayload>(
            &self.config,
            "POST",
            "/auth/oauth/url",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiOAuthAuthorizationRequestPayload {
                    provider: map_oauth_provider_to_upstream(&normalized_provider)?,
                    redirect_uri,
                    scope: normalize_optional_text(request.scope.as_deref()),
                    state: normalize_optional_text(request.state.as_deref()),
                })
                .map_err(|error| {
                    format!("serialize upstream oauth authorization request failed: {error}")
                })?,
            ),
        )?
        .ok_or_else(|| {
            "Upstream user center returned an empty OAuth authorization payload.".to_owned()
        })?;
        let auth_url =
            normalize_optional_text(oauth_payload.auth_url.as_deref()).ok_or_else(|| {
                "Upstream user center did not return an OAuth authorization URL.".to_owned()
            })?;

        Ok(UserCenterOAuthUrlPayload { auth_url })
    }

    fn request_oauth_login(
        &self,
        request: &UserCenterOAuthLoginRequest,
    ) -> Result<UpstreamAppApiLoginPayload, String> {
        let normalized_provider = self.require_enabled_oauth_provider(&request.provider)?;
        let code = normalize_optional_text(Some(request.code.as_str()))
            .ok_or_else(|| "OAuth code is required.".to_owned())?;
        let headers = self.build_request_headers("POST", "/auth/oauth/login", None, None)?;
        upstream_request_json::<UpstreamAppApiLoginPayload>(
            &self.config,
            "POST",
            "/auth/oauth/login",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiOAuthLoginRequestPayload {
                    code,
                    device_id: normalize_optional_text(request.device_id.as_deref()),
                    device_type: normalize_optional_text(request.device_type.as_deref()),
                    provider: map_oauth_provider_to_upstream(&normalized_provider)?,
                    state: normalize_optional_text(request.state.as_deref()),
                })
                .map_err(|error| {
                    format!("serialize upstream oauth login request failed: {error}")
                })?,
            ),
        )?
        .ok_or_else(|| "Upstream user center returned an empty OAuth login payload.".to_owned())
    }

    fn request_send_verify_code(
        &self,
        request: &UserCenterSendVerifyCodeRequest,
    ) -> Result<(), String> {
        let headers = self.build_request_headers("POST", "/auth/verify/send", None, None)?;
        let verify_type = normalize_verify_type(&request.verify_type)?;
        let scene = normalize_verify_scene(&request.scene)?;
        let normalized_target = match verify_type {
            "EMAIL" => require_normalized_email(request.target.as_str())?,
            "PHONE" => require_normalized_phone(request.target.as_str())?,
            _ => request.target.trim().to_owned(),
        };

        let _ = upstream_request_json::<Value>(
            &self.config,
            "POST",
            "/auth/verify/send",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiVerifyCodeSendRequestPayload {
                    device_id: None,
                    target: normalized_target,
                    scene: scene.to_owned(),
                    verify_type: verify_type.to_owned(),
                })
                .map_err(|error| {
                    format!("serialize upstream verify-code request failed: {error}")
                })?,
            ),
        )?;

        Ok(())
    }

    fn request_password_reset_challenge(
        &self,
        request: &UserCenterPasswordResetChallengeRequest,
    ) -> Result<(), String> {
        let headers =
            self.build_request_headers("POST", "/auth/password/reset/request", None, None)?;
        let account = normalize_optional_text(Some(request.account.as_str()))
            .ok_or_else(|| "Account is required.".to_owned())?;
        let channel = normalize_password_reset_channel(&request.channel)?;

        let _ = upstream_request_json::<Value>(
            &self.config,
            "POST",
            "/auth/password/reset/request",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiPasswordResetChallengeRequestPayload {
                    account,
                    channel: channel.to_owned(),
                })
                .map_err(|error| {
                    format!("serialize upstream password-reset challenge request failed: {error}")
                })?,
            ),
        )?;

        Ok(())
    }

    fn request_password_reset(
        &self,
        request: &UserCenterPasswordResetRequest,
    ) -> Result<(), String> {
        let headers = self.build_request_headers("POST", "/auth/password/reset", None, None)?;
        let account = normalize_optional_text(Some(request.account.as_str()))
            .ok_or_else(|| "Account is required.".to_owned())?;
        let code = normalize_optional_text(Some(request.code.as_str()))
            .ok_or_else(|| "Verification code is required.".to_owned())?;
        let new_password =
            require_password_input(Some(request.new_password.as_str()), "reset password")?;
        require_password_confirmation(&new_password, request.confirm_password.as_deref())?;

        let _ = upstream_request_json::<Value>(
            &self.config,
            "POST",
            "/auth/password/reset",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiPasswordResetRequestPayload {
                    account,
                    code,
                    confirm_password: request.confirm_password.clone(),
                    new_password,
                })
                .map_err(|error| {
                    format!(
                        "serialize upstream password-reset confirmation request failed: {error}"
                    )
                })?,
            ),
        )?;

        Ok(())
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
        let current_state = session_record_to_upstream_state(session_record).ok_or_else(|| {
            "The external user-center session cannot be refreshed because no upstream token state is stored.".to_owned()
        })?;
        let headers = self.build_request_headers(
            "POST",
            "/auth/refresh",
            Some(session_record.id.as_str()),
            Some(&current_state),
        )?;
        let refreshed = upstream_request_json::<UpstreamAppApiLoginPayload>(
            &self.config,
            "POST",
            "/auth/refresh",
            &headers,
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
        session_id: Option<&str>,
        upstream_state: &PersistedUpstreamSessionState,
    ) -> Result<UpstreamAppApiUserProfilePayload, String> {
        let headers =
            self.build_request_headers("GET", "/user/profile", session_id, Some(upstream_state))?;
        upstream_request_json::<UpstreamAppApiUserProfilePayload>(
            &self.config,
            "GET",
            "/user/profile",
            &headers,
            None,
        )?
        .ok_or_else(|| "Upstream user center returned an empty profile payload.".to_owned())
    }

    fn request_vip_info_with_state(
        &self,
        session_id: Option<&str>,
        upstream_state: &PersistedUpstreamSessionState,
    ) -> Result<UpstreamAppApiVipInfoPayload, String> {
        let headers =
            self.build_request_headers("GET", "/vip/info", session_id, Some(upstream_state))?;
        upstream_request_json::<UpstreamAppApiVipInfoPayload>(
            &self.config,
            "GET",
            "/vip/info",
            &headers,
            None,
        )?
        .ok_or_else(|| "Upstream user center returned an empty VIP payload.".to_owned())
    }

    fn update_profile_with_state(
        &self,
        session_id: Option<&str>,
        upstream_state: &PersistedUpstreamSessionState,
        request: &UpdateUserCenterProfileRequest,
    ) -> Result<UpstreamAppApiUserProfilePayload, String> {
        let headers =
            self.build_request_headers("PUT", "/user/profile", session_id, Some(upstream_state))?;
        upstream_request_json::<UpstreamAppApiUserProfilePayload>(
            &self.config,
            "PUT",
            "/user/profile",
            &headers,
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
        account_fallback: &str,
        display_name_hint: Option<&str>,
        login_payload: &UpstreamAppApiLoginPayload,
    ) -> Result<UserRecord, String> {
        let user_info = login_payload.user_info.as_ref();
        let resolved_phone = user_info
            .and_then(|payload| payload.phone.as_deref())
            .map(normalize_phone)
            .filter(|value| !value.is_empty());
        let resolved_email = resolve_shadow_email_for_account(
            user_info.and_then(|payload| payload.email.as_deref()),
            resolved_phone.as_deref(),
            Some(account_fallback),
        );
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
        let display_name = match resolved_phone.as_deref() {
            Some(phone) => resolve_phone_display_name(
                phone,
                user_info
                    .and_then(|payload| payload.nickname.as_deref())
                    .or(display_name_hint),
            ),
            None => resolve_display_name(
                &resolved_email,
                user_info
                    .and_then(|payload| payload.nickname.as_deref())
                    .or(display_name_hint),
            ),
        };
        let avatar_url = user_info.and_then(|payload| payload.avatar.as_deref());
        let user = upsert_user_shadow_with_phone(
            connection,
            &preferred_user_id,
            &resolved_email,
            resolved_phone.as_deref(),
            &display_name,
            avatar_url,
            &self.provider_key,
            resolved_subject.as_deref(),
        )?;
        ensure_default_profile_and_membership(connection, &user.id)?;
        Ok(user)
    }

    fn resolve_oauth_account_hint(
        &self,
        provider: &str,
        login_payload: &UpstreamAppApiLoginPayload,
    ) -> String {
        let user_info = login_payload.user_info.as_ref();
        if let Some(email) = user_info
            .and_then(|payload| payload.email.as_deref())
            .and_then(|value| normalize_optional_text(Some(value)))
        {
            return email;
        }

        if let Some(phone) = user_info
            .and_then(|payload| payload.phone.as_deref())
            .map(normalize_phone)
            .filter(|value| !value.is_empty())
        {
            return phone;
        }

        let stable_identity = user_info
            .and_then(|payload| normalize_value_string(payload.id.as_ref()))
            .or_else(|| {
                user_info.and_then(|payload| normalize_optional_text(payload.username.as_deref()))
            })
            .unwrap_or_else(|| "user".to_owned());

        format!("{provider}-{stable_identity}")
    }

    fn sync_user_from_profile_payload(
        &self,
        connection: &mut Connection,
        existing_user: &UserRecord,
        profile_payload: &UpstreamAppApiUserProfilePayload,
        upstream_state: &PersistedUpstreamSessionState,
    ) -> Result<UserRecord, String> {
        let resolved_phone = profile_payload
            .phone
            .as_deref()
            .map(normalize_phone)
            .filter(|value| !value.is_empty())
            .or_else(|| existing_user.phone.clone());
        let resolved_email = resolve_shadow_email_for_account(
            profile_payload.email.as_deref(),
            resolved_phone.as_deref(),
            Some(existing_user.email.as_str()),
        );
        let display_name = match resolved_phone.as_deref() {
            Some(phone) => resolve_phone_display_name(
                phone,
                profile_payload
                    .nickname
                    .as_deref()
                    .or(Some(existing_user.display_name.as_str())),
            ),
            None => resolve_display_name(
                &resolved_email,
                profile_payload
                    .nickname
                    .as_deref()
                    .or(Some(existing_user.display_name.as_str())),
            ),
        };
        let user = upsert_user_shadow_with_phone(
            connection,
            &existing_user.id,
            &resolved_email,
            resolved_phone.as_deref(),
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

impl UserCenterProvider for SdkworkCloudAppApiExternalUserCenterProvider {
    fn exchange_session(
        &self,
        _connection: &mut Connection,
        _request: &UserCenterSessionExchangeRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        Err("Session exchange is not supported for sdkwork-cloud-app-api integration.".to_owned())
    }

    fn get_oauth_authorization_url(
        &self,
        request: &UserCenterOAuthAuthorizationRequest,
    ) -> Result<UserCenterOAuthUrlPayload, String> {
        self.request_oauth_authorization_url(request)
    }

    fn login(
        &self,
        connection: &mut Connection,
        request: &UserCenterLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let account = resolve_login_account(request)?;
        let password = require_password_input(request.password.as_deref(), "sign in")?;
        let login_payload = self.request_login(&account, &password)?;
        self.create_persisted_session_from_login_payload(connection, &account, None, &login_payload)
    }

    fn login_with_email_code(
        &self,
        connection: &mut Connection,
        request: &UserCenterEmailCodeLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_email = require_normalized_email(&request.email)?;
        let normalized_request = UserCenterEmailCodeLoginRequest {
            app_version: request.app_version.clone(),
            code: request.code.trim().to_owned(),
            device_id: request.device_id.clone(),
            device_name: request.device_name.clone(),
            device_type: request.device_type.clone(),
            email: normalized_email.clone(),
        };
        let login_payload = self.request_email_code_login(&normalized_request)?;
        self.create_persisted_session_from_login_payload(
            connection,
            &normalized_email,
            None,
            &login_payload,
        )
    }

    fn login_with_oauth(
        &self,
        connection: &mut Connection,
        request: &UserCenterOAuthLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_provider = self.require_enabled_oauth_provider(&request.provider)?;
        let login_payload = self.request_oauth_login(request)?;
        let account_hint = self.resolve_oauth_account_hint(&normalized_provider, &login_payload);
        self.create_persisted_session_from_login_payload(
            connection,
            &account_hint,
            None,
            &login_payload,
        )
    }

    fn login_with_phone_code(
        &self,
        connection: &mut Connection,
        request: &UserCenterPhoneCodeLoginRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let normalized_phone = require_normalized_phone(&request.phone)?;
        let normalized_request = UserCenterPhoneCodeLoginRequest {
            app_version: request.app_version.clone(),
            code: request.code.trim().to_owned(),
            device_id: request.device_id.clone(),
            device_name: request.device_name.clone(),
            device_type: request.device_type.clone(),
            phone: normalized_phone.clone(),
        };
        let login_payload = self.request_phone_code_login(&normalized_request)?;
        self.create_persisted_session_from_login_payload(
            connection,
            &normalized_phone,
            None,
            &login_payload,
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
                if let Ok(headers) = self.build_request_headers(
                    "POST",
                    "/auth/logout",
                    Some(session_record.id.as_str()),
                    Some(&upstream_state),
                ) {
                    let _ = upstream_request_json::<Value>(
                        &self.config,
                        "POST",
                        "/auth/logout",
                        &headers,
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
            &ExternalUserCenterIntegrationKind::SdkworkCloudAppApi,
            &self.provider_key,
            &["password", "emailCode", "phoneCode"],
            &["email", "phone"],
            &["email", "phone"],
            !self.oauth_providers.is_empty(),
            true,
            self.oauth_providers
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>()
                .as_slice(),
            false,
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

        let profile_payload = match self
            .request_profile_with_state(Some(session_record.id.as_str()), &upstream_state)
        {
            Ok(profile_payload) => profile_payload,
            Err(error) if error.contains("status 401") || error.contains("status 403") => {
                upstream_state = self.refresh_session_state(connection, &session_record)?;
                self.request_profile_with_state(Some(session_record.id.as_str()), &upstream_state)?
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
        let vip_payload = match self
            .request_vip_info_with_state(Some(session_record.id.as_str()), &upstream_state)
        {
            Ok(vip_payload) => vip_payload,
            Err(error) if error.contains("status 401") || error.contains("status 403") => {
                upstream_state = self.refresh_session_state(connection, &session_record)?;
                self.request_vip_info_with_state(Some(session_record.id.as_str()), &upstream_state)?
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
            &session.user,
            Some(membership),
        ))
    }

    fn register(
        &self,
        connection: &mut Connection,
        request: &UserCenterRegisterRequest,
    ) -> Result<UserCenterSessionPayload, String> {
        let password = require_password_input(request.password.as_deref(), "register")?;
        require_password_confirmation(&password, request.confirm_password.as_deref())?;
        let verification_code = normalize_optional_text(request.verification_code.as_deref())
            .ok_or_else(|| "Verification code is required.".to_owned())?;
        let normalized_channel = normalize_optional_text(request.channel.as_deref())
            .map(|value| value.to_ascii_uppercase());
        let normalized_optional_email = request
            .email
            .as_deref()
            .map(require_normalized_email)
            .transpose()?;
        let normalized_optional_phone = request
            .phone
            .as_deref()
            .map(require_normalized_phone)
            .transpose()?;
        let normalized_username = normalize_optional_text(request.username.as_deref());
        let display_name_hint = request.name.as_deref().or(request.username.as_deref());
        let (account_for_login, user_type, resolved_email, resolved_phone, resolved_username) =
            match normalized_channel.as_deref() {
                Some("PHONE") | Some("SMS") => {
                    let normalized_phone = normalized_optional_phone
                        .clone()
                        .ok_or_else(|| "Phone is required for phone registration.".to_owned())?;
                    (
                        normalized_phone.clone(),
                        "PHONE",
                        normalized_optional_email.clone(),
                        Some(normalized_phone.clone()),
                        normalized_username
                            .clone()
                            .unwrap_or_else(|| normalized_phone.clone()),
                    )
                }
                Some("EMAIL") => {
                    let normalized_email = normalized_optional_email
                        .clone()
                        .ok_or_else(|| "Email is required for email registration.".to_owned())?;
                    (
                        normalized_email.clone(),
                        "EMAIL",
                        Some(normalized_email.clone()),
                        normalized_optional_phone.clone(),
                        normalized_username
                            .clone()
                            .unwrap_or_else(|| normalized_email.clone()),
                    )
                }
                Some(_) => {
                    return Err("channel must be EMAIL, PHONE, or SMS.".to_owned());
                }
                None if normalized_optional_phone.is_some()
                    && normalized_optional_email.is_none() =>
                {
                    let normalized_phone = normalized_optional_phone
                        .clone()
                        .ok_or_else(|| "Phone is required for phone registration.".to_owned())?;
                    (
                        normalized_phone.clone(),
                        "PHONE",
                        None,
                        Some(normalized_phone.clone()),
                        normalized_username
                            .clone()
                            .unwrap_or_else(|| normalized_phone.clone()),
                    )
                }
                None => {
                    let normalized_email = normalized_optional_email
                        .clone()
                        .ok_or_else(|| "Email is required for email registration.".to_owned())?;
                    (
                        normalized_email.clone(),
                        "EMAIL",
                        Some(normalized_email.clone()),
                        normalized_optional_phone.clone(),
                        normalized_username
                            .clone()
                            .unwrap_or_else(|| normalized_email.clone()),
                    )
                }
            };
        let headers = self.build_request_headers("POST", "/auth/register", None, None)?;
        let _ = upstream_request_json::<UpstreamAppApiUserInfoPayload>(
            &self.config,
            "POST",
            "/auth/register",
            &headers,
            Some(
                serde_json::to_value(UpstreamAppApiRegisterRequestPayload {
                    confirm_password: password.clone(),
                    email: resolved_email.clone(),
                    phone: resolved_phone.clone(),
                    password: password.clone(),
                    user_type: user_type.to_owned(),
                    username: resolved_username,
                    verification_code: Some(verification_code),
                })
                .map_err(|error| format!("serialize upstream register request failed: {error}"))?,
            ),
        )?;
        let login_payload = self.request_login(&account_for_login, &password)?;
        self.create_persisted_session_from_login_payload(
            connection,
            &account_for_login,
            display_name_hint,
            &login_payload,
        )
    }

    fn request_password_reset(
        &self,
        _connection: &mut Connection,
        request: &UserCenterPasswordResetChallengeRequest,
    ) -> Result<(), String> {
        self.request_password_reset_challenge(request)
    }

    fn reset_password(
        &self,
        _connection: &mut Connection,
        request: &UserCenterPasswordResetRequest,
    ) -> Result<(), String> {
        self.request_password_reset(request)
    }

    fn send_verify_code(
        &self,
        _connection: &mut Connection,
        request: &UserCenterSendVerifyCodeRequest,
    ) -> Result<(), String> {
        self.request_send_verify_code(request)
    }

    fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<UserCenterSessionPayload>, String> {
        let Some(session_id) = read_session_header(headers) else {
            return Ok(None);
        };
        read_persisted_session_payload(
            connection,
            &session_id,
            resolve_user_center_public_mode(
                &UserCenterMode::External,
                &ExternalUserCenterIntegrationKind::SdkworkCloudAppApi,
            ),
        )
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

        let updated_profile_payload = match self.update_profile_with_state(
            Some(session_record.id.as_str()),
            &upstream_state,
            request,
        ) {
            Ok(updated_profile_payload) => updated_profile_payload,
            Err(error) if error.contains("status 401") || error.contains("status 403") => {
                upstream_state = self.refresh_session_state(connection, &session_record)?;
                self.update_profile_with_state(
                    Some(session_record.id.as_str()),
                    &upstream_state,
                    request,
                )?
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
        Err(
            "VIP membership is managed by the external sdkwork-cloud-app-api user center."
                .to_owned(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use uuid::Uuid;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn resolve_default_provider_key_matches_user_center_standard_namespace_convention() {
        assert_eq!(
            resolve_default_provider_key(
                &UserCenterMode::Local,
                &ExternalUserCenterIntegrationKind::Headers,
            ),
            "sdkwork-birdcoder-local"
        );
        assert_eq!(
            resolve_default_provider_key(
                &UserCenterMode::External,
                &ExternalUserCenterIntegrationKind::Headers,
            ),
            "sdkwork-birdcoder-header"
        );
        assert_eq!(
            resolve_default_provider_key(
                &UserCenterMode::External,
                &ExternalUserCenterIntegrationKind::SdkworkCloudAppApi,
            ),
            "sdkwork-birdcoder-remote"
        );
    }

    #[test]
    fn resolve_user_center_public_mode_uses_canonical_selectors() {
        assert_eq!(
            resolve_user_center_public_mode(
                &UserCenterMode::Local,
                &ExternalUserCenterIntegrationKind::Headers,
            ),
            "builtin-local"
        );
        assert_eq!(
            resolve_user_center_public_mode(
                &UserCenterMode::External,
                &ExternalUserCenterIntegrationKind::SdkworkCloudAppApi,
            ),
            "sdkwork-cloud-app-api"
        );
        assert_eq!(
            resolve_user_center_public_mode(
                &UserCenterMode::External,
                &ExternalUserCenterIntegrationKind::Headers,
            ),
            "external-user-center"
        );
    }

    #[test]
    fn resolve_user_center_config_from_env_rejects_legacy_login_provider_aliases() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        std::env::set_var(BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV, "local");
        std::env::remove_var(BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV);

        let resolved = resolve_user_center_config_from_env();

        std::env::remove_var(BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV);

        assert_eq!(
            resolved.configuration_error,
            Some(
                "BIRDCODER_USER_CENTER_LOGIN_PROVIDER must be one of: builtin-local, sdkwork-cloud-app-api, external-user-center."
                    .to_owned()
            )
        );
    }

    #[test]
    fn resolve_user_center_seed_policy_from_env_enables_builtin_local_seed_contracts() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        std::env::remove_var(BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV);
        std::env::remove_var(BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV);
        std::env::remove_var(BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV);

        let seed_policy = resolve_user_center_seed_policy_from_env();

        assert_eq!(seed_policy.authority_seed_enabled, true);
        assert_eq!(seed_policy.auth_development_seed_enabled, true);
        assert_eq!(seed_policy.fixed_verification_code_enabled, true);
        assert_eq!(resolve_local_fixed_verify_code(&seed_policy), None);
    }

    #[test]
    fn resolve_user_center_seed_policy_from_env_disables_local_seed_contracts_for_cloud_mode() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        std::env::set_var(
            BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV,
            "sdkwork-cloud-app-api",
        );
        std::env::set_var(
            BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV,
            "https://cloud.sdkwork.test/app",
        );
        std::env::set_var(BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV, "123456");

        let seed_policy = resolve_user_center_seed_policy_from_env();

        std::env::remove_var(BIRDCODER_USER_CENTER_LOGIN_PROVIDER_ENV);
        std::env::remove_var(BIRDCODER_USER_CENTER_APP_API_BASE_URL_ENV);
        std::env::remove_var(BIRDCODER_LOCAL_VERIFY_CODE_FIXED_ENV);

        assert_eq!(seed_policy.authority_seed_enabled, false);
        assert_eq!(seed_policy.auth_development_seed_enabled, false);
        assert_eq!(seed_policy.fixed_verification_code_enabled, false);
        assert_eq!(resolve_local_fixed_verify_code(&seed_policy), None);
    }

    #[test]
    fn stable_entity_uuid_returns_deterministic_rfc4122_v5_uuid() {
        let first = stable_entity_uuid("plus_user", "100000000000000001");
        let second = stable_entity_uuid("plus_user", "100000000000000001");
        let parsed = Uuid::parse_str(first.as_str()).expect("stable entity uuid should parse");

        assert_eq!(first, second);
        assert_eq!(parsed.get_version_num(), 5);
        assert_eq!(parsed.to_string(), first);
    }
}
