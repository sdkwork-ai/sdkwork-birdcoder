import type { BirdCoderEntityStorageBinding } from './data.ts';

export type { BirdCoderEntityStorageBinding } from './data.ts';

export const BIRDCODER_APPBASE_AUTH_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'user_account',
  storageScope: 'appbase.user-center.auth',
  storageKey: 'session',
  preferredProvider: 'sqlite',
  storageMode: 'key-value',
};

export const BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'user_profile',
  storageScope: 'appbase.user-center.user',
  storageKey: 'profile',
  preferredProvider: 'sqlite',
  storageMode: 'key-value',
};

export const BIRDCODER_APPBASE_VIP_SUBSCRIPTION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'vip_subscription',
  storageScope: 'appbase.commerce.vip',
  storageKey: 'membership',
  preferredProvider: 'sqlite',
  storageMode: 'key-value',
};

export const BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'workbench_preference',
  storageScope: 'workbench',
  storageKey: 'preferences',
  preferredProvider: 'sqlite',
  storageMode: 'key-value',
};

export const BIRDCODER_RUN_CONFIGURATION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'run_configuration',
  storageScope: 'runtime.run-configurations',
  storageKey: 'run-configs.global.v1',
  preferredProvider: 'sqlite',
  storageMode: 'key-value',
};

export const BIRDCODER_TERMINAL_SESSION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'terminal_session',
  storageScope: 'runtime.terminal',
  storageKey: 'sessions.v1',
  preferredProvider: 'sqlite',
  storageMode: 'key-value',
};

export const BIRDCODER_TERMINAL_EXECUTION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'terminal_execution',
  storageScope: 'runtime.terminal',
  storageKey: 'executions.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_WORKSPACE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'workspace',
  storageScope: 'workspace',
  storageKey: 'workspaces.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_PROJECT_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'project',
  storageScope: 'workspace',
  storageKey: 'projects.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_TEAM_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'team',
  storageScope: 'collaboration',
  storageKey: 'teams.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_TEAM_MEMBER_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'team_member',
  storageScope: 'collaboration',
  storageKey: 'team-members.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_DEPLOYMENT_TARGET_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'deployment_target',
  storageScope: 'deployment',
  storageKey: 'deployment-targets.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_CODING_SESSION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'coding_session',
  storageScope: 'coding-session',
  storageKey: 'coding-sessions.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_CODING_SESSION_TURN_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'coding_session_turn',
  storageScope: 'coding-session',
  storageKey: 'coding-session-turns.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_CODING_SESSION_MESSAGE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'coding_session_message',
  storageScope: 'coding-session',
  storageKey: 'coding-session-messages.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'coding_session_runtime',
  storageScope: 'coding-session',
  storageKey: 'coding-session-runtimes.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_CODING_SESSION_EVENT_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'coding_session_event',
  storageScope: 'coding-session',
  storageKey: 'coding-session-events.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_CODING_SESSION_ARTIFACT_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'coding_session_artifact',
  storageScope: 'coding-session',
  storageKey: 'coding-session-artifacts.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_CODING_SESSION_CHECKPOINT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'coding_session_checkpoint',
    storageScope: 'coding-session',
    storageKey: 'coding-session-checkpoints.v1',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_CODING_SESSION_OPERATION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'coding_session_operation',
    storageScope: 'coding-session',
    storageKey: 'coding-session-operations.v1',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_PROMPT_ASSET_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'prompt_asset',
  storageScope: 'prompt',
  storageKey: 'prompt-assets.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_PROMPT_ASSET_VERSION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'prompt_asset_version',
  storageScope: 'prompt',
  storageKey: 'prompt-asset-versions.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_PROMPT_BUNDLE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'prompt_bundle',
  storageScope: 'prompt',
  storageKey: 'prompt-bundles.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_PROMPT_BUNDLE_ITEM_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'prompt_bundle_item',
  storageScope: 'prompt',
  storageKey: 'prompt-bundle-items.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_PROMPT_RUN_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'prompt_run',
  storageScope: 'prompt-runtime',
  storageKey: 'prompt-runs.v1',
  preferredProvider: 'postgresql',
  storageMode: 'table',
};

export const BIRDCODER_PROMPT_EVALUATION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'prompt_evaluation',
  storageScope: 'prompt-runtime',
  storageKey: 'prompt-evaluations.v1',
  preferredProvider: 'postgresql',
  storageMode: 'table',
};

export const BIRDCODER_SKILL_PACKAGE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'skill_package',
  storageScope: 'skillhub',
  storageKey: 'skill-packages.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_SKILL_VERSION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'skill_version',
  storageScope: 'skillhub',
  storageKey: 'skill-versions.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_SKILL_CAPABILITY_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'skill_capability',
  storageScope: 'skillhub',
  storageKey: 'skill-capabilities.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_SKILL_INSTALLATION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'skill_installation',
  storageScope: 'skillhub',
  storageKey: 'skill-installations.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_SKILL_BINDING_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'skill_binding',
  storageScope: 'skillhub',
  storageKey: 'skill-bindings.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_SKILL_RUNTIME_CONFIG_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'skill_runtime_config',
  storageScope: 'skillhub',
  storageKey: 'skill-runtime-configs.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APP_TEMPLATE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'app_template',
  storageScope: 'app-template',
  storageKey: 'app-templates.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APP_TEMPLATE_VERSION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'app_template_version',
  storageScope: 'app-template',
  storageKey: 'app-template-versions.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'app_template_target_profile',
    storageScope: 'app-template',
    storageKey: 'app-template-target-profiles.v1',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APP_TEMPLATE_PRESET_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'app_template_preset',
  storageScope: 'app-template',
  storageKey: 'app-template-presets.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APP_TEMPLATE_INSTANTIATION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'app_template_instantiation',
    storageScope: 'app-template',
    storageKey: 'app-template-instantiations.v1',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_PROJECT_DOCUMENT_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'project_document',
  storageScope: 'project-documents',
  storageKey: 'project-documents.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_RELEASE_RECORD_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'release_record',
  storageScope: 'governance',
  storageKey: 'release-records.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_AUDIT_EVENT_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'audit_event',
  storageScope: 'governance',
  storageKey: 'audit-events.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_GOVERNANCE_POLICY_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'governance_policy',
  storageScope: 'governance',
  storageKey: 'governance-policies.v1',
  preferredProvider: 'postgresql',
  storageMode: 'table',
};

export const BIRDCODER_DEPLOYMENT_RECORD_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'deployment_record',
  storageScope: 'deployment',
  storageKey: 'deployment-records.v1',
  preferredProvider: 'postgresql',
  storageMode: 'table',
};
