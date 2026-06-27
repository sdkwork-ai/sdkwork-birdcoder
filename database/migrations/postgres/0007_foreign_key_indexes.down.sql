-- sdkwork:migration
-- id: 0007_foreign_key_indexes
-- engine: postgres
-- module: birdcoder
-- purpose: Remove foreign key column indexes added in 0007
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0

DROP INDEX IF EXISTS idx_ai_coding_session_runtime_session_created;
DROP INDEX IF EXISTS idx_ai_coding_session_turn_runtime_created;
DROP INDEX IF EXISTS idx_ai_coding_session_event_turn_sequence;
DROP INDEX IF EXISTS idx_ai_coding_session_artifact_turn_created;
DROP INDEX IF EXISTS idx_ai_coding_session_operation_turn_status;
DROP INDEX IF EXISTS idx_ai_coding_session_message_turn_created;
DROP INDEX IF EXISTS idx_studio_project_user_deleted;
DROP INDEX IF EXISTS idx_studio_project_content_user_deleted;
