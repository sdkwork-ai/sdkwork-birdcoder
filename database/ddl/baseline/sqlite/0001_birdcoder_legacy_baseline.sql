-- birdcoder baseline schema (de-duplicated, tenant isolation per SUBJECT_ID_SPEC)

-- ============================================================
-- AI Coding Session tables (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_coding_session (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    entry_surface TEXT NOT NULL,
    host_mode TEXT NOT NULL DEFAULT 'server',
    engine_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    last_turn_at TEXT NULL,
    native_session_id TEXT NULL,
    sort_timestamp INTEGER NULL,
    transcript_updated_at TEXT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    unread INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_coding_session_message (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    timestamp_ms INTEGER NULL,
    name TEXT NULL,
    tool_calls_json TEXT NULL,
    tool_call_id TEXT NULL,
    file_changes_json TEXT NULL,
    commands_json TEXT NULL,
    task_progress_json TEXT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_runtime (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    engine_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    host_mode TEXT NOT NULL,
    status TEXT NOT NULL,
    transport_kind TEXT NOT NULL,
    native_session_id TEXT NULL,
    native_turn_container_id TEXT NULL,
    capability_snapshot_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_turn (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    runtime_id TEXT NOT NULL,
    request_kind TEXT NOT NULL,
    status TEXT NOT NULL,
    input_summary TEXT NOT NULL,
    started_at TEXT NULL,
    completed_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_event (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NULL,
    runtime_id TEXT NULL,
    event_kind TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_artifact (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NULL,
    artifact_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    blob_ref TEXT NULL,
    metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_checkpoint (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    runtime_id TEXT NULL,
    checkpoint_kind TEXT NOT NULL,
    resumable INTEGER NOT NULL,
    state_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_operation (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    status TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    stream_kind TEXT NOT NULL,
    artifact_refs_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_coding_session_prompt_entry (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    normalized_prompt_text TEXT NOT NULL,
    last_used_at TEXT NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_tenant_project_updated
ON ai_coding_session(tenant_id, project_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_tenant_user_updated
ON ai_coding_session(tenant_id, user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_message_tenant_session_created
ON ai_coding_session_message(tenant_id, coding_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_prompt_entry_tenant_session_last_used
ON ai_coding_session_prompt_entry(tenant_id, coding_session_id, last_used_at);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_coding_session_prompt_entry_tenant_session_normalized_prompt
ON ai_coding_session_prompt_entry(tenant_id, coding_session_id, normalized_prompt_text);

-- ============================================================
-- AI Saved Prompt Entry (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_saved_prompt_entry (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    prompt_text TEXT NOT NULL,
    normalized_prompt_text TEXT NOT NULL,
    last_saved_at TEXT NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_saved_prompt_entry_tenant_user_last_saved
ON ai_saved_prompt_entry(tenant_id, user_id, last_saved_at);

CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_saved_prompt_entry_tenant_normalized_prompt
ON ai_saved_prompt_entry(tenant_id, user_id, normalized_prompt_text);

-- ============================================================
-- Studio Workspace (tenant-scoped)
-- ============================================================

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

-- ============================================================
-- Studio Project (tenant-scoped)
-- ============================================================

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
    user_id INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_studio_project_tenant_name
ON studio_project(tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_studio_project_tenant_code
ON studio_project(tenant_id, code);

-- ============================================================
-- Studio Project Content (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS studio_project_content (
    id INTEGER PRIMARY KEY,
    uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    v INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    data_scope INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER NULL,
    project_id INTEGER NOT NULL,
    project_uuid TEXT NOT NULL,
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

-- ============================================================
-- Studio Deployment Target (tenant-scoped)
-- ============================================================

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

-- ============================================================
-- Studio Deployment Record (tenant-scoped)
-- ============================================================

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

-- ============================================================
-- Studio Team (tenant-scoped)
-- ============================================================

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

-- ============================================================
-- AI Skill Package tables (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_skill_package (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    slug TEXT NOT NULL,
    source_uri TEXT NOT NULL,
    status TEXT NOT NULL,
    manifest_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_skill_version (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    skill_package_id TEXT NOT NULL,
    version_label TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_skill_capability (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    skill_version_id TEXT NOT NULL,
    capability_key TEXT NOT NULL,
    description_text TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_skill_installation (
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
    skill_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    installed_at TEXT NOT NULL
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
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_app_template_version (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    app_template_id TEXT NOT NULL,
    version_label TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_app_template_target_profile (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    app_template_version_id TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    runtime TEXT NOT NULL,
    deployment_mode TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_app_template_preset (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    app_template_version_id TEXT NOT NULL,
    preset_key TEXT NOT NULL,
    description_text TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio_app_template_instantiation (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
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

-- ============================================================
-- Runtime Model Config (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS runtime_model_config (
    id TEXT PRIMARY KEY,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    config_key TEXT NOT NULL,
    config_json TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'server',
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_runtime_model_config_tenant_key
ON runtime_model_config(tenant_id, config_key);

-- ============================================================
-- Commerce Membership tables (tenant-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS commerce_membership (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    owner_user_id TEXT NOT NULL,
    plan_id TEXT NULL,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NULL,
    expires_at TEXT NULL,
    remaining_days TEXT NOT NULL DEFAULT '0',
    total_days TEXT NOT NULL DEFAULT '0',
    total_spent TEXT NOT NULL DEFAULT '0',
    points TEXT NOT NULL DEFAULT '0',
    growth_value TEXT NOT NULL DEFAULT '0',
    upgrade_growth_value TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS commerce_membership_benefit (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    membership_id TEXT NOT NULL,
    name TEXT NOT NULL,
    benefit_key TEXT NULL,
    benefit_type TEXT NULL,
    description TEXT NULL,
    icon TEXT NULL,
    claimed INTEGER NOT NULL DEFAULT 0,
    usage_limit TEXT NULL,
    used_count TEXT NULL
);

CREATE TABLE IF NOT EXISTS commerce_membership_package_group (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    description TEXT NULL,
    sort_weight TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS commerce_membership_package (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id INTEGER NOT NULL DEFAULT 0,
    organization_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    price TEXT NOT NULL,
    original_price TEXT NULL,
    point_amount TEXT NOT NULL DEFAULT '0',
    duration_days TEXT NOT NULL DEFAULT '30',
    plan_name TEXT NULL,
    sort_weight TEXT NOT NULL DEFAULT '0',
    recommended INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_commerce_membership_benefit_tenant_membership_id
ON commerce_membership_benefit(tenant_id, membership_id);

CREATE INDEX IF NOT EXISTS idx_commerce_membership_package_tenant_group_id
ON commerce_membership_package(tenant_id, group_id);
