pub mod workspace {
    pub const TABLE: &str = "studio_workspace";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const DATA_SCOPE: &str = "data_scope";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const NAME: &str = "name";
    pub const CODE: &str = "code";
    pub const TITLE: &str = "title";
    pub const DESCRIPTION: &str = "description";
    pub const OWNER_ID: &str = "owner_id";
    pub const LEADER_ID: &str = "leader_id";
    pub const CREATED_BY_USER_ID: &str = "created_by_user_id";
    pub const ICON: &str = "icon";
    pub const COLOR: &str = "color";
    pub const TYPE: &str = "type";
    pub const START_TIME: &str = "start_time";
    pub const END_TIME: &str = "end_time";
    pub const MAX_MEMBERS: &str = "max_members";
    pub const CURRENT_MEMBERS: &str = "current_members";
    pub const MEMBER_COUNT: &str = "member_count";
    pub const MAX_STORAGE: &str = "max_storage";
    pub const USED_STORAGE: &str = "used_storage";
    pub const SETTINGS_JSON: &str = "settings_json";
    pub const IS_PUBLIC: &str = "is_public";
    pub const IS_TEMPLATE: &str = "is_template";
    pub const STATUS: &str = "status";
}

pub mod workspace_member {
    pub const TABLE: &str = "studio_workspace_member";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const WORKSPACE_ID: &str = "workspace_id";
    pub const USER_ID: &str = "user_id";
    pub const TEAM_ID: &str = "team_id";
    pub const ROLE: &str = "role";
    pub const CREATED_BY_USER_ID: &str = "created_by_user_id";
    pub const GRANTED_BY_USER_ID: &str = "granted_by_user_id";
    pub const STATUS: &str = "status";
}

pub mod project {
    pub const TABLE: &str = "studio_project";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const V: &str = "v";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const DATA_SCOPE: &str = "data_scope";
    pub const PARENT_ID: &str = "parent_id";
    pub const PARENT_UUID: &str = "parent_uuid";
    pub const PARENT_METADATA: &str = "parent_metadata";
    pub const USER_ID: &str = "user_id";
    pub const NAME: &str = "name";
    pub const TITLE: &str = "title";
    pub const COVER_IMAGE: &str = "cover_image";
    pub const AUTHOR: &str = "author";
    pub const FILE_ID: &str = "file_id";
    pub const CODE: &str = "code";
    pub const TYPE: &str = "type";
    pub const SITE_PATH: &str = "site_path";
    pub const DOMAIN_PREFIX: &str = "domain_prefix";
    pub const DESCRIPTION: &str = "description";
    pub const STATUS: &str = "status";
    pub const CONVERSATION_ID: &str = "conversation_id";
    pub const WORKSPACE_ID: &str = "workspace_id";
    pub const WORKSPACE_UUID: &str = "workspace_uuid";
    pub const LEADER_ID: &str = "leader_id";
    pub const START_TIME: &str = "start_time";
    pub const END_TIME: &str = "end_time";
    pub const BUDGET_AMOUNT: &str = "budget_amount";
    pub const IS_DELETED: &str = "is_deleted";
    pub const IS_TEMPLATE: &str = "is_template";
}

pub mod project_collaborator {
    pub const TABLE: &str = "studio_project_collaborator";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const PROJECT_ID: &str = "project_id";
    pub const WORKSPACE_ID: &str = "workspace_id";
    pub const USER_ID: &str = "user_id";
    pub const TEAM_ID: &str = "team_id";
    pub const ROLE: &str = "role";
    pub const CREATED_BY_USER_ID: &str = "created_by_user_id";
    pub const GRANTED_BY_USER_ID: &str = "granted_by_user_id";
    pub const STATUS: &str = "status";
}

