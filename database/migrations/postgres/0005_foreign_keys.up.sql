-- sdkwork:migration
-- id: 0005_foreign_keys
-- engine: postgres
-- module: birdcoder
-- purpose: Add core strong-relation FK constraints (P1-17)
-- reversible: true
-- transactional: true
-- lock: lightweight
-- contract_version: 1.0.0
--
-- Policy: ON DELETE RESTRICT ON UPDATE CASCADE (default strong-relation strategy).
--
-- Column adaptations vs task text (actual baseline column names):
--   * ai_coding_session_*.session_id  -> actual column coding_session_id
--   * ai_skill_*.skill_id              -> actual columns skill_package_id / skill_version_id
--     with natural targets ai_skill_package.id / ai_skill_version.id
--   * studio_app_template_*.template_id -> actual columns app_template_id / app_template_version_id
--     with natural targets studio_app_template.id / studio_app_template_version.id
--
-- Blocked FKs (omitted pending schema decision):
--   * studio_project_document.project_id  -> studio_project.id        (type mismatch: TEXT vs INTEGER)
--   * studio_deployment_record.project_id  -> studio_project.id        (type mismatch: TEXT vs INTEGER)
--   * ops_release_record.target_id          -> studio_deployment_target.id (column target_id absent)
--   * commerce_membership.user_id           -> user table               (no user table owned by this module)
--   * commerce_order.user_id                -> user table               (no user table owned by this module)

-- ============================================================
-- ai_ session relations -> ai_coding_session.id
-- ============================================================

ALTER TABLE ai_coding_session_message
    ADD CONSTRAINT fk_ai_coding_session_message_coding_session_id
    FOREIGN KEY (coding_session_id) REFERENCES ai_coding_session(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_coding_session_turn
    ADD CONSTRAINT fk_ai_coding_session_turn_coding_session_id
    FOREIGN KEY (coding_session_id) REFERENCES ai_coding_session(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_coding_session_event
    ADD CONSTRAINT fk_ai_coding_session_event_coding_session_id
    FOREIGN KEY (coding_session_id) REFERENCES ai_coding_session(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_coding_session_artifact
    ADD CONSTRAINT fk_ai_coding_session_artifact_coding_session_id
    FOREIGN KEY (coding_session_id) REFERENCES ai_coding_session(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_coding_session_runtime
    ADD CONSTRAINT fk_ai_coding_session_runtime_coding_session_id
    FOREIGN KEY (coding_session_id) REFERENCES ai_coding_session(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_coding_session_checkpoint
    ADD CONSTRAINT fk_ai_coding_session_checkpoint_coding_session_id
    FOREIGN KEY (coding_session_id) REFERENCES ai_coding_session(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_coding_session_operation
    ADD CONSTRAINT fk_ai_coding_session_operation_coding_session_id
    FOREIGN KEY (coding_session_id) REFERENCES ai_coding_session(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_coding_session_prompt_entry
    ADD CONSTRAINT fk_ai_coding_session_prompt_entry_coding_session_id
    FOREIGN KEY (coding_session_id) REFERENCES ai_coding_session(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- ai_skill relations
-- ============================================================

ALTER TABLE ai_skill_version
    ADD CONSTRAINT fk_ai_skill_version_skill_package_id
    FOREIGN KEY (skill_package_id) REFERENCES ai_skill_package(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_skill_capability
    ADD CONSTRAINT fk_ai_skill_capability_skill_version_id
    FOREIGN KEY (skill_version_id) REFERENCES ai_skill_version(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ai_skill_installation
    ADD CONSTRAINT fk_ai_skill_installation_skill_version_id
    FOREIGN KEY (skill_version_id) REFERENCES ai_skill_version(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- studio_ relations
-- ============================================================

ALTER TABLE studio_project
    ADD CONSTRAINT fk_studio_project_workspace_id
    FOREIGN KEY (workspace_id) REFERENCES studio_workspace(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_project_content
    ADD CONSTRAINT fk_studio_project_content_project_id
    FOREIGN KEY (project_id) REFERENCES studio_project(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_team_member
    ADD CONSTRAINT fk_studio_team_member_team_id
    FOREIGN KEY (team_id) REFERENCES studio_team(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_workspace_member
    ADD CONSTRAINT fk_studio_workspace_member_workspace_id
    FOREIGN KEY (workspace_id) REFERENCES studio_workspace(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_project_collaborator
    ADD CONSTRAINT fk_studio_project_collaborator_project_id
    FOREIGN KEY (project_id) REFERENCES studio_project(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_app_template_version
    ADD CONSTRAINT fk_studio_app_template_version_app_template_id
    FOREIGN KEY (app_template_id) REFERENCES studio_app_template(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_app_template_target_profile
    ADD CONSTRAINT fk_studio_app_template_target_profile_app_template_version_id
    FOREIGN KEY (app_template_version_id) REFERENCES studio_app_template_version(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_app_template_preset
    ADD CONSTRAINT fk_studio_app_template_preset_app_template_version_id
    FOREIGN KEY (app_template_version_id) REFERENCES studio_app_template_version(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_app_template_instantiation
    ADD CONSTRAINT fk_studio_app_template_instantiation_app_template_version_id
    FOREIGN KEY (app_template_version_id) REFERENCES studio_app_template_version(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE studio_deployment_record
    ADD CONSTRAINT fk_studio_deployment_record_target_id
    FOREIGN KEY (target_id) REFERENCES studio_deployment_target(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- commerce_ relations
-- ============================================================

ALTER TABLE commerce_invoice
    ADD CONSTRAINT fk_commerce_invoice_order_id
    FOREIGN KEY (order_id) REFERENCES commerce_order(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE commerce_payment
    ADD CONSTRAINT fk_commerce_payment_order_id
    FOREIGN KEY (order_id) REFERENCES commerce_order(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;
