use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::http::HeaderMap;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use time::{format_description::well_known::Rfc3339, Duration as TimeDuration, OffsetDateTime};
use uuid::Uuid;

pub const IAM_ACCESS_TOKEN_HEADER_NAME: &str = "Access-Token";
pub const IAM_AUTHORIZATION_HEADER_NAME: &str = "authorization";
pub const IAM_AUTHORIZATION_SCHEME: &str = "Bearer";
pub const IAM_SESSION_HEADER_NAME: &str = "x-sdkwork-iam-session-id";

const SDKWORK_IAM_MODE_ENV: &str = "SDKWORK_IAM_MODE";
const SDKWORK_IAM_LOCAL_BOOTSTRAP_EMAIL_ENV: &str = "SDKWORK_IAM_LOCAL_BOOTSTRAP_EMAIL";
const SDKWORK_IAM_LOCAL_BOOTSTRAP_PHONE_ENV: &str = "SDKWORK_IAM_LOCAL_BOOTSTRAP_PHONE";
const SDKWORK_IAM_LOCAL_BOOTSTRAP_PASSWORD_ENV: &str = "SDKWORK_IAM_LOCAL_BOOTSTRAP_PASSWORD";
const SDKWORK_IAM_LOCAL_VERIFY_CODE_FIXED_ENV: &str = "SDKWORK_IAM_LOCAL_VERIFY_CODE_FIXED";
const SDKWORK_IAM_LOCAL_OAUTH_PROVIDERS_ENV: &str = "SDKWORK_IAM_LOCAL_OAUTH_PROVIDERS";

const DEFAULT_APP_ID: &str = "sdkwork-birdcoder";
const DEFAULT_TENANT_ID: &str = "0";
const DEFAULT_ORGANIZATION_ID: &str = "0";
const DEFAULT_BOOTSTRAP_EMAIL: &str = "local-default@sdkwork-iam.local";
const DEFAULT_BOOTSTRAP_PHONE: &str = "13800000000";
const DEFAULT_BOOTSTRAP_PASSWORD: &str = "dev123456";
const DEFAULT_VERIFY_CODE: &str = "123456";
const DEFAULT_SESSION_TTL_SECONDS: i64 = 7 * 24 * 60 * 60;
const DEFAULT_VERIFY_CODE_TTL_SECONDS: i64 = 10 * 60;
const DEFAULT_QR_TTL_SECONDS: i64 = 5 * 60;
const DEFAULT_PROFILE_BIO: &str =
    "Build and ship professional AI-native development systems with unified engine governance.";
const DEFAULT_PROFILE_COMPANY: &str = "SDKWork";
const DEFAULT_PROFILE_LOCATION: &str = "Shanghai";
const DEFAULT_PROFILE_WEBSITE: &str = "https://sdkwork.com";

#[derive(Clone, Copy)]
struct IamStandardTable {
    name: &'static str,
    columns: &'static [&'static str],
}

const IAM_TENANT_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "uuid",
    "code",
    "name",
    "status",
    "created_at",
    "updated_at",
    "is_deleted",
];

const IAM_ORGANIZATION_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "uuid",
    "tenant_id",
    "parent_id",
    "code",
    "name",
    "path",
    "status",
    "created_at",
    "updated_at",
    "is_deleted",
];

const IAM_ORGANIZATION_MEMBER_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "uuid",
    "tenant_id",
    "organization_id",
    "user_id",
    "role_code",
    "status",
    "joined_at",
    "left_at",
    "remark",
    "is_deleted",
];

const IAM_USER_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "uuid",
    "tenant_id",
    "organization_id",
    "username",
    "email",
    "phone",
    "nickname",
    "display_name",
    "avatar_url",
    "provider_key",
    "external_subject",
    "status",
    "bio",
    "company",
    "location",
    "website",
    "metadata_json",
    "created_at",
    "updated_at",
    "is_deleted",
];

const IAM_USER_IDENTITY_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "uuid",
    "tenant_id",
    "user_id",
    "provider",
    "subject",
    "email",
    "created_at",
    "is_deleted",
];

const IAM_CREDENTIAL_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "uuid",
    "tenant_id",
    "user_id",
    "credential_type",
    "credential_hash",
    "password_hash",
    "status",
    "expires_at",
    "created_at",
    "updated_at",
    "is_deleted",
];

const IAM_SESSION_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "uuid",
    "tenant_id",
    "organization_id",
    "user_id",
    "app_id",
    "environment",
    "deployment_mode",
    "auth_level",
    "auth_token_hash",
    "access_token_hash",
    "refresh_token_hash",
    "sharding_key",
    "sharding_strategy",
    "data_scope_json",
    "permission_scope_json",
    "status",
    "expires_at",
    "revoked_at",
    "created_at",
    "updated_at",
    "is_deleted",
];

const IAM_VERIFICATION_CODE_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "target",
    "scene",
    "verify_type",
    "code_hash",
    "expires_at",
    "consumed_at",
    "created_at",
    "is_deleted",
];

const IAM_LOGIN_QR_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "uuid",
    "session_key",
    "status",
    "qr_content",
    "qr_url",
    "session_id",
    "user_id",
    "expires_at",
    "created_at",
    "updated_at",
    "is_deleted",
];

const IAM_MFA_FACTOR_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "tenant_id",
    "user_id",
    "factor_type",
    "secret_ref",
    "status",
    "created_at",
    "updated_at",
];

const IAM_DEVICE_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "tenant_id",
    "user_id",
    "device_fingerprint",
    "name",
    "trusted",
    "last_seen_at",
    "created_at",
];

const IAM_ROLE_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "tenant_id",
    "code",
    "name",
    "status",
    "created_at",
    "updated_at",
];

const IAM_PERMISSION_STANDARD_COLUMNS: &[&str] =
    &["id", "code", "name", "resource", "action", "created_at"];

const IAM_POLICY_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "tenant_id",
    "code",
    "name",
    "policy_json",
    "status",
    "created_at",
    "updated_at",
];

const IAM_ROLE_PERMISSION_STANDARD_COLUMNS: &[&str] =
    &["id", "tenant_id", "role_id", "permission_id", "created_at"];

const IAM_USER_ROLE_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "tenant_id",
    "user_id",
    "role_id",
    "organization_id",
    "created_at",
];

const IAM_API_KEY_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "tenant_id",
    "user_id",
    "name",
    "key_hash",
    "permission_scope_json",
    "status",
    "expires_at",
    "created_at",
    "updated_at",
];

const IAM_SECURITY_EVENT_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "tenant_id",
    "user_id",
    "session_id",
    "event_type",
    "severity",
    "detail_json",
    "created_at",
];

const IAM_AUDIT_EVENT_STANDARD_COLUMNS: &[&str] = &[
    "id",
    "tenant_id",
    "organization_id",
    "actor_user_id",
    "action",
    "resource_type",
    "resource_id",
    "request_id",
    "app_id",
    "environment",
    "sharding_key",
    "detail_json",
    "created_at",
];

const IAM_STANDARD_TABLES: &[IamStandardTable] = &[
    IamStandardTable {
        name: "iam_tenant",
        columns: IAM_TENANT_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_organization",
        columns: IAM_ORGANIZATION_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_organization_member",
        columns: IAM_ORGANIZATION_MEMBER_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_user",
        columns: IAM_USER_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_user_identity",
        columns: IAM_USER_IDENTITY_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_credential",
        columns: IAM_CREDENTIAL_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_session",
        columns: IAM_SESSION_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_verification_code",
        columns: IAM_VERIFICATION_CODE_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_login_qr",
        columns: IAM_LOGIN_QR_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_mfa_factor",
        columns: IAM_MFA_FACTOR_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_device",
        columns: IAM_DEVICE_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_role",
        columns: IAM_ROLE_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_permission",
        columns: IAM_PERMISSION_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_policy",
        columns: IAM_POLICY_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_role_permission",
        columns: IAM_ROLE_PERMISSION_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_user_role",
        columns: IAM_USER_ROLE_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_api_key",
        columns: IAM_API_KEY_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_security_event",
        columns: IAM_SECURITY_EVENT_STANDARD_COLUMNS,
    },
    IamStandardTable {
        name: "iam_audit_event",
        columns: IAM_AUDIT_EVENT_STANDARD_COLUMNS,
    },
];

const IAM_STANDARD_INDEXES: &[&str] = &[
    "idx_iam_user_email_active",
    "idx_iam_user_phone_active",
    "idx_iam_session_auth_token_hash",
    "idx_iam_session_access_token_hash",
    "idx_iam_session_refresh_token_hash",
    "idx_iam_verification_code_lookup",
];

