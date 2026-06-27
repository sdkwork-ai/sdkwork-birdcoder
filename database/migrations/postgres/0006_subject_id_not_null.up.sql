-- sdkwork:migration
-- id: 0006_subject_id_not_null
-- engine: postgres
-- module: birdcoder
-- purpose: Enforce NOT NULL on user_id columns for SUBJECT_ID_SPEC tenant isolation
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0
--
-- Per SUBJECT_ID_SPEC.md, tenant_id, organization_id, and user_id must all be
-- NOT NULL to prevent cross-user data leakage when WHERE filters omit user_id.
-- Existing NULL user_id values are backfilled to 0 (system user) before the
-- constraint is applied.

-- ============================================================
-- Backfill NULL user_id values to 0 (system user)
-- ============================================================

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

-- ============================================================
-- Enforce NOT NULL with DEFAULT 0
-- ============================================================

ALTER TABLE ai_coding_session ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_coding_session_message ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session_message ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_coding_session_runtime ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session_runtime ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_coding_session_turn ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session_turn ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_coding_session_event ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session_event ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_coding_session_artifact ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session_artifact ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_coding_session_checkpoint ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session_checkpoint ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_coding_session_operation ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session_operation ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_coding_session_prompt_entry ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_coding_session_prompt_entry ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_saved_prompt_entry ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE ai_saved_prompt_entry ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE studio_project ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE studio_project ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE studio_project_content ALTER COLUMN user_id SET DEFAULT 0;
ALTER TABLE studio_project_content ALTER COLUMN user_id SET NOT NULL;
