pub const ALL_TABLES_DDL: &str = r#"
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

CREATE INDEX IF NOT EXISTS idx_commerce_membership_benefit_membership_id
ON commerce_membership_benefit(membership_id);

CREATE INDEX IF NOT EXISTS idx_commerce_membership_package_group_id
ON commerce_membership_package(group_id);
"#;

pub fn initialize_schema(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute_batch(ALL_TABLES_DDL)
}
