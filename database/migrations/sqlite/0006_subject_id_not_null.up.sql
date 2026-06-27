-- sdkwork:migration
-- id: 0006_subject_id_not_null
-- engine: sqlite
-- module: birdcoder
-- purpose: Backfill NULL user_id values to 0 for SUBJECT_ID_SPEC tenant isolation
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0
--
-- SQLite does not support ALTER COLUMN SET NOT NULL. The NOT NULL constraint
-- is enforced in the baseline DDL (0001) for new installations. This migration
-- backfills existing NULL values so the data is consistent before any schema
-- recreation or migration to PostgreSQL.

UPDATE ai_coding_session SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_coding_session_message SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_coding_session_runtime SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_coding_session_turn SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_coding_session_event SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_coding_session_artifact SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_coding_session_checkpoint SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_coding_session_operation SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_coding_session_prompt_entry SET user_id = 0 WHERE user_id IS NULL;
UPDATE ai_saved_prompt_entry SET user_id = 0 WHERE user_id IS NULL;
UPDATE studio_project SET user_id = 0 WHERE user_id IS NULL;
UPDATE studio_project_content SET user_id = 0 WHERE user_id IS NULL;
