-- sdkwork:migration
-- id: 0004_indexes
-- engine: postgres
-- module: birdcoder
-- purpose: Drop critical query indexes added in 0004_indexes.up.sql
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0

DROP INDEX IF EXISTS idx_ai_coding_session_tenant_workspace_status;
DROP INDEX IF EXISTS idx_ai_coding_session_message_session_created;
DROP INDEX IF EXISTS idx_ai_coding_session_turn_session_created;
DROP INDEX IF EXISTS idx_ai_coding_session_event_session_created;
DROP INDEX IF EXISTS idx_ai_coding_session_artifact_session_created;
DROP INDEX IF EXISTS idx_ai_coding_session_operation_session_status;
DROP INDEX IF EXISTS idx_ai_coding_session_checkpoint_session_created;
DROP INDEX IF EXISTS idx_ai_saved_prompt_entry_user_created;

DROP INDEX IF EXISTS idx_studio_workspace_owner_created;
DROP INDEX IF EXISTS idx_studio_project_workspace_created;
DROP INDEX IF EXISTS idx_studio_team_member_team_user;
DROP INDEX IF EXISTS idx_studio_workspace_member_workspace_user;
DROP INDEX IF EXISTS idx_studio_project_collaborator_project_user;

DROP INDEX IF EXISTS idx_ops_audit_event_tenant_created;
