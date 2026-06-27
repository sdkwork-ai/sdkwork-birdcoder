-- sdkwork:migration
-- id: 0007_foreign_key_indexes
-- engine: postgres
-- module: birdcoder
-- purpose: Add missing foreign key column indexes for join performance
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0
--
-- Migration 0004 covered the primary coding_session_id indexes. This migration
-- adds indexes for runtime_id and turn_id foreign key columns that are used in
-- JOIN and WHERE clauses when fetching turn/event/artifact/operation details.

-- ai_coding_session_runtime: index for session → runtime lookups
CREATE INDEX IF NOT EXISTS idx_ai_coding_session_runtime_session_created
ON ai_coding_session_runtime(coding_session_id, created_at);

-- ai_coding_session_turn: index for runtime → turn lookups
CREATE INDEX IF NOT EXISTS idx_ai_coding_session_turn_runtime_created
ON ai_coding_session_turn(runtime_id, created_at);

-- ai_coding_session_event: index for turn → event lookups
CREATE INDEX IF NOT EXISTS idx_ai_coding_session_event_turn_sequence
ON ai_coding_session_event(turn_id, sequence_no);

-- ai_coding_session_artifact: index for turn → artifact lookups
CREATE INDEX IF NOT EXISTS idx_ai_coding_session_artifact_turn_created
ON ai_coding_session_artifact(turn_id, created_at);

-- ai_coding_session_operation: index for turn → operation lookups
CREATE INDEX IF NOT EXISTS idx_ai_coding_session_operation_turn_status
ON ai_coding_session_operation(turn_id, status);

-- ai_coding_session_message: index for turn → message lookups
CREATE INDEX IF NOT EXISTS idx_ai_coding_session_message_turn_created
ON ai_coding_session_message(turn_id, created_at);

-- studio_project: index for user_id + is_deleted filtering (tenant isolation)
CREATE INDEX IF NOT EXISTS idx_studio_project_user_deleted
ON studio_project(user_id, is_deleted);

-- studio_project_content: index for user_id + is_deleted filtering (tenant isolation)
CREATE INDEX IF NOT EXISTS idx_studio_project_content_user_deleted
ON studio_project_content(user_id, is_deleted);
