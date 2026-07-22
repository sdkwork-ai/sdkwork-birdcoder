pub const ALL_TABLES_DDL: &str = r#"
CREATE TABLE IF NOT EXISTS studio_workspace (
    id INTEGER PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    code TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    owner_id INTEGER NOT NULL,
    leader_id INTEGER NULL,
    created_by_user_id INTEGER NULL,
    icon TEXT NULL,
    color TEXT NULL,
    type TEXT NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    max_members INTEGER NULL,
    current_members INTEGER NULL,
    member_count INTEGER NULL,
    max_storage INTEGER NULL,
    used_storage INTEGER NULL,
    settings_json TEXT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    is_template INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_project (
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
    title TEXT NOT NULL,
    cover_image TEXT NULL,
    author TEXT NULL,
    file_id INTEGER NULL,
    code TEXT NOT NULL,
    type INTEGER NOT NULL,
    site_path TEXT NULL,
    domain_prefix TEXT NULL,
    description TEXT NULL,
    status INTEGER NOT NULL,
    conversation_id INTEGER NULL,
    workspace_id INTEGER NULL,
    workspace_uuid TEXT NULL,
    leader_id INTEGER NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    budget_amount INTEGER NULL,
    is_deleted INTEGER NOT NULL,
    is_template INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_name
ON studio_project(name);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_code
ON studio_project(code);

CREATE TABLE IF NOT EXISTS studio_project_content (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NULL,
    parent_id INTEGER NULL,
    project_id INTEGER NOT NULL,
    project_uuid TEXT NOT NULL,
    config_data TEXT NULL,
    content_data TEXT NULL,
    metadata TEXT NULL,
    content_version TEXT NOT NULL,
    content_hash TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_project_content_project_id
ON studio_project_content(project_id);

CREATE INDEX IF NOT EXISTS idx_studio_project_content_project_uuid
ON studio_project_content(project_uuid);

CREATE TABLE IF NOT EXISTS studio_project_document (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id TEXT NOT NULL,
    document_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    body_ref TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_deployment_target (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    environment_key TEXT NOT NULL,
    runtime TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_deployment_record (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    release_record_id TEXT NULL,
    status TEXT NOT NULL,
    endpoint_url TEXT NULL,
    started_at TEXT NULL,
    completed_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS studio_team (
    id INTEGER PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    owner_id INTEGER NOT NULL,
    leader_id INTEGER NULL,
    created_by_user_id INTEGER NULL,
    metadata_json TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_team_member (
    id INTEGER PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    created_by_user_id INTEGER NULL,
    granted_by_user_id INTEGER NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_workspace_member (
    id INTEGER PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    team_id INTEGER NULL,
    role TEXT NOT NULL,
    created_by_user_id INTEGER NULL,
    granted_by_user_id INTEGER NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_project_collaborator (
    id INTEGER PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL,
    workspace_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    team_id INTEGER NULL,
    role TEXT NOT NULL,
    created_by_user_id INTEGER NULL,
    granted_by_user_id INTEGER NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_project_runtime_location (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL,
    registered_by_user_id INTEGER NOT NULL,
    runtime_target_id TEXT NOT NULL,
    runtime_target_kind TEXT NOT NULL,
    location_kind TEXT NOT NULL,
    path_flavor TEXT NOT NULL,
    root_locator TEXT NOT NULL,
    display_name TEXT NOT NULL,
    encrypted_absolute_path TEXT NOT NULL,
    path_encryption_key_id TEXT NOT NULL,
    path_fingerprint TEXT NOT NULL,
    terminal_available INTEGER NOT NULL DEFAULT 0,
    git_available INTEGER NOT NULL DEFAULT 0,
    build_available INTEGER NOT NULL DEFAULT 0,
    file_system_available INTEGER NOT NULL DEFAULT 0,
    health_status TEXT NOT NULL,
    last_verified_at TEXT NULL,
    last_seen_at TEXT NULL,
    verified_by_user_id INTEGER NULL,
    git_repository_url TEXT NULL,
    git_remote_name TEXT NULL,
    git_branch TEXT NULL,
    git_commit TEXT NULL,
    git_worktree_key TEXT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_runtime_location_active_path
ON studio_project_runtime_location(tenant_id, organization_id, project_id, runtime_target_id, path_fingerprint)
WHERE is_deleted IS NOT TRUE;

CREATE TABLE IF NOT EXISTS studio_project_runtime_location_preference (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL,
    subject_user_id INTEGER NOT NULL,
    capability TEXT NOT NULL,
    runtime_location_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_runtime_location_preference_active
ON studio_project_runtime_location_preference(tenant_id, organization_id, project_id, subject_user_id, capability)
WHERE is_deleted IS NOT TRUE;

CREATE TABLE IF NOT EXISTS studio_project_runtime_location_idempotency (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL,
    subject_user_id INTEGER NOT NULL,
    operation_kind TEXT NOT NULL,
    idempotency_key_hash TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    resource_kind TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_version INTEGER NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_runtime_location_idempotency
ON studio_project_runtime_location_idempotency(tenant_id, organization_id, project_id, subject_user_id, operation_kind, idempotency_key_hash);

CREATE TABLE IF NOT EXISTS ops_project_runtime_location_audit (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL,
    runtime_location_id TEXT NULL,
    actor_user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    trace_id TEXT NULL,
    occurred_at TEXT NOT NULL,
    redacted_metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_project_sandbox_binding (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL REFERENCES studio_project(id) ON DELETE CASCADE,
    sandbox_id TEXT NOT NULL,
    root_entry_id TEXT NOT NULL,
    logical_path TEXT NOT NULL DEFAULT '',
    lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('active', 'revoked')),
    created_by_user_id INTEGER NOT NULL,
    updated_by_user_id INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_sandbox_binding_active
ON studio_project_sandbox_binding(tenant_id, organization_id, project_id)
WHERE is_deleted IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_studio_project_sandbox_binding_lookup
ON studio_project_sandbox_binding(tenant_id, organization_id, project_id, is_deleted);

CREATE TABLE IF NOT EXISTS studio_project_sandbox_binding_idempotency (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL REFERENCES studio_project(id) ON DELETE CASCADE,
    subject_user_id INTEGER NOT NULL,
    operation_kind TEXT NOT NULL,
    idempotency_key_hash TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_version INTEGER NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_sandbox_binding_idempotency
ON studio_project_sandbox_binding_idempotency(
    tenant_id, organization_id, project_id, subject_user_id, operation_kind, idempotency_key_hash
);

CREATE INDEX IF NOT EXISTS idx_studio_project_sandbox_binding_idempotency_expiry
ON studio_project_sandbox_binding_idempotency(expires_at);

CREATE TABLE IF NOT EXISTS ops_project_sandbox_binding_audit (
    id TEXT PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    project_id INTEGER NOT NULL REFERENCES studio_project(id) ON DELETE CASCADE,
    sandbox_binding_id TEXT NOT NULL,
    actor_user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL,
    trace_id TEXT NULL,
    occurred_at TEXT NOT NULL,
    redacted_metadata_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_project_sandbox_binding_audit_scope_time
ON ops_project_sandbox_binding_audit(
    tenant_id, organization_id, project_id, sandbox_binding_id, occurred_at
);

CREATE TABLE IF NOT EXISTS ops_release_record (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    release_version TEXT NOT NULL,
    release_kind TEXT NOT NULL,
    rollout_stage TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_audit_event (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_governance_policy (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    policy_category TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    approval_policy TEXT NOT NULL,
    rationale TEXT NULL,
    status TEXT NOT NULL
);
"#;
