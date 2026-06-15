pub mod skill_package {
    pub const TABLE: &str = "ai_skill_package";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const SLUG: &str = "slug";
    pub const SOURCE_URI: &str = "source_uri";
    pub const STATUS: &str = "status";
    pub const MANIFEST_JSON: &str = "manifest_json";
}

pub mod skill_version {
    pub const TABLE: &str = "ai_skill_version";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const SKILL_PACKAGE_ID: &str = "skill_package_id";
    pub const VERSION_LABEL: &str = "version_label";
    pub const MANIFEST_JSON: &str = "manifest_json";
    pub const STATUS: &str = "status";
}

pub mod skill_capability {
    pub const TABLE: &str = "ai_skill_capability";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const SKILL_VERSION_ID: &str = "skill_version_id";
    pub const CAPABILITY_KEY: &str = "capability_key";
    pub const DESCRIPTION_TEXT: &str = "description_text";
    pub const PAYLOAD_JSON: &str = "payload_json";
}

pub mod skill_installation {
    pub const TABLE: &str = "ai_skill_installation";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const SCOPE_TYPE: &str = "scope_type";
    pub const SCOPE_ID: &str = "scope_id";
    pub const SKILL_VERSION_ID: &str = "skill_version_id";
    pub const STATUS: &str = "status";
    pub const INSTALLED_AT: &str = "installed_at";
}
