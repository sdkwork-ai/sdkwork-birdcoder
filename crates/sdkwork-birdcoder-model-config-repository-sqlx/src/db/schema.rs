pub const ALL_TABLES_DDL: &str = r#"
CREATE TABLE IF NOT EXISTS runtime_model_config (
    id TEXT PRIMARY KEY,
    config_key TEXT NOT NULL UNIQUE,
    config_json TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'server',
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_runtime_model_config_key
ON runtime_model_config(config_key);
"#;
