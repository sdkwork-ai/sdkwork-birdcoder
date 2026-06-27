-- sdkwork:migration
-- id: 0005_foreign_keys
-- engine: postgres
-- module: birdcoder
-- purpose: Drop core strong-relation FK constraints added in 0005_foreign_keys.up.sql
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0

ALTER TABLE ai_coding_session_message DROP CONSTRAINT IF EXISTS fk_ai_coding_session_message_coding_session_id;
ALTER TABLE ai_coding_session_turn DROP CONSTRAINT IF EXISTS fk_ai_coding_session_turn_coding_session_id;
ALTER TABLE ai_coding_session_event DROP CONSTRAINT IF EXISTS fk_ai_coding_session_event_coding_session_id;
ALTER TABLE ai_coding_session_artifact DROP CONSTRAINT IF EXISTS fk_ai_coding_session_artifact_coding_session_id;
ALTER TABLE ai_coding_session_runtime DROP CONSTRAINT IF EXISTS fk_ai_coding_session_runtime_coding_session_id;
ALTER TABLE ai_coding_session_checkpoint DROP CONSTRAINT IF EXISTS fk_ai_coding_session_checkpoint_coding_session_id;
ALTER TABLE ai_coding_session_operation DROP CONSTRAINT IF EXISTS fk_ai_coding_session_operation_coding_session_id;
ALTER TABLE ai_coding_session_prompt_entry DROP CONSTRAINT IF EXISTS fk_ai_coding_session_prompt_entry_coding_session_id;

ALTER TABLE ai_skill_version DROP CONSTRAINT IF EXISTS fk_ai_skill_version_skill_package_id;
ALTER TABLE ai_skill_capability DROP CONSTRAINT IF EXISTS fk_ai_skill_capability_skill_version_id;
ALTER TABLE ai_skill_installation DROP CONSTRAINT IF EXISTS fk_ai_skill_installation_skill_version_id;

ALTER TABLE studio_project DROP CONSTRAINT IF EXISTS fk_studio_project_workspace_id;
ALTER TABLE studio_project_content DROP CONSTRAINT IF EXISTS fk_studio_project_content_project_id;
ALTER TABLE studio_team_member DROP CONSTRAINT IF EXISTS fk_studio_team_member_team_id;
ALTER TABLE studio_workspace_member DROP CONSTRAINT IF EXISTS fk_studio_workspace_member_workspace_id;
ALTER TABLE studio_project_collaborator DROP CONSTRAINT IF EXISTS fk_studio_project_collaborator_project_id;
ALTER TABLE studio_app_template_version DROP CONSTRAINT IF EXISTS fk_studio_app_template_version_app_template_id;
ALTER TABLE studio_app_template_target_profile DROP CONSTRAINT IF EXISTS fk_studio_app_template_target_profile_app_template_version_id;
ALTER TABLE studio_app_template_preset DROP CONSTRAINT IF EXISTS fk_studio_app_template_preset_app_template_version_id;
ALTER TABLE studio_app_template_instantiation DROP CONSTRAINT IF EXISTS fk_studio_app_template_instantiation_app_template_version_id;
ALTER TABLE studio_deployment_record DROP CONSTRAINT IF EXISTS fk_studio_deployment_record_target_id;

ALTER TABLE commerce_invoice DROP CONSTRAINT IF EXISTS fk_commerce_invoice_order_id;
ALTER TABLE commerce_payment DROP CONSTRAINT IF EXISTS fk_commerce_payment_order_id;
