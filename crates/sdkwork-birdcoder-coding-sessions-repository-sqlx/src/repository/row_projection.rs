fn qualified(alias: &str, column: &str) -> String {
    if alias.is_empty() {
        column.to_owned()
    } else {
        format!("{alias}.{column}")
    }
}

fn selected(alias: &str, column: &str) -> String {
    format!("{} AS {column}", qualified(alias, column))
}

fn uuid_as_text(alias: &str, column: &str) -> String {
    format!("CAST({} AS TEXT) AS {column}", qualified(alias, column))
}

fn json_as_text(alias: &str, column: &str) -> String {
    format!("CAST({} AS TEXT) AS {column}", qualified(alias, column))
}

fn timestamp_as_text(alias: &str, column: &str) -> String {
    format!(
        "TO_CHAR({} AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS {column}",
        qualified(alias, column),
    )
}

fn sqlite_wildcard(alias: &str) -> String {
    if alias.is_empty() {
        "*".to_owned()
    } else {
        format!("{alias}.*")
    }
}

pub(crate) fn session(is_postgres: bool, alias: &str) -> String {
    if !is_postgres {
        return sqlite_wildcard(alias);
    }

    [
        selected(alias, "id"),
        uuid_as_text(alias, "uuid"),
        timestamp_as_text(alias, "created_at"),
        timestamp_as_text(alias, "updated_at"),
        selected(alias, "version"),
        selected(alias, "is_deleted"),
        selected(alias, "workspace_id"),
        selected(alias, "project_id"),
        selected(alias, "runtime_location_id"),
        selected(alias, "title"),
        selected(alias, "status"),
        selected(alias, "entry_surface"),
        selected(alias, "host_mode"),
        selected(alias, "engine_id"),
        selected(alias, "model_id"),
        timestamp_as_text(alias, "last_turn_at"),
        selected(alias, "native_session_id"),
        selected(alias, "native_session_tree_id"),
        selected(alias, "native_parent_session_id"),
        selected(alias, "native_forked_from_session_id"),
        selected(alias, "native_title"),
        selected(alias, "native_preview"),
        selected(alias, "native_source"),
        selected(alias, "provider_version"),
        selected(alias, "model_provider"),
        selected(alias, "native_project_id"),
        selected(alias, "native_cwd"),
        selected(alias, "native_git_branch"),
        selected(alias, "native_git_commit"),
        selected(alias, "native_git_repository_url"),
        selected(alias, "native_agent_name"),
        selected(alias, "native_agent_role"),
        selected(alias, "native_is_ephemeral"),
        selected(alias, "native_is_sidechain"),
        selected(alias, "native_schema_version"),
        json_as_text(alias, "native_metadata_json"),
        selected(alias, "sort_timestamp"),
        timestamp_as_text(alias, "transcript_updated_at"),
        selected(alias, "pinned"),
        selected(alias, "archived"),
        selected(alias, "unread"),
    ]
    .join(", ")
}

pub(crate) fn message(is_postgres: bool, alias: &str) -> String {
    if !is_postgres {
        return sqlite_wildcard(alias);
    }

    [
        selected(alias, "id"),
        uuid_as_text(alias, "uuid"),
        timestamp_as_text(alias, "created_at"),
        timestamp_as_text(alias, "updated_at"),
        selected(alias, "version"),
        selected(alias, "is_deleted"),
        selected(alias, "coding_session_id"),
        selected(alias, "turn_id"),
        selected(alias, "role"),
        selected(alias, "content"),
        json_as_text(alias, "metadata_json"),
        selected(alias, "timestamp_ms"),
        selected(alias, "name"),
        json_as_text(alias, "tool_calls_json"),
        selected(alias, "tool_call_id"),
        json_as_text(alias, "file_changes_json"),
        json_as_text(alias, "commands_json"),
        json_as_text(alias, "task_progress_json"),
    ]
    .join(", ")
}

pub(crate) fn turn(is_postgres: bool, alias: &str) -> String {
    if !is_postgres {
        return sqlite_wildcard(alias);
    }

    [
        selected(alias, "id"),
        timestamp_as_text(alias, "created_at"),
        timestamp_as_text(alias, "updated_at"),
        selected(alias, "version"),
        selected(alias, "is_deleted"),
        selected(alias, "coding_session_id"),
        selected(alias, "runtime_id"),
        selected(alias, "request_kind"),
        selected(alias, "status"),
        selected(alias, "input_summary"),
        timestamp_as_text(alias, "started_at"),
        timestamp_as_text(alias, "completed_at"),
    ]
    .join(", ")
}

pub(crate) fn event(is_postgres: bool, alias: &str) -> String {
    if !is_postgres {
        return sqlite_wildcard(alias);
    }

    [
        selected(alias, "id"),
        timestamp_as_text(alias, "created_at"),
        timestamp_as_text(alias, "updated_at"),
        selected(alias, "version"),
        selected(alias, "is_deleted"),
        selected(alias, "coding_session_id"),
        selected(alias, "turn_id"),
        selected(alias, "runtime_id"),
        selected(alias, "event_kind"),
        selected(alias, "sequence_no"),
        json_as_text(alias, "payload_json"),
    ]
    .join(", ")
}

pub(crate) fn artifact(is_postgres: bool, alias: &str) -> String {
    if !is_postgres {
        return sqlite_wildcard(alias);
    }

    [
        selected(alias, "id"),
        timestamp_as_text(alias, "created_at"),
        timestamp_as_text(alias, "updated_at"),
        selected(alias, "version"),
        selected(alias, "is_deleted"),
        selected(alias, "coding_session_id"),
        selected(alias, "turn_id"),
        selected(alias, "artifact_kind"),
        selected(alias, "title"),
        selected(alias, "blob_ref"),
        json_as_text(alias, "metadata_json"),
    ]
    .join(", ")
}

pub(crate) fn checkpoint(is_postgres: bool, alias: &str) -> String {
    if !is_postgres {
        return sqlite_wildcard(alias);
    }

    [
        selected(alias, "id"),
        timestamp_as_text(alias, "created_at"),
        timestamp_as_text(alias, "updated_at"),
        selected(alias, "version"),
        selected(alias, "is_deleted"),
        selected(alias, "coding_session_id"),
        selected(alias, "runtime_id"),
        selected(alias, "checkpoint_kind"),
        selected(alias, "resumable"),
        json_as_text(alias, "state_json"),
    ]
    .join(", ")
}

pub(crate) fn operation(is_postgres: bool, alias: &str) -> String {
    if !is_postgres {
        return sqlite_wildcard(alias);
    }

    [
        selected(alias, "id"),
        timestamp_as_text(alias, "created_at"),
        timestamp_as_text(alias, "updated_at"),
        selected(alias, "version"),
        selected(alias, "is_deleted"),
        selected(alias, "coding_session_id"),
        selected(alias, "turn_id"),
        selected(alias, "status"),
        selected(alias, "stream_url"),
        selected(alias, "stream_kind"),
        json_as_text(alias, "artifact_refs_json"),
    ]
    .join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sqlite_session_projection_retains_wildcard_for_legacy_tables() {
        assert_eq!(session(false, "s"), "s.*");
    }

    #[test]
    fn postgres_session_projection_converts_driver_specific_types() {
        let projection = session(true, "s");
        assert!(projection.contains("CAST(s.uuid AS TEXT) AS uuid"));
        assert!(projection.contains("TO_CHAR(s.created_at AT TIME ZONE 'UTC'"));
        assert!(projection.contains("CAST(s.native_metadata_json AS TEXT) AS native_metadata_json"));
        assert!(projection.contains("s.pinned AS pinned"));
    }
}