pub mod project_runtime_location {
    pub const TABLE: &str = "studio_project_runtime_location";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const REGISTERED_BY_USER_ID: &str = "registered_by_user_id";
    pub const RUNTIME_TARGET_ID: &str = "runtime_target_id";
    pub const RUNTIME_TARGET_KIND: &str = "runtime_target_kind";
    pub const LOCATION_KIND: &str = "location_kind";
    pub const PATH_FLAVOR: &str = "path_flavor";
    pub const ROOT_LOCATOR: &str = "root_locator";
    pub const DISPLAY_NAME: &str = "display_name";
    pub const ENCRYPTED_ABSOLUTE_PATH: &str = "encrypted_absolute_path";
    pub const PATH_ENCRYPTION_KEY_ID: &str = "path_encryption_key_id";
    pub const PATH_FINGERPRINT: &str = "path_fingerprint";
    pub const TERMINAL_AVAILABLE: &str = "terminal_available";
    pub const GIT_AVAILABLE: &str = "git_available";
    pub const BUILD_AVAILABLE: &str = "build_available";
    pub const FILE_SYSTEM_AVAILABLE: &str = "file_system_available";
    pub const HEALTH_STATUS: &str = "health_status";
    pub const LAST_VERIFIED_AT: &str = "last_verified_at";
    pub const LAST_SEEN_AT: &str = "last_seen_at";
    pub const VERIFIED_BY_USER_ID: &str = "verified_by_user_id";
    pub const GIT_REPOSITORY_URL: &str = "git_repository_url";
    pub const GIT_REMOTE_NAME: &str = "git_remote_name";
    pub const GIT_BRANCH: &str = "git_branch";
    pub const GIT_COMMIT: &str = "git_commit";
    pub const GIT_WORKTREE_KEY: &str = "git_worktree_key";
    pub const VERSION: &str = "version";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const IS_DELETED: &str = "is_deleted";
}

pub mod project_runtime_location_preference {
    pub const TABLE: &str = "studio_project_runtime_location_preference";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const SUBJECT_USER_ID: &str = "subject_user_id";
    pub const CAPABILITY: &str = "capability";
    pub const RUNTIME_LOCATION_ID: &str = "runtime_location_id";
    pub const VERSION: &str = "version";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const IS_DELETED: &str = "is_deleted";
}

pub mod project_runtime_location_idempotency {
    pub const TABLE: &str = "studio_project_runtime_location_idempotency";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const SUBJECT_USER_ID: &str = "subject_user_id";
    pub const OPERATION_KIND: &str = "operation_kind";
    pub const IDEMPOTENCY_KEY_HASH: &str = "idempotency_key_hash";
    pub const REQUEST_FINGERPRINT: &str = "request_fingerprint";
    pub const RESOURCE_KIND: &str = "resource_kind";
    pub const RESOURCE_ID: &str = "resource_id";
    pub const RESOURCE_VERSION: &str = "resource_version";
    pub const CREATED_AT: &str = "created_at";
    pub const EXPIRES_AT: &str = "expires_at";
}

pub mod project_runtime_location_audit {
    pub const TABLE: &str = "ops_project_runtime_location_audit";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const RUNTIME_LOCATION_ID: &str = "runtime_location_id";
    pub const ACTOR_USER_ID: &str = "actor_user_id";
    pub const ACTION: &str = "action";
    pub const RESULT: &str = "result";
    pub const TRACE_ID: &str = "trace_id";
    pub const OCCURRED_AT: &str = "occurred_at";
    pub const REDACTED_METADATA_JSON: &str = "redacted_metadata_json";
}

pub mod project_sandbox_binding {
    pub const TABLE: &str = "studio_project_sandbox_binding";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const SANDBOX_ID: &str = "sandbox_id";
    pub const ROOT_ENTRY_ID: &str = "root_entry_id";
    pub const LOGICAL_PATH: &str = "logical_path";
    pub const STATUS: &str = "status";
    pub const CREATED_BY_USER_ID: &str = "created_by_user_id";
    pub const UPDATED_BY_USER_ID: &str = "updated_by_user_id";
    pub const VERSION: &str = "version";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const IS_DELETED: &str = "is_deleted";
}

pub mod project_sandbox_binding_idempotency {
    pub const TABLE: &str = "studio_project_sandbox_binding_idempotency";
    pub const ID: &str = "id";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const SUBJECT_USER_ID: &str = "subject_user_id";
    pub const OPERATION_KIND: &str = "operation_kind";
    pub const IDEMPOTENCY_KEY_HASH: &str = "idempotency_key_hash";
    pub const REQUEST_FINGERPRINT: &str = "request_fingerprint";
    pub const RESOURCE_ID: &str = "resource_id";
    pub const RESOURCE_VERSION: &str = "resource_version";
    pub const CREATED_AT: &str = "created_at";
    pub const EXPIRES_AT: &str = "expires_at";
}

