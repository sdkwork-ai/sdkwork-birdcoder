-- sdkwork:migration
-- id: 0004_indexes
-- engine: sqlite
-- module: birdcoder
-- purpose: Backfill critical query indexes across ai_/studio_/ops_/runtime_ domains (P1-16)
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0
--
-- NOTE: Task P1-16 listed 17 indexes. Three reference columns absent from the
-- baseline 0001 schema and are intentionally omitted here pending a schema decision:
--   * idx_studio_project_content_project_type -> studio_project_content.content_type (column absent)
--   * idx_ops_release_record_target_created     -> ops_release_record.target_id (column absent)
--   * idx_runtime_model_config_provider_active  -> runtime_model_config.provider / is_active (columns absent)
-- The ai_coding_session_* "session" foreign-key column is named coding_session_id
-- in the baseline (not session_id); index names below keep the requested *_session_*
-- naming while indexing the actual coding_session_id column.

-- ============================================================
-- ai_ domain
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_tenant_workspace_status
ON ai_coding_session(tenant_id, workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_message_session_created
ON ai_coding_session_message(coding_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_turn_session_created
ON ai_coding_session_turn(coding_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_event_session_created
ON ai_coding_session_event(coding_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_artifact_session_created
ON ai_coding_session_artifact(coding_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_operation_session_status
ON ai_coding_session_operation(coding_session_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_checkpoint_session_created
ON ai_coding_session_checkpoint(coding_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_saved_prompt_entry_user_created
ON ai_saved_prompt_entry(user_id, created_at);

-- ============================================================
-- studio_ domain
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_studio_workspace_owner_created
ON studio_workspace(owner_id, created_at);

CREATE INDEX IF NOT EXISTS idx_studio_project_workspace_created
ON studio_project(workspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_studio_team_member_team_user
ON studio_team_member(team_id, user_id);

CREATE INDEX IF NOT EXISTS idx_studio_workspace_member_workspace_user
ON studio_workspace_member(workspace_id, user_id);

CREATE INDEX IF NOT EXISTS idx_studio_project_collaborator_project_user
ON studio_project_collaborator(project_id, user_id);

-- ============================================================
-- ops_ domain
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ops_audit_event_tenant_created
ON ops_audit_event(tenant_id, created_at);
