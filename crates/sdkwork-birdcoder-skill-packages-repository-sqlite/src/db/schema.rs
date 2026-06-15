pub const ALL_TABLES_DDL: &str = r#"
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

CREATE INDEX IF NOT EXISTS idx_ai_skill_version_package_id
ON ai_skill_version(skill_package_id);

CREATE INDEX IF NOT EXISTS idx_ai_skill_capability_version_id
ON ai_skill_capability(skill_version_id);

CREATE INDEX IF NOT EXISTS idx_ai_skill_installation_version_id
ON ai_skill_installation(skill_version_id);
"#;

pub fn initialize_schema(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute_batch(ALL_TABLES_DDL)
}
