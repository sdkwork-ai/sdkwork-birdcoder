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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'PLATFORM',
    biz_type TEXT NULL,
    biz_id INTEGER NULL,
    jwt_secret_key TEXT NOT NULL DEFAULT 'birdcoder-local-tenant-secret',
    token_expiration_ms INTEGER NULL,
    refresh_token_expiration_ms INTEGER NULL,
    status TEXT NOT NULL,
    description TEXT NULL,
    admin_user_id INTEGER NULL,
    install_app_list TEXT NULL,
    expire_time TEXT NULL,
    metadata TEXT NULL,
    contact_person TEXT NULL,
    contact_phone TEXT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_organization (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    parent_id INTEGER NULL,
    parent_uuid TEXT NULL,
    parent_metadata TEXT NULL,
    name TEXT NOT NULL,
    jwt_secret_key TEXT NOT NULL UNIQUE,
    token_expiration_ms INTEGER NULL,
    refresh_token_expiration_ms INTEGER NULL,
    code TEXT NOT NULL UNIQUE,
    install_app_list TEXT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    metadata TEXT NULL,
    description TEXT NULL,
    contact_person TEXT NULL,
    contact_phone TEXT NULL,
    contact_email TEXT NULL,
    address TEXT NULL,
    website TEXT NULL,
    logo_url TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plus_organization_status
ON plus_organization(status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_plus_organization_parent_id
ON plus_organization(parent_id, is_deleted);

CREATE TABLE IF NOT EXISTS plus_organization_member (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    owner INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    joined_at TEXT NULL,
    left_at TEXT NULL,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_org_member_user_id
ON plus_organization_member(user_id);

CREATE INDEX IF NOT EXISTS idx_org_member_owner_id
ON plus_organization_member(owner_id);

CREATE INDEX IF NOT EXISTS idx_org_member_user_owner
ON plus_organization_member(user_id, owner_id);

CREATE TABLE IF NOT EXISTS plus_member_relations (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    parent_id INTEGER NULL,
    parent_uuid TEXT NULL,
    parent_metadata TEXT NULL,
    member_id INTEGER NOT NULL,
    owner INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    relation_type INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    effective_at TEXT NULL,
    expired_at TEXT NULL,
    sort_order INTEGER NULL,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_member_rel_member_id
ON plus_member_relations(member_id);

CREATE INDEX IF NOT EXISTS idx_member_rel_target_id
ON plus_member_relations(target_id);

CREATE INDEX IF NOT EXISTS idx_member_rel_relation_type
ON plus_member_relations(relation_type);

CREATE INDEX IF NOT EXISTS idx_member_rel_owner_id
ON plus_member_relations(owner_id);

CREATE INDEX IF NOT EXISTS idx_member_rel_member_owner
ON plus_member_relations(member_id, owner_id);

CREATE TABLE IF NOT EXISTS plus_department (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    parent_id INTEGER NULL,
    parent_uuid TEXT NULL,
    parent_metadata TEXT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    owner INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    code TEXT NULL,
    sort_order INTEGER NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    tree_path TEXT NULL,
    level INTEGER NULL,
    manager_id INTEGER NULL,
    phone TEXT NULL,
    email TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dept_org_id
ON plus_department(owner_id);

CREATE INDEX IF NOT EXISTS idx_dept_code
ON plus_department(code);

CREATE INDEX IF NOT EXISTS idx_dept_parent_id
ON plus_department(parent_id);

CREATE INDEX IF NOT EXISTS idx_dept_is_active
ON plus_department(is_active);

CREATE INDEX IF NOT EXISTS idx_dept_org_parent
ON plus_department(owner_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_dept_level
ON plus_department(level);

CREATE TABLE IF NOT EXISTS plus_position (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    parent_id INTEGER NULL,
    parent_uuid TEXT NULL,
    parent_metadata TEXT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    owner INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    code TEXT NULL,
    level INTEGER NOT NULL,
    sort_order INTEGER NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    tree_path TEXT NULL,
    category TEXT NULL,
    required_experience_years INTEGER NULL,
    required_education TEXT NULL,
    max_member_count INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_position_org_id
ON plus_position(owner_id);

CREATE INDEX IF NOT EXISTS idx_position_code
ON plus_position(code);

CREATE INDEX IF NOT EXISTS idx_position_level
ON plus_position(level);

CREATE INDEX IF NOT EXISTS idx_position_parent_id
ON plus_position(parent_id);

CREATE INDEX IF NOT EXISTS idx_position_is_active
ON plus_position(is_active);

CREATE TABLE IF NOT EXISTS plus_role (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_permission (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT NULL,
    status INTEGER NOT NULL,
    sort_order INTEGER NULL,
    resource_url TEXT NULL,
    http_method TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_role_permission (
    id INTEGER PRIMARY KEY,
    uuid TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    role_uuid TEXT NOT NULL,
    permission_id INTEGER NOT NULL,
    permission_uuid TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    description TEXT NULL,
    operator_id INTEGER NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permission1
ON plus_role_permission(role_id, permission_id);

CREATE TABLE IF NOT EXISTS plus_user_role (
    id INTEGER NULL,
    uuid TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    operator_id INTEGER NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_role1
ON plus_user_role(user_id, role_id);

CREATE TABLE IF NOT EXISTS plus_user (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    username TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    password TEXT NOT NULL,
    salt TEXT NULL,
    platform TEXT NOT NULL,
    type TEXT NOT NULL,
    gender TEXT NULL,
    face_image TEXT NULL,
    face_video TEXT NULL,
    scene TEXT NULL,
    email TEXT NULL UNIQUE,
    phone TEXT NULL,
    country_code TEXT NULL,
    province_code TEXT NULL,
    city_code TEXT NULL,
    district_code TEXT NULL,
    address TEXT NULL,
    bio TEXT NULL,
    birth_date TEXT NULL,
    oauth_user_info TEXT NULL,
    metadata TEXT NULL,
    social_info_list TEXT NULL,
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
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    oauth_provider TEXT NOT NULL,
    open_id TEXT NOT NULL,
    union_id TEXT NULL,
    app_id TEXT NULL,
    channel_account_id INTEGER NULL,
    access_token_expires_at TEXT NULL,
    oauth_user_info TEXT NULL,
    oauth_user_info_json TEXT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (oauth_provider, open_id),
    UNIQUE (oauth_provider, union_id)
);

CREATE TABLE IF NOT EXISTS plus_user_address (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    country_code TEXT NULL,
    province_code TEXT NULL,
    city_code TEXT NULL,
    district_code TEXT NULL,
    address_detail TEXT NOT NULL,
    postal_code TEXT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    tag TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_card (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    card_organization_id INTEGER NULL,
    card_type INTEGER NULL,
    code_type INTEGER NULL,
    title TEXT NULL,
    brand_name TEXT NULL,
    logo_url TEXT NULL,
    notice TEXT NULL,
    description TEXT NULL,
    color TEXT NULL,
    quantity INTEGER NULL,
    get_limit INTEGER NULL,
    can_share INTEGER NULL,
    can_give_friend INTEGER NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    status INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_user_card (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    card_id INTEGER NULL,
    card_code TEXT NULL,
    acquire_time TEXT NULL,
    activate_time TEXT NULL,
    cancel_time TEXT NULL,
    points INTEGER NULL,
    balance INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plus_user_card_user_card
ON plus_user_card(user_id, card_id);

CREATE TABLE IF NOT EXISTS plus_member_card (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    card_id INTEGER NULL,
    supply_bonus INTEGER NULL,
    supply_balance INTEGER NULL,
    bonus_name TEXT NULL,
    balance_name TEXT NULL,
    prerogative TEXT NULL,
    auto_activate INTEGER NULL,
    wx_activate INTEGER NULL,
    cost_money_unit INTEGER NULL,
    increase_bonus INTEGER NULL,
    init_increase_bonus INTEGER NULL,
    max_increase_bonus INTEGER NULL,
    cost_bonus_unit INTEGER NULL,
    reduce_money INTEGER NULL,
    least_money_to_use_bonus INTEGER NULL,
    max_reduce_bonus INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_member_level (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    card_id INTEGER NULL,
    level_name TEXT NULL,
    required_points INTEGER NULL,
    description TEXT NULL,
    status INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_card_template (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NULL,
    template_code TEXT NULL UNIQUE,
    card_type INTEGER NOT NULL,
    code_type INTEGER NULL,
    title TEXT NULL,
    description TEXT NULL,
    brand_name TEXT NULL,
    logo_url TEXT NULL,
    notice TEXT NULL,
    color TEXT NULL,
    quantity INTEGER NULL,
    get_limit INTEGER NULL,
    can_share INTEGER NULL,
    can_give_friend INTEGER NULL,
    minimum_balance NUMERIC NULL,
    initial_balance NUMERIC NULL,
    discount_rate NUMERIC NULL,
    validity_type INTEGER NOT NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    validity_days INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NULL
);

CREATE TABLE IF NOT EXISTS plus_coupon (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    redeem_code TEXT NULL UNIQUE,
    point_cost INTEGER NULL,
    type INTEGER NOT NULL,
    description TEXT NULL,
    amount INTEGER NULL,
    discount REAL NULL,
    min_consume INTEGER NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    total INTEGER NULL,
    get_limit INTEGER NULL,
    received_count INTEGER NULL,
    used_count INTEGER NULL,
    status INTEGER NOT NULL,
    stackable INTEGER NOT NULL,
    scope_type INTEGER NOT NULL,
    scope_value TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_coupon_template (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    template_code TEXT NULL UNIQUE,
    type INTEGER NOT NULL,
    description TEXT NULL,
    amount INTEGER NULL,
    discount REAL NULL,
    min_consume INTEGER NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    total INTEGER NULL,
    get_limit INTEGER NULL,
    received_count INTEGER NULL,
    used_count INTEGER NULL,
    status INTEGER NULL,
    validity_type INTEGER NULL,
    validity_days INTEGER NULL,
    can_share INTEGER NULL,
    stackable INTEGER NULL,
    scope_type INTEGER NULL,
    scope_value TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_user_coupon (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    coupon_id INTEGER NOT NULL,
    coupon_code TEXT NOT NULL,
    acquire_at TEXT NOT NULL,
    acquire_request_no TEXT NULL,
    acquire_type INTEGER NOT NULL,
    point_cost INTEGER NULL,
    points_refunded INTEGER NOT NULL,
    points_refund_at TEXT NULL,
    use_at TEXT NULL,
    expire_at TEXT NULL,
    status INTEGER NOT NULL,
    order_id INTEGER NULL,
    can_shared INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (coupon_code),
    UNIQUE (user_id, acquire_request_no)
);

CREATE TABLE IF NOT EXISTS plus_product (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    code TEXT NULL UNIQUE,
    subtitle TEXT NULL,
    resources TEXT NULL,
    price NUMERIC NOT NULL,
    original_price NUMERIC NULL,
    stock INTEGER NOT NULL,
    sales_count INTEGER NULL,
    status INTEGER NOT NULL,
    on_sale_at TEXT NULL,
    description TEXT NULL,
    tags TEXT NULL,
    category_id INTEGER NOT NULL,
    base_attributes TEXT NOT NULL,
    spec_attributes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_sku (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    product_id INTEGER NOT NULL,
    sku_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    title TEXT NULL,
    price NUMERIC NOT NULL,
    original_price NUMERIC NULL,
    stock INTEGER NOT NULL,
    sales INTEGER NULL,
    status INTEGER NOT NULL,
    image TEXT NULL,
    specs TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sku_product
ON plus_sku(product_id);

CREATE INDEX IF NOT EXISTS idx_sku_code
ON plus_sku(sku_code);

CREATE TABLE IF NOT EXISTS plus_currency (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NULL,
    currency_type INTEGER NOT NULL,
    precision_digits INTEGER NULL,
    is_active INTEGER NULL,
    description TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS plus_exchange_rate (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    base_currency_id INTEGER NOT NULL,
    target_currency_id INTEGER NOT NULL,
    base_currency_code TEXT NULL,
    target_currency_code TEXT NULL,
    rate NUMERIC NOT NULL,
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (base_currency_id, target_currency_id, effective_date)
);

CREATE TABLE IF NOT EXISTS plus_agent_skill_package (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    package_key TEXT NOT NULL,
    name TEXT NOT NULL,
    summary TEXT NULL,
    description TEXT NULL,
    icon TEXT NULL,
    cover_image TEXT NULL,
    category_id INTEGER NULL,
    enabled INTEGER NOT NULL,
    featured INTEGER NOT NULL,
    sort_weight INTEGER NOT NULL,
    tags TEXT NULL,
    latest_published_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, organization_id, package_key)
);

CREATE INDEX IF NOT EXISTS idx_plus_agent_skill_package_user
ON plus_agent_skill_package(user_id);

CREATE INDEX IF NOT EXISTS idx_plus_agent_skill_package_category
ON plus_agent_skill_package(category_id);

CREATE INDEX IF NOT EXISTS idx_plus_agent_skill_package_market
ON plus_agent_skill_package(enabled, featured, sort_weight);

CREATE TABLE IF NOT EXISTS plus_agent_skill (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    skill_key TEXT NOT NULL,
    name TEXT NOT NULL,
    summary TEXT NULL,
    description TEXT NULL,
    icon TEXT NULL,
    cover_image TEXT NULL,
    category_id INTEGER NULL,
    package_id INTEGER NULL,
    provider TEXT NULL,
    version TEXT NULL,
    version_name TEXT NULL,
    runtime TEXT NULL,
    entrypoint TEXT NULL,
    manifest_url TEXT NULL,
    repository_url TEXT NULL,
    homepage_url TEXT NULL,
    documentation_url TEXT NULL,
    license_name TEXT NULL,
    source_type TEXT NOT NULL,
    market_status TEXT NOT NULL,
    visibility TEXT NOT NULL,
    review_status TEXT NOT NULL,
    review_comment TEXT NULL,
    reviewed_by INTEGER NULL,
    reviewed_at TEXT NULL,
    builtin INTEGER NOT NULL,
    is_builtin INTEGER NOT NULL,
    enabled INTEGER NOT NULL,
    featured INTEGER NOT NULL,
    recommend_weight INTEGER NOT NULL,
    price NUMERIC NULL,
    currency TEXT NULL,
    install_count INTEGER NOT NULL,
    rating_avg NUMERIC NULL,
    rating_count INTEGER NOT NULL,
    tags TEXT NULL,
    capabilities TEXT NULL,
    config_schema TEXT NULL,
    default_config TEXT NULL,
    latest_published_at TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, organization_id, skill_key)
);

CREATE INDEX IF NOT EXISTS idx_plus_agent_skill_user
ON plus_agent_skill(user_id);

CREATE INDEX IF NOT EXISTS idx_plus_agent_skill_category
ON plus_agent_skill(category_id);

CREATE INDEX IF NOT EXISTS idx_plus_agent_skill_package
ON plus_agent_skill(package_id);

CREATE INDEX IF NOT EXISTS idx_plus_agent_skill_market
ON plus_agent_skill(enabled, market_status, visibility, review_status);

CREATE INDEX IF NOT EXISTS idx_plus_agent_skill_featured
ON plus_agent_skill(featured, recommend_weight);

CREATE TABLE IF NOT EXISTS plus_user_agent_skill (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    enabled INTEGER NOT NULL,
    config TEXT NULL,
    installed_at TEXT NULL,
    last_enabled_at TEXT NULL,
    last_used_at TEXT NULL,
    used_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, organization_id, user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_plus_user_agent_skill_user
ON plus_user_agent_skill(user_id);

CREATE INDEX IF NOT EXISTS idx_plus_user_agent_skill_skill
ON plus_user_agent_skill(skill_id);

CREATE INDEX IF NOT EXISTS idx_plus_user_agent_skill_enabled
ON plus_user_agent_skill(enabled);

CREATE TABLE IF NOT EXISTS plus_agent_plugin (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    code TEXT NULL,
    description TEXT NULL,
    version TEXT NULL,
    type TEXT NULL,
    config TEXT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_plus_agent_plugin_code
ON plus_agent_plugin(code);

CREATE INDEX IF NOT EXISTS idx_plus_agent_plugin_type
ON plus_agent_plugin(type);

CREATE INDEX IF NOT EXISTS idx_plus_agent_plugin_enabled
ON plus_agent_plugin(is_enabled);

CREATE TABLE IF NOT EXISTS plus_datasource (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NULL,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    type INTEGER NOT NULL,
    status INTEGER NOT NULL,
    description TEXT NULL,
    connection_config TEXT NOT NULL,
    url TEXT NULL,
    owner TEXT NULL,
    last_connected_at TEXT NULL,
    connection_timeout INTEGER NULL,
    tags TEXT NULL,
    db_version TEXT NULL,
    security_level INTEGER NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    icon TEXT NULL,
    color TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_datasource_name
ON plus_datasource(name);

CREATE INDEX IF NOT EXISTS idx_plus_datasource_type
ON plus_datasource(type);

CREATE INDEX IF NOT EXISTS idx_plus_datasource_status
ON plus_datasource(status);

CREATE INDEX IF NOT EXISTS idx_plus_datasource_project_id
ON plus_datasource(project_id);

CREATE INDEX IF NOT EXISTS idx_plus_datasource_user_id
ON plus_datasource(user_id);


CREATE TABLE IF NOT EXISTS plus_schema (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 0,
    datasource_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    table_count INTEGER NOT NULL DEFAULT 0,
    last_sync_time TEXT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plus_schema_name
ON plus_schema(name);

CREATE INDEX IF NOT EXISTS idx_plus_schema_datasource_id
ON plus_schema(datasource_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_schema_datasource_name
ON plus_schema(datasource_id, name);

CREATE TABLE IF NOT EXISTS plus_table (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 0,
    schema_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    type TEXT NULL,
    column_count INTEGER NOT NULL DEFAULT 0,
    row_count INTEGER NOT NULL DEFAULT 0,
    last_sync_time TEXT NULL,
    primary_keys TEXT NULL,
    engine TEXT NULL,
    create_sql TEXT NULL,
    comment TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_table_name
ON plus_table(name);

CREATE INDEX IF NOT EXISTS idx_plus_table_schema_id
ON plus_table(schema_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_table_schema_name
ON plus_table(schema_id, name);

CREATE TABLE IF NOT EXISTS plus_column (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 0,
    table_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    data_type TEXT NULL,
    column_type TEXT NULL,
    ordinal_position INTEGER NULL,
    is_nullable INTEGER NOT NULL DEFAULT 1,
    is_primary_key INTEGER NOT NULL DEFAULT 0,
    is_auto_increment INTEGER NOT NULL DEFAULT 0,
    default_value TEXT NULL,
    comment TEXT NULL,
    character_set TEXT NULL,
    collation_rule TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_column_name
ON plus_column(name);

CREATE INDEX IF NOT EXISTS idx_plus_column_table_id
ON plus_column(table_id);

CREATE INDEX IF NOT EXISTS idx_plus_column_ordinal_position
ON plus_column(ordinal_position);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_column_table_name
ON plus_column(table_id, name);

CREATE TABLE IF NOT EXISTS plus_ai_generation (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NULL,
    title TEXT NULL,
    request_id TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NULL,
    type TEXT NOT NULL,
    model TEXT NOT NULL,
    channel TEXT NOT NULL,
    input_params TEXT NULL,
    output_result TEXT NULL,
    status INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    channel_task_id TEXT NULL,
    channel_task_status TEXT NULL,
    channel_task_info TEXT NULL,
    cost NUMERIC NULL,
    error_code TEXT NULL,
    error_message TEXT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retry INTEGER NOT NULL DEFAULT 3,
    started_at TEXT NULL,
    completed_at TEXT NULL,
    conversation_id INTEGER NULL,
    message_id INTEGER NULL,
    parent_id INTEGER NULL,
    batch_id TEXT NULL,
    callback_url TEXT NULL,
    biz_scene TEXT NULL,
    biz_id INTEGER NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_ai_generation_user_type_idempotency
ON plus_ai_generation(user_id, type, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_user_status
ON plus_ai_generation(user_id, status);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_type_status
ON plus_ai_generation(type, status);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_channel_task
ON plus_ai_generation(channel_task_id);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_conversation
ON plus_ai_generation(conversation_id);

CREATE TABLE IF NOT EXISTS plus_ai_generation_content (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NULL,
    channel TEXT NOT NULL,
    type TEXT NOT NULL,
    generation_id INTEGER NOT NULL DEFAULT 0,
    tags TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    content_type INTEGER NOT NULL,
    content_id INTEGER NULL,
    metadata TEXT NULL,
    input_params TEXT NULL,
    output TEXT NULL,
    content_format TEXT NULL,
    original_prompt TEXT NULL,
    optimized_prompt TEXT NULL,
    negative_prompt TEXT NULL,
    seed INTEGER NULL,
    steps INTEGER NULL,
    cfg_scale NUMERIC NULL,
    sampler TEXT NULL,
    width INTEGER NULL,
    height INTEGER NULL,
    duration NUMERIC NULL,
    file_size INTEGER NULL,
    file_url TEXT NULL,
    file_urls TEXT NULL,
    thumbnail_url TEXT NULL,
    preview_url TEXT NULL,
    style TEXT NULL,
    language TEXT NULL,
    voice_id TEXT NULL,
    is_hd INTEGER NOT NULL DEFAULT 0,
    variant_index INTEGER NULL,
    extra_params TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_content_generation
ON plus_ai_generation_content(generation_id);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_content_content_type
ON plus_ai_generation_content(content_type);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_content_content_id
ON plus_ai_generation_content(content_id);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_content_created_at
ON plus_ai_generation_content(created_at);

CREATE TABLE IF NOT EXISTS plus_ai_generation_style (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    type INTEGER NOT NULL,
    config_params TEXT NULL,
    tags TEXT NULL,
    cover_image TEXT NULL,
    assets TEXT NULL,
    preview_image TEXT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    usage_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_style_user_id
ON plus_ai_generation_style(user_id);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_style_name
ON plus_ai_generation_style(name);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_style_type
ON plus_ai_generation_style(type);

CREATE INDEX IF NOT EXISTS idx_plus_ai_generation_style_status
ON plus_ai_generation_style(status);

CREATE TABLE IF NOT EXISTS plus_channel (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    channel INTEGER NOT NULL,
    types TEXT NULL,
    support_resources TEXT NULL,
    status INTEGER NOT NULL,
    description TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_channel_channel
ON plus_channel(channel);

CREATE INDEX IF NOT EXISTS idx_plus_channel_status
ON plus_channel(status);

CREATE TABLE IF NOT EXISTS plus_channel_account (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    account_key TEXT NOT NULL,
    channel INTEGER NOT NULL,
    types TEXT NULL,
    support_resources TEXT NULL,
    configs TEXT NULL,
    proxy_account_configs TEXT NULL,
    status INTEGER NOT NULL,
    description TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_channel_account_key
ON plus_channel_account(account_key);

CREATE INDEX IF NOT EXISTS idx_plus_channel_account_channel
ON plus_channel_account(channel);

CREATE INDEX IF NOT EXISTS idx_plus_channel_account_status
ON plus_channel_account(status);

CREATE TABLE IF NOT EXISTS plus_channel_proxy (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    channel INTEGER NOT NULL,
    proxy INTEGER NOT NULL,
    default_model TEXT NULL,
    status INTEGER NOT NULL,
    description TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_channel_proxy_channel
ON plus_channel_proxy(channel);

CREATE INDEX IF NOT EXISTS idx_plus_channel_proxy_status
ON plus_channel_proxy(status);

CREATE TABLE IF NOT EXISTS plus_channel_resource (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    resource INTEGER NOT NULL,
    channel INTEGER NOT NULL,
    channel_account_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_channel_resource_account
ON plus_channel_resource(channel_account_id);

CREATE TABLE IF NOT EXISTS plus_api_key (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    key_value TEXT NOT NULL,
    key_type INTEGER NOT NULL,
    owner INTEGER NULL,
    status INTEGER NOT NULL,
    expire_time TEXT NULL,
    description TEXT NULL,
    last_used_time TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_api_key_key_value
ON plus_api_key(key_value);

CREATE INDEX IF NOT EXISTS idx_plus_api_key_user
ON plus_api_key(user_id);

CREATE INDEX IF NOT EXISTS idx_plus_api_key_status
ON plus_api_key(status);

CREATE TABLE IF NOT EXISTS plus_app (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    icon TEXT NULL,
    resource_list TEXT NULL,
    project_id INTEGER NULL,
    description TEXT NULL,
    version TEXT NULL,
    icon_url TEXT NULL,
    access_url TEXT NULL,
    config TEXT NULL,
    status INTEGER NULL,
    app_type INTEGER NULL,
    platforms TEXT NULL,
    install_platforms TEXT NULL,
    install_skill TEXT NULL,
    install_config TEXT NULL,
    release_notes TEXT NULL,
    package_name TEXT NULL,
    bundle_id TEXT NULL,
    store_url TEXT NULL,
    download_url TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_user_id
ON plus_app(user_id);

CREATE INDEX IF NOT EXISTS idx_app_project_id
ON plus_app(project_id);

CREATE INDEX IF NOT EXISTS idx_app_status
ON plus_app(status);

CREATE TABLE IF NOT EXISTS plus_ai_model_availability (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    object_id TEXT NOT NULL,
    model_id INTEGER NULL,
    channel TEXT NULL,
    model_key TEXT NOT NULL,
    platform TEXT NOT NULL,
    environment TEXT NOT NULL,
    region_code TEXT NOT NULL,
    access_tier TEXT NOT NULL,
    available INTEGER NOT NULL,
    status INTEGER NOT NULL,
    effective_from TEXT NULL,
    effective_to TEXT NULL,
    reason TEXT NULL,
    metadata TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_model_availability_scope
ON plus_ai_model_availability(tenant_id, organization_id, channel, model_key, platform, environment, region_code, access_tier);

CREATE INDEX IF NOT EXISTS idx_ai_model_availability_model
ON plus_ai_model_availability(model_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_availability_channel_key
ON plus_ai_model_availability(channel, model_key);

CREATE INDEX IF NOT EXISTS idx_ai_model_availability_platform_env
ON plus_ai_model_availability(platform, environment);

CREATE INDEX IF NOT EXISTS idx_ai_model_availability_region
ON plus_ai_model_availability(region_code);

CREATE INDEX IF NOT EXISTS idx_ai_model_availability_status
ON plus_ai_model_availability(status, available);

CREATE INDEX IF NOT EXISTS idx_ai_model_availability_time
ON plus_ai_model_availability(effective_from, effective_to);

CREATE TABLE IF NOT EXISTS plus_ai_model_compliance_profile (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    object_id TEXT NOT NULL,
    model_id INTEGER NULL,
    channel TEXT NULL,
    model_key TEXT NOT NULL,
    standard_code TEXT NOT NULL,
    standard_name TEXT NULL,
    level TEXT NOT NULL,
    status TEXT NOT NULL,
    verified_by TEXT NULL,
    auditor TEXT NULL,
    certificate_no TEXT NULL,
    certificate_url TEXT NULL,
    valid_from TEXT NULL,
    valid_to TEXT NULL,
    data_residency_regions TEXT NULL,
    controls TEXT NULL,
    notes TEXT NULL,
    metadata TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_model_compliance_standard
ON plus_ai_model_compliance_profile(tenant_id, organization_id, channel, model_key, standard_code);

CREATE INDEX IF NOT EXISTS idx_ai_model_compliance_model
ON plus_ai_model_compliance_profile(model_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_compliance_channel_key
ON plus_ai_model_compliance_profile(channel, model_key);

CREATE INDEX IF NOT EXISTS idx_ai_model_compliance_standard
ON plus_ai_model_compliance_profile(standard_code);

CREATE INDEX IF NOT EXISTS idx_ai_model_compliance_level
ON plus_ai_model_compliance_profile(level);

CREATE INDEX IF NOT EXISTS idx_ai_model_compliance_status
ON plus_ai_model_compliance_profile(status);

CREATE INDEX IF NOT EXISTS idx_ai_model_compliance_valid
ON plus_ai_model_compliance_profile(valid_from, valid_to);

CREATE TABLE IF NOT EXISTS plus_ai_model_info (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    object_id TEXT NOT NULL,
    channel INTEGER NULL,
    vendor INTEGER NULL,
    model TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_key TEXT NOT NULL,
    vendor_model TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    version TEXT NULL,
    family TEXT NULL,
    open_source INTEGER NULL,
    api_endpoint TEXT NULL,
    model_type INTEGER NULL,
    pricing_type TEXT NULL,
    lifecycle_stage TEXT NULL,
    release_date TEXT NULL,
    deprecated_at TEXT NULL,
    context_tokens INTEGER NULL,
    max_input_tokens INTEGER NULL,
    max_output_tokens INTEGER NULL,
    support_reasoning INTEGER NULL,
    support_multimodal INTEGER NULL,
    support_function_call INTEGER NULL,
    support_structured_output INTEGER NULL,
    support_realtime INTEGER NULL,
    support_fine_tuning INTEGER NULL,
    popularity_score INTEGER NULL,
    scenes TEXT NULL,
    tags TEXT NULL,
    owned_by TEXT NULL,
    function_info TEXT NULL,
    limit_info TEXT NULL,
    price_info TEXT NULL,
    metadata TEXT NULL,
    product_support_info TEXT NULL,
    supported_voices TEXT NULL,
    default_temperature REAL NULL,
    default_top_p REAL NULL,
    default_frequency_penalty REAL NULL,
    default_presence_penalty REAL NULL,
    status INTEGER NULL,
    usage_count INTEGER NULL,
    total_tokens INTEGER NULL,
    avg_response_time INTEGER NULL,
    config_params TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_model_channel_key
ON plus_ai_model_info(channel, model_key);

CREATE INDEX IF NOT EXISTS idx_model_channel
ON plus_ai_model_info(channel);

CREATE INDEX IF NOT EXISTS idx_model_type
ON plus_ai_model_info(model_type);

CREATE INDEX IF NOT EXISTS idx_model_status
ON plus_ai_model_info(status);

CREATE INDEX IF NOT EXISTS idx_model_family
ON plus_ai_model_info(family);

CREATE INDEX IF NOT EXISTS idx_model_vendor
ON plus_ai_model_info(vendor);

CREATE INDEX IF NOT EXISTS idx_model_model_id
ON plus_ai_model_info(model_id);

CREATE INDEX IF NOT EXISTS idx_model_model_key
ON plus_ai_model_info(model_key);

CREATE INDEX IF NOT EXISTS idx_model_pricing_type
ON plus_ai_model_info(pricing_type);

CREATE INDEX IF NOT EXISTS idx_model_lifecycle_stage
ON plus_ai_model_info(lifecycle_stage);

CREATE INDEX IF NOT EXISTS idx_model_release_date
ON plus_ai_model_info(release_date);

CREATE INDEX IF NOT EXISTS idx_model_context_tokens
ON plus_ai_model_info(context_tokens);

CREATE INDEX IF NOT EXISTS idx_model_support_reasoning
ON plus_ai_model_info(support_reasoning);

CREATE INDEX IF NOT EXISTS idx_model_support_multimodal
ON plus_ai_model_info(support_multimodal);

CREATE INDEX IF NOT EXISTS idx_model_popularity_score
ON plus_ai_model_info(popularity_score);

CREATE TABLE IF NOT EXISTS plus_ai_model_price (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    object_id TEXT NOT NULL,
    model_id INTEGER NULL,
    channel TEXT NULL,
    model_key TEXT NULL,
    model TEXT NOT NULL,
    product_code TEXT NULL,
    feature_code TEXT NULL,
    billing_type TEXT NULL,
    price_item_type TEXT NULL,
    tier_name TEXT NULL,
    rule_priority INTEGER NULL,
    unit TEXT NOT NULL,
    unit_size REAL NULL,
    price REAL NULL,
    input_price REAL NULL,
    batch_input_price REAL NULL,
    cached_input_price REAL NULL,
    batch_cached_input_price REAL NULL,
    output_price REAL NULL,
    batch_output_price REAL NULL,
    currency TEXT NOT NULL,
    min_usage REAL NULL,
    max_usage REAL NULL,
    effective_from TEXT NULL,
    effective_to TEXT NULL,
    is_default INTEGER NULL,
    status TEXT NULL,
    metadata TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_price_model_id
ON plus_ai_model_price(model_id);

CREATE INDEX IF NOT EXISTS idx_model_price_channel_model_key
ON plus_ai_model_price(channel, model_key);

CREATE INDEX IF NOT EXISTS idx_model_price_product
ON plus_ai_model_price(product_code);

CREATE INDEX IF NOT EXISTS idx_model_price_feature
ON plus_ai_model_price(feature_code);

CREATE INDEX IF NOT EXISTS idx_model_price_effective_time
ON plus_ai_model_price(effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_model_price_status
ON plus_ai_model_price(status);

CREATE INDEX IF NOT EXISTS idx_model_price_lookup
ON plus_ai_model_price(channel, model_key, product_code, feature_code, status, effective_from, effective_to, is_default);

CREATE TABLE IF NOT EXISTS plus_ai_model_price_metric (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    object_id TEXT NOT NULL,
    price_rule_id INTEGER NOT NULL,
    model_id INTEGER NULL,
    channel TEXT NULL,
    model_key TEXT NULL,
    product_code TEXT NULL,
    feature_code TEXT NULL,
    metric_type TEXT NOT NULL,
    billing_type TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_size REAL NULL,
    price REAL NULL,
    currency TEXT NOT NULL,
    min_usage REAL NULL,
    max_usage REAL NULL,
    tier_no INTEGER NOT NULL,
    tier_name TEXT NULL,
    effective_from TEXT NULL,
    effective_to TEXT NULL,
    status INTEGER NOT NULL,
    metadata TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_model_price_metric
ON plus_ai_model_price_metric(tenant_id, organization_id, price_rule_id, metric_type, tier_no);

CREATE INDEX IF NOT EXISTS idx_ai_model_price_metric_price_rule
ON plus_ai_model_price_metric(price_rule_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_price_metric_model
ON plus_ai_model_price_metric(model_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_price_metric_channel_key
ON plus_ai_model_price_metric(channel, model_key);

CREATE INDEX IF NOT EXISTS idx_ai_model_price_metric_product_feature
ON plus_ai_model_price_metric(product_code, feature_code);

CREATE INDEX IF NOT EXISTS idx_ai_model_price_metric_effective
ON plus_ai_model_price_metric(effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_ai_model_price_metric_status
ON plus_ai_model_price_metric(status);

CREATE TABLE IF NOT EXISTS plus_ai_model_taxonomy (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    object_id TEXT NOT NULL,
    type TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    parent_id INTEGER NULL,
    path TEXT NULL,
    level_no INTEGER NULL,
    icon TEXT NULL,
    color TEXT NULL,
    sort_weight INTEGER NULL,
    visible INTEGER NULL,
    is_builtin INTEGER NULL,
    status INTEGER NOT NULL,
    metadata TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_model_taxonomy_code
ON plus_ai_model_taxonomy(tenant_id, organization_id, type, code);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_type
ON plus_ai_model_taxonomy(type);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_parent
ON plus_ai_model_taxonomy(parent_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_status
ON plus_ai_model_taxonomy(status);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_sort
ON plus_ai_model_taxonomy(sort_weight);

CREATE TABLE IF NOT EXISTS plus_ai_model_taxonomy_rel (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    object_id TEXT NOT NULL,
    model_id INTEGER NOT NULL,
    channel TEXT NULL,
    model_key TEXT NULL,
    taxonomy_id INTEGER NOT NULL,
    taxonomy_type TEXT NOT NULL,
    taxonomy_code TEXT NULL,
    relation_weight INTEGER NULL,
    is_primary_tag INTEGER NULL,
    metadata TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_model_taxonomy_rel
ON plus_ai_model_taxonomy_rel(tenant_id, organization_id, model_id, taxonomy_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_rel_model
ON plus_ai_model_taxonomy_rel(model_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_rel_taxonomy
ON plus_ai_model_taxonomy_rel(taxonomy_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_rel_type
ON plus_ai_model_taxonomy_rel(taxonomy_type);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_rel_channel_key
ON plus_ai_model_taxonomy_rel(channel, model_key);

CREATE INDEX IF NOT EXISTS idx_ai_model_taxonomy_rel_code
ON plus_ai_model_taxonomy_rel(taxonomy_code);

CREATE TABLE IF NOT EXISTS plus_ai_tenant_model_policy (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    object_id TEXT NOT NULL,
    policy_code TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id INTEGER NULL,
    channel TEXT NULL,
    model_id INTEGER NULL,
    model_key TEXT NULL,
    feature_code TEXT NULL,
    decision TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    priority INTEGER NOT NULL,
    qps_limit INTEGER NULL,
    concurrency_limit INTEGER NULL,
    daily_token_quota INTEGER NULL,
    monthly_token_quota INTEGER NULL,
    daily_request_quota INTEGER NULL,
    monthly_request_quota INTEGER NULL,
    effective_from TEXT NULL,
    effective_to TEXT NULL,
    reason TEXT NULL,
    status INTEGER NOT NULL,
    metadata TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_tenant_model_policy_code
ON plus_ai_tenant_model_policy(tenant_id, organization_id, policy_code);

CREATE INDEX IF NOT EXISTS idx_ai_tenant_model_policy_subject
ON plus_ai_tenant_model_policy(subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_ai_tenant_model_policy_model
ON plus_ai_tenant_model_policy(channel, model_key);

CREATE INDEX IF NOT EXISTS idx_ai_tenant_model_policy_feature
ON plus_ai_tenant_model_policy(feature_code);

CREATE INDEX IF NOT EXISTS idx_ai_tenant_model_policy_effective
ON plus_ai_tenant_model_policy(effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_ai_tenant_model_policy_priority
ON plus_ai_tenant_model_policy(enabled, priority);

CREATE INDEX IF NOT EXISTS idx_ai_tenant_model_policy_status
ON plus_ai_tenant_model_policy(status);

CREATE TABLE IF NOT EXISTS plus_ai_agent_tool_relation (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    agent_id INTEGER NOT NULL,
    tool_id INTEGER NOT NULL,
    sort_order INTEGER NULL,
    enabled INTEGER NOT NULL,
    actions TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_agent_tool
ON plus_ai_agent_tool_relation(agent_id, tool_id);

CREATE TABLE IF NOT EXISTS plus_ai_agent (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    face_image TEXT NULL,
    face_video TEXT NULL,
    owner INTEGER NULL,
    owner_id INTEGER NOT NULL,
    channel TEXT NULL,
    channel_id TEXT NULL,
    icon TEXT NULL,
    description TEXT NULL,
    tags TEXT NULL,
    type INTEGER NOT NULL,
    biz_type INTEGER NULL,
    biz_scope INTEGER NULL,
    status INTEGER NOT NULL,
    base_config TEXT NULL,
    knowledge_config TEXT NULL,
    memory_config TEXT NULL,
    speech_config TEXT NULL,
    tool_config TEXT NULL,
    scene TEXT NULL,
    chat_options TEXT NULL,
    members TEXT NULL,
    cate_id INTEGER NULL,
    prompt_id INTEGER NULL
);

CREATE INDEX IF NOT EXISTS uk_ai_agent_user_id_name
ON plus_ai_agent(tenant_id, organization_id, user_id, name);

CREATE TABLE IF NOT EXISTS plus_ai_prompt (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    biz_type TEXT NOT NULL,
    description TEXT NULL,
    cate_id INTEGER NULL,
    enabled INTEGER NOT NULL,
    sort INTEGER NULL,
    parameters TEXT NULL,
    creator TEXT NULL,
    model TEXT NULL,
    tags TEXT NULL,
    usage_count INTEGER NULL,
    avg_response_time INTEGER NULL,
    version TEXT NULL,
    is_public INTEGER NULL,
    is_favorite INTEGER NULL,
    favorite_count INTEGER NULL,
    last_used_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_cate_id
ON plus_ai_prompt(cate_id);

CREATE INDEX IF NOT EXISTS idx_prompt_type
ON plus_ai_prompt(type);

CREATE INDEX IF NOT EXISTS idx_prompt_biz_type
ON plus_ai_prompt(biz_type);

CREATE INDEX IF NOT EXISTS idx_prompt_enabled
ON plus_ai_prompt(enabled);

CREATE INDEX IF NOT EXISTS idx_prompt_model
ON plus_ai_prompt(model);

CREATE INDEX IF NOT EXISTS idx_prompt_created_at
ON plus_ai_prompt(created_at);

CREATE TABLE IF NOT EXISTS plus_ai_prompt_history (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    prompt_id INTEGER NULL,
    prompt_title TEXT NULL,
    prompt_content TEXT NULL,
    used_content TEXT NULL,
    response_content TEXT NULL,
    model TEXT NULL,
    duration INTEGER NULL,
    input_tokens INTEGER NULL,
    output_tokens INTEGER NULL,
    success INTEGER NOT NULL,
    error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_history_user_id
ON plus_ai_prompt_history(user_id);

CREATE INDEX IF NOT EXISTS idx_prompt_history_prompt_id
ON plus_ai_prompt_history(prompt_id);

CREATE INDEX IF NOT EXISTS idx_prompt_history_created_at
ON plus_ai_prompt_history(created_at);

CREATE TABLE IF NOT EXISTS plus_ai_tool (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    owner INTEGER NULL,
    owner_id INTEGER NOT NULL,
    tags TEXT NULL,
    export_mcp INTEGER NOT NULL,
    description TEXT NULL,
    type INTEGER NOT NULL,
    status INTEGER NOT NULL,
    enabled INTEGER NOT NULL,
    tool_definition TEXT NULL
);

CREATE TABLE IF NOT EXISTS plus_api_security_policy (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    policy_code TEXT NOT NULL,
    api_type TEXT NOT NULL,
    path_pattern TEXT NOT NULL,
    http_method TEXT NOT NULL,
    match_mode TEXT NOT NULL,
    auth_mode TEXT NOT NULL,
    allow_anonymous INTEGER NOT NULL,
    required_roles TEXT NULL,
    required_permissions TEXT NULL,
    priority INTEGER NOT NULL,
    enabled INTEGER NOT NULL,
    description TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_api_security_policy_policy_code
ON plus_api_security_policy(policy_code);

CREATE TABLE IF NOT EXISTS plus_category (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    parent_id INTEGER NULL,
    parent_uuid TEXT NULL,
    parent_metadata TEXT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    shop_id INTEGER NOT NULL,
    type INTEGER NOT NULL,
    group_name TEXT NULL,
    code TEXT NULL,
    tags TEXT NULL,
    icon TEXT NULL,
    sort_weight INTEGER NULL,
    path TEXT NULL,
    visible INTEGER NOT NULL,
    status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_category_shop_id
ON plus_category(shop_id);

CREATE INDEX IF NOT EXISTS idx_category_type_shop
ON plus_category(type, shop_id);

CREATE TABLE IF NOT EXISTS plus_attribute (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT NULL,
    type INTEGER NOT NULL,
    content_type INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    attribute_value TEXT NULL,
    sort_weight INTEGER NULL,
    required INTEGER NOT NULL,
    status INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_attribute_scope_code
ON plus_attribute(content_type, content_id, code);

CREATE INDEX IF NOT EXISTS idx_plus_attribute_category_status
ON plus_attribute(category_id, status);

CREATE INDEX IF NOT EXISTS idx_plus_attribute_content_scope
ON plus_attribute(content_type, content_id, status);

CREATE TABLE IF NOT EXISTS plus_tags (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NULL,
    type INTEGER NULL,
    description TEXT NULL
);

CREATE TABLE IF NOT EXISTS plus_memory (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NULL,
    agent_id INTEGER NULL,
    conversation_id INTEGER NULL,
    profile TEXT NULL
);

CREATE TABLE IF NOT EXISTS plus_memory_item (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    agent_id INTEGER NULL,
    conversation_id INTEGER NULL,
    name TEXT NULL,
    type INTEGER NULL,
    content TEXT NULL
);

CREATE TABLE IF NOT EXISTS plus_notification (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    role INTEGER NOT NULL,
    sender_id INTEGER NULL,
    sender TEXT NULL,
    receiver_id INTEGER NULL,
    receiver TEXT NULL,
    group_id INTEGER NULL,
    title TEXT NULL,
    content TEXT NULL,
    type INTEGER NOT NULL,
    channel_type INTEGER NOT NULL,
    template_id TEXT NULL,
    template_params TEXT NULL,
    redirect_url TEXT NULL,
    mini_program_path TEXT NULL,
    status INTEGER NOT NULL,
    sent_at TEXT NULL,
    read_at TEXT NULL,
    extra_data TEXT NULL,
    retry_count INTEGER NULL,
    max_retry_count INTEGER NULL,
    error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_receiver
ON plus_notification(receiver_id);

CREATE INDEX IF NOT EXISTS idx_notification_sender
ON plus_notification(sender_id);

CREATE INDEX IF NOT EXISTS idx_notification_group
ON plus_notification(group_id);

CREATE INDEX IF NOT EXISTS idx_notification_status
ON plus_notification(status);

CREATE INDEX IF NOT EXISTS idx_notification_type
ON plus_notification(type);

CREATE INDEX IF NOT EXISTS idx_notification_channel
ON plus_notification(channel_type);

CREATE INDEX IF NOT EXISTS idx_notification_tenant
ON plus_notification(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notification_org
ON plus_notification(organization_id);

CREATE INDEX IF NOT EXISTS idx_notification_created
ON plus_notification(created_at);

CREATE TABLE IF NOT EXISTS plus_notification_content (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    notification_id INTEGER NOT NULL,
    notification_uuid TEXT NOT NULL,
    role INTEGER NOT NULL,
    message_type INTEGER NOT NULL,
    status INTEGER NOT NULL,
    type INTEGER NOT NULL,
    channel_type INTEGER NOT NULL,
    body TEXT NOT NULL,
    sender_id INTEGER NULL,
    receiver_id INTEGER NULL,
    group_id INTEGER NULL,
    metadata TEXT NULL,
    summary TEXT NULL,
    priority INTEGER NOT NULL,
    expire_at TEXT NULL,
    is_muted INTEGER NOT NULL,
    read_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_content_notification
ON plus_notification_content(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_content_message_type
ON plus_notification_content(message_type);

CREATE INDEX IF NOT EXISTS idx_notification_content_status
ON plus_notification_content(status);

CREATE INDEX IF NOT EXISTS idx_notification_content_receiver
ON plus_notification_content(receiver_id);

CREATE INDEX IF NOT EXISTS idx_notification_content_group
ON plus_notification_content(group_id);

CREATE INDEX IF NOT EXISTS idx_notification_content_notification_type
ON plus_notification_content(type);

CREATE INDEX IF NOT EXISTS idx_notification_content_tenant
ON plus_notification_content(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notification_content_org
ON plus_notification_content(organization_id);

CREATE TABLE IF NOT EXISTS plus_push_device_endpoint (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    endpoint_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    workspace_id INTEGER NULL,
    installation_id TEXT NOT NULL,
    device_type TEXT NULL,
    platform TEXT NULL,
    vendor TEXT NULL,
    device_token TEXT NULL,
    permission_state TEXT NULL,
    status TEXT NOT NULL,
    device_name TEXT NULL,
    app_version TEXT NULL,
    os_version TEXT NULL,
    locale TEXT NULL,
    metadata TEXT NULL,
    active INTEGER NOT NULL,
    registered_at TEXT NULL,
    last_active_at TEXT NULL,
    disabled_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_push_device_endpoint_endpoint_id
ON plus_push_device_endpoint(endpoint_id);

CREATE INDEX IF NOT EXISTS idx_push_endpoint_user
ON plus_push_device_endpoint(user_id);

CREATE INDEX IF NOT EXISTS idx_push_endpoint_endpoint
ON plus_push_device_endpoint(endpoint_id);

CREATE INDEX IF NOT EXISTS idx_push_endpoint_installation
ON plus_push_device_endpoint(installation_id);

CREATE INDEX IF NOT EXISTS idx_push_endpoint_token
ON plus_push_device_endpoint(device_token);

CREATE INDEX IF NOT EXISTS idx_push_endpoint_status
ON plus_push_device_endpoint(status);

CREATE INDEX IF NOT EXISTS idx_push_endpoint_user_installation
ON plus_push_device_endpoint(user_id, installation_id);

CREATE TABLE IF NOT EXISTS plus_push_topic_subscription (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    endpoint_id TEXT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata TEXT NULL,
    subscribed_at TEXT NULL,
    unsubscribed_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_push_topic_subscription_user_topic_endpoint
ON plus_push_topic_subscription(user_id, topic, endpoint_id);

CREATE INDEX IF NOT EXISTS idx_push_topic_user
ON plus_push_topic_subscription(user_id);

CREATE INDEX IF NOT EXISTS idx_push_topic_endpoint
ON plus_push_topic_subscription(endpoint_id);

CREATE INDEX IF NOT EXISTS idx_push_topic_topic
ON plus_push_topic_subscription(topic);

CREATE INDEX IF NOT EXISTS idx_push_topic_status
ON plus_push_topic_subscription(status);

CREATE TABLE IF NOT EXISTS plus_conversation (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    title TEXT NULL,
    type INTEGER NULL,
    channel_id TEXT NULL,
    description TEXT NULL,
    knowledge_config TEXT NULL,
    memory_config TEXT NULL,
    status INTEGER NOT NULL,
    agent_id INTEGER NULL,
    agent_type INTEGER NULL,
    agent_biz_type INTEGER NULL,
    scene TEXT NULL,
    summary TEXT NULL,
    last_message_id INTEGER NULL,
    message_count INTEGER NOT NULL,
    unread_count INTEGER NOT NULL,
    tags TEXT NULL,
    content_type INTEGER NULL,
    content_id INTEGER NULL,
    system_context TEXT NULL,
    user_context TEXT NULL,
    last_interaction_time TEXT NULL,
    model_id INTEGER NULL,
    model TEXT NULL,
    knowledge_base_id INTEGER NULL,
    data_source_id INTEGER NULL,
    chat_options TEXT NULL,
    pinned INTEGER NULL,
    sort_order INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_conversation_user_id
ON plus_conversation(user_id);

CREATE INDEX IF NOT EXISTS idx_plus_conversation_agent_id
ON plus_conversation(agent_id);

CREATE INDEX IF NOT EXISTS idx_plus_conversation_status
ON plus_conversation(status);

CREATE INDEX IF NOT EXISTS idx_plus_conversation_channel_id
ON plus_conversation(channel_id);

CREATE INDEX IF NOT EXISTS idx_plus_conversation_user_sort
ON plus_conversation(user_id, pinned, sort_order, updated_at);

CREATE INDEX IF NOT EXISTS idx_plus_conversation_agent_user_updated_at
ON plus_conversation(agent_id, user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_plus_conversation_last_interaction_time
ON plus_conversation(last_interaction_time);

CREATE TABLE IF NOT EXISTS plus_chat_message (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    role INTEGER NOT NULL,
    sender_id INTEGER NULL,
    sender TEXT NULL,
    receiver_id INTEGER NULL,
    receiver TEXT NULL,
    group_id INTEGER NULL,
    type INTEGER NOT NULL,
    status INTEGER NOT NULL,
    conversation_type INTEGER NULL,
    conversation_id INTEGER NOT NULL,
    conversation_uuid TEXT NOT NULL,
    channel_id TEXT NULL,
    agent_id INTEGER NULL,
    knowledge_base_id INTEGER NULL,
    datasource_id INTEGER NULL,
    agent_type INTEGER NULL,
    agent_biz_type INTEGER NULL,
    user_id INTEGER NULL,
    channel_msg_id TEXT NOT NULL,
    channel_client_msg_id TEXT NOT NULL,
    channel_msg_seq INTEGER NULL,
    parent_message_id INTEGER NULL,
    token_count INTEGER NULL,
    send_at TEXT NULL,
    receive_at TEXT NULL,
    read_at TEXT NULL,
    processing_time INTEGER NULL,
    is_error INTEGER NULL,
    error_code TEXT NULL,
    error_message TEXT NULL,
    model_id INTEGER NULL,
    model TEXT NULL,
    temperature REAL NULL,
    used_rag INTEGER NULL,
    chat_options TEXT NULL,
    feedback_metadata TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_user_id
ON plus_chat_message(user_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_conversation_id
ON plus_chat_message(conversation_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_status
ON plus_chat_message(status);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_sender_id
ON plus_chat_message(sender_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_receiver_id
ON plus_chat_message(receiver_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_group_id
ON plus_chat_message(group_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_parent_message_id
ON plus_chat_message(parent_message_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_channel_msg_id
ON plus_chat_message(channel_msg_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_created_at
ON plus_chat_message(created_at);

CREATE TABLE IF NOT EXISTS plus_chat_message_content (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    message_id INTEGER NOT NULL,
    channel_msg_id TEXT NOT NULL,
    role INTEGER NOT NULL,
    type INTEGER NOT NULL,
    status INTEGER NOT NULL,
    conversation_id INTEGER NOT NULL,
    conversation_uuid TEXT NOT NULL,
    agent_id INTEGER NULL,
    agent_type INTEGER NOT NULL,
    agent_biz_type INTEGER NULL,
    content TEXT NOT NULL,
    metadata TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_chat_message_content_message_id
ON plus_chat_message_content(message_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_content_channel_msg_id
ON plus_chat_message_content(channel_msg_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_content_conversation_id
ON plus_chat_message_content(conversation_id);

CREATE INDEX IF NOT EXISTS idx_plus_chat_message_content_status
ON plus_chat_message_content(status);

CREATE TABLE IF NOT EXISTS plus_detail (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    content_type INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    content TEXT NULL,
    metadata TEXT NULL
);

CREATE TABLE IF NOT EXISTS plus_collection (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    parent_id INTEGER NULL,
    parent_uuid TEXT NULL,
    parent_metadata TEXT NULL,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    type INTEGER NOT NULL,
    content_id INTEGER NULL,
    cover_image TEXT NULL,
    is_public INTEGER NULL,
    is_pinned INTEGER NULL,
    sort INTEGER NULL,
    item_count INTEGER NULL,
    view_count INTEGER NULL,
    favorite_count INTEGER NULL,
    last_updated_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_collection_parent
ON plus_collection(parent_id);

CREATE INDEX IF NOT EXISTS idx_collection_type
ON plus_collection(type);

CREATE INDEX IF NOT EXISTS idx_collection_user
ON plus_collection(user_id);

CREATE INDEX IF NOT EXISTS idx_collection_content
ON plus_collection(content_id);

CREATE INDEX IF NOT EXISTS idx_collection_created
ON plus_collection(created_at);

CREATE TABLE IF NOT EXISTS plus_collection_item (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    collection_id INTEGER NOT NULL,
    collection_uuid TEXT NULL,
    type INTEGER NOT NULL,
    content_type INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    content_uuid TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    cover_image TEXT NULL,
    position INTEGER NOT NULL,
    is_pinned INTEGER NOT NULL,
    tags TEXT NULL,
    extra_data TEXT NULL,
    source TEXT NULL,
    remark TEXT NULL,
    added_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_coll_item_collection
ON plus_collection_item(collection_id);

CREATE INDEX IF NOT EXISTS idx_coll_item_content_type
ON plus_collection_item(content_type);

CREATE INDEX IF NOT EXISTS idx_coll_item_content_id
ON plus_collection_item(content_id);

CREATE INDEX IF NOT EXISTS idx_coll_item_position
ON plus_collection_item(position);

CREATE INDEX IF NOT EXISTS idx_coll_item_created
ON plus_collection_item(created_at);

CREATE TABLE IF NOT EXISTS plus_favorite (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    title TEXT NULL,
    image TEXT NULL,
    content_type INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    folder_id INTEGER NULL,
    remark TEXT NULL,
    tags TEXT NULL,
    sort_weight INTEGER NULL,
    is_private INTEGER NOT NULL,
    status INTEGER NOT NULL,
    view_count INTEGER NULL,
    last_viewed_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorite_user_content
ON plus_favorite(user_id, content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_favorite_user_id
ON plus_favorite(user_id);

CREATE INDEX IF NOT EXISTS idx_favorite_content
ON plus_favorite(content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_favorite_folder_id
ON plus_favorite(folder_id);

CREATE INDEX IF NOT EXISTS idx_favorite_created_at
ON plus_favorite(created_at);

CREATE TABLE IF NOT EXISTS plus_favorite_folder (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    parent_id INTEGER NULL,
    item_count INTEGER NULL,
    sort_order INTEGER NULL,
    status INTEGER NOT NULL,
    is_private INTEGER NOT NULL,
    is_default INTEGER NOT NULL,
    is_deleted INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_folder_user
ON plus_favorite_folder(user_id);

CREATE INDEX IF NOT EXISTS idx_folder_parent
ON plus_favorite_folder(parent_id);

CREATE TABLE IF NOT EXISTS plus_share (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    title TEXT NULL,
    description TEXT NULL,
    type TEXT NOT NULL,
    contents TEXT NULL,
    content_type TEXT NULL,
    status TEXT NOT NULL,
    share_url TEXT NULL,
    content_ids TEXT NULL,
    password TEXT NULL,
    expire_at TEXT NULL,
    click_count INTEGER NULL,
    tags TEXT NULL,
    share_code TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_share_share_code
ON plus_share(share_code);

CREATE TABLE IF NOT EXISTS plus_share_visit_record (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    share_id INTEGER NOT NULL,
    ip_address TEXT NULL,
    user_agent TEXT NULL,
    accessed_at TEXT NOT NULL,
    success INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_share_id
ON plus_share_visit_record(share_id);

CREATE INDEX IF NOT EXISTS idx_ip_address
ON plus_share_visit_record(ip_address);

CREATE INDEX IF NOT EXISTS idx_created_at
ON plus_share_visit_record(created_at);

CREATE TABLE IF NOT EXISTS plus_invitation_code (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    code TEXT NOT NULL,
    creator_user_id INTEGER NOT NULL,
    status INTEGER NOT NULL,
    expire_time TEXT NULL,
    usage_limit INTEGER NULL,
    used_count INTEGER NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_invitation_code_code
ON plus_invitation_code(code);

CREATE TABLE IF NOT EXISTS plus_invitation_relation (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    inviter_user_id INTEGER NOT NULL,
    invitee_user_id INTEGER NOT NULL,
    invite_code TEXT NOT NULL,
    used_time TEXT NOT NULL,
    relation_level INTEGER NOT NULL,
    reward_status INTEGER NOT NULL,
    reward_amount NUMERIC NULL,
    reward_type INTEGER NULL
);

CREATE TABLE IF NOT EXISTS plus_sns_follow_relation (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    relation_type INTEGER NOT NULL,
    owner INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    is_mutual INTEGER NOT NULL,
    is_blocked INTEGER NOT NULL,
    is_special INTEGER NOT NULL,
    group_name TEXT NULL,
    remark TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS UK_sns_follow_relation
ON plus_sns_follow_relation(follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_sns_follow_rel_follower_id
ON plus_sns_follow_relation(follower_id);

CREATE INDEX IF NOT EXISTS idx_sns_follow_rel_following_id
ON plus_sns_follow_relation(following_id);

CREATE INDEX IF NOT EXISTS idx_sns_follow_rel_relation_type
ON plus_sns_follow_relation(relation_type);

CREATE INDEX IF NOT EXISTS idx_sns_follow_rel_owner_id
ON plus_sns_follow_relation(owner_id);

CREATE INDEX IF NOT EXISTS idx_sns_follow_rel_is_mutual
ON plus_sns_follow_relation(is_mutual);

CREATE INDEX IF NOT EXISTS idx_sns_follow_rel_is_blocked
ON plus_sns_follow_relation(is_blocked);

CREATE INDEX IF NOT EXISTS idx_sns_follow_rel_is_special
ON plus_sns_follow_relation(is_special);

CREATE INDEX IF NOT EXISTS idx_sns_follow_rel_created_at
ON plus_sns_follow_relation(created_at);

CREATE TABLE IF NOT EXISTS plus_sns_follow_statistics (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    following_count INTEGER NOT NULL,
    follower_count INTEGER NOT NULL,
    mutual_count INTEGER NOT NULL,
    special_count INTEGER NOT NULL,
    blocked_count INTEGER NOT NULL,
    total_interaction_count INTEGER NOT NULL,
    last_updated_at INTEGER NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS UK_sns_follow_statistics
ON plus_sns_follow_statistics(user_id, owner_id);

CREATE INDEX IF NOT EXISTS idx_sns_follow_stat_user_id
ON plus_sns_follow_statistics(user_id);

CREATE INDEX IF NOT EXISTS idx_sns_follow_stat_owner_id
ON plus_sns_follow_statistics(owner_id);

CREATE INDEX IF NOT EXISTS idx_sns_follow_stat_following_count
ON plus_sns_follow_statistics(following_count);

CREATE INDEX IF NOT EXISTS idx_sns_follow_stat_follower_count
ON plus_sns_follow_statistics(follower_count);

CREATE INDEX IF NOT EXISTS idx_sns_follow_stat_mutual_count
ON plus_sns_follow_statistics(mutual_count);

CREATE TABLE IF NOT EXISTS plus_comments (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    parent_id INTEGER NULL,
    parent_uuid TEXT NULL,
    parent_metadata TEXT NULL,
    user_id INTEGER NULL,
    content TEXT NOT NULL,
    content_type INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    status INTEGER NOT NULL,
    likes INTEGER NULL,
    reply_count INTEGER NULL,
    is_top INTEGER NULL,
    ip_address TEXT NULL,
    device_info TEXT NULL,
    author TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_comment_content_id_type
ON plus_comments(content_id, content_type);

CREATE INDEX IF NOT EXISTS idx_comment_user_id
ON plus_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_comment_status
ON plus_comments(status);

CREATE INDEX IF NOT EXISTS idx_comment_parent_id
ON plus_comments(parent_id);

CREATE TABLE IF NOT EXISTS plus_content_vote (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    content_type INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    metadata TEXT NULL,
    source TEXT NULL,
    client_ip TEXT NULL,
    device_info TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vote_user_content
ON plus_content_vote(user_id, content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_vote_content
ON plus_content_vote(content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_vote_rating
ON plus_content_vote(rating);

CREATE INDEX IF NOT EXISTS idx_vote_created_at
ON plus_content_vote(created_at);

CREATE TABLE IF NOT EXISTS plus_visit_history (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    content_type INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    visit_count INTEGER NULL,
    last_visited_at TEXT NOT NULL,
    duration INTEGER NULL,
    source TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_visit_user_content
ON plus_visit_history(user_id, content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_visit_user_id
ON plus_visit_history(user_id);

CREATE INDEX IF NOT EXISTS idx_visit_content_type
ON plus_visit_history(content_type);

CREATE INDEX IF NOT EXISTS idx_visit_created_at
ON plus_visit_history(created_at);

CREATE TABLE IF NOT EXISTS plus_feeds (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    title TEXT NOT NULL,
    summary TEXT NULL,
    category_id INTEGER NOT NULL,
    content_type INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    cover_images TEXT NULL,
    resource_list TEXT NULL,
    author TEXT NULL,
    source TEXT NULL,
    source_url TEXT NULL,
    publish_time TEXT NULL,
    tags TEXT NULL,
    status INTEGER NOT NULL,
    view_count INTEGER NULL,
    like_count INTEGER NULL,
    comment_count INTEGER NULL,
    share_count INTEGER NULL,
    favorite_count INTEGER NULL,
    is_top INTEGER NULL,
    is_hot INTEGER NULL,
    is_recommended INTEGER NULL,
    sort_order INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_feeds_status
ON plus_feeds(status);

CREATE INDEX IF NOT EXISTS idx_feeds_user_id
ON plus_feeds(user_id);

CREATE INDEX IF NOT EXISTS idx_feeds_category_id
ON plus_feeds(category_id);

CREATE INDEX IF NOT EXISTS idx_feeds_content_type
ON plus_feeds(content_type);

CREATE INDEX IF NOT EXISTS idx_feeds_publish_time
ON plus_feeds(publish_time);

CREATE INDEX IF NOT EXISTS idx_feeds_status_publish_time
ON plus_feeds(status, publish_time);

CREATE TABLE IF NOT EXISTS plus_short_url (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    original_url TEXT NOT NULL,
    short_code TEXT NOT NULL,
    expires_at TEXT NULL,
    click_count INTEGER NOT NULL,
    status INTEGER NOT NULL,
    created_by INTEGER NULL,
    description TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_short_url_short_code
ON plus_short_url(short_code);

CREATE TABLE IF NOT EXISTS plus_feedback (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    title TEXT NOT NULL,
    feedback_content TEXT NOT NULL,
    feedback_type INTEGER NOT NULL,
    status INTEGER NOT NULL,
    priority INTEGER NULL,
    biz_id INTEGER NULL,
    biz_type TEXT NULL,
    rating INTEGER NULL,
    contact_info TEXT NULL,
    attachments TEXT NULL,
    images TEXT NULL,
    reply_content TEXT NULL,
    reply_time TEXT NULL,
    reply_user_id INTEGER NULL,
    resolved_at TEXT NULL,
    closed_at TEXT NULL,
    closed_by INTEGER NULL,
    close_reason TEXT NULL,
    follow_up_count INTEGER NULL,
    last_follow_up_time TEXT NULL,
    assigned_to INTEGER NULL,
    assigned_at TEXT NULL,
    tags TEXT NULL,
    source TEXT NULL,
    device_info TEXT NULL,
    app_version TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id
ON plus_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_status
ON plus_feedback(status);

CREATE INDEX IF NOT EXISTS idx_feedback_type
ON plus_feedback(feedback_type);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
ON plus_feedback(created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created
ON plus_feedback(status, created_at);

CREATE TABLE IF NOT EXISTS plus_email_message (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    folder TEXT NOT NULL,
    direction TEXT NOT NULL,
    external_message_id TEXT NOT NULL,
    from_address TEXT NULL,
    to_addresses TEXT NULL,
    cc_addresses TEXT NULL,
    bcc_addresses TEXT NULL,
    subject TEXT NULL,
    content TEXT NULL,
    content_type TEXT NULL,
    is_read INTEGER NOT NULL,
    sent_at TEXT NULL,
    received_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_email_message_user_external
ON plus_email_message(user_id, external_message_id);

CREATE INDEX IF NOT EXISTS idx_plus_email_message_user_created
ON plus_email_message(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_plus_email_message_user_folder
ON plus_email_message(user_id, folder);

CREATE INDEX IF NOT EXISTS idx_plus_email_message_user_read
ON plus_email_message(user_id, is_read);

CREATE TABLE IF NOT EXISTS plus_events (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    event_type TEXT NULL,
    source TEXT NULL,
    target TEXT NULL,
    payload TEXT NULL,
    occurred_at TEXT NULL,
    is_processed INTEGER NOT NULL,
    processed_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS plus_disk (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    type INTEGER NOT NULL,
    owner INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    knowledge_base_id INTEGER NULL,
    disk_size INTEGER NOT NULL,
    used_size INTEGER NOT NULL,
    description TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_disk_name
ON plus_disk(name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plus_disk_owner_id2
ON plus_disk(owner, owner_id, type);

CREATE INDEX IF NOT EXISTS idx_plus_disk_name
ON plus_disk(name);

CREATE INDEX IF NOT EXISTS idx_plus_disk_owner_id
ON plus_disk(owner_id);

CREATE INDEX IF NOT EXISTS idx_plus_disk_knowledge_base_id
ON plus_disk(knowledge_base_id);

CREATE TABLE IF NOT EXISTS plus_disk_member (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    disk_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission TEXT NOT NULL,
    remark TEXT NULL,
    is_owner INTEGER NOT NULL,
    knowledge_base_id INTEGER NULL,
    pinned_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disk_member_disk_user
ON plus_disk_member(disk_id, user_id);

CREATE INDEX IF NOT EXISTS idx_disk_member_disk_id
ON plus_disk_member(disk_id);

CREATE INDEX IF NOT EXISTS idx_disk_member_user_id
ON plus_disk_member(user_id);

CREATE INDEX IF NOT EXISTS idx_disk_member_pinned_at
ON plus_disk_member(pinned_at);

CREATE INDEX IF NOT EXISTS idx_disk_member_knowledge_base_id
ON plus_disk_member(knowledge_base_id);

CREATE TABLE IF NOT EXISTS plus_file (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    type INTEGER NOT NULL,
    disk_id INTEGER NOT NULL,
    size INTEGER NULL,
    content_type INTEGER NULL,
    content_id INTEGER NULL,
    extension TEXT NULL,
    etag TEXT NULL,
    biz_type INTEGER NULL,
    biz_id INTEGER NULL,
    asset_type TEXT NULL,
    workspace_id INTEGER NULL,
    workspace_uuid TEXT NULL,
    project_uuid TEXT NULL,
    project_type INTEGER NULL,
    project_id INTEGER NULL,
    channel TEXT NOT NULL,
    generation_type INTEGER NOT NULL,
    generation_id INTEGER NULL,
    prompt_uuid TEXT NULL,
    owner TEXT NULL,
    owner_id INTEGER NULL,
    author TEXT NULL,
    channel_config_id INTEGER NULL,
    bucket TEXT NOT NULL,
    path TEXT NULL,
    relative_path TEXT NULL,
    object_key TEXT NULL,
    storage_class INTEGER NULL,
    version TEXT NULL,
    resource TEXT NULL,
    last_modified TEXT NULL,
    upload_time TEXT NULL,
    last_access_time TEXT NULL,
    is_upload_temp INTEGER NOT NULL,
    expire_at TEXT NULL,
    description TEXT NULL,
    tags TEXT NULL,
    file_category INTEGER NULL,
    access_scope INTEGER NOT NULL,
    status INTEGER NOT NULL,
    upload_status INTEGER NOT NULL,
    parent_id INTEGER NULL,
    parent_metadata TEXT NULL,
    parent_uuid TEXT NULL,
    metadata TEXT NULL,
    permission TEXT NOT NULL,
    reference_file_id INTEGER NULL,
    mime_type TEXT NULL,
    cover_image TEXT NULL,
    password TEXT NULL,
    remark TEXT NULL,
    sort_order INTEGER NULL,
    pinned_at TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_disk_parent_path
ON plus_file(disk_id, parent_id, path);

CREATE INDEX IF NOT EXISTS idx_file_name
ON plus_file(name);

CREATE INDEX IF NOT EXISTS idx_file_object_key
ON plus_file(object_key);

CREATE INDEX IF NOT EXISTS idx_file_project_uuid
ON plus_file(project_uuid);

CREATE INDEX IF NOT EXISTS idx_file_access_scope
ON plus_file(access_scope);

CREATE INDEX IF NOT EXISTS idx_file_prompt_uuid
ON plus_file(prompt_uuid);

CREATE INDEX IF NOT EXISTS idx_file_user_id
ON plus_file(user_id);

CREATE TABLE IF NOT EXISTS plus_file_content (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    file_id INTEGER NOT NULL,
    file_uuid TEXT NOT NULL,
    file_version TEXT NOT NULL,
    prompt TEXT NULL,
    thinking_content TEXT NULL,
    encoding TEXT NULL,
    content TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_plus_file_content_file_id
ON plus_file_content(file_id, file_version);

CREATE INDEX IF NOT EXISTS idx_plus_file_content_file_uuid
ON plus_file_content(file_uuid, file_version);

CREATE TABLE IF NOT EXISTS plus_file_part (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    file_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    total_size INTEGER NOT NULL,
    checksum TEXT NULL,
    status INTEGER NOT NULL,
    storage_path TEXT NULL
);

CREATE TABLE IF NOT EXISTS plus_oss_bucket (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    name TEXT NOT NULL,
    region TEXT NULL,
    channel INTEGER NULL,
    channel_config_id INTEGER NULL,
    description TEXT NULL,
    status TEXT NULL,
    creation_date TEXT NULL,
    arn TEXT NULL,
    endpoint TEXT NULL,
    storage_class TEXT NULL,
    versioning_enabled INTEGER NULL,
    encryption_enabled INTEGER NULL,
    encryption_type TEXT NULL,
    acl TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_oss_bucket_name
ON plus_oss_bucket(name);

CREATE INDEX IF NOT EXISTS idx_oss_bucket_user_id
ON plus_oss_bucket(user_id);

CREATE INDEX IF NOT EXISTS idx_oss_bucket_region
ON plus_oss_bucket(region);

CREATE TABLE IF NOT EXISTS plus_order (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    subject TEXT NOT NULL,
    order_type INTEGER NOT NULL,
    owner INTEGER NULL,
    owner_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    order_sn TEXT NOT NULL UNIQUE,
    transaction_id TEXT NULL,
    out_trade_no TEXT NOT NULL UNIQUE,
    total_amount NUMERIC NOT NULL,
    paid_amount NUMERIC NOT NULL,
    paid_points_amount INTEGER NULL,
    status INTEGER NOT NULL,
    pay_success_time TEXT NULL,
    expire_time TEXT NULL,
    task_code TEXT NULL,
    dispatch_mode INTEGER NULL,
    dispatch_status INTEGER NULL,
    worker_user_id INTEGER NULL,
    dispatcher_user_id INTEGER NULL,
    accepted_time TEXT NULL,
    service_start_time TEXT NULL,
    dispatch_expire_time TEXT NULL,
    task_payload TEXT NULL,
    content_type INTEGER NULL,
    content_id INTEGER NULL,
    category_id INTEGER NOT NULL,
    pay_objects TEXT NULL,
    deliver_info TEXT NULL,
    coupon_info TEXT NULL,
    buyer_info TEXT NULL,
    seller_info TEXT NULL,
    complete_time TEXT NULL,
    cancel_time TEXT NULL,
    remark TEXT NULL,
    product_amount NUMERIC NULL,
    shipping_amount NUMERIC NULL,
    discount_amount NUMERIC NULL,
    tax_amount NUMERIC NULL,
    refunded_amount NUMERIC NULL,
    currency TEXT NULL,
    client_info TEXT NULL,
    payment_method TEXT NULL,
    source_channel TEXT NULL,
    merchant_remark TEXT NULL,
    payment_expire_time TEXT NULL,
    refund_status INTEGER NULL,
    product_image TEXT NULL,
    payment_provider INTEGER NULL,
    payment_product_type TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_order_item (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    order_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    product_type TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    sku_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    expire_time TEXT NULL,
    content_type INTEGER NULL,
    content_id INTEGER NULL,
    product_name TEXT NULL,
    sku_spec TEXT NULL,
    buyer_info TEXT NULL,
    seller_info TEXT NULL,
    discount_amount NUMERIC NULL,
    paid_amount NUMERIC NULL,
    refunded_amount NUMERIC NULL,
    currency TEXT NULL,
    product_image TEXT NULL,
    refund_status INTEGER NULL,
    review_status INTEGER NULL,
    payment_provider INTEGER NULL,
    payment_product_type TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_payment (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    subject TEXT NULL,
    purpose TEXT NOT NULL,
    order_id INTEGER NOT NULL,
    transaction_id TEXT NULL,
    out_trade_no TEXT NOT NULL UNIQUE,
    channel INTEGER NOT NULL,
    provider INTEGER NOT NULL,
    product_type TEXT NULL,
    status INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    expire_time TEXT NULL,
    success_time TEXT NULL,
    remark TEXT NULL,
    content_type INTEGER NULL,
    content_id INTEGER NULL,
    pay_objects TEXT NULL,
    metadata TEXT NULL,
    client_info TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_refund (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    order_id INTEGER NOT NULL,
    payment_id INTEGER NOT NULL,
    out_refund_no TEXT NOT NULL UNIQUE,
    out_trade_no TEXT NULL,
    refund_id TEXT NULL,
    amount NUMERIC NOT NULL,
    channel INTEGER NULL,
    provider INTEGER NULL,
    product_type TEXT NULL,
    type TEXT NOT NULL,
    status INTEGER NOT NULL,
    apply_time TEXT NOT NULL,
    complete_time TEXT NULL,
    remark TEXT NULL,
    content_type INTEGER NULL,
    content_id INTEGER NULL,
    operator_id INTEGER NULL,
    metadata TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_shopping_cart (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    owner INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    name TEXT NULL,
    description TEXT NULL,
    group_list TEXT NULL,
    status INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_shopping_cart_item (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    cart_id INTEGER NOT NULL,
    cart_group_uuid TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    sku_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    is_selected INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (cart_id, sku_id)
);

CREATE TABLE IF NOT EXISTS plus_payment_webhook_event (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    provider INTEGER NOT NULL,
    event_id TEXT NOT NULL,
    nonce TEXT NOT NULL,
    signature TEXT NULL,
    request_timestamp INTEGER NULL,
    out_trade_no TEXT NULL,
    transaction_id TEXT NULL,
    payload_digest TEXT NULL,
    status TEXT NOT NULL,
    processed_at TEXT NULL,
    message TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (provider, event_id),
    UNIQUE (provider, nonce)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_out_trade_no
ON plus_payment_webhook_event(out_trade_no);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_created_at
ON plus_payment_webhook_event(created_at);

CREATE TABLE IF NOT EXISTS plus_order_dispatch_rule (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    task_code TEXT NOT NULL UNIQUE,
    task_name TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    allow_grab INTEGER NOT NULL,
    allow_assign INTEGER NOT NULL,
    default_task_concurrent_limit INTEGER NOT NULL,
    metadata TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_dispatch_rule_task_code
ON plus_order_dispatch_rule(task_code);

CREATE INDEX IF NOT EXISTS idx_order_dispatch_rule_enabled
ON plus_order_dispatch_rule(enabled);

CREATE TABLE IF NOT EXISTS plus_order_worker_dispatch_profile (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL UNIQUE,
    rating_level TEXT NULL,
    enabled INTEGER NOT NULL,
    global_max_in_progress INTEGER NOT NULL,
    metadata TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_worker_dispatch_profile_user_id
ON plus_order_worker_dispatch_profile(user_id);

CREATE INDEX IF NOT EXISTS idx_order_worker_dispatch_profile_enabled
ON plus_order_worker_dispatch_profile(enabled);

CREATE INDEX IF NOT EXISTS idx_order_worker_dispatch_profile_rating_level
ON plus_order_worker_dispatch_profile(rating_level);

CREATE TABLE IF NOT EXISTS plus_vip_user (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL UNIQUE,
    vip_level_id INTEGER NULL,
    status TEXT NOT NULL,
    point_balance INTEGER NOT NULL DEFAULT 0,
    total_recharged_points INTEGER NOT NULL DEFAULT 0,
    valid_from TEXT NULL,
    valid_to TEXT NULL,
    last_active_time TEXT NULL,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_account (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    account_type TEXT NOT NULL,
    owner TEXT NULL,
    owner_id INTEGER NOT NULL,
    available_balance NUMERIC NOT NULL DEFAULT 0,
    frozen_balance NUMERIC NOT NULL DEFAULT 0,
    available_points INTEGER NOT NULL DEFAULT 0,
    frozen_points INTEGER NOT NULL DEFAULT 0,
    token_balance INTEGER NOT NULL DEFAULT 0,
    frozen_token INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, organization_id, user_id, account_type)
);

CREATE TABLE IF NOT EXISTS plus_account_history (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    account_id INTEGER NOT NULL,
    transaction_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    amount NUMERIC NULL,
    balance_before NUMERIC NULL,
    balance_after NUMERIC NULL,
    related_account_id INTEGER NULL,
    points_change INTEGER NULL,
    points_before INTEGER NULL,
    points_after INTEGER NULL,
    token_change INTEGER NULL,
    token_before INTEGER NULL,
    token_after INTEGER NULL,
    source_type TEXT NULL,
    source_id TEXT NULL,
    expired_at TEXT NULL,
    status TEXT NOT NULL,
    usage_result TEXT NOT NULL,
    remarks TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_account_history_account_id
ON plus_account_history(account_id);

CREATE INDEX IF NOT EXISTS idx_account_history_transaction_id
ON plus_account_history(transaction_id);

CREATE INDEX IF NOT EXISTS idx_account_history_source_id
ON plus_account_history(source_id);

CREATE TABLE IF NOT EXISTS plus_account_exchange_config (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    config_key TEXT NOT NULL,
    config_value NUMERIC NOT NULL,
    remarks TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, organization_id, config_key)
);

CREATE TABLE IF NOT EXISTS plus_ledger_bridge (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    bridge_type TEXT NOT NULL,
    source_ledger TEXT NOT NULL,
    target_ledger TEXT NOT NULL,
    bridge_amount NUMERIC NOT NULL,
    source_business_type TEXT NOT NULL,
    source_business_id TEXT NOT NULL,
    source_record_key TEXT NULL,
    target_record_key TEXT NULL,
    compensation_record_key TEXT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT NULL,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_level (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    level_value INTEGER NOT NULL,
    required_points INTEGER NOT NULL DEFAULT 0,
    description TEXT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_benefit (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT NULL,
    benefit_key TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_level_benefit (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    vip_level_id INTEGER NOT NULL,
    benefit_id INTEGER NOT NULL,
    daily_limit INTEGER NULL,
    monthly_limit INTEGER NULL,
    total_limit INTEGER NULL,
    status TEXT NOT NULL,
    metadata TEXT NULL,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_pack_group (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    app_id INTEGER NULL,
    scope_type TEXT NOT NULL,
    scope_id INTEGER NOT NULL,
    group_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    sort_weight INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    remark TEXT NULL,
    packs TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_pack (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    app_id INTEGER NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    group_id INTEGER NULL,
    vip_level_id INTEGER NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    point_amount INTEGER NOT NULL DEFAULT 0,
    vip_duration_days INTEGER NOT NULL DEFAULT 0,
    billing_cycle TEXT NULL,
    status TEXT NOT NULL,
    sort_weight INTEGER NOT NULL DEFAULT 0,
    valid_from TEXT NULL,
    valid_to TEXT NULL,
    remark TEXT NULL,
    recharge_pack_id INTEGER NULL,
    point_reward_config TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_recharge_method (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT NULL,
    method_key TEXT NOT NULL,
    status TEXT NOT NULL,
    sort_weight INTEGER NOT NULL DEFAULT 0,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_recharge_pack (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    app_id INTEGER NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    point_amount INTEGER NOT NULL DEFAULT 0,
    vip_duration_days INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    sort_weight INTEGER NOT NULL DEFAULT 0,
    valid_from TEXT NULL,
    valid_to TEXT NULL,
    remark TEXT NULL,
    recharge_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_recharge (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    vip_level_id INTEGER NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    point_amount INTEGER NOT NULL DEFAULT 0,
    recharge_type TEXT NOT NULL,
    recharge_time TEXT NOT NULL,
    transaction_no TEXT NOT NULL,
    status TEXT NOT NULL,
    remark TEXT NULL,
    recharge_method_id INTEGER NULL,
    recharge_pack_id INTEGER NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_point_change (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    change_type TEXT NOT NULL,
    change_amount INTEGER NOT NULL,
    before_balance INTEGER NOT NULL,
    after_balance INTEGER NOT NULL,
    source_id INTEGER NULL,
    source_type TEXT NULL,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_vip_benefit_usage (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL,
    benefit_type TEXT NOT NULL,
    usage_time TEXT NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    source_id INTEGER NULL,
    source_type TEXT NULL,
    remark TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plus_user_auth_session (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
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
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
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
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
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
const DEFAULT_LOCAL_ORGANIZATION_ID: &str = "0";
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
struct VipUserRecord {
    created_at: String,
    last_active_time: Option<String>,
    organization_id: Option<String>,
    point_balance: i64,
    remark: Option<String>,
    status: String,
    tenant_id: Option<String>,
    total_recharged_points: i64,
    updated_at: String,
    user_id: String,
    valid_from: Option<String>,
    valid_to: Option<String>,
    vip_level_id: Option<String>,
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
    pub vip_level_id: Option<String>,
    pub point_balance: Option<String>,
    pub total_recharged_points: Option<String>,
    pub status: Option<String>,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub last_active_time: Option<String>,
    pub remark: Option<String>,
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
    pub user_id: String,
    pub vip_level_id: Option<String>,
    pub point_balance: String,
    pub total_recharged_points: String,
    pub status: String,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub last_active_time: Option<String>,
    pub remark: Option<String>,
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
    let default_tenant_name = "BirdCoder Local Tenant";
    let default_tenant_description =
        "Default local tenant aligned with spring-ai-plus style multi-tenant storage.";
    let default_tenant_type = "PLATFORM";
    let default_tenant_secret_key = "birdcoder-local-tenant-secret";
    let default_token_expiration_ms: i64 = 7 * 24 * 60 * 60 * 1000;
    let default_refresh_token_expiration_ms: i64 = 30 * 24 * 60 * 60 * 1000;
    let canonical_default_id_exists: i64 = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM plus_tenant WHERE CAST(id AS TEXT) = ?1)",
            params![DEFAULT_LOCAL_TENANT_ID],
            |row| row.get(0),
        )
        .map_err(|error| format!("probe canonical default plus_tenant failed: {error}"))?;
    if canonical_default_id_exists > 0 {
        let transaction = connection.transaction().map_err(|error| {
            format!("open default plus_tenant canonicalization failed: {error}")
        })?;
        transaction
            .execute(
                r#"
                UPDATE plus_tenant
                SET
                    code = ?1 || '-superseded-' || rowid,
                    status = 'inactive',
                    updated_at = ?2,
                    is_deleted = 1
                WHERE code = ?1 COLLATE NOCASE
                    AND CAST(id AS TEXT) <> ?3
                "#,
                params![DEFAULT_LOCAL_TENANT_CODE, &now, DEFAULT_LOCAL_TENANT_ID],
            )
            .map_err(|error| {
                format!("release duplicate default plus_tenant code failed: {error}")
            })?;
        let updated_canonical_default = transaction
            .execute(
                r#"
                UPDATE plus_tenant
                SET
                    code = ?1,
                    name = ?2,
                    description = ?3,
                    type = ?4,
                    jwt_secret_key = CASE
                        WHEN jwt_secret_key IS NULL OR jwt_secret_key = '' THEN ?5
                        ELSE jwt_secret_key
                    END,
                    token_expiration_ms = COALESCE(token_expiration_ms, ?6),
                    refresh_token_expiration_ms = COALESCE(refresh_token_expiration_ms, ?7),
                    status = 'active',
                    updated_at = ?8,
                    is_deleted = 0
                WHERE CAST(id AS TEXT) = ?9
                "#,
                params![
                    DEFAULT_LOCAL_TENANT_CODE,
                    default_tenant_name,
                    default_tenant_description,
                    default_tenant_type,
                    default_tenant_secret_key,
                    default_token_expiration_ms,
                    default_refresh_token_expiration_ms,
                    &now,
                    DEFAULT_LOCAL_TENANT_ID,
                ],
            )
            .map_err(|error| format!("canonicalize default plus_tenant failed: {error}"))?;
        transaction.commit().map_err(|error| {
            format!("commit default plus_tenant canonicalization failed: {error}")
        })?;
        if updated_canonical_default > 0 {
            return Ok(());
        }
    }

    let updated_existing_default_code = connection
        .execute(
            r#"
            UPDATE plus_tenant
            SET
                code = ?1,
                name = ?2,
                description = ?3,
                type = ?4,
                jwt_secret_key = CASE
                    WHEN jwt_secret_key IS NULL OR jwt_secret_key = '' THEN ?5
                    ELSE jwt_secret_key
                END,
                token_expiration_ms = COALESCE(token_expiration_ms, ?6),
                refresh_token_expiration_ms = COALESCE(refresh_token_expiration_ms, ?7),
                status = 'active',
                updated_at = ?8,
                is_deleted = 0
            WHERE rowid = (
                SELECT rowid
                FROM plus_tenant
                WHERE code = ?1 COLLATE NOCASE
                ORDER BY
                    CASE WHEN code = ?1 THEN 0 ELSE 1 END,
                    CASE WHEN is_deleted = 0 THEN 0 ELSE 1 END,
                    updated_at DESC,
                    rowid ASC
                LIMIT 1
            )
            "#,
            params![
                DEFAULT_LOCAL_TENANT_CODE,
                default_tenant_name,
                default_tenant_description,
                default_tenant_type,
                default_tenant_secret_key,
                default_token_expiration_ms,
                default_refresh_token_expiration_ms,
                &now,
            ],
        )
        .map_err(|error| format!("ensure default plus_tenant failed: {error}"))?;
    if updated_existing_default_code > 0 {
        return Ok(());
    }

    connection
        .execute(
            r#"
            INSERT INTO plus_tenant (
                id, uuid, created_at, updated_at, version, name, code, type, biz_type, biz_id,
                jwt_secret_key, token_expiration_ms, refresh_token_expiration_ms, status,
                description, admin_user_id, install_app_list, expire_time, metadata,
                contact_person, contact_phone, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, NULL, NULL,
                ?8, ?9, ?10, 'active', ?11, NULL, NULL, NULL, NULL,
                NULL, NULL, 0
            )
            ON CONFLICT(id) DO UPDATE SET
                uuid = COALESCE(NULLIF(plus_tenant.uuid, ''), excluded.uuid),
                code = excluded.code,
                name = excluded.name,
                type = excluded.type,
                jwt_secret_key = COALESCE(NULLIF(plus_tenant.jwt_secret_key, ''), excluded.jwt_secret_key),
                token_expiration_ms = COALESCE(plus_tenant.token_expiration_ms, excluded.token_expiration_ms),
                refresh_token_expiration_ms = COALESCE(plus_tenant.refresh_token_expiration_ms, excluded.refresh_token_expiration_ms),
                description = excluded.description,
                status = 'active',
                updated_at = excluded.updated_at,
                is_deleted = 0
            "#,
            params![
                DEFAULT_LOCAL_TENANT_ID,
                stable_entity_uuid("plus_tenant", DEFAULT_LOCAL_TENANT_ID),
                &now,
                &now,
                default_tenant_name,
                DEFAULT_LOCAL_TENANT_CODE,
                default_tenant_type,
                default_tenant_secret_key,
                default_token_expiration_ms,
                default_refresh_token_expiration_ms,
                default_tenant_description,
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
                sqlite_row_optional_string_value(row, 3, &format!("{table_name}.organization_id"))
                    .map_err(|error| {
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
        let resolved_organization_id = resolve_local_organization_id(organization_id.as_deref());
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
                sqlite_row_optional_string_value(row, 3, &format!("{table_name}.organization_id"))
                    .map_err(|error| {
                        format!("read {table_name} organization_id failed: {error}")
                    })?,
                sqlite_row_optional_string_value(row, 4, &format!("{table_name}.parent_tenant_id"))
                    .map_err(|error| {
                        format!("read {table_name} parent tenant_id failed: {error}")
                    })?,
                sqlite_row_optional_string_value(
                    row,
                    5,
                    &format!("{table_name}.parent_organization_id"),
                )
                .map_err(|error| {
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
            .or_else(|| normalize_optional_text(parent_organization_id.as_deref()))
            .unwrap_or_else(|| DEFAULT_LOCAL_ORGANIZATION_ID.to_owned());
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
                sqlite_row_optional_string_value(row, 2, "plus_user_login_qr.tenant_id").map_err(
                    |error| format!("read plus_user_login_qr tenant_id failed: {error}"),
                )?,
                sqlite_row_optional_string_value(row, 3, "plus_user_login_qr.organization_id")
                    .map_err(|error| {
                        format!("read plus_user_login_qr organization_id failed: {error}")
                    })?,
                sqlite_row_optional_string_value(row, 4, "plus_user_login_qr.parent_tenant_id")
                    .map_err(|error| {
                        format!("read plus_user_login_qr parent tenant_id failed: {error}")
                    })?,
                sqlite_row_optional_string_value(
                    row,
                    5,
                    "plus_user_login_qr.parent_organization_id",
                )
                .map_err(|error| {
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
            .or_else(|| normalize_optional_text(user_organization_id.as_deref()))
            .unwrap_or_else(|| DEFAULT_LOCAL_ORGANIZATION_ID.to_owned());
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

const USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES: &[(&str, &[(&str, bool)])] = &[
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
    (
        "plus_user_verify_code",
        &[("id", false), ("tenant_id", true)],
    ),
    (
        "plus_user_login_qr",
        &[
            ("id", false),
            ("tenant_id", true),
            ("session_id", true),
            ("user_id", true),
        ],
    ),
    (
        "plus_organization",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("parent_id", true),
        ],
    ),
    (
        "plus_organization_member",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("owner_id", false),
        ],
    ),
    (
        "plus_member_relations",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("parent_id", true),
            ("member_id", false),
            ("owner_id", false),
            ("target_id", false),
        ],
    ),
    (
        "plus_department",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("parent_id", true),
            ("owner_id", false),
            ("manager_id", true),
        ],
    ),
    (
        "plus_position",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("parent_id", true),
            ("owner_id", false),
        ],
    ),
    (
        "plus_role",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_permission",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_role_permission",
        &[
            ("id", false),
            ("role_id", false),
            ("permission_id", false),
            ("operator_id", true),
        ],
    ),
    (
        "plus_user_role",
        &[
            ("id", true),
            ("user_id", false),
            ("role_id", false),
            ("operator_id", true),
        ],
    ),
    (
        "plus_card",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("card_organization_id", true),
        ],
    ),
    (
        "plus_user_card",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("card_id", true),
        ],
    ),
    (
        "plus_member_card",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("card_id", true),
        ],
    ),
    (
        "plus_member_level",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("card_id", true),
            ("required_points", true),
        ],
    ),
    (
        "plus_card_template",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_coupon",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("point_cost", true),
        ],
    ),
    (
        "plus_coupon_template",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_user_coupon",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("coupon_id", false),
            ("point_cost", true),
            ("order_id", true),
        ],
    ),
    (
        "plus_product",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("category_id", false),
        ],
    ),
    (
        "plus_sku",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("product_id", false),
        ],
    ),
    (
        "plus_currency",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_exchange_rate",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("base_currency_id", false),
            ("target_currency_id", false),
        ],
    ),
    (
        "plus_agent_skill_package",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("category_id", true),
        ],
    ),
    (
        "plus_agent_skill",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("category_id", true),
            ("package_id", true),
            ("reviewed_by", true),
        ],
    ),
    (
        "plus_user_agent_skill",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("skill_id", false),
        ],
    ),
    (
        "plus_agent_plugin",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_datasource",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("project_id", false),
        ],
    ),
    (
        "plus_schema",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("datasource_id", false),
        ],
    ),
    (
        "plus_table",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("schema_id", false),
        ],
    ),
    (
        "plus_column",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("table_id", false),
        ],
    ),
    (
        "plus_ai_generation",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("conversation_id", true),
            ("message_id", true),
            ("parent_id", true),
            ("biz_id", true),
        ],
    ),
    (
        "plus_ai_generation_content",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("generation_id", false),
            ("content_id", true),
            ("seed", true),
            ("file_size", true),
        ],
    ),
    (
        "plus_ai_generation_style",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
        ],
    ),
    (
        "plus_channel",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
        ],
    ),
    (
        "plus_channel_account",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
        ],
    ),
    (
        "plus_channel_proxy",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
        ],
    ),
    (
        "plus_channel_resource",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("channel_account_id", false),
        ],
    ),
    (
        "plus_api_key",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
        ],
    ),
    (
        "plus_app",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("project_id", true),
        ],
    ),
    (
        "plus_ai_model_availability",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("model_id", true),
        ],
    ),
    (
        "plus_ai_model_compliance_profile",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("model_id", true),
        ],
    ),
    (
        "plus_ai_model_info",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_ai_model_price",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("model_id", true),
        ],
    ),
    (
        "plus_ai_model_price_metric",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("price_rule_id", false),
            ("model_id", true),
        ],
    ),
    (
        "plus_ai_model_taxonomy",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("parent_id", true),
        ],
    ),
    (
        "plus_ai_model_taxonomy_rel",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("model_id", false),
            ("taxonomy_id", false),
        ],
    ),
    (
        "plus_ai_tenant_model_policy",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("subject_id", true),
            ("model_id", true),
        ],
    ),
    (
        "plus_ai_agent_tool_relation",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("agent_id", false),
            ("tool_id", false),
        ],
    ),
    (
        "plus_ai_agent",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("owner_id", false),
            ("biz_type", true),
            ("cate_id", true),
            ("prompt_id", true),
        ],
    ),
    (
        "plus_ai_prompt",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("cate_id", true),
            ("usage_count", true),
            ("avg_response_time", true),
        ],
    ),
    (
        "plus_ai_prompt_history",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("prompt_id", true),
            ("duration", true),
        ],
    ),
    (
        "plus_ai_tool",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("owner_id", false),
        ],
    ),
    (
        "plus_api_security_policy",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_category",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("parent_id", true),
            ("shop_id", false),
        ],
    ),
    (
        "plus_attribute",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("content_id", false),
            ("category_id", false),
        ],
    ),
    (
        "plus_tags",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
        ],
    ),
    (
        "plus_memory",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("agent_id", true),
            ("conversation_id", true),
        ],
    ),
    (
        "plus_memory_item",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("agent_id", true),
            ("conversation_id", true),
        ],
    ),
    (
        "plus_notification",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("sender_id", true),
            ("receiver_id", true),
            ("group_id", true),
        ],
    ),
    (
        "plus_notification_content",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("notification_id", false),
            ("sender_id", true),
            ("receiver_id", true),
            ("group_id", true),
        ],
    ),
    (
        "plus_push_device_endpoint",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("workspace_id", true),
        ],
    ),
    (
        "plus_push_topic_subscription",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
        ],
    ),
    (
        "plus_conversation",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("agent_id", true),
            ("agent_biz_type", true),
            ("last_message_id", true),
            ("content_id", true),
            ("model_id", true),
            ("knowledge_base_id", true),
            ("data_source_id", true),
        ],
    ),
    (
        "plus_chat_message",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("sender_id", true),
            ("receiver_id", true),
            ("group_id", true),
            ("conversation_id", false),
            ("agent_id", true),
            ("knowledge_base_id", true),
            ("datasource_id", true),
            ("agent_biz_type", true),
            ("user_id", true),
            ("channel_msg_seq", true),
            ("parent_message_id", true),
            ("processing_time", true),
            ("model_id", true),
        ],
    ),
    (
        "plus_chat_message_content",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("message_id", false),
            ("conversation_id", false),
            ("agent_id", true),
            ("agent_biz_type", true),
        ],
    ),
    (
        "plus_detail",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("content_id", false),
        ],
    ),
    (
        "plus_collection",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("parent_id", true),
            ("user_id", true),
            ("content_id", true),
        ],
    ),
    (
        "plus_collection_item",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("collection_id", false),
            ("content_id", false),
        ],
    ),
    (
        "plus_favorite",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("content_id", false),
            ("folder_id", true),
        ],
    ),
    (
        "plus_favorite_folder",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("parent_id", true),
        ],
    ),
    (
        "plus_share",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
        ],
    ),
    (
        "plus_share_visit_record",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("share_id", false),
        ],
    ),
    (
        "plus_invitation_code",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("creator_user_id", false),
        ],
    ),
    (
        "plus_invitation_relation",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("inviter_user_id", false),
            ("invitee_user_id", false),
        ],
    ),
    (
        "plus_sns_follow_relation",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("follower_id", false),
            ("following_id", false),
            ("owner_id", false),
        ],
    ),
    (
        "plus_sns_follow_statistics",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("owner_id", false),
            ("following_count", false),
            ("follower_count", false),
            ("mutual_count", false),
            ("special_count", false),
            ("blocked_count", false),
            ("total_interaction_count", false),
            ("last_updated_at", true),
        ],
    ),
    (
        "plus_comments",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("parent_id", true),
            ("user_id", true),
            ("content_id", false),
        ],
    ),
    (
        "plus_content_vote",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("content_id", false),
        ],
    ),
    (
        "plus_visit_history",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("content_id", false),
        ],
    ),
    (
        "plus_feeds",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("category_id", false),
            ("content_id", false),
            ("view_count", true),
            ("like_count", true),
            ("comment_count", true),
            ("share_count", true),
            ("favorite_count", true),
        ],
    ),
    (
        "plus_short_url",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("created_by", true),
        ],
    ),
    (
        "plus_feedback",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("biz_id", true),
            ("reply_user_id", true),
            ("closed_by", true),
            ("assigned_to", true),
        ],
    ),
    (
        "plus_email_message",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
        ],
    ),
    (
        "plus_events",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_disk",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("owner_id", false),
            ("knowledge_base_id", true),
            ("disk_size", false),
            ("used_size", false),
        ],
    ),
    (
        "plus_disk_member",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("disk_id", false),
            ("user_id", false),
            ("knowledge_base_id", true),
        ],
    ),
    (
        "plus_file",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("disk_id", false),
            ("size", true),
            ("content_id", true),
            ("biz_id", true),
            ("workspace_id", true),
            ("project_id", true),
            ("generation_id", true),
            ("owner_id", true),
            ("channel_config_id", true),
            ("parent_id", true),
            ("reference_file_id", true),
        ],
    ),
    (
        "plus_file_content",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("file_id", false),
        ],
    ),
    (
        "plus_file_part",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("file_id", false),
            ("chunk_size", false),
            ("total_size", false),
        ],
    ),
    (
        "plus_oss_bucket",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", true),
            ("channel_config_id", true),
        ],
    ),
    (
        "plus_order",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("owner_id", false),
            ("user_id", false),
            ("worker_user_id", true),
            ("dispatcher_user_id", true),
            ("content_id", true),
            ("category_id", false),
        ],
    ),
    (
        "plus_order_item",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("order_id", false),
            ("category_id", false),
            ("product_id", false),
            ("sku_id", false),
            ("content_id", true),
        ],
    ),
    (
        "plus_payment",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("order_id", false),
            ("content_id", true),
        ],
    ),
    (
        "plus_refund",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("order_id", false),
            ("payment_id", false),
            ("content_id", true),
            ("operator_id", true),
        ],
    ),
    (
        "plus_shopping_cart",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
            ("owner_id", false),
        ],
    ),
    (
        "plus_shopping_cart_item",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("cart_id", false),
            ("product_id", false),
            ("sku_id", false),
        ],
    ),
    (
        "plus_payment_webhook_event",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("request_timestamp", true),
        ],
    ),
    (
        "plus_order_dispatch_rule",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
        ],
    ),
    (
        "plus_order_worker_dispatch_profile",
        &[
            ("id", false),
            ("tenant_id", true),
            ("organization_id", true),
            ("user_id", false),
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
        let (column_name, column_type) = row
            .map_err(|error| format!("read sqlite table info for {table_name} failed: {error}"))?;
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
        let query =
            format!("SELECT {column_name} FROM {table_name} WHERE {column_name} IS NOT NULL");
        let mut statement = connection.prepare(&query).map_err(|error| {
            format!("prepare identifier compatibility probe for {table_name}.{column_name} failed: {error}")
        })?;
        let mut rows = statement.query([]).map_err(|error| {
            format!("query identifier compatibility probe for {table_name}.{column_name} failed: {error}")
        })?;

        while let Some(row) = rows.next().map_err(|error| {
            format!(
                "read identifier compatibility row for {table_name}.{column_name} failed: {error}"
            )
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
    if !sqlite_user_center_table_requires_integer_identifier_upgrade(
        connection,
        table_name,
        required_columns,
    )? {
        return Ok(false);
    }

    if !sqlite_user_center_identifier_columns_are_decimal_compatible(
        connection,
        table_name,
        required_columns,
    )? {
        eprintln!(
            "sqlite user center integer identifier upgrade skipped for table {table_name}: existing rows contain non-decimal identifiers."
        );
        return Ok(false);
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
        .map_err(|error| {
            format!(
                "recreate {table_name} schema during integer identifier upgrade failed: {error}"
            )
        })?;
    transaction
        .execute(&insert_select_sql, [])
        .map_err(|error| format!("copy upgraded {table_name} rows failed: {error}"))?;
    transaction
        .execute(&format!("DROP TABLE {legacy_table_name}"), [])
        .map_err(|error| format!("drop legacy {table_name} table failed: {error}"))?;
    transaction.commit().map_err(|error| {
        format!("commit integer identifier upgrade for {table_name} failed: {error}")
    })?;

    Ok(true)
}

fn ensure_sqlite_user_center_integer_identifier_upgrade(
    connection: &mut Connection,
) -> Result<(), String> {
    let plus_tenant_legacy_table = "plus_tenant__legacy_integer_identifiers";
    let plus_user_legacy_table = "plus_user__legacy_integer_identifiers";
    let plus_oauth_account_legacy_table = "plus_oauth_account__legacy_integer_identifiers";
    let plus_vip_user_legacy_table = "plus_vip_user__legacy_integer_identifiers";
    let plus_user_auth_session_legacy_table = "plus_user_auth_session__legacy_integer_identifiers";
    let plus_user_verify_code_legacy_table = "plus_user_verify_code__legacy_integer_identifiers";
    let plus_user_login_qr_legacy_table = "plus_user_login_qr__legacy_integer_identifiers";
    let plus_organization_legacy_table = "plus_organization__legacy_integer_identifiers";

    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_tenant",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[0].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_tenant (
                id, uuid, created_at, updated_at, version, name, code, type, biz_type, biz_id,
                jwt_secret_key, token_expiration_ms, refresh_token_expiration_ms, status,
                description, admin_user_id, install_app_list, expire_time, metadata,
                contact_person, contact_phone, is_deleted
            )
            SELECT
                CAST(id AS INTEGER), uuid, created_at, updated_at, version, name, code, type, biz_type,
                biz_id, jwt_secret_key, token_expiration_ms, refresh_token_expiration_ms, status,
                description, admin_user_id, install_app_list, expire_time, metadata,
                contact_person, contact_phone, is_deleted
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
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN 0
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                CASE
                    WHEN organization_id IS NULL OR TRIM(CAST(organization_id AS TEXT)) = '' THEN 0
                    ELSE CAST(organization_id AS INTEGER)
                END,
                username, nickname, password, salt, platform, type, scene, email, phone,
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
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN 0
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                CASE
                    WHEN organization_id IS NULL OR TRIM(CAST(organization_id AS TEXT)) = '' THEN 0
                    ELSE CAST(organization_id AS INTEGER)
                END,
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
                id, uuid, tenant_id, organization_id, user_id, vip_level_id, status,
                point_balance, total_recharged_points, valid_from, valid_to,
                last_active_time, remark, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER),
                uuid,
                CASE
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN 0
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                CASE
                    WHEN organization_id IS NULL OR TRIM(CAST(organization_id AS TEXT)) = '' THEN 0
                    ELSE CAST(organization_id AS INTEGER)
                END,
                CAST(user_id AS INTEGER),
                vip_level_id, status, point_balance, total_recharged_points,
                valid_from, valid_to, last_active_time, remark, created_at, updated_at, version, is_deleted
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
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN 0
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                CASE
                    WHEN organization_id IS NULL OR TRIM(CAST(organization_id AS TEXT)) = '' THEN 0
                    ELSE CAST(organization_id AS INTEGER)
                END,
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
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN 0
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                CASE
                    WHEN organization_id IS NULL OR TRIM(CAST(organization_id AS TEXT)) = '' THEN 0
                    ELSE CAST(organization_id AS INTEGER)
                END,
                provider_key, verify_type, scene, target, code, status, expires_at,
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
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN 0
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                CASE
                    WHEN organization_id IS NULL OR TRIM(CAST(organization_id AS TEXT)) = '' THEN 0
                    ELSE CAST(organization_id AS INTEGER)
                END,
                provider_key, qr_key, status,
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
    let _ = upgrade_sqlite_user_center_integer_identifier_table(
        connection,
        "plus_organization",
        USER_CENTER_INTEGER_IDENTIFIER_TABLE_RULES[7].1,
        USER_CENTER_SQLITE_SCHEMA,
        format!(
            r#"
            INSERT INTO plus_organization (
                id, uuid, tenant_id, organization_id, data_scope, parent_id, parent_uuid,
                parent_metadata, name, jwt_secret_key, token_expiration_ms,
                refresh_token_expiration_ms, code, install_app_list, status, metadata,
                description, contact_person, contact_phone, contact_email, address, website,
                logo_url, created_at, updated_at, version, is_deleted
            )
            SELECT
                CAST(id AS INTEGER),
                uuid,
                CASE
                    WHEN tenant_id IS NULL OR TRIM(CAST(tenant_id AS TEXT)) = '' THEN 0
                    ELSE CAST(tenant_id AS INTEGER)
                END,
                CASE
                    WHEN organization_id IS NULL OR TRIM(CAST(organization_id AS TEXT)) = '' THEN 0
                    ELSE CAST(organization_id AS INTEGER)
                END,
                CASE
                    WHEN data_scope IS NULL OR TRIM(CAST(data_scope AS TEXT)) = '' THEN 1
                    ELSE CAST(data_scope AS INTEGER)
                END,
                CASE
                    WHEN parent_id IS NULL OR TRIM(CAST(parent_id AS TEXT)) = '' THEN NULL
                    ELSE CAST(parent_id AS INTEGER)
                END,
                parent_uuid, parent_metadata, name, jwt_secret_key, token_expiration_ms,
                refresh_token_expiration_ms, code, install_app_list,
                CASE
                    WHEN status IS NULL OR TRIM(CAST(status AS TEXT)) = '' THEN 1
                    WHEN LOWER(TRIM(CAST(status AS TEXT))) = 'active' THEN 1
                    WHEN LOWER(TRIM(CAST(status AS TEXT))) = 'inactive' THEN 2
                    WHEN LOWER(TRIM(CAST(status AS TEXT))) = 'disabled' THEN 3
                    WHEN LOWER(TRIM(CAST(status AS TEXT))) = 'deleted' THEN 4
                    ELSE CAST(status AS INTEGER)
                END,
                metadata, description, contact_person, contact_phone, contact_email,
                address, website, logo_url, created_at, updated_at, version, is_deleted
            FROM {plus_organization_legacy_table}
            "#
        ),
    )?;

    Ok(())
}

fn ensure_sqlite_user_center_business_columns(connection: &Connection) -> Result<(), String> {
    if crate::sqlite_table_exists(connection, "plus_tenant")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_tenant",
            &[
                ("type", "type TEXT NOT NULL DEFAULT 'PLATFORM'"),
                ("biz_type", "biz_type TEXT NULL"),
                ("biz_id", "biz_id INTEGER NULL"),
                (
                    "jwt_secret_key",
                    "jwt_secret_key TEXT NOT NULL DEFAULT 'birdcoder-local-tenant-secret'",
                ),
                ("token_expiration_ms", "token_expiration_ms INTEGER NULL"),
                (
                    "refresh_token_expiration_ms",
                    "refresh_token_expiration_ms INTEGER NULL",
                ),
                ("admin_user_id", "admin_user_id INTEGER NULL"),
                ("install_app_list", "install_app_list TEXT NULL"),
                ("expire_time", "expire_time TEXT NULL"),
                ("metadata", "metadata TEXT NULL"),
                ("contact_person", "contact_person TEXT NULL"),
                ("contact_phone", "contact_phone TEXT NULL"),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_organization")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_organization",
            &[
                ("tenant_id", "tenant_id INTEGER NOT NULL DEFAULT 0"),
                (
                    "organization_id",
                    "organization_id INTEGER NOT NULL DEFAULT 0",
                ),
                ("data_scope", "data_scope INTEGER NOT NULL DEFAULT 1"),
                ("parent_id", "parent_id INTEGER NULL"),
                ("parent_uuid", "parent_uuid TEXT NULL"),
                ("parent_metadata", "parent_metadata TEXT NULL"),
                ("name", "name TEXT NOT NULL DEFAULT ''"),
                ("jwt_secret_key", "jwt_secret_key TEXT NOT NULL DEFAULT ''"),
                ("token_expiration_ms", "token_expiration_ms INTEGER NULL"),
                (
                    "refresh_token_expiration_ms",
                    "refresh_token_expiration_ms INTEGER NULL",
                ),
                ("code", "code TEXT NOT NULL DEFAULT ''"),
                ("install_app_list", "install_app_list TEXT NULL"),
                ("status", "status INTEGER NOT NULL DEFAULT 1"),
                ("metadata", "metadata TEXT NULL"),
                ("description", "description TEXT NULL"),
                ("contact_person", "contact_person TEXT NULL"),
                ("contact_phone", "contact_phone TEXT NULL"),
                ("contact_email", "contact_email TEXT NULL"),
                ("address", "address TEXT NULL"),
                ("website", "website TEXT NULL"),
                ("logo_url", "logo_url TEXT NULL"),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_user")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_user",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NOT NULL DEFAULT 0"),
                (
                    "organization_id",
                    "organization_id INTEGER NOT NULL DEFAULT 0",
                ),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_oauth_account")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_oauth_account",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NOT NULL DEFAULT 0"),
                (
                    "organization_id",
                    "organization_id INTEGER NOT NULL DEFAULT 0",
                ),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_vip_user")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_vip_user",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NOT NULL DEFAULT 0"),
                (
                    "organization_id",
                    "organization_id INTEGER NOT NULL DEFAULT 0",
                ),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_user_auth_session")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_user_auth_session",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NOT NULL DEFAULT 0"),
                (
                    "organization_id",
                    "organization_id INTEGER NOT NULL DEFAULT 0",
                ),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_user_verify_code")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_user_verify_code",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NOT NULL DEFAULT 0"),
                (
                    "organization_id",
                    "organization_id INTEGER NOT NULL DEFAULT 0",
                ),
            ],
        )?;
    }
    if crate::sqlite_table_exists(connection, "plus_user_login_qr")? {
        crate::ensure_sqlite_table_columns(
            connection,
            "plus_user_login_qr",
            &[
                ("uuid", "uuid TEXT NOT NULL DEFAULT ''"),
                ("tenant_id", "tenant_id INTEGER NOT NULL DEFAULT 0"),
                (
                    "organization_id",
                    "organization_id INTEGER NOT NULL DEFAULT 0",
                ),
            ],
        )?;
    }

    Ok(())
}

pub fn ensure_sqlite_user_center_schema(connection: &mut Connection) -> Result<(), String> {
    connection
        .execute_batch(USER_CENTER_SQLITE_SCHEMA)
        .map_err(|error| format!("create sqlite user center schema failed: {error}"))?;
    ensure_sqlite_user_center_business_columns(connection)?;
    ensure_sqlite_user_center_integer_identifier_upgrade(connection)?;
    ensure_sqlite_user_center_business_columns(connection)?;

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

fn long_integer_json_string(value: i64) -> String {
    value.to_string()
}

fn parse_optional_long_integer_decimal_string(
    value: Option<&str>,
    field_name: &str,
) -> Result<Option<i64>, String> {
    let Some(normalized) = normalize_optional_text(value) else {
        return Ok(None);
    };
    let digits = normalized.strip_prefix('-').unwrap_or(normalized.as_str());
    if digits.is_empty() || !digits.chars().all(|entry| entry.is_ascii_digit()) {
        return Err(format!(
            "{field_name} must be a Java Long/BIGINT decimal string."
        ));
    }
    normalized.parse::<i64>().map(Some).map_err(|_| {
        format!("{field_name} must be within the signed 64-bit Java Long/BIGINT range.")
    })
}

fn resolve_local_organization_id(value: Option<&str>) -> String {
    normalize_optional_text(value).unwrap_or_else(|| DEFAULT_LOCAL_ORGANIZATION_ID.to_owned())
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
                    format!(
                        "sqlite column {column_name} could not be normalized as optional string"
                    ),
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
                    organization_id: sqlite_row_optional_string_value(
                        row,
                        3,
                        "plus_user.organization_id",
                    )?,
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
                    organization_id: sqlite_row_optional_string_value(
                        row,
                        3,
                        "plus_user.organization_id",
                    )?,
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
                    organization_id: sqlite_row_optional_string_value(
                        row,
                        3,
                        "plus_user.organization_id",
                    )?,
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
                    organization_id: sqlite_row_optional_string_value(
                        row,
                        3,
                        "plus_user.organization_id",
                    )?,
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

fn load_vip_user_record(
    connection: &Connection,
    user_id: &str,
) -> Result<Option<VipUserRecord>, String> {
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
                status,
                point_balance,
                total_recharged_points,
                valid_from,
                valid_to,
                last_active_time,
                remark
            FROM plus_vip_user
            WHERE user_id = ?1 AND is_deleted = 0
            LIMIT 1
            "#,
            params![user_id],
            |row| {
                Ok(VipUserRecord {
                    uuid: row.get(0)?,
                    tenant_id: sqlite_row_optional_string_value(row, 1, "plus_vip_user.tenant_id")?,
                    organization_id: sqlite_row_optional_string_value(
                        row,
                        2,
                        "plus_vip_user.organization_id",
                    )?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    user_id: sqlite_row_required_string_value(row, 5, "plus_vip_user.user_id")?,
                    vip_level_id: sqlite_row_optional_string_value(
                        row,
                        6,
                        "plus_vip_user.vip_level_id",
                    )?,
                    status: row.get(7)?,
                    point_balance: row.get::<_, Option<i64>>(8)?.unwrap_or(0),
                    total_recharged_points: row.get::<_, Option<i64>>(9)?.unwrap_or(0),
                    valid_from: row.get(10)?,
                    valid_to: row.get(11)?,
                    last_active_time: row.get(12)?,
                    remark: row.get(13)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("load plus_vip_user {user_id} failed: {error}"))
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
        .and_then(|user| user.organization_id.clone())
        .unwrap_or_else(|| DEFAULT_LOCAL_ORGANIZATION_ID.to_owned());

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
                ?1, ?2, ?3, ?4, ?5, ?6, '', NULL, 'default', 'default', 'birdcoder',
                ?7, ?8, NULL, NULL, NULL, NULL, NULL, NULL, ?9, ?10, ?11, ?12, 'active',
                ?13, ?14, 0, 0
            )
            ON CONFLICT(id) DO UPDATE SET
                tenant_id = excluded.tenant_id,
                organization_id = excluded.organization_id,
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
                &resolved_tenant_id,
                &resolved_organization_id,
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
                user.tenant_id
                    .clone()
                    .unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned()),
                resolve_local_organization_id(user.organization_id.as_deref()),
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
    upsert_vip_user_shadow(
        connection, user_id, None, None, None, None, None, None, None, None,
    )?;
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
                resolve_local_organization_id(user.organization_id.as_deref()),
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
                DEFAULT_LOCAL_ORGANIZATION_ID,
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

fn upsert_vip_user_shadow(
    connection: &mut Connection,
    user_id: &str,
    vip_level_id: Option<&str>,
    status: Option<&str>,
    point_balance: Option<i64>,
    total_recharged_points: Option<i64>,
    valid_from: Option<&str>,
    valid_to: Option<&str>,
    last_active_time: Option<&str>,
    remark: Option<&str>,
) -> Result<VipUserRecord, String> {
    let now = crate::current_storage_timestamp();
    let existing = load_vip_user_record(connection, user_id)?;
    let resolved_vip_level_id = normalize_optional_text(vip_level_id).or_else(|| {
        existing
            .as_ref()
            .and_then(|record| record.vip_level_id.clone())
    });
    let resolved_status = normalize_optional_text(status)
        .or_else(|| existing.as_ref().map(|record| record.status.clone()))
        .unwrap_or_else(|| "inactive".to_owned());
    let resolved_point_balance = point_balance
        .or_else(|| existing.as_ref().map(|record| record.point_balance))
        .unwrap_or(0);
    let resolved_total_recharged_points = total_recharged_points
        .or_else(|| {
            existing
                .as_ref()
                .map(|record| record.total_recharged_points)
        })
        .unwrap_or(0);
    let resolved_valid_from = normalize_optional_text(valid_from).or_else(|| {
        existing
            .as_ref()
            .and_then(|record| record.valid_from.clone())
    });
    let resolved_valid_to = normalize_optional_text(valid_to)
        .or_else(|| existing.as_ref().and_then(|record| record.valid_to.clone()));
    let resolved_last_active_time = normalize_optional_text(last_active_time)
        .or_else(|| {
            existing
                .as_ref()
                .and_then(|record| record.last_active_time.clone())
        })
        .or_else(|| Some(now.clone()));
    let resolved_remark = normalize_optional_text(remark)
        .or_else(|| existing.as_ref().and_then(|record| record.remark.clone()));
    let membership_scope_user = load_user_by_id(connection, user_id)?
        .ok_or_else(|| format!("user {user_id} was not found for vip membership upsert"))?;

    connection
        .execute(
            r#"
            INSERT INTO plus_vip_user (
                id, uuid, tenant_id, organization_id, user_id, vip_level_id, status, point_balance,
                total_recharged_points, valid_from, valid_to,
                last_active_time, remark, created_at, updated_at, version, is_deleted
            )
            VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 0, 0
            )
            ON CONFLICT(user_id) DO UPDATE SET
                tenant_id = excluded.tenant_id,
                organization_id = excluded.organization_id,
                updated_at = excluded.updated_at,
                is_deleted = 0,
                vip_level_id = excluded.vip_level_id,
                status = excluded.status,
                point_balance = excluded.point_balance,
                total_recharged_points = excluded.total_recharged_points,
                valid_from = excluded.valid_from,
                valid_to = excluded.valid_to,
                last_active_time = excluded.last_active_time,
                remark = excluded.remark
            "#,
            params![
                crate::create_identifier("vip-user"),
                stable_entity_uuid("plus_vip_user", user_id),
                membership_scope_user
                    .tenant_id
                    .clone()
                    .unwrap_or_else(|| DEFAULT_LOCAL_TENANT_ID.to_owned()),
                resolve_local_organization_id(membership_scope_user.organization_id.as_deref()),
                user_id,
                &resolved_vip_level_id,
                &resolved_status,
                resolved_point_balance,
                resolved_total_recharged_points,
                &resolved_valid_from,
                &resolved_valid_to,
                &resolved_last_active_time,
                &resolved_remark,
                &now,
                &now,
            ],
        )
        .map_err(|error| format!("upsert vip membership shadow {user_id} failed: {error}"))?;

    load_vip_user_record(connection, user_id)?
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
                DEFAULT_LOCAL_ORGANIZATION_ID,
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
    membership: Option<VipUserRecord>,
) -> UserCenterVipMembershipPayload {
    let resolved = membership.unwrap_or(VipUserRecord {
        uuid: user.uuid.clone(),
        tenant_id: user.tenant_id.clone(),
        organization_id: user.organization_id.clone(),
        created_at: user.created_at.clone(),
        updated_at: user.updated_at.clone(),
        user_id: user.id.clone(),
        status: "inactive".to_owned(),
        vip_level_id: None,
        point_balance: 0,
        total_recharged_points: 0,
        valid_from: None,
        valid_to: None,
        last_active_time: None,
        remark: None,
    });

    UserCenterVipMembershipPayload {
        uuid: resolved.uuid,
        tenant_id: resolved.tenant_id,
        organization_id: resolved.organization_id,
        created_at: resolved.created_at,
        updated_at: resolved.updated_at,
        user_id: resolved.user_id,
        vip_level_id: resolved.vip_level_id,
        point_balance: long_integer_json_string(resolved.point_balance),
        total_recharged_points: long_integer_json_string(resolved.total_recharged_points),
        status: resolved.status,
        valid_from: resolved.valid_from,
        valid_to: resolved.valid_to,
        last_active_time: resolved.last_active_time,
        remark: resolved.remark,
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
    let requested_point_balance = parse_optional_long_integer_decimal_string(
        request.point_balance.as_deref(),
        "pointBalance",
    )?;
    let requested_total_recharged_points = parse_optional_long_integer_decimal_string(
        request.total_recharged_points.as_deref(),
        "totalRechargedPoints",
    )?;
    upsert_vip_user_shadow(
        connection,
        &session.user.id,
        request.vip_level_id.as_deref(),
        request.status.as_deref(),
        requested_point_balance,
        requested_total_recharged_points,
        request.valid_from.as_deref(),
        request.valid_to.as_deref(),
        request.last_active_time.as_deref(),
        request.remark.as_deref(),
    )?;

    Ok(build_vip_membership_payload(
        &session.user,
        load_vip_user_record(connection, &session.user.id)?,
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
            load_vip_user_record(connection, &session.user.id)?,
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
                organization_id: Some(DEFAULT_LOCAL_ORGANIZATION_ID.to_owned()),
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
            load_vip_user_record(connection, &session.user.id)?,
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
        let vip_level_id = if vip_level > 0 {
            Some(vip_level.to_string())
        } else {
            None
        };
        let membership = upsert_vip_user_shadow(
            connection,
            &session_record.user_id,
            vip_level_id.as_deref(),
            Some(normalized_status.as_str()),
            Some(vip_payload.vip_points.unwrap_or(0)),
            Some(vip_payload.vip_points.unwrap_or(0)),
            None,
            vip_payload.expire_time.as_deref(),
            None,
            None,
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

    #[test]
    fn ensure_sqlite_user_center_schema_tolerates_non_decimal_legacy_tenant_ids() {
        let mut connection = Connection::open_in_memory().expect("open sqlite memory database");
        connection
            .execute_batch(
                r#"
                CREATE TABLE plus_tenant (
                    id TEXT PRIMARY KEY,
                    uuid TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    name TEXT NOT NULL,
                    code TEXT NOT NULL UNIQUE,
                    type TEXT NOT NULL DEFAULT 'PLATFORM',
                    biz_type TEXT NULL,
                    biz_id INTEGER NULL,
                    jwt_secret_key TEXT NOT NULL DEFAULT 'birdcoder-local-tenant-secret',
                    token_expiration_ms INTEGER NULL,
                    refresh_token_expiration_ms INTEGER NULL,
                    status TEXT NOT NULL,
                    description TEXT NULL,
                    admin_user_id INTEGER NULL,
                    install_app_list TEXT NULL,
                    expire_time TEXT NULL,
                    metadata TEXT NULL,
                    contact_person TEXT NULL,
                    contact_phone TEXT NULL,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );

                INSERT INTO plus_tenant (
                    id, uuid, created_at, updated_at, version, name, code, type, biz_type, biz_id,
                    jwt_secret_key, token_expiration_ms, refresh_token_expiration_ms, status,
                    description, admin_user_id, install_app_list, expire_time, metadata,
                    contact_person, contact_phone, is_deleted
                ) VALUES (
                    'tenant-local',
                    '34ce68f3-7a2c-5bdb-b2f5-d9d845e8a671',
                    '2026-04-24T00:00:00Z',
                    '2026-04-24T00:00:00Z',
                    0,
                    'Default Tenant',
                    'birdcoder-local',
                    'PLATFORM',
                    NULL,
                    NULL,
                    'birdcoder-local-tenant-secret',
                    604800000,
                    2592000000,
                    'active',
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    0
                );
                "#,
            )
            .expect("create legacy non-decimal plus_tenant");

        ensure_sqlite_user_center_schema(&mut connection)
            .expect("non-decimal legacy tenant ids should not block startup");

        let tenant_id: String = connection
            .query_row(
                "SELECT id FROM plus_tenant WHERE code = ?1",
                params![DEFAULT_LOCAL_TENANT_CODE],
                |row| row.get(0),
            )
            .expect("read legacy tenant id");
        assert_eq!(tenant_id, "tenant-local");
    }

    #[test]
    fn ensure_sqlite_user_center_schema_adopts_case_variant_legacy_local_tenant_code() {
        let mut connection = Connection::open_in_memory().expect("open sqlite memory database");
        connection
            .execute_batch(
                r#"
                CREATE TABLE plus_tenant (
                    id TEXT PRIMARY KEY,
                    uuid TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    name TEXT NOT NULL,
                    code TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'PLATFORM',
                    biz_type TEXT NULL,
                    biz_id INTEGER NULL,
                    jwt_secret_key TEXT NOT NULL DEFAULT 'birdcoder-local-tenant-secret',
                    token_expiration_ms INTEGER NULL,
                    refresh_token_expiration_ms INTEGER NULL,
                    status TEXT NOT NULL,
                    description TEXT NULL,
                    admin_user_id INTEGER NULL,
                    install_app_list TEXT NULL,
                    expire_time TEXT NULL,
                    metadata TEXT NULL,
                    contact_person TEXT NULL,
                    contact_phone TEXT NULL,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );
                CREATE UNIQUE INDEX idx_plus_tenant_code_legacy_nocase
                    ON plus_tenant(code COLLATE NOCASE);

                INSERT INTO plus_tenant (
                    id, uuid, created_at, updated_at, version, name, code, type, biz_type, biz_id,
                    jwt_secret_key, token_expiration_ms, refresh_token_expiration_ms, status,
                    description, admin_user_id, install_app_list, expire_time, metadata,
                    contact_person, contact_phone, is_deleted
                ) VALUES (
                    'tenant-local',
                    '34ce68f3-7a2c-5bdb-b2f5-d9d845e8a671',
                    '2026-04-24T00:00:00Z',
                    '2026-04-24T00:00:00Z',
                    0,
                    'Default Tenant',
                    'BirdCoder-Local',
                    'PLATFORM',
                    NULL,
                    NULL,
                    'birdcoder-local-tenant-secret',
                    604800000,
                    2592000000,
                    'active',
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    0
                );
                "#,
            )
            .expect("create legacy case-variant plus_tenant");

        ensure_sqlite_user_center_schema(&mut connection)
            .expect("case-variant legacy tenant code should not block startup");

        let tenant: (String, String) = connection
            .query_row(
                "SELECT id, code FROM plus_tenant WHERE code = ?1 COLLATE NOCASE",
                params![DEFAULT_LOCAL_TENANT_CODE],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("read canonicalized legacy tenant");
        assert_eq!(
            tenant,
            (
                "tenant-local".to_owned(),
                DEFAULT_LOCAL_TENANT_CODE.to_owned()
            )
        );

        let tenant_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM plus_tenant WHERE code = ?1 COLLATE NOCASE",
                params![DEFAULT_LOCAL_TENANT_CODE],
                |row| row.get(0),
            )
            .expect("count canonical local tenants");
        assert_eq!(tenant_count, 1);
    }

    #[test]
    fn ensure_sqlite_user_center_schema_canonicalizes_default_tenant_id_when_code_is_duplicated() {
        let mut connection = Connection::open_in_memory().expect("open sqlite memory database");
        connection
            .execute_batch(
                r#"
                CREATE TABLE plus_tenant (
                    id INTEGER PRIMARY KEY,
                    uuid TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    name TEXT NOT NULL,
                    code TEXT NOT NULL UNIQUE,
                    type TEXT NOT NULL DEFAULT 'PLATFORM',
                    biz_type TEXT NULL,
                    biz_id INTEGER NULL,
                    jwt_secret_key TEXT NOT NULL DEFAULT 'birdcoder-local-tenant-secret',
                    token_expiration_ms INTEGER NULL,
                    refresh_token_expiration_ms INTEGER NULL,
                    status TEXT NOT NULL,
                    description TEXT NULL,
                    admin_user_id INTEGER NULL,
                    install_app_list TEXT NULL,
                    expire_time TEXT NULL,
                    metadata TEXT NULL,
                    contact_person TEXT NULL,
                    contact_phone TEXT NULL,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );

                INSERT INTO plus_tenant (
                    id, uuid, created_at, updated_at, version, name, code, type, biz_type, biz_id,
                    jwt_secret_key, token_expiration_ms, refresh_token_expiration_ms, status,
                    description, admin_user_id, install_app_list, expire_time, metadata,
                    contact_person, contact_phone, is_deleted
                ) VALUES
                (
                    0,
                    '34ce68f3-7a2c-5bdb-b2f5-d9d845e8a670',
                    '2026-04-24T00:00:00Z',
                    '2026-04-24T00:00:00Z',
                    0,
                    'Legacy Local Tenant',
                    'legacy-local',
                    'PLATFORM',
                    NULL,
                    NULL,
                    'birdcoder-local-tenant-secret',
                    604800000,
                    2592000000,
                    'active',
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    0
                ),
                (
                    42,
                    '34ce68f3-7a2c-5bdb-b2f5-d9d845e8a672',
                    '2026-04-24T00:00:00Z',
                    '2026-04-24T00:00:00Z',
                    0,
                    'Duplicate Default Code Tenant',
                    'birdcoder-local',
                    'PLATFORM',
                    NULL,
                    NULL,
                    'birdcoder-local-tenant-secret',
                    604800000,
                    2592000000,
                    'active',
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    0
                );
                "#,
            )
            .expect("create duplicated default tenant fixture");

        ensure_sqlite_user_center_schema(&mut connection)
            .expect("duplicated default tenant code should not block startup");

        let canonical_tenant: (String, String) = connection
            .query_row(
                "SELECT CAST(id AS TEXT), code FROM plus_tenant WHERE id = ?1",
                params![DEFAULT_LOCAL_TENANT_ID],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("read canonical default tenant");
        assert_eq!(
            canonical_tenant,
            (
                DEFAULT_LOCAL_TENANT_ID.to_owned(),
                DEFAULT_LOCAL_TENANT_CODE.to_owned()
            )
        );

        let default_code_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM plus_tenant WHERE code = ?1 COLLATE NOCASE",
                params![DEFAULT_LOCAL_TENANT_CODE],
                |row| row.get(0),
            )
            .expect("count canonical default-code tenants");
        assert_eq!(default_code_count, 1);
    }

    #[test]
    fn ensure_sqlite_user_center_schema_upgrades_legacy_oauth_accounts_missing_tenant_id() {
        let mut connection = Connection::open_in_memory().expect("open sqlite memory database");
        connection
            .execute_batch(
                r#"
                CREATE TABLE legacy_plus_oauth_account (
                    id TEXT PRIMARY KEY,
                    uuid TEXT NOT NULL UNIQUE,
                    organization_id INTEGER NOT NULL DEFAULT 0,
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

                INSERT INTO legacy_plus_oauth_account (
                    id, uuid, organization_id, user_id, oauth_provider, open_id, union_id, app_id,
                    oauth_user_info_json, status, created_at, updated_at, version, is_deleted
                ) VALUES (
                    '1001',
                    '61a99802-c855-5f88-b8a9-bac807a5ee16',
                    0,
                    '1002',
                    'github',
                    'legacy-open-id',
                    NULL,
                    NULL,
                    NULL,
                    'active',
                    '2026-04-24T00:00:00Z',
                    '2026-04-24T00:00:00Z',
                    0,
                    0
                );

                ALTER TABLE legacy_plus_oauth_account RENAME TO plus_oauth_account;
                "#,
            )
            .expect("create legacy plus_oauth_account without tenant_id");

        ensure_sqlite_user_center_schema(&mut connection)
            .expect("legacy oauth accounts without tenant_id should not block startup");

        let migrated: (i64, Option<i64>, i64) = connection
            .query_row(
                "SELECT id, tenant_id, user_id FROM plus_oauth_account WHERE open_id = 'legacy-open-id'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("read migrated oauth account");
        assert_eq!(migrated, (1001, Some(0), 1002));
    }
}
