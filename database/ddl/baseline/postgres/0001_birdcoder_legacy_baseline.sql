-- birdcoder baseline schema for PostgreSQL (native types, tenant isolation per SUBJECT_ID_SPEC)

-- ============================================================
-- AI Coding Session tables (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_coding_session (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    workspace_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    entry_surface TEXT NOT NULL,
    host_mode TEXT NOT NULL DEFAULT 'server',
    engine_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    last_turn_at TIMESTAMPTZ NULL,
    native_session_id TEXT NULL,
    sort_timestamp BIGINT NULL,
    transcript_updated_at TIMESTAMPTZ NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    unread BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ai_coding_session_message (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json JSONB NOT NULL,
    timestamp_ms BIGINT NULL,
    name TEXT NULL,
    tool_calls_json JSONB NULL,
    tool_call_id TEXT NULL,
    file_changes_json JSONB NULL,
    commands_json JSONB NULL,
    task_progress_json JSONB NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_runtime (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    coding_session_id TEXT NOT NULL,
    engine_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    host_mode TEXT NOT NULL,
    status TEXT NOT NULL,
    transport_kind TEXT NOT NULL,
    native_session_id TEXT NULL,
    native_turn_container_id TEXT NULL,
    capability_snapshot_json JSONB NOT NULL,
    metadata_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_turn (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    coding_session_id TEXT NOT NULL,
    runtime_id TEXT NOT NULL,
    request_kind TEXT NOT NULL,
    status TEXT NOT NULL,
    input_summary TEXT NOT NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_event (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NULL,
    runtime_id TEXT NULL,
    event_kind TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_artifact (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NULL,
    artifact_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    blob_ref TEXT NULL,
    metadata_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_checkpoint (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    coding_session_id TEXT NOT NULL,
    runtime_id TEXT NULL,
    checkpoint_kind TEXT NOT NULL,
    resumable BOOLEAN NOT NULL,
    state_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_operation (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    status TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    stream_kind TEXT NOT NULL,
    artifact_refs_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_prompt_entry (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    coding_session_id TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    normalized_prompt_text TEXT NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_tenant_project_updated
ON ai_coding_session(tenant_id, project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_tenant_user_updated
ON ai_coding_session(tenant_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_message_tenant_session_created
ON ai_coding_session_message(tenant_id, coding_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_prompt_entry_tenant_session_last_used
ON ai_coding_session_prompt_entry(tenant_id, coding_session_id, last_used_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_coding_session_prompt_entry_tenant_session_normalized_prompt
ON ai_coding_session_prompt_entry(tenant_id, coding_session_id, normalized_prompt_text);

-- ============================================================
-- AI Saved Prompt Entry (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_saved_prompt_entry (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    prompt_text TEXT NOT NULL,
    normalized_prompt_text TEXT NOT NULL,
    last_saved_at TIMESTAMPTZ NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_saved_prompt_entry_tenant_user_last_saved
ON ai_saved_prompt_entry(tenant_id, user_id, last_saved_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_saved_prompt_entry_tenant_normalized_prompt
ON ai_saved_prompt_entry(tenant_id, user_id, normalized_prompt_text);

-- ============================================================
-- Studio Workspace (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_workspace (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL,
    code TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    owner_id BIGINT NOT NULL,
    leader_id BIGINT NULL,
    created_by_user_id BIGINT NULL,
    icon TEXT NULL,
    color TEXT NULL,
    type TEXT NULL,
    start_time TIMESTAMPTZ NULL,
    end_time TIMESTAMPTZ NULL,
    max_members INTEGER NULL,
    current_members INTEGER NULL,
    member_count INTEGER NULL,
    max_storage BIGINT NULL,
    used_storage BIGINT NULL,
    settings_json JSONB NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL
);

-- ============================================================
-- Studio Project (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_project (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    parent_id BIGINT NULL,
    parent_uuid UUID NULL,
    parent_metadata TEXT NULL,
    user_id BIGINT NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    cover_image TEXT NULL,
    author TEXT NULL,
    file_id BIGINT NULL,
    code TEXT NOT NULL,
    type INTEGER NOT NULL,
    site_path TEXT NULL,
    domain_prefix TEXT NULL,
    description TEXT NULL,
    status INTEGER NOT NULL,
    conversation_id BIGINT NULL,
    workspace_id BIGINT NULL,
    workspace_uuid UUID NULL,
    leader_id BIGINT NULL,
    start_time TIMESTAMPTZ NULL,
    end_time TIMESTAMPTZ NULL,
    budget_amount BIGINT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    is_template BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_studio_project_tenant_name
ON studio_project(tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_studio_project_tenant_code
ON studio_project(tenant_id, code);

-- ============================================================
-- Studio Project Content (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_project_content (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id BIGINT NOT NULL DEFAULT 0,
    parent_id BIGINT NULL,
    project_id BIGINT NOT NULL,
    project_uuid UUID NOT NULL,
    config_data TEXT NULL,
    content_data TEXT NULL,
    metadata TEXT NULL,
    content_version TEXT NOT NULL,
    content_hash TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_project_content_tenant_project_id
ON studio_project_content(tenant_id, project_id);

CREATE INDEX IF NOT EXISTS idx_studio_project_content_tenant_project_uuid
ON studio_project_content(tenant_id, project_uuid);

-- ============================================================
-- Studio Project Document (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_project_document (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    project_id TEXT NOT NULL,
    document_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    body_ref TEXT NULL,
    status TEXT NOT NULL
);

-- ============================================================
-- Studio Deployment Target (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_deployment_target (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    environment_key TEXT NOT NULL,
    runtime TEXT NOT NULL,
    status TEXT NOT NULL
);

-- ============================================================
-- Studio Deployment Record (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_deployment_record (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    project_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    release_record_id TEXT NULL,
    status TEXT NOT NULL,
    endpoint_url TEXT NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL
);

-- ============================================================
-- Studio Team (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_team (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    workspace_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    owner_id BIGINT NOT NULL,
    leader_id BIGINT NULL,
    created_by_user_id BIGINT NULL,
    metadata_json JSONB NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_team_member (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    team_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role TEXT NOT NULL,
    created_by_user_id BIGINT NULL,
    granted_by_user_id BIGINT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_workspace_member (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    team_id BIGINT NULL,
    role TEXT NOT NULL,
    created_by_user_id BIGINT NULL,
    granted_by_user_id BIGINT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_project_collaborator (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    project_id BIGINT NOT NULL,
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    team_id BIGINT NULL,
    role TEXT NOT NULL,
    created_by_user_id BIGINT NULL,
    granted_by_user_id BIGINT NULL,
    status TEXT NOT NULL
);

-- ============================================================
-- AI Skill Package tables (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_skill_package (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    slug TEXT NOT NULL,
    source_uri TEXT NOT NULL,
    status TEXT NOT NULL,
    manifest_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_skill_version (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    skill_package_id TEXT NOT NULL,
    version_label TEXT NOT NULL,
    manifest_json JSONB NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_skill_capability (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    skill_version_id TEXT NOT NULL,
    capability_key TEXT NOT NULL,
    description_text TEXT NOT NULL,
    payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_skill_installation (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    skill_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    installed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_skill_version_tenant_package_id
ON ai_skill_version(tenant_id, skill_package_id);

CREATE INDEX IF NOT EXISTS idx_ai_skill_capability_tenant_version_id
ON ai_skill_capability(tenant_id, skill_version_id);

CREATE INDEX IF NOT EXISTS idx_ai_skill_installation_tenant_version_id
ON ai_skill_installation(tenant_id, skill_version_id);

-- ============================================================
-- Studio App Template tables (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_app_template (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_app_template_version (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    app_template_id TEXT NOT NULL,
    version_label TEXT NOT NULL,
    manifest_json JSONB NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_app_template_target_profile (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    app_template_version_id TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    runtime TEXT NOT NULL,
    deployment_mode TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_app_template_preset (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    app_template_version_id TEXT NOT NULL,
    preset_key TEXT NOT NULL,
    description_text TEXT NOT NULL,
    payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_app_template_instantiation (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    project_id TEXT NOT NULL,
    app_template_version_id TEXT NOT NULL,
    preset_key TEXT NOT NULL,
    status TEXT NOT NULL,
    output_root TEXT NOT NULL
);

-- ============================================================
-- Ops tables (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS ops_release_record (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    release_version TEXT NOT NULL,
    release_kind TEXT NOT NULL,
    rollout_stage TEXT NOT NULL,
    manifest_json JSONB NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_audit_event (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_governance_policy (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    policy_category TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    approval_policy TEXT NOT NULL,
    rationale TEXT NULL,
    status TEXT NOT NULL
);

-- ============================================================
-- Runtime Model Config (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS runtime_model_config (
    id TEXT PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    config_key TEXT NOT NULL,
    config_json JSONB NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'server',
    updated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_runtime_model_config_tenant_key
ON runtime_model_config(tenant_id, config_key);

-- ============================================================
-- Commerce Membership tables (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_membership (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    owner_user_id TEXT NOT NULL,
    plan_id TEXT NULL,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    remaining_days TEXT NOT NULL DEFAULT '0',
    total_days TEXT NOT NULL DEFAULT '0',
    total_spent TEXT NOT NULL DEFAULT '0',
    points TEXT NOT NULL DEFAULT '0',
    growth_value TEXT NOT NULL DEFAULT '0',
    upgrade_growth_value TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS commerce_membership_benefit (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    membership_id TEXT NOT NULL,
    name TEXT NOT NULL,
    benefit_key TEXT NULL,
    benefit_type TEXT NULL,
    description TEXT NULL,
    icon TEXT NULL,
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    usage_limit TEXT NULL,
    used_count TEXT NULL
);

CREATE TABLE IF NOT EXISTS commerce_membership_package_group (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL,
    description TEXT NULL,
    sort_weight TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS commerce_membership_package (
    id TEXT PRIMARY KEY,
    uuid UUID NULL,
    tenant_id BIGINT NOT NULL DEFAULT 0,
    organization_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    price TEXT NOT NULL,
    original_price TEXT NULL,
    point_amount TEXT NOT NULL DEFAULT '0',
    duration_days TEXT NOT NULL DEFAULT '30',
    plan_name TEXT NULL,
    sort_weight TEXT NOT NULL DEFAULT '0',
    recommended BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_commerce_membership_benefit_tenant_membership_id
ON commerce_membership_benefit(tenant_id, membership_id);

CREATE INDEX IF NOT EXISTS idx_commerce_membership_package_tenant_group_id
ON commerce_membership_package(tenant_id, group_id);
