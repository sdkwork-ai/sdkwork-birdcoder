-- GENERATED FILE - DO NOT HAND-EDIT
-- Produced by: scripts/generate-ddl.mjs (pnpm db:generate:ddl)
-- Engine: postgres
-- Module: birdcoder
-- Contract version: 2.0.0
-- Owner: birdcoder-workbench
-- Table prefixes: studio_
-- Sources: baseline(1) + migrations(0)

-- ============================================================
-- baseline: 0001_birdcoder_baseline.sql
-- ============================================================
-- SDKWork BirdCoder greenfield baseline (PostgreSQL)
-- BirdCoder owns coding-workbench facts only. Cross-domain resources are stored
-- as stable identifiers and never receive physical foreign keys.

CREATE TABLE IF NOT EXISTS studio_workspace (
    id BIGINT NOT NULL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL,
    created_by_user_id BIGINT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    icon_url TEXT NULL,
    color TEXT NULL,
    visibility TEXT NOT NULL CHECK (visibility IN ('private', 'organization')),
    status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_studio_workspace_code_nonblank CHECK (length(btrim(code)) BETWEEN 1 AND 96),
    CONSTRAINT chk_studio_workspace_name_nonblank CHECK (length(btrim(name)) BETWEEN 1 AND 160)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_workspace_scope_code_active
ON studio_workspace(tenant_id, organization_id, code)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_studio_workspace_owner_updated
ON studio_workspace(tenant_id, organization_id, owner_user_id, updated_at DESC, id DESC)
WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS studio_project (
    id BIGINT NOT NULL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    workspace_id BIGINT NOT NULL REFERENCES studio_workspace(id) ON DELETE RESTRICT,
    owner_user_id BIGINT NOT NULL,
    created_by_user_id BIGINT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    project_kind TEXT NOT NULL,
    default_agent_project_id TEXT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_studio_project_code_nonblank CHECK (length(btrim(code)) BETWEEN 1 AND 96),
    CONSTRAINT chk_studio_project_name_nonblank CHECK (length(btrim(name)) BETWEEN 1 AND 160),
    CONSTRAINT chk_studio_project_agent_project_id CHECK (
        default_agent_project_id IS NULL OR default_agent_project_id LIKE 'project.%'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_workspace_code_active
ON studio_project(tenant_id, organization_id, workspace_id, code)
WHERE is_deleted = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_agent_project_active
ON studio_project(tenant_id, organization_id, default_agent_project_id)
WHERE is_deleted = FALSE AND default_agent_project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_studio_project_workspace_updated
ON studio_project(tenant_id, organization_id, workspace_id, updated_at DESC, id DESC)
WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS studio_project_document_binding (
    id BIGINT NOT NULL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL REFERENCES studio_project(id) ON DELETE RESTRICT,
    document_id TEXT NOT NULL,
    binding_kind TEXT NOT NULL,
    created_by_user_id BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_studio_project_document_id_nonblank CHECK (length(btrim(document_id)) BETWEEN 1 AND 160),
    CONSTRAINT chk_studio_project_document_kind_nonblank CHECK (length(btrim(binding_kind)) BETWEEN 1 AND 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_document_binding_active
ON studio_project_document_binding(tenant_id, organization_id, project_id, document_id, binding_kind)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_studio_project_document_binding_project
ON studio_project_document_binding(tenant_id, organization_id, project_id, created_at DESC, id DESC)
WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS studio_project_runtime_location (
    id BIGINT NOT NULL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL REFERENCES studio_project(id) ON DELETE RESTRICT,
    registered_by_user_id BIGINT NOT NULL,
    runtime_target_id TEXT NOT NULL,
    runtime_target_kind TEXT NOT NULL CHECK (
        runtime_target_kind IN ('desktop', 'server', 'runner', 'container', 'remote')
    ),
    location_kind TEXT NOT NULL CHECK (
        location_kind IN ('local_directory', 'server_workspace', 'runner_workspace', 'container_workspace', 'remote_workspace')
    ),
    path_flavor TEXT NOT NULL CHECK (path_flavor IN ('windows', 'posix', 'virtual')),
    display_name TEXT NOT NULL,
    encrypted_absolute_path TEXT NOT NULL,
    path_encryption_key_id TEXT NOT NULL,
    path_fingerprint TEXT NOT NULL,
    terminal_available BOOLEAN NOT NULL DEFAULT FALSE,
    git_available BOOLEAN NOT NULL DEFAULT FALSE,
    build_available BOOLEAN NOT NULL DEFAULT FALSE,
    filesystem_available BOOLEAN NOT NULL DEFAULT FALSE,
    health_status TEXT NOT NULL CHECK (
        health_status IN ('pending', 'healthy', 'degraded', 'unreachable', 'revoked')
    ),
    last_verified_at TIMESTAMPTZ NULL,
    last_seen_at TIMESTAMPTZ NULL,
    verified_by_user_id BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_studio_project_runtime_target_id_nonblank CHECK (length(btrim(runtime_target_id)) BETWEEN 1 AND 160),
    CONSTRAINT chk_studio_project_runtime_display_name_nonblank CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
    CONSTRAINT chk_studio_project_runtime_ciphertext_nonblank CHECK (length(encrypted_absolute_path) > 0),
    CONSTRAINT chk_studio_project_runtime_fingerprint CHECK (path_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_runtime_location_active_path
ON studio_project_runtime_location(
    tenant_id,
    organization_id,
    project_id,
    runtime_target_id,
    path_fingerprint
)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_studio_project_runtime_location_project
ON studio_project_runtime_location(tenant_id, organization_id, project_id, updated_at DESC, id DESC)
WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS studio_project_runtime_location_preference (
    id BIGINT NOT NULL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL REFERENCES studio_project(id) ON DELETE RESTRICT,
    subject_user_id BIGINT NOT NULL,
    capability TEXT NOT NULL CHECK (capability IN ('terminal', 'git', 'build', 'filesystem')),
    runtime_location_id BIGINT NOT NULL REFERENCES studio_project_runtime_location(id) ON DELETE RESTRICT,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_runtime_location_preference_active
ON studio_project_runtime_location_preference(
    tenant_id,
    organization_id,
    project_id,
    subject_user_id,
    capability
)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_studio_project_runtime_location_preference_location
ON studio_project_runtime_location_preference(
    tenant_id,
    organization_id,
    runtime_location_id
)
WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS studio_project_runtime_location_idempotency (
    id BIGINT NOT NULL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL REFERENCES studio_project(id) ON DELETE RESTRICT,
    subject_user_id BIGINT NOT NULL,
    operation_kind TEXT NOT NULL,
    idempotency_key_hash TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    resource_kind TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_version BIGINT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_studio_project_runtime_location_idempotency_expiry CHECK (expires_at > created_at),
    CONSTRAINT chk_studio_project_runtime_location_idempotency_hash CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_studio_project_runtime_location_request_hash CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_runtime_location_idempotency
ON studio_project_runtime_location_idempotency(
    tenant_id,
    organization_id,
    project_id,
    subject_user_id,
    operation_kind,
    idempotency_key_hash
);

CREATE INDEX IF NOT EXISTS idx_studio_project_runtime_location_idempotency_expiry
ON studio_project_runtime_location_idempotency(expires_at);

CREATE TABLE IF NOT EXISTS studio_project_runtime_location_audit (
    id BIGINT NOT NULL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL REFERENCES studio_project(id) ON DELETE RESTRICT,
    runtime_location_id BIGINT NULL REFERENCES studio_project_runtime_location(id) ON DELETE SET NULL,
    actor_user_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('succeeded', 'rejected', 'failed')),
    reason_code TEXT NULL,
    trace_id TEXT NULL,
    previous_version BIGINT NULL,
    new_version BIGINT NULL,
    redacted_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_studio_project_runtime_location_audit_metadata_object CHECK (
        jsonb_typeof(redacted_metadata_json) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS idx_studio_project_runtime_location_audit_scope_time
ON studio_project_runtime_location_audit(
    tenant_id,
    organization_id,
    project_id,
    runtime_location_id,
    occurred_at DESC,
    id DESC
);

CREATE TABLE IF NOT EXISTS studio_project_sandbox_binding (
    id BIGINT NOT NULL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL REFERENCES studio_project(id) ON DELETE RESTRICT,
    sandbox_id TEXT NOT NULL,
    root_entry_id TEXT NOT NULL,
    logical_path TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
    created_by_user_id BIGINT NOT NULL,
    updated_by_user_id BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_studio_project_sandbox_id_nonblank CHECK (length(btrim(sandbox_id)) BETWEEN 1 AND 160),
    CONSTRAINT chk_studio_project_sandbox_root_entry_id_nonblank CHECK (length(btrim(root_entry_id)) BETWEEN 1 AND 160),
    CONSTRAINT chk_studio_project_sandbox_logical_path CHECK (
        logical_path = '' OR (logical_path !~ '(^|/)\.\.(/|$)' AND logical_path !~ '^[A-Za-z]:[\\/]')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_sandbox_binding_active
ON studio_project_sandbox_binding(tenant_id, organization_id, project_id)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_studio_project_sandbox_binding_lookup
ON studio_project_sandbox_binding(tenant_id, organization_id, project_id, updated_at DESC, id DESC)
WHERE is_deleted = FALSE;

CREATE TABLE IF NOT EXISTS studio_project_sandbox_binding_idempotency (
    id BIGINT NOT NULL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL REFERENCES studio_project(id) ON DELETE RESTRICT,
    subject_user_id BIGINT NOT NULL,
    operation_kind TEXT NOT NULL,
    idempotency_key_hash TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_version BIGINT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_studio_project_sandbox_binding_idempotency_expiry CHECK (expires_at > created_at),
    CONSTRAINT chk_studio_project_sandbox_binding_idempotency_hash CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_studio_project_sandbox_binding_request_hash CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_studio_project_sandbox_binding_idempotency
ON studio_project_sandbox_binding_idempotency(
    tenant_id,
    organization_id,
    project_id,
    subject_user_id,
    operation_kind,
    idempotency_key_hash
);

CREATE INDEX IF NOT EXISTS idx_studio_project_sandbox_binding_idempotency_expiry
ON studio_project_sandbox_binding_idempotency(expires_at);

CREATE TABLE IF NOT EXISTS studio_project_sandbox_binding_audit (
    id BIGINT NOT NULL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL REFERENCES studio_project(id) ON DELETE RESTRICT,
    sandbox_binding_id BIGINT NULL REFERENCES studio_project_sandbox_binding(id) ON DELETE SET NULL,
    actor_user_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('succeeded', 'rejected', 'failed')),
    reason_code TEXT NULL,
    trace_id TEXT NULL,
    previous_version BIGINT NULL,
    new_version BIGINT NULL,
    redacted_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT chk_studio_project_sandbox_binding_audit_metadata_object CHECK (
        jsonb_typeof(redacted_metadata_json) = 'object'
    )
);

CREATE INDEX IF NOT EXISTS idx_studio_project_sandbox_binding_audit_scope_time
ON studio_project_sandbox_binding_audit(
    tenant_id,
    organization_id,
    project_id,
    sandbox_binding_id,
    occurred_at DESC,
    id DESC
);
