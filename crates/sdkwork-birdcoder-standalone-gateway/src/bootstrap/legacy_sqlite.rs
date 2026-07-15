use sqlx::SqlitePool;

#[derive(Clone, Copy)]
struct LegacySqliteTable {
    name: &'static str,
    add_uuid: bool,
}

#[derive(Clone, Copy)]
struct LegacySqliteColumn {
    table: &'static str,
    name: &'static str,
    definition: &'static str,
}

const TENANT_USER_TABLES: &[LegacySqliteTable] = &[
    LegacySqliteTable {
        name: "ai_coding_session",
        add_uuid: false,
    },
    LegacySqliteTable {
        name: "ai_coding_session_artifact",
        add_uuid: true,
    },
    LegacySqliteTable {
        name: "ai_coding_session_checkpoint",
        add_uuid: true,
    },
    LegacySqliteTable {
        name: "ai_coding_session_event",
        add_uuid: true,
    },
    LegacySqliteTable {
        name: "ai_coding_session_message",
        add_uuid: false,
    },
    LegacySqliteTable {
        name: "ai_coding_session_operation",
        add_uuid: true,
    },
    LegacySqliteTable {
        name: "ai_coding_session_prompt_entry",
        add_uuid: true,
    },
    LegacySqliteTable {
        name: "ai_coding_session_runtime",
        add_uuid: true,
    },
    LegacySqliteTable {
        name: "ai_coding_session_turn",
        add_uuid: true,
    },
];

const OPERATION_COLUMNS: &[(&str, &str)] = &[
    ("request_payload_json", "TEXT NOT NULL DEFAULT '{}'"),
    ("request_fingerprint", "TEXT NOT NULL DEFAULT ''"),
    ("idempotency_key", "TEXT NULL"),
    (
        "available_at",
        "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z'",
    ),
    ("attempt", "INTEGER NOT NULL DEFAULT 0"),
    ("max_attempt", "INTEGER NOT NULL DEFAULT 1"),
    ("lease_owner", "TEXT NULL"),
    ("lease_expires_at", "TEXT NULL"),
    ("fencing_token", "INTEGER NOT NULL DEFAULT 0"),
    ("runner_id", "TEXT NULL"),
    ("started_at", "TEXT NULL"),
    ("completed_at", "TEXT NULL"),
    ("problem_json", "TEXT NULL"),
];

fn legacy_sqlite_columns() -> Vec<LegacySqliteColumn> {
    let mut columns = Vec::new();
    for table in TENANT_USER_TABLES {
        if table.add_uuid {
            columns.push(LegacySqliteColumn {
                table: table.name,
                name: "uuid",
                definition: "TEXT NULL",
            });
        }
        for name in ["tenant_id", "organization_id", "user_id"] {
            columns.push(LegacySqliteColumn {
                table: table.name,
                name,
                definition: "INTEGER NOT NULL DEFAULT 0",
            });
        }
    }
    columns.extend(
        OPERATION_COLUMNS
            .iter()
            .map(|(name, definition)| LegacySqliteColumn {
                table: "ai_coding_session_operation",
                name,
                definition,
            }),
    );
    for name in ["tenant_id", "organization_id"] {
        columns.push(LegacySqliteColumn {
            table: "runtime_model_config",
            name,
            definition: "INTEGER NOT NULL DEFAULT 0",
        });
    }
    columns.push(LegacySqliteColumn {
        table: "studio_project_content",
        name: "is_deleted",
        definition: "INTEGER NOT NULL DEFAULT 0",
    });
    columns
}

pub(super) async fn upgrade_legacy_sqlite_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    for column in legacy_sqlite_columns() {
        let table_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        )
        .bind(column.table)
        .fetch_one(pool)
        .await?
            > 0;
        if !table_exists {
            continue;
        }

        let column_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2",
        )
        .bind(column.table)
        .bind(column.name)
        .fetch_one(pool)
        .await?
            > 0;
        if column_exists {
            continue;
        }

        let statement = format!(
            "ALTER TABLE \"{}\" ADD COLUMN \"{}\" {}",
            column.table, column.name, column.definition,
        );
        sqlx::query(&statement).execute(pool).await?;
        tracing::info!(
            table = column.table,
            column = column.name,
            "expanded legacy BirdCoder SQLite schema"
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn legacy_sqlite_schema_upgrade_is_additive_and_replay_safe() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory SQLite pool should connect");
        let columns = legacy_sqlite_columns();
        let mut legacy_tables = columns
            .iter()
            .map(|column| column.table)
            .collect::<Vec<_>>();
        legacy_tables.sort_unstable();
        legacy_tables.dedup();

        for table in legacy_tables {
            let statement = format!("CREATE TABLE \"{table}\" (id TEXT PRIMARY KEY)");
            sqlx::query(&statement)
                .execute(&pool)
                .await
                .expect("legacy fixture table should be created");
        }
        sqlx::query("INSERT INTO ai_coding_session (id) VALUES ('legacy-session')")
            .execute(&pool)
            .await
            .expect("legacy fixture row should be created");

        upgrade_legacy_sqlite_schema(&pool)
            .await
            .expect("legacy schema should be upgraded");
        upgrade_legacy_sqlite_schema(&pool)
            .await
            .expect("legacy schema upgrade should be replay safe");

        for column in columns {
            let count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2",
            )
            .bind(column.table)
            .bind(column.name)
            .fetch_one(&pool)
            .await
            .expect("upgraded column should be inspectable");
            assert_eq!(count, 1, "{}.{} should exist", column.table, column.name);
        }

        let legacy_rows = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM ai_coding_session WHERE id = 'legacy-session'",
        )
        .fetch_one(&pool)
        .await
        .expect("legacy row should remain queryable");
        assert_eq!(legacy_rows, 1);
    }
}