pub mod project_sandbox_binding_audit {
    pub const TABLE: &str = "studio_project_sandbox_binding_audit";
    pub const ID: &str = "id";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const SANDBOX_BINDING_ID: &str = "sandbox_binding_id";
    pub const ACTOR_USER_ID: &str = "actor_user_id";
    pub const ACTION: &str = "action";
    pub const RESULT: &str = "result";
    pub const REASON_CODE: &str = "reason_code";
    pub const TRACE_ID: &str = "trace_id";
    pub const PREVIOUS_VERSION: &str = "previous_version";
    pub const NEW_VERSION: &str = "new_version";
    pub const OCCURRED_AT: &str = "occurred_at";
    pub const REDACTED_METADATA_JSON: &str = "redacted_metadata_json";
}

pub mod project_content {
    pub const TABLE: &str = "studio_project_content";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const V: &str = "v";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const DATA_SCOPE: &str = "data_scope";
    pub const USER_ID: &str = "user_id";
    pub const PARENT_ID: &str = "parent_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const PROJECT_UUID: &str = "project_uuid";
    pub const CONFIG_DATA: &str = "config_data";
    pub const CONTENT_DATA: &str = "content_data";
    pub const METADATA: &str = "metadata";
    pub const CONTENT_VERSION: &str = "content_version";
    pub const CONTENT_HASH: &str = "content_hash";
}

pub mod project_document {
    pub const TABLE: &str = "studio_project_document";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const PROJECT_ID: &str = "project_id";
    pub const DOCUMENT_KIND: &str = "document_kind";
    pub const TITLE: &str = "title";
    pub const SLUG: &str = "slug";
    pub const BODY_REF: &str = "body_ref";
    pub const STATUS: &str = "status";
}

pub mod deployment_target {
    pub const TABLE: &str = "studio_deployment_target";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const PROJECT_ID: &str = "project_id";
    pub const NAME: &str = "name";
    pub const ENVIRONMENT_KEY: &str = "environment_key";
    pub const RUNTIME: &str = "runtime";
    pub const STATUS: &str = "status";
}

pub mod deployment_record {
    pub const TABLE: &str = "studio_deployment_record";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const PROJECT_ID: &str = "project_id";
    pub const TARGET_ID: &str = "target_id";
    pub const RELEASE_RECORD_ID: &str = "release_record_id";
    pub const STATUS: &str = "status";
    pub const ENDPOINT_URL: &str = "endpoint_url";
    pub const STARTED_AT: &str = "started_at";
    pub const COMPLETED_AT: &str = "completed_at";
}

pub mod team {
    pub const TABLE: &str = "studio_team";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const WORKSPACE_ID: &str = "workspace_id";
    pub const NAME: &str = "name";
    pub const CODE: &str = "code";
    pub const TITLE: &str = "title";
    pub const DESCRIPTION: &str = "description";
    pub const OWNER_ID: &str = "owner_id";
    pub const LEADER_ID: &str = "leader_id";
    pub const CREATED_BY_USER_ID: &str = "created_by_user_id";
    pub const METADATA_JSON: &str = "metadata_json";
    pub const STATUS: &str = "status";
}

pub mod team_member {
    pub const TABLE: &str = "studio_team_member";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const TEAM_ID: &str = "team_id";
    pub const USER_ID: &str = "user_id";
    pub const ROLE: &str = "role";
    pub const CREATED_BY_USER_ID: &str = "created_by_user_id";
    pub const GRANTED_BY_USER_ID: &str = "granted_by_user_id";
    pub const STATUS: &str = "status";
}

pub mod release_record {
    pub const TABLE: &str = "ops_release_record";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const ORGANIZATION_ID: &str = "organization_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const RELEASE_VERSION: &str = "release_version";
    pub const RELEASE_KIND: &str = "release_kind";
    pub const ROLLOUT_STAGE: &str = "rollout_stage";
    pub const MANIFEST_JSON: &str = "manifest_json";
    pub const STATUS: &str = "status";
}

pub mod audit_event {
    pub const TABLE: &str = "ops_audit_event";
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
    pub const EVENT_TYPE: &str = "event_type";
    pub const PAYLOAD_JSON: &str = "payload_json";
}

pub mod governance_policy {
    pub const TABLE: &str = "ops_governance_policy";
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
    pub const POLICY_CATEGORY: &str = "policy_category";
    pub const TARGET_TYPE: &str = "target_type";
    pub const TARGET_ID: &str = "target_id";
    pub const APPROVAL_POLICY: &str = "approval_policy";
    pub const RATIONALE: &str = "rationale";
    pub const STATUS: &str = "status";
}
