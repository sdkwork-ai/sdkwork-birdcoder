-- sdkwork:migration
-- id: 0006_subject_id_not_null
-- engine: postgres
-- module: birdcoder
-- purpose: Revert user_id NOT NULL constraint (back to nullable)
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0

ALTER TABLE ai_coding_session ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_coding_session_message ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session_message ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_coding_session_runtime ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session_runtime ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_coding_session_turn ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session_turn ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_coding_session_event ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session_event ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_coding_session_artifact ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session_artifact ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_coding_session_checkpoint ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session_checkpoint ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_coding_session_operation ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session_operation ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_coding_session_prompt_entry ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_coding_session_prompt_entry ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE ai_saved_prompt_entry ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ai_saved_prompt_entry ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE studio_project ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE studio_project ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE studio_project_content ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE studio_project_content ALTER COLUMN user_id DROP DEFAULT;