const IAM_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS iam_tenant (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS iam_organization (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    parent_id TEXT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS iam_organization_member (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_code TEXT NULL,
    status TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    left_at TEXT NULL,
    remark TEXT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS iam_user (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id TEXT NULL,
    organization_id TEXT NULL,
    username TEXT NULL,
    email TEXT NOT NULL,
    phone TEXT NULL,
    nickname TEXT NOT NULL,
    display_name TEXT NULL,
    avatar_url TEXT NULL,
    provider_key TEXT NOT NULL DEFAULT 'local',
    external_subject TEXT NULL,
    status TEXT NOT NULL,
    bio TEXT NULL,
    company TEXT NULL,
    location TEXT NULL,
    website TEXT NULL,
    metadata_json TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_iam_user_email_active
ON iam_user(email)
WHERE is_deleted = 0;

CREATE INDEX IF NOT EXISTS idx_iam_user_phone_active
ON iam_user(phone)
WHERE is_deleted = 0 AND phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS iam_user_identity (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT '0',
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    email TEXT NULL,
    created_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, provider, subject)
);

CREATE TABLE IF NOT EXISTS iam_credential (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL DEFAULT '0',
    user_id TEXT NOT NULL,
    credential_type TEXT NOT NULL,
    credential_hash TEXT NOT NULL,
    password_hash TEXT NULL,
    status TEXT NOT NULL,
    expires_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, credential_type)
);

CREATE TABLE IF NOT EXISTS iam_session (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    organization_id TEXT NULL,
    user_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    environment TEXT NOT NULL,
    deployment_mode TEXT NOT NULL,
    auth_level TEXT NOT NULL,
    auth_token_hash TEXT NOT NULL,
    access_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT NULL,
    sharding_key TEXT NOT NULL,
    sharding_strategy TEXT NOT NULL,
    data_scope_json TEXT NOT NULL,
    permission_scope_json TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_iam_session_auth_token_hash
ON iam_session(auth_token_hash);

CREATE INDEX IF NOT EXISTS idx_iam_session_access_token_hash
ON iam_session(access_token_hash);

CREATE INDEX IF NOT EXISTS idx_iam_session_refresh_token_hash
ON iam_session(refresh_token_hash);

CREATE TABLE IF NOT EXISTS iam_verification_code (
    id TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    scene TEXT NOT NULL,
    verify_type TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT NULL,
    created_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_iam_verification_code_lookup
ON iam_verification_code(target, scene, verify_type, consumed_at, expires_at, is_deleted);

CREATE TABLE IF NOT EXISTS iam_login_qr (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    session_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    qr_content TEXT NULL,
    qr_url TEXT NULL,
    session_id TEXT NULL,
    user_id TEXT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS iam_mfa_factor (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    factor_type TEXT NOT NULL,
    secret_ref TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS iam_device (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    name TEXT NULL,
    trusted INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (tenant_id, user_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS iam_role (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS iam_permission (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS iam_policy (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    policy_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS iam_role_permission (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (tenant_id, role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS iam_user_role (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    organization_id TEXT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (tenant_id, user_id, role_id, organization_id)
);

CREATE TABLE IF NOT EXISTS iam_api_key (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    permission_scope_json TEXT NOT NULL,
    status TEXT NOT NULL,
    expires_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS iam_security_event (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NULL,
    session_id TEXT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS iam_audit_event (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    organization_id TEXT NULL,
    actor_user_id TEXT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NULL,
    request_id TEXT NULL,
    app_id TEXT NULL,
    environment TEXT NULL,
    sharding_key TEXT NULL,
    detail_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"#;

#[derive(Clone, Copy, Eq, PartialEq)]
enum IamMode {
    Local,
    Private,
    Cloud,
}

impl IamMode {
    fn from_env() -> Self {
        match read_env_trimmed(SDKWORK_IAM_MODE_ENV)
            .unwrap_or_else(|| "local".to_owned())
            .to_ascii_lowercase()
            .as_str()
        {
            "cloud" => Self::Cloud,
            "private" => Self::Private,
            _ => Self::Local,
        }
    }

    fn deployment_mode(self) -> &'static str {
        match self {
            Self::Cloud => "saas",
            Self::Private => "private",
            Self::Local => "local",
        }
    }

    fn local_authority_enabled(self) -> bool {
        !matches!(self, Self::Cloud)
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamLoginRequest {
    pub account: Option<String>,
    pub app_version: Option<String>,
    pub code: Option<String>,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub device_type: Option<String>,
    pub email: Option<String>,
    pub grant_type: Option<String>,
    pub login_method: Option<String>,
    pub password: Option<String>,
    pub phone: Option<String>,
    pub username: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamRegisterRequest {
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
pub struct IamSendVerifyCodeRequest {
    pub scene: String,
    pub target: String,
    pub verify_type: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamVerifyCodeRequest {
    pub scene: String,
    pub target: String,
    pub verify_type: String,
    pub code: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamPasswordResetChallengeRequest {
    pub account: String,
    pub channel: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamPasswordResetRequest {
    pub account: String,
    pub code: String,
    pub confirm_password: Option<String>,
    pub new_password: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamRefreshSessionRequest {
    pub refresh_token: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamOAuthAuthorizationRequest {
    pub provider: String,
    pub redirect_uri: String,
    pub scope: Option<String>,
    pub state: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamOAuthLoginRequest {
    pub code: String,
    pub device_id: Option<String>,
    pub device_type: Option<String>,
    pub provider: String,
    pub state: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IamQrAuthSessionPasswordRequest {
    pub password: String,
    pub username: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateIamProfileRequest {
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub company: Option<String>,
    pub display_name: Option<String>,
    pub location: Option<String>,
    pub website: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IamUserPayload {
    pub id: String,
    pub uuid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IamSessionPayload {
    pub access_token: String,
    pub auth_token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub session_id: String,
    pub user: IamUserPayload,
    #[serde(skip_serializing)]
    pub token_type: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IamQrAuthSessionPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qr_url: Option<String>,
    pub session_key: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<IamSessionPayload>,
}

pub type IamLoginQrCodePayload = IamQrAuthSessionPayload;
pub type IamLoginQrStatusPayload = IamQrAuthSessionPayload;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IamOAuthUrlPayload {
    pub auth_url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IamVerificationPolicyPayload {
    pub email_code_login_enabled: bool,
    pub email_registration_verification_required: bool,
    pub phone_code_login_enabled: bool,
    pub phone_registration_verification_required: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IamMetadataPayload {
    pub left_rail_mode: String,
    pub login_methods: Vec<String>,
    pub oauth_login_enabled: bool,
    pub oauth_providers: Vec<String>,
    pub qr_login_enabled: bool,
    pub qr_login_type: String,
    pub recovery_methods: Vec<String>,
    pub register_methods: Vec<String>,
    pub verification_policy: IamVerificationPolicyPayload,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IamProfilePayload {
    pub uuid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    pub bio: String,
    pub company: String,
    pub display_name: String,
    pub email: String,
    pub user_id: String,
    pub location: String,
    pub website: String,
}

#[derive(Clone)]
struct UserRecord {
    id: String,
    uuid: String,
    tenant_id: Option<String>,
    organization_id: Option<String>,
    created_at: String,
    updated_at: String,
    email: String,
    name: String,
    avatar_url: Option<String>,
    bio: Option<String>,
    company: Option<String>,
    location: Option<String>,
    website: Option<String>,
}

#[derive(Clone)]
pub struct IamState {
    mode: IamMode,
}

impl IamState {
    pub fn from_env() -> Self {
        Self {
            mode: IamMode::from_env(),
        }
    }

    pub fn metadata(&self) -> IamMetadataPayload {
        build_runtime_settings()
    }

    pub fn verification_policy(&self) -> IamVerificationPolicyPayload {
        build_verification_policy()
    }

    pub fn login(
        &self,
        connection: &mut Connection,
        request: &IamLoginRequest,
    ) -> Result<IamSessionPayload, String> {
        self.ensure_local_authority()?;
        let method = request
            .grant_type
            .as_deref()
            .or(request.login_method.as_deref())
            .map(normalize_login_method)
            .unwrap_or_else(|| "password".to_owned());

        match method.as_str() {
            "session_bridge" | "sessionbridge" => {
                ensure_sqlite_iam_bootstrap_user(connection)?;
                let user = load_user_by_id(connection, crate::BOOTSTRAP_WORKSPACE_OWNER_USER_ID)?
                    .ok_or_else(|| "Local IAM bootstrap user is missing.".to_owned())?;
                issue_login_session(connection, self.mode, &user, request)
            }
            "email_code" | "emailcode" => {
                let email = required_login_email(request)?;
                let code = required_text(request.code.as_deref(), "code")?;
                verify_code(connection, &email, "login", "email", &code)?;
                let user = load_user_by_email(connection, &email)?
                    .ok_or_else(|| format!("IAM user {email} was not found."))?;
                issue_login_session(connection, self.mode, &user, request)
            }
            "phone_code" | "phonecode" => {
                let phone = required_text(request.phone.as_deref(), "phone")?;
                let code = required_text(request.code.as_deref(), "code")?;
                verify_code(connection, &phone, "login", "phone", &code)?;
                let user = load_user_by_phone(connection, &phone)?
                    .ok_or_else(|| format!("IAM user with phone {phone} was not found."))?;
                issue_login_session(connection, self.mode, &user, request)
            }
            _ => {
                let account = request
                    .account
                    .as_deref()
                    .or(request.email.as_deref())
                    .or(request.username.as_deref())
                    .or(request.phone.as_deref())
                    .and_then(|value| normalize_optional_text(Some(value)))
                    .ok_or_else(|| "account, email, username, or phone is required.".to_owned())?;
                let password = required_text(request.password.as_deref(), "password")?;
                let user = load_user_by_login(connection, &account)?
                    .ok_or_else(|| format!("IAM user {account} was not found."))?;
                verify_user_password(connection, &user.id, &password)?;
                issue_login_session(connection, self.mode, &user, request)
            }
        }
    }

    pub fn login_with_oauth(
        &self,
        connection: &mut Connection,
        request: &IamOAuthLoginRequest,
    ) -> Result<IamSessionPayload, String> {
        self.ensure_local_authority()?;
        let provider = normalize_provider(&request.provider)?;
        let subject = normalize_required(&request.code, "code")?;
        let email = format!("{subject}@oauth.{provider}.sdkwork-iam.local");
        let display_name = format!("{} SDKWork IAM", provider.to_uppercase());
        let user = upsert_user(connection, None, &email, None, Some(&display_name), None)?;
        let mut session = issue_session(connection, self.mode, &user)?;
        insert_session_context_value(&mut session, "oauthProvider", Some(provider));
        insert_session_context_value(
            &mut session,
            "oauthState",
            normalize_optional_text(request.state.as_deref()),
        );
        insert_session_context_value(
            &mut session,
            "deviceId",
            normalize_optional_text(request.device_id.as_deref()),
        );
        insert_session_context_value(
            &mut session,
            "deviceType",
            normalize_optional_text(request.device_type.as_deref()),
        );
        Ok(session)
    }

    pub fn get_oauth_authorization_url(
        &self,
        request: &IamOAuthAuthorizationRequest,
    ) -> Result<IamOAuthUrlPayload, String> {
        self.ensure_local_authority()?;
        let provider = normalize_provider(&request.provider)?;
        if !resolve_oauth_providers()
            .iter()
            .any(|entry| entry == &provider)
        {
            return Err(format!("OAuth provider {provider} is not enabled."));
        }

        let mut auth_url = format!(
            "{}{}provider={}&code=local-{}",
            request.redirect_uri,
            if request.redirect_uri.contains('?') {
                "&"
            } else {
                "?"
            },
            provider,
            Uuid::new_v4()
        );
        if let Some(state) = normalize_optional_text(request.state.as_deref()) {
            auth_url.push_str("&state=");
            auth_url.push_str(&state);
        }
        if let Some(scope) = normalize_optional_text(request.scope.as_deref()) {
            auth_url.push_str("&scope=");
            auth_url.push_str(&scope);
        }
        Ok(IamOAuthUrlPayload { auth_url })
    }

    pub fn register(
        &self,
        connection: &mut Connection,
        request: &IamRegisterRequest,
    ) -> Result<IamSessionPayload, String> {
        self.ensure_local_authority()?;
        let email = request
            .email
            .as_deref()
            .and_then(|value| normalize_optional_text(Some(value)))
            .map(|value| value.to_ascii_lowercase())
            .ok_or_else(|| "email is required.".to_owned())?;
        let password = required_text(request.password.as_deref(), "password")?;
        if request
            .confirm_password
            .as_deref()
            .is_some_and(|confirm| confirm != password)
        {
            return Err("confirmPassword must match password.".to_owned());
        }
        if let Some(code) = request.verification_code.as_deref() {
            verify_code(connection, &email, "registration", "email", code)?;
        }
        let user = upsert_user(
            connection,
            request.username.as_deref(),
            &email,
            request.phone.as_deref(),
            request.name.as_deref(),
            None,
        )?;
        set_user_password(connection, &user.id, &password)?;
        let mut session = issue_session(connection, self.mode, &user)?;
        insert_session_context_value(
            &mut session,
            "registrationChannel",
            normalize_optional_text(request.channel.as_deref()),
        );
        Ok(session)
    }

    pub fn refresh_session(
        &self,
        connection: &mut Connection,
        refresh_token: Option<&str>,
    ) -> Result<IamSessionPayload, String> {
        self.ensure_local_authority()?;
        let token = required_text(refresh_token, "refreshToken")?;
        let token_hash = hash_text(&token);
        let user = connection
            .query_row(
                r#"
                SELECT iam_user.id
                FROM iam_session
                INNER JOIN iam_user ON iam_user.id = iam_session.user_id
                WHERE iam_session.refresh_token_hash = ?1
                  AND iam_session.revoked_at IS NULL
                  AND iam_session.is_deleted = 0
                  AND iam_user.is_deleted = 0
                LIMIT 1
                "#,
                params![token_hash],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("resolve refresh session failed: {error}"))?
            .ok_or_else(|| "refreshToken is invalid or expired.".to_owned())?;
        let user = load_user_by_id(connection, &user)?
            .ok_or_else(|| "IAM user for refresh token was not found.".to_owned())?;
        issue_session(connection, self.mode, &user)
    }

    pub fn logout(
        &self,
        connection: &mut Connection,
        session_id: Option<&str>,
    ) -> Result<(), String> {
        let Some(session_id) = normalize_optional_text(session_id) else {
            return Ok(());
        };
        let now = now_rfc3339();
        connection
            .execute(
                "UPDATE iam_session SET revoked_at = ?1, updated_at = ?1 WHERE id = ?2",
                params![now, session_id],
            )
            .map_err(|error| format!("revoke IAM session failed: {error}"))?;
        Ok(())
    }

    pub fn resolve_session(
        &self,
        connection: &Connection,
        headers: &HeaderMap,
    ) -> Result<Option<IamSessionPayload>, String> {
        let auth_token = read_authorization_token(headers);
        let access_token = read_header_value(headers, IAM_ACCESS_TOKEN_HEADER_NAME);
        let session_id = read_header_value(headers, IAM_SESSION_HEADER_NAME);
        let Some(session_lookup) = auth_token.or(access_token).or(session_id) else {
            return Ok(None);
        };
        load_session_by_token_or_id(connection, &session_lookup)
    }

    pub fn ensure_user_account(
        &self,
        connection: &mut Connection,
        user_id: Option<&str>,
        email: Option<&str>,
        name: Option<&str>,
        avatar_url: Option<&str>,
    ) -> Result<IamUserPayload, String> {
        let user = if let Some(user_id) = normalize_optional_text(user_id) {
            if let Some(user) = load_user_by_id(connection, &user_id)? {
                user
            } else {
                let email = normalize_optional_text(email)
                    .map(|value| value.to_ascii_lowercase())
                    .unwrap_or_else(|| format!("{user_id}@local.sdkwork-iam.local"));
                upsert_user(connection, Some(&user_id), &email, None, name, avatar_url)?
            }
        } else {
            let email = normalize_optional_text(email)
                .map(|value| value.to_ascii_lowercase())
                .ok_or_else(|| "email is required when userId is not provided.".to_owned())?;
            upsert_user(connection, None, &email, None, name, avatar_url)?
        };
        Ok(map_user_payload(&user))
    }

    pub fn send_verify_code(
        &self,
        connection: &mut Connection,
        request: &IamSendVerifyCodeRequest,
    ) -> Result<(), String> {
        self.ensure_local_authority()?;
        let target = normalize_required(&request.target, "target")?;
        let scene = normalize_required(&request.scene, "scene")?;
        let verify_type = normalize_required(&request.verify_type, "verifyType")?;
        let code = read_env_trimmed(SDKWORK_IAM_LOCAL_VERIFY_CODE_FIXED_ENV)
            .unwrap_or_else(|| DEFAULT_VERIFY_CODE.to_owned());
        insert_verify_code(connection, &target, &scene, &verify_type, &code)
    }

    pub fn verify_code(
        &self,
        connection: &mut Connection,
        request: &IamVerifyCodeRequest,
    ) -> Result<(), String> {
        self.ensure_local_authority()?;
        verify_code(
            connection,
            &normalize_required(&request.target, "target")?,
            &normalize_required(&request.scene, "scene")?,
            &normalize_required(&request.verify_type, "verifyType")?,
            &normalize_required(&request.code, "code")?,
        )
    }

    pub fn request_password_reset(
        &self,
        connection: &mut Connection,
        request: &IamPasswordResetChallengeRequest,
    ) -> Result<(), String> {
        self.ensure_local_authority()?;
        let account = normalize_required(&request.account, "account")?;
        let channel = normalize_required(&request.channel, "channel")?;
        insert_verify_code(
            connection,
            &account,
            "password_reset",
            &channel,
            DEFAULT_VERIFY_CODE,
        )
    }

    pub fn reset_password(
        &self,
        connection: &mut Connection,
        request: &IamPasswordResetRequest,
    ) -> Result<(), String> {
        self.ensure_local_authority()?;
        if request
            .confirm_password
            .as_deref()
            .is_some_and(|confirm| confirm != request.new_password)
        {
            return Err("confirmPassword must match newPassword.".to_owned());
        }
        let account = normalize_required(&request.account, "account")?;
        verify_code(
            connection,
            &account,
            "password_reset",
            "email",
            &request.code,
        )
        .or_else(|_| {
            verify_code(
                connection,
                &account,
                "password_reset",
                "phone",
                &request.code,
            )
        })?;
        let user = load_user_by_login(connection, &account)?
            .ok_or_else(|| format!("IAM user {account} was not found."))?;
        set_user_password(connection, &user.id, &request.new_password)
    }

    pub fn read_profile(
        &self,
        connection: &mut Connection,
        session: &IamSessionPayload,
    ) -> Result<IamProfilePayload, String> {
        let user = session_user(session)?;
        let user = load_user_by_id(connection, &user.id)?
            .ok_or_else(|| "IAM session user was not found.".to_owned())?;
        Ok(map_profile_payload(&user))
    }

    pub fn update_profile(
        &self,
        connection: &mut Connection,
        session: &IamSessionPayload,
        request: &UpdateIamProfileRequest,
    ) -> Result<IamProfilePayload, String> {
        let user = session_user(session)?;
        let current = load_user_by_id(connection, &user.id)?
            .ok_or_else(|| "IAM session user was not found.".to_owned())?;
        let now = now_rfc3339();
        connection
            .execute(
                r#"
                UPDATE iam_user
                SET
                    nickname = COALESCE(?2, nickname),
                    display_name = COALESCE(?2, display_name),
                    avatar_url = COALESCE(?3, avatar_url),
                    bio = COALESCE(?4, bio),
                    company = COALESCE(?5, company),
                    location = COALESCE(?6, location),
                    website = COALESCE(?7, website),
                    updated_at = ?8
                WHERE id = ?1
                "#,
                params![
                    current.id,
                    normalize_optional_text(request.display_name.as_deref()),
                    normalize_optional_text(request.avatar_url.as_deref()),
                    normalize_optional_text(request.bio.as_deref()),
                    normalize_optional_text(request.company.as_deref()),
                    normalize_optional_text(request.location.as_deref()),
                    normalize_optional_text(request.website.as_deref()),
                    now,
                ],
            )
            .map_err(|error| format!("update IAM profile failed: {error}"))?;
        let updated = load_user_by_id(connection, &user.id)?
            .ok_or_else(|| "Updated IAM profile was not found.".to_owned())?;
        Ok(map_profile_payload(&updated))
    }

    pub fn generate_login_qr_code(
        &self,
        connection: &mut Connection,
    ) -> Result<IamLoginQrCodePayload, String> {
        self.ensure_local_authority()?;
        let session_key = format!("qr_{}", Uuid::new_v4().simple());
        let created_at = now_rfc3339();
        let expires_at =
            format_time(OffsetDateTime::now_utc() + TimeDuration::seconds(DEFAULT_QR_TTL_SECONDS));
        let qr_content = format!("sdkwork://birdcoder/iam/qr_auth/{session_key}");
        let qr_url: Option<String> = None;
        connection
            .execute(
                r#"
                INSERT INTO iam_login_qr (
                    id, uuid, session_key, status, qr_content, qr_url, expires_at,
                    created_at, updated_at, is_deleted
                )
                VALUES (?1, ?2, ?3, 'pending', ?4, ?5, ?6, ?7, ?7, 0)
                "#,
                params![
                    new_id(),
                    stable_uuid("iam_login_qr", &session_key),
                    session_key,
                    qr_content,
                    qr_url,
                    expires_at,
                    created_at,
                ],
            )
            .map_err(|error| format!("create IAM QR auth session failed: {error}"))?;
        load_qr_session(connection, &session_key)
    }

    pub fn resolve_login_qr_status(
        &self,
        connection: &mut Connection,
        session_key: &str,
    ) -> Result<IamLoginQrStatusPayload, String> {
        expire_qr_if_needed(connection, session_key)?;
        load_qr_session(connection, session_key)
    }

    pub fn mark_login_qr_scanned(
        &self,
        connection: &mut Connection,
        session_key: &str,
    ) -> Result<IamLoginQrStatusPayload, String> {
        expire_qr_if_needed(connection, session_key)?;
        let now = now_rfc3339();
        connection
            .execute(
                "UPDATE iam_login_qr SET status = 'scanned', updated_at = ?1 WHERE session_key = ?2 AND status = 'pending' AND is_deleted = 0",
                params![now, session_key],
            )
            .map_err(|error| format!("mark IAM QR auth session scanned failed: {error}"))?;
        load_qr_session(connection, session_key)
    }

    pub fn confirm_login_qr_with_password(
        &self,
        connection: &mut Connection,
        session_key: &str,
        request: &IamQrAuthSessionPasswordRequest,
    ) -> Result<IamSessionPayload, String> {
        let login = IamLoginRequest {
            account: Some(request.username.clone()),
            app_version: None,
            code: None,
            device_id: None,
            device_name: None,
            device_type: None,
            email: None,
            grant_type: Some("password".to_owned()),
            login_method: Some("password".to_owned()),
            password: Some(request.password.clone()),
            phone: None,
            username: Some(request.username.clone()),
        };
        let session = self.login(connection, &login)?;
        confirm_qr_session(connection, session_key, &session)?;
        Ok(session)
    }

    fn ensure_local_authority(&self) -> Result<(), String> {
        if self.mode.local_authority_enabled() {
            Ok(())
        } else {
            Err("Cloud IAM mode is served by the generated SDKWork app API, not the local BirdCoder host.".to_owned())
        }
    }
}

pub fn ensure_sqlite_iam_schema(connection: &mut Connection) -> Result<(), String> {
    ensure_sqlite_iam_standard_table_shapes(connection)?;
    reset_sqlite_iam_standard_indexes(connection, "schema initialization")?;
    connection
        .execute_batch(IAM_SCHEMA)
        .map_err(|error| format!("create sqlite IAM schema failed: {error}"))?;
    let now = now_rfc3339();
    connection
        .execute(
            r#"
            INSERT INTO iam_tenant (id, uuid, code, name, status, created_at, updated_at, is_deleted)
            VALUES (?1, ?2, 'sdkwork-birdcoder-local', 'SDKWork BirdCoder Local Tenant', 'active', ?3, ?3, 0)
            ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, is_deleted = 0
            "#,
            params![DEFAULT_TENANT_ID, stable_uuid("iam_tenant", DEFAULT_TENANT_ID), now],
        )
        .map_err(|error| format!("ensure default IAM tenant failed: {error}"))?;
    connection
        .execute(
            r#"
            INSERT INTO iam_organization (id, uuid, tenant_id, parent_id, code, name, path, status, created_at, updated_at, is_deleted)
            VALUES (?1, ?2, ?3, NULL, 'root', 'Root Organization', '/0', 'active', ?4, ?4, 0)
            ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, is_deleted = 0
            "#,
            params![
                DEFAULT_ORGANIZATION_ID,
                stable_uuid("iam_organization", DEFAULT_ORGANIZATION_ID),
                DEFAULT_TENANT_ID,
                now,
            ],
        )
        .map_err(|error| format!("ensure default IAM organization failed: {error}"))?;
    Ok(())
}

pub fn ensure_sqlite_iam_bootstrap_user(connection: &mut Connection) -> Result<(), String> {
    if !IamMode::from_env().local_authority_enabled() {
        return Ok(());
    }
    ensure_sqlite_iam_schema(connection)?;
    let email = read_env_trimmed(SDKWORK_IAM_LOCAL_BOOTSTRAP_EMAIL_ENV)
        .filter(|value| value.contains('@'))
        .unwrap_or_else(|| DEFAULT_BOOTSTRAP_EMAIL.to_owned())
        .to_ascii_lowercase();
    let phone = read_env_trimmed(SDKWORK_IAM_LOCAL_BOOTSTRAP_PHONE_ENV)
        .or_else(|| Some(DEFAULT_BOOTSTRAP_PHONE.to_owned()));
    let user = upsert_user(
        connection,
        Some(crate::BOOTSTRAP_WORKSPACE_OWNER_USER_ID),
        &email,
        phone.as_deref(),
        Some("SDKWork IAM Local Owner"),
        None,
    )?;
    set_user_password(
        connection,
        &user.id,
        &read_env_trimmed(SDKWORK_IAM_LOCAL_BOOTSTRAP_PASSWORD_ENV)
            .unwrap_or_else(|| DEFAULT_BOOTSTRAP_PASSWORD.to_owned()),
    )?;
    Ok(())
}

fn build_verification_policy() -> IamVerificationPolicyPayload {
    IamVerificationPolicyPayload {
        email_code_login_enabled: true,
        email_registration_verification_required: false,
        phone_code_login_enabled: true,
        phone_registration_verification_required: false,
    }
}

fn build_runtime_settings() -> IamMetadataPayload {
    IamMetadataPayload {
        left_rail_mode: "qr-only".to_owned(),
        login_methods: vec![
            "password".to_owned(),
            "emailCode".to_owned(),
            "phoneCode".to_owned(),
            "sessionBridge".to_owned(),
        ],
        oauth_login_enabled: true,
        oauth_providers: resolve_oauth_providers(),
        qr_login_enabled: true,
        qr_login_type: "web".to_owned(),
        recovery_methods: vec!["email".to_owned(), "phone".to_owned()],
        register_methods: vec!["email".to_owned(), "phone".to_owned()],
        verification_policy: build_verification_policy(),
    }
}

fn resolve_oauth_providers() -> Vec<String> {
    read_env_trimmed(SDKWORK_IAM_LOCAL_OAUTH_PROVIDERS_ENV)
        .unwrap_or_else(|| "wechat,douyin,github".to_owned())
        .split([',', ';', '\n'])
        .filter_map(|entry| normalize_optional_text(Some(entry)))
        .map(|entry| entry.to_ascii_lowercase())
        .collect()
}

fn sqlite_iam_table_exists(connection: &Connection, table_name: &str) -> Result<bool, String> {
    let mut statement = connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
        .map_err(|error| {
            format!("prepare sqlite IAM table probe for {table_name} failed: {error}")
        })?;
    let mut rows = statement.query([table_name]).map_err(|error| {
        format!("query sqlite IAM table probe for {table_name} failed: {error}")
    })?;

    rows.next()
        .map(|row| row.is_some())
        .map_err(|error| format!("read sqlite IAM table probe for {table_name} failed: {error}"))
}

fn sqlite_iam_table_columns(
    connection: &Connection,
    table_name: &str,
) -> Result<Vec<String>, String> {
    let pragma = format!("PRAGMA table_info({table_name})");
    let mut statement = connection.prepare(&pragma).map_err(|error| {
        format!("prepare sqlite IAM table info for {table_name} failed: {error}")
    })?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("query sqlite IAM table info for {table_name} failed: {error}"))?;
    let mut column_names = Vec::new();
    for row in rows {
        column_names.push(row.map_err(|error| {
            format!("read sqlite IAM table info for {table_name} failed: {error}")
        })?);
    }

    Ok(column_names)
}

fn sqlite_columns_match_standard(column_names: &[String], standard_columns: &[&str]) -> bool {
    column_names.len() == standard_columns.len()
        && column_names
            .iter()
            .map(String::as_str)
            .eq(standard_columns.iter().copied())
}

fn ensure_sqlite_iam_standard_table_shapes(connection: &Connection) -> Result<(), String> {
    for table in IAM_STANDARD_TABLES {
        if !sqlite_iam_table_exists(connection, table.name)? {
            continue;
        }

        let column_names = sqlite_iam_table_columns(connection, table.name)?;
        if !sqlite_columns_match_standard(&column_names, table.columns) {
            reset_sqlite_iam_standard_tables(connection, table.name)?;
            return Ok(());
        }
    }

    Ok(())
}

fn reset_sqlite_iam_standard_tables(
    connection: &Connection,
    drifted_table_name: &str,
) -> Result<(), String> {
    reset_sqlite_iam_standard_indexes(connection, drifted_table_name)?;

    for table in IAM_STANDARD_TABLES.iter().rev() {
        let sql = format!("DROP TABLE IF EXISTS {}", table.name);
        connection.execute(&sql, []).map_err(|error| {
            format!(
                "drop sqlite IAM table {} while resetting drift from {drifted_table_name} failed: {error}",
                table.name
            )
        })?;
    }

    Ok(())
}

fn reset_sqlite_iam_standard_indexes(connection: &Connection, reason: &str) -> Result<(), String> {
    for index_name in IAM_STANDARD_INDEXES {
        let sql = format!("DROP INDEX IF EXISTS {index_name}");
        connection.execute(&sql, []).map_err(|error| {
            format!("drop sqlite IAM index {index_name} while resetting {reason} failed: {error}")
        })?;
    }

    Ok(())
}

fn issue_session(
    connection: &mut Connection,
    mode: IamMode,
    user: &UserRecord,
) -> Result<IamSessionPayload, String> {
    let session_id = new_id();
    let auth_token = format!("auth_{}", Uuid::new_v4().simple());
    let access_token = format!("access_{}", Uuid::new_v4().simple());
    let refresh_token = format!("refresh_{}", Uuid::new_v4().simple());
    let now = now_rfc3339();
    let expires_at =
        format_time(OffsetDateTime::now_utc() + TimeDuration::seconds(DEFAULT_SESSION_TTL_SECONDS));
    connection
        .execute(
            r#"
            INSERT INTO iam_session (
                id, uuid, tenant_id, organization_id, user_id, app_id, environment,
                deployment_mode, auth_level, auth_token_hash, access_token_hash,
                refresh_token_hash, sharding_key, sharding_strategy, data_scope_json,
                permission_scope_json, status, expires_at, created_at, updated_at, is_deleted
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'dev', ?7, 'password', ?8, ?9, ?10, ?3, 'tenant',
                ?11, ?12, 'active', ?13, ?14, ?14, 0)
            "#,
            params![
                session_id,
                stable_uuid("iam_session", &session_id),
                user.tenant_id
                    .clone()
                    .unwrap_or_else(|| DEFAULT_TENANT_ID.to_owned()),
                user.organization_id.clone(),
                user.id,
                DEFAULT_APP_ID,
                mode.deployment_mode(),
                hash_text(&auth_token),
                hash_text(&access_token),
                hash_text(&refresh_token),
                json!(["tenant"]).to_string(),
                json!(["birdcoder.*"]).to_string(),
                expires_at,
                now,
            ],
        )
        .map_err(|error| format!("issue IAM session failed: {error}"))?;
    Ok(IamSessionPayload {
        access_token,
        auth_token,
        context: Some(build_context(user, &session_id, mode)),
        expires_at: Some(expires_at),
        refresh_token: Some(refresh_token),
        session_id,
        token_type: IAM_AUTHORIZATION_SCHEME.to_owned(),
        user: map_user_payload(user),
    })
}

fn issue_login_session(
    connection: &mut Connection,
    mode: IamMode,
    user: &UserRecord,
    request: &IamLoginRequest,
) -> Result<IamSessionPayload, String> {
    upsert_login_device(
        connection,
        user,
        request.device_id.as_deref(),
        request.device_name.as_deref(),
    )?;
    let mut session = issue_session(connection, mode, user)?;
    insert_session_context_value(
        &mut session,
        "appVersion",
        normalize_optional_text(request.app_version.as_deref()),
    );
    insert_session_context_value(
        &mut session,
        "deviceId",
        normalize_optional_text(request.device_id.as_deref()),
    );
    insert_session_context_value(
        &mut session,
        "deviceName",
        normalize_optional_text(request.device_name.as_deref()),
    );
    insert_session_context_value(
        &mut session,
        "deviceType",
        normalize_optional_text(request.device_type.as_deref()),
    );
    Ok(session)
}

fn upsert_login_device(
    connection: &mut Connection,
    user: &UserRecord,
    device_id: Option<&str>,
    device_name: Option<&str>,
) -> Result<(), String> {
    let Some(device_id) = normalize_optional_text(device_id) else {
        return Ok(());
    };
    let tenant_id = user
        .tenant_id
        .clone()
        .unwrap_or_else(|| DEFAULT_TENANT_ID.to_owned());
    let now = now_rfc3339();
    let device_row_id = stable_numeric_id("iam_device", &format!("{}:{device_id}", user.id));
    let device_name = normalize_optional_text(device_name);
    connection
        .execute(
            r#"
            INSERT OR IGNORE INTO iam_device (
                id, tenant_id, user_id, device_fingerprint, name, trusted, last_seen_at, created_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)
            "#,
            params![
                device_row_id,
                tenant_id,
                user.id,
                device_id,
                device_name,
                now,
            ],
        )
        .map_err(|error| format!("record IAM login device failed: {error}"))?;
    connection
        .execute(
            r#"
            UPDATE iam_device
            SET name = COALESCE(?4, name), last_seen_at = ?5
            WHERE tenant_id = ?1 AND user_id = ?2 AND device_fingerprint = ?3
            "#,
            params![tenant_id, user.id, device_id, device_name, now,],
        )
        .map_err(|error| format!("update IAM login device failed: {error}"))?;
    Ok(())
}

fn insert_session_context_value(session: &mut IamSessionPayload, key: &str, value: Option<String>) {
    let Some(value) = value else {
        return;
    };
    let Some(context) = session.context.as_mut().and_then(Value::as_object_mut) else {
        return;
    };
    context.insert(key.to_owned(), Value::String(value));
}

fn load_session_by_token_or_id(
    connection: &Connection,
    token_or_id: &str,
) -> Result<Option<IamSessionPayload>, String> {
    let token = normalize_required(token_or_id, "token")?;
    let token_hash = hash_text(&token);
    let session = connection
        .query_row(
            r#"
            SELECT id, user_id, expires_at, deployment_mode
            FROM iam_session
            WHERE is_deleted = 0
              AND revoked_at IS NULL
              AND status = 'active'
              AND (id = ?1 OR auth_token_hash = ?2 OR access_token_hash = ?2)
            LIMIT 1
            "#,
            params![token, token_hash],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|error| format!("resolve IAM session failed: {error}"))?;
    let Some((session_id, user_id, expires_at, deployment_mode)) = session else {
        return Ok(None);
    };
    if is_expired(&expires_at) {
        return Ok(None);
    }
    let Some(user) = load_user_by_id(connection, &user_id)? else {
        return Ok(None);
    };
    Ok(Some(IamSessionPayload {
        access_token: token.clone(),
        auth_token: token,
        context: Some(build_context(
            &user,
            &session_id,
            match deployment_mode.as_str() {
                "saas" => IamMode::Cloud,
                "private" => IamMode::Private,
                _ => IamMode::Local,
            },
        )),
        expires_at: Some(expires_at),
        refresh_token: None,
        session_id,
        token_type: IAM_AUTHORIZATION_SCHEME.to_owned(),
        user: map_user_payload(&user),
    }))
}

fn build_context(user: &UserRecord, session_id: &str, mode: IamMode) -> Value {
    json!({
        "tenantId": user.tenant_id.clone().unwrap_or_else(|| DEFAULT_TENANT_ID.to_owned()),
        "organizationId": user.organization_id,
        "userId": user.id,
        "sessionId": session_id,
        "appId": DEFAULT_APP_ID,
        "environment": "dev",
        "deploymentMode": mode.deployment_mode(),
        "authLevel": "password",
        "dataScope": ["tenant"],
        "permissionScope": ["birdcoder.*"],
    })
}

fn upsert_user(
    connection: &mut Connection,
    preferred_id: Option<&str>,
    email: &str,
    phone: Option<&str>,
    name: Option<&str>,
    avatar_url: Option<&str>,
) -> Result<UserRecord, String> {
    let email = normalize_required(email, "email")?.to_ascii_lowercase();
    let id = normalize_optional_text(preferred_id)
        .unwrap_or_else(|| stable_numeric_id("iam_user", &email));
    let now = now_rfc3339();
    let display_name = normalize_optional_text(name).unwrap_or_else(|| {
        email
            .split('@')
            .next()
            .unwrap_or("SDKWork IAM User")
            .to_owned()
    });
    connection
        .execute(
            r#"
            INSERT INTO iam_user (
                id, uuid, tenant_id, organization_id, username, email, phone, nickname,
                display_name, avatar_url, provider_key, status, bio, company, location,
                website, created_at, updated_at, is_deleted
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9, 'local', 'active', ?10, ?11, ?12, ?13, ?14, ?14, 0)
            ON CONFLICT(id) DO UPDATE SET
                email = excluded.email,
                phone = COALESCE(excluded.phone, iam_user.phone),
                nickname = COALESCE(excluded.nickname, iam_user.nickname),
                display_name = COALESCE(excluded.display_name, iam_user.display_name),
                avatar_url = COALESCE(excluded.avatar_url, iam_user.avatar_url),
                updated_at = excluded.updated_at,
                is_deleted = 0
            "#,
            params![
                id,
                stable_uuid("iam_user", &id),
                DEFAULT_TENANT_ID,
                DEFAULT_ORGANIZATION_ID,
                id,
                email,
                normalize_optional_text(phone),
                display_name,
                normalize_optional_text(avatar_url),
                DEFAULT_PROFILE_BIO,
                DEFAULT_PROFILE_COMPANY,
                DEFAULT_PROFILE_LOCATION,
                DEFAULT_PROFILE_WEBSITE,
                now,
            ],
        )
        .map_err(|error| format!("upsert IAM user failed: {error}"))?;
    load_user_by_id(connection, &id)?.ok_or_else(|| "Upserted IAM user was not found.".to_owned())
}

fn load_user_by_login(
    connection: &Connection,
    account: &str,
) -> Result<Option<UserRecord>, String> {
    let account = normalize_required(account, "account")?;
    if account.contains('@') {
        return load_user_by_email(connection, &account.to_ascii_lowercase());
    }
    if account
        .chars()
        .all(|char| char.is_ascii_digit() || char == '+')
    {
        return load_user_by_phone(connection, &account);
    }
    load_user_by_id(connection, &account)
}

fn load_user_by_id(connection: &Connection, user_id: &str) -> Result<Option<UserRecord>, String> {
    load_user_where(connection, "id", user_id)
}

fn load_user_by_email(connection: &Connection, email: &str) -> Result<Option<UserRecord>, String> {
    load_user_where(connection, "email", email)
}

fn load_user_by_phone(connection: &Connection, phone: &str) -> Result<Option<UserRecord>, String> {
    load_user_where(connection, "phone", phone)
}

fn load_user_where(
    connection: &Connection,
    field: &str,
    value: &str,
) -> Result<Option<UserRecord>, String> {
    let sql = format!(
        r#"
        SELECT id, uuid, tenant_id, organization_id, created_at, updated_at, email, phone,
               nickname, avatar_url, bio, company, location, website
        FROM iam_user
        WHERE {field} = ?1 AND is_deleted = 0
        LIMIT 1
        "#
    );
    connection
        .query_row(&sql, params![value], |row| {
            Ok(UserRecord {
                id: row.get(0)?,
                uuid: row.get(1)?,
                tenant_id: row.get(2)?,
                organization_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                email: row.get(6)?,
                name: row.get(8)?,
                avatar_url: row.get(9)?,
                bio: row.get(10)?,
                company: row.get(11)?,
                location: row.get(12)?,
                website: row.get(13)?,
            })
        })
        .optional()
        .map_err(|error| format!("load IAM user by {field} failed: {error}"))
}

fn set_user_password(
    connection: &mut Connection,
    user_id: &str,
    password: &str,
) -> Result<(), String> {
    let password = normalize_required(password, "password")?;
    let now = now_rfc3339();
    let hash = hash_password(&password)?;
    let id = stable_numeric_id("iam_credential", user_id);
    connection
        .execute(
            r#"
            INSERT INTO iam_credential (
                id, uuid, tenant_id, user_id, credential_type, credential_hash,
                password_hash, status, created_at, updated_at, is_deleted
            )
            VALUES (?1, ?2, ?3, ?4, 'password', ?5, ?5, 'active', ?6, ?6, 0)
            ON CONFLICT(user_id, credential_type) DO UPDATE SET
                credential_hash = excluded.credential_hash,
                password_hash = excluded.password_hash,
                status = 'active',
                updated_at = excluded.updated_at,
                is_deleted = 0
            "#,
            params![
                id,
                stable_uuid("iam_credential", &id),
                DEFAULT_TENANT_ID,
                user_id,
                hash,
                now
            ],
        )
        .map_err(|error| format!("set IAM password failed: {error}"))?;
    Ok(())
}

fn verify_user_password(
    connection: &Connection,
    user_id: &str,
    password: &str,
) -> Result<(), String> {
    let hash = connection
        .query_row(
            r#"
            SELECT credential_hash
            FROM iam_credential
            WHERE user_id = ?1 AND credential_type = 'password' AND status = 'active' AND is_deleted = 0
            LIMIT 1
            "#,
            params![user_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("load IAM credential failed: {error}"))?
        .ok_or_else(|| "IAM password credential was not found.".to_owned())?;
    verify_password(password, &hash)
}

fn insert_verify_code(
    connection: &mut Connection,
    target: &str,
    scene: &str,
    verify_type: &str,
    code: &str,
) -> Result<(), String> {
    let now = now_rfc3339();
    let expires_at = format_time(
        OffsetDateTime::now_utc() + TimeDuration::seconds(DEFAULT_VERIFY_CODE_TTL_SECONDS),
    );
    connection
        .execute(
            r#"
            INSERT INTO iam_verification_code (
                id, target, scene, verify_type, code_hash, expires_at, created_at, is_deleted
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)
            "#,
            params![
                new_id(),
                target,
                scene,
                verify_type,
                hash_text(code),
                expires_at,
                now
            ],
        )
        .map_err(|error| format!("store IAM verification code failed: {error}"))?;
    Ok(())
}

fn verify_code(
    connection: &mut Connection,
    target: &str,
    scene: &str,
    verify_type: &str,
    code: &str,
) -> Result<(), String> {
    let code_hash = hash_text(code);
    let record_id = connection
        .query_row(
            r#"
            SELECT id
            FROM iam_verification_code
            WHERE target = ?1
              AND scene = ?2
              AND verify_type = ?3
              AND code_hash = ?4
              AND consumed_at IS NULL
              AND expires_at > ?5
              AND is_deleted = 0
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            params![target, scene, verify_type, code_hash, now_rfc3339()],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("verify IAM code failed: {error}"))?
        .ok_or_else(|| "verification code is invalid or expired.".to_owned())?;
    connection
        .execute(
            "UPDATE iam_verification_code SET consumed_at = ?1 WHERE id = ?2",
            params![now_rfc3339(), record_id],
        )
        .map_err(|error| format!("consume IAM verification code failed: {error}"))?;
    Ok(())
}

fn load_qr_session(
    connection: &Connection,
    session_key: &str,
) -> Result<IamQrAuthSessionPayload, String> {
    connection
        .query_row(
            r#"
            SELECT session_key, status, qr_content, qr_url, expires_at
            FROM iam_login_qr
            WHERE session_key = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![session_key],
            |row| {
                Ok(IamQrAuthSessionPayload {
                    session_key: row.get(0)?,
                    status: row.get(1)?,
                    qr_content: row.get(2)?,
                    qr_url: row.get(3)?,
                    expires_at: row.get(4)?,
                    session: None,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load IAM QR auth session failed: {error}"))?
        .ok_or_else(|| format!("IAM QR auth session {session_key} was not found."))
}

fn expire_qr_if_needed(connection: &mut Connection, session_key: &str) -> Result<(), String> {
    let Some((status, expires_at)) = connection
        .query_row(
            "SELECT status, expires_at FROM iam_login_qr WHERE session_key = ?1 AND is_deleted = 0",
            params![session_key],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|error| format!("load IAM QR expiry failed: {error}"))?
    else {
        return Ok(());
    };
    if status != "confirmed" && is_expired(&expires_at) {
        connection
            .execute(
                "UPDATE iam_login_qr SET status = 'expired', updated_at = ?1 WHERE session_key = ?2",
                params![now_rfc3339(), session_key],
            )
            .map_err(|error| format!("expire IAM QR auth session failed: {error}"))?;
    }
    Ok(())
}

fn confirm_qr_session(
    connection: &mut Connection,
    session_key: &str,
    session: &IamSessionPayload,
) -> Result<(), String> {
    expire_qr_if_needed(connection, session_key)?;
    let current = load_qr_session(connection, session_key)?;
    if current.status == "expired" {
        return Err("IAM QR auth session has expired.".to_owned());
    }
    let user = session_user(session)?;
    connection
        .execute(
            "UPDATE iam_login_qr SET status = 'confirmed', session_id = ?1, user_id = ?2, updated_at = ?3 WHERE session_key = ?4 AND is_deleted = 0",
            params![session.session_id, user.id, now_rfc3339(), session_key],
        )
        .map_err(|error| format!("confirm IAM QR auth session failed: {error}"))?;
    Ok(())
}

fn map_user_payload(user: &UserRecord) -> IamUserPayload {
    IamUserPayload {
        id: user.id.clone(),
        uuid: user.uuid.clone(),
        tenant_id: user.tenant_id.clone(),
        organization_id: user.organization_id.clone(),
        created_at: user.created_at.clone(),
        updated_at: user.updated_at.clone(),
        name: user.name.clone(),
        email: user.email.clone(),
        avatar_url: user.avatar_url.clone(),
    }
}

fn map_profile_payload(user: &UserRecord) -> IamProfilePayload {
    IamProfilePayload {
        uuid: user.uuid.clone(),
        tenant_id: user.tenant_id.clone(),
        organization_id: user.organization_id.clone(),
        created_at: user.created_at.clone(),
        updated_at: user.updated_at.clone(),
        avatar_url: user.avatar_url.clone(),
        bio: user
            .bio
            .clone()
            .unwrap_or_else(|| DEFAULT_PROFILE_BIO.to_owned()),
        company: user
            .company
            .clone()
            .unwrap_or_else(|| DEFAULT_PROFILE_COMPANY.to_owned()),
        display_name: user.name.clone(),
        email: user.email.clone(),
        user_id: user.id.clone(),
        location: user
            .location
            .clone()
            .unwrap_or_else(|| DEFAULT_PROFILE_LOCATION.to_owned()),
        website: user
            .website
            .clone()
            .unwrap_or_else(|| DEFAULT_PROFILE_WEBSITE.to_owned()),
    }
}

fn session_user(session: &IamSessionPayload) -> Result<&IamUserPayload, String> {
    Ok(&session.user)
}

fn read_header_value(headers: &HeaderMap, header_name: &str) -> Option<String> {
    headers
        .get(header_name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| normalize_optional_text(Some(value)))
}

fn read_authorization_token(headers: &HeaderMap) -> Option<String> {
    let authorization = read_header_value(headers, IAM_AUTHORIZATION_HEADER_NAME)?;
    let mut parts = authorization.split_whitespace();
    let first = parts.next()?;
    let second = parts.next();
    if first.eq_ignore_ascii_case(IAM_AUTHORIZATION_SCHEME) {
        return second.and_then(|value| normalize_optional_text(Some(value)));
    }
    normalize_optional_text(Some(first))
}

fn normalize_login_method(value: &str) -> String {
    value.trim().replace('-', "_").to_ascii_lowercase()
}

fn normalize_provider(value: &str) -> Result<String, String> {
    let provider = normalize_required(value, "provider")?.to_ascii_lowercase();
    if provider.chars().all(|char| {
        char.is_ascii_lowercase() || char.is_ascii_digit() || char == '_' || char == '-'
    }) {
        Ok(provider)
    } else {
        Err("provider contains unsupported characters.".to_owned())
    }
}

fn required_login_email(request: &IamLoginRequest) -> Result<String, String> {
    request
        .email
        .as_deref()
        .or(request.account.as_deref())
        .and_then(|value| normalize_optional_text(Some(value)))
        .map(|value| value.to_ascii_lowercase())
        .filter(|value| value.contains('@'))
        .ok_or_else(|| "email is required.".to_owned())
}

fn required_text(value: Option<&str>, field: &str) -> Result<String, String> {
    value
        .and_then(|value| normalize_optional_text(Some(value)))
        .ok_or_else(|| format!("{field} is required."))
}

fn normalize_required(value: &str, field: &str) -> Result<String, String> {
    normalize_optional_text(Some(value)).ok_or_else(|| format!("{field} is required."))
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_owned)
}

fn read_env_trimmed(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .and_then(|value| normalize_optional_text(Some(&value)))
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::encode_b64(Uuid::new_v4().as_bytes())
        .map_err(|error| format!("create IAM password salt failed: {error}"))?;
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|error| format!("hash IAM password failed: {error}"))
}

fn verify_password(password: &str, hash: &str) -> Result<(), String> {
    let parsed = PasswordHash::new(hash)
        .map_err(|error| format!("parse IAM password hash failed: {error}"))?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| "password is invalid.".to_owned())
}

fn hash_text(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn new_id() -> String {
    (Uuid::new_v4().as_u128() % 1_000_000_000_000_000_000u128).to_string()
}

fn stable_numeric_id(namespace: &str, value: &str) -> String {
    let uuid = Uuid::new_v5(
        &Uuid::NAMESPACE_OID,
        format!("{namespace}:{value}").as_bytes(),
    );
    (uuid.as_u128() % 1_000_000_000_000_000_000u128).to_string()
}

fn stable_uuid(namespace: &str, value: &str) -> String {
    Uuid::new_v5(
        &Uuid::NAMESPACE_OID,
        format!("{namespace}:{value}").as_bytes(),
    )
    .to_string()
}

fn now_rfc3339() -> String {
    format_time(OffsetDateTime::now_utc())
}

fn format_time(value: OffsetDateTime) -> String {
    value
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

fn is_expired(value: &str) -> bool {
    OffsetDateTime::parse(value, &Rfc3339)
        .map(|expires_at| expires_at <= OffsetDateTime::now_utc())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    use rusqlite::{Connection, OptionalExtension};

    fn sqlite_column_names(connection: &Connection, table_name: &str) -> Vec<String> {
        let pragma = format!("PRAGMA table_info({table_name})");
        let mut statement = connection
            .prepare(&pragma)
            .expect("prepare sqlite table info");
        statement
            .query_map([], |row| row.get::<_, String>(1))
            .expect("query sqlite table info")
            .map(|row| row.expect("read sqlite table info"))
            .collect()
    }

    #[test]
    fn ensure_sqlite_iam_schema_rebuilds_nonstandard_session_table_before_indexing() {
        let mut connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .execute_batch(
                r#"
                CREATE TABLE iam_session (
                    id TEXT PRIMARY KEY,
                    uuid TEXT NOT NULL UNIQUE,
                    tenant_id TEXT NOT NULL,
                    organization_id TEXT NULL,
                    user_id TEXT NOT NULL,
                    app_id TEXT NOT NULL,
                    environment TEXT NOT NULL,
                    deployment_mode TEXT NOT NULL,
                    auth_level TEXT NOT NULL,
                    refresh_token_hash TEXT NULL,
                    sharding_key TEXT NOT NULL,
                    sharding_strategy TEXT NOT NULL,
                    data_scope_json TEXT NOT NULL,
                    permission_scope_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    revoked_at TEXT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );
                "#,
            )
            .expect("seed legacy iam_session table");

        ensure_sqlite_iam_schema(&mut connection).expect("upgrade sqlite IAM schema");

        let column_names = sqlite_column_names(&connection, "iam_session");
        assert_eq!(column_names, IAM_SESSION_STANDARD_COLUMNS);

        let auth_token_index_sql = connection
            .query_row(
                r#"
                SELECT sql
                FROM sqlite_master
                WHERE type = 'index' AND name = 'idx_iam_session_auth_token_hash'
                "#,
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .expect("read auth token index");
        assert!(
            auth_token_index_sql
                .as_deref()
                .is_some_and(|sql| sql.contains("auth_token_hash")),
            "auth token hash index must be created on the standard column"
        );
    }

    #[test]
    fn ensure_sqlite_iam_schema_rebuilds_nonstandard_organization_table_before_seeding() {
        let mut connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .execute_batch(
                r#"
                CREATE TABLE iam_organization (
                    id TEXT PRIMARY KEY,
                    uuid TEXT NOT NULL UNIQUE,
                    tenant_id TEXT NOT NULL,
                    parent_id TEXT NULL,
                    code TEXT NOT NULL,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );
                "#,
            )
            .expect("seed legacy iam_organization table");

        ensure_sqlite_iam_schema(&mut connection).expect("upgrade sqlite IAM schema");

        assert_eq!(
            sqlite_column_names(&connection, "iam_organization"),
            vec![
                "id",
                "uuid",
                "tenant_id",
                "parent_id",
                "code",
                "name",
                "path",
                "status",
                "created_at",
                "updated_at",
                "is_deleted",
            ]
        );

        let root_path = connection
            .query_row(
                "SELECT path FROM iam_organization WHERE id = ?1",
                [DEFAULT_ORGANIZATION_ID],
                |row| row.get::<_, String>(0),
            )
            .expect("read default IAM organization path");
        assert_eq!(root_path, "/0");
    }

    #[test]
    fn ensure_sqlite_iam_schema_rebuilds_nonstandard_session_index_before_use() {
        let mut connection = Connection::open_in_memory().expect("open in-memory sqlite");
        ensure_sqlite_iam_schema(&mut connection).expect("create sqlite IAM schema");
        connection
            .execute_batch(
                r#"
                DROP INDEX IF EXISTS idx_iam_session_auth_token_hash;
                CREATE INDEX idx_iam_session_auth_token_hash
                ON iam_session(refresh_token_hash);
                "#,
            )
            .expect("seed legacy iam_session index");

        ensure_sqlite_iam_schema(&mut connection).expect("standardize sqlite IAM schema");

        let auth_token_index_sql = connection
            .query_row(
                r#"
                SELECT sql
                FROM sqlite_master
                WHERE type = 'index' AND name = 'idx_iam_session_auth_token_hash'
                "#,
                [],
                |row| row.get::<_, String>(0),
            )
            .expect("read auth token index");
        assert!(
            auth_token_index_sql.contains("ON iam_session(auth_token_hash)"),
            "auth token hash index must target auth_token_hash after schema standardization"
        );
    }

    #[test]
    fn ensure_sqlite_iam_schema_creates_standard_session_table_on_fresh_database() {
        let mut connection = Connection::open_in_memory().expect("open in-memory sqlite");

        ensure_sqlite_iam_schema(&mut connection).expect("create sqlite IAM schema");

        assert_eq!(
            sqlite_column_names(&connection, "iam_session"),
            IAM_SESSION_STANDARD_COLUMNS
        );
    }

    #[test]
    fn ensure_sqlite_iam_schema_creates_registered_standard_tables_on_fresh_database() {
        let mut connection = Connection::open_in_memory().expect("open in-memory sqlite");

        ensure_sqlite_iam_schema(&mut connection).expect("create sqlite IAM schema");

        for table in IAM_STANDARD_TABLES {
            assert_eq!(
                sqlite_column_names(&connection, table.name),
                table.columns,
                "{} must match the registered IAM table contract",
                table.name
            );
        }
    }

    #[test]
    fn ensure_sqlite_iam_schema_preserves_non_iam_tables_when_rebuilding_drifted_iam_tables() {
        let mut connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .execute_batch(
                r#"
                CREATE TABLE studio_project (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL
                );
                INSERT INTO studio_project (id, name) VALUES ('project-1', 'Local Project');
                CREATE TABLE iam_organization (
                    id TEXT PRIMARY KEY,
                    uuid TEXT NOT NULL UNIQUE,
                    tenant_id TEXT NOT NULL,
                    parent_id TEXT NULL,
                    code TEXT NOT NULL,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );
                "#,
            )
            .expect("seed business table and legacy IAM table");

        ensure_sqlite_iam_schema(&mut connection).expect("standardize sqlite IAM schema");

        let project_name = connection
            .query_row(
                "SELECT name FROM studio_project WHERE id = 'project-1'",
                [],
                |row| row.get::<_, String>(0),
            )
            .expect("read non-IAM project table");
        assert_eq!(project_name, "Local Project");
    }
}
