-- sdkwork:migration
-- id: 0007_foreign_key_indexes
-- engine: sqlite
-- module: birdcoder
-- purpose: Add missing foreign key column indexes for join performance
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_runtime_session_created
ON ai_coding_session_runtime(coding_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_turn_runtime_created
ON ai_coding_session_turn(runtime_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_event_turn_sequence
ON ai_coding_session_event(turn_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_artifact_turn_created
ON ai_coding_session_artifact(turn_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_operation_turn_status
ON ai_coding_session_operation(turn_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_coding_session_message_turn_created
ON ai_coding_session_message(turn_id, created_at);

CREATE INDEX IF NOT EXISTS idx_studio_project_user_deleted
ON studio_project(user_id, is_deleted);

CREATE INDEX IF NOT EXISTS idx_studio_project_content_user_deleted
ON studio_project_content(user_id, is_deleted);
