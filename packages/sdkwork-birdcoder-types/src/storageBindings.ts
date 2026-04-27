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

export const BIRDCODER_APPBASE_VIP_USER_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'vip_user',
  storageScope: 'appbase.commerce.vip',
  storageKey: 'membership',
  preferredProvider: 'sqlite',
  storageMode: 'key-value',
};

export const BIRDCODER_APPBASE_AGENT_PLUGIN_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'agent_plugin',
  storageScope: 'appbase.plugin.agent',
  storageKey: 'agent-plugins.v104',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_DATASOURCE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'datasource',
  storageScope: 'appbase.datasource',
  storageKey: 'datasources.v104',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_DATASOURCE_SCHEMA_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'datasource_schema',
  storageScope: 'appbase.datasource',
  storageKey: 'schemas.v104',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_DATASOURCE_TABLE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'datasource_table',
  storageScope: 'appbase.datasource',
  storageKey: 'tables.v104',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_DATASOURCE_COLUMN_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'datasource_column',
  storageScope: 'appbase.datasource',
  storageKey: 'columns.v104',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_AI_GENERATION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'ai_generation',
  storageScope: 'appbase.ai-generation',
  storageKey: 'generations.v104',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_AI_GENERATION_CONTENT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_generation_content',
    storageScope: 'appbase.ai-generation',
    storageKey: 'generation-contents.v104',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_GENERATION_STYLE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_generation_style',
    storageScope: 'appbase.ai-generation',
    storageKey: 'generation-styles.v104',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_PLATFORM_CHANNEL_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'channel',
  storageScope: 'appbase.platform.channel',
  storageKey: 'channels.java',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_PLATFORM_CHANNEL_ACCOUNT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'channel_account',
    storageScope: 'appbase.platform.channel',
    storageKey: 'channel-accounts.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_PLATFORM_CHANNEL_PROXY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'channel_proxy',
    storageScope: 'appbase.platform.channel',
    storageKey: 'channel-proxies.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_PLATFORM_CHANNEL_RESOURCE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'channel_resource',
    storageScope: 'appbase.platform.channel',
    storageKey: 'channel-resources.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_PLATFORM_API_KEY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'api_key',
    storageScope: 'appbase.platform.api-key',
    storageKey: 'api-keys.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_APP_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'app',
  storageScope: 'appbase.app',
  storageKey: 'apps.java',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_PROJECT_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'project',
  storageScope: 'appbase.project',
  storageKey: 'projects.java',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_PROJECT_CONTENT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'project_content',
    storageScope: 'appbase.project',
    storageKey: 'project-contents.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_MODEL_AVAILABILITY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_model_availability',
    storageScope: 'appbase.ai-model',
    storageKey: 'model-availabilities.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_MODEL_COMPLIANCE_PROFILE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_model_compliance_profile',
    storageScope: 'appbase.ai-model',
    storageKey: 'model-compliance-profiles.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_MODEL_INFO_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_model_info',
    storageScope: 'appbase.ai-model',
    storageKey: 'model-info.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_MODEL_PRICE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_model_price',
    storageScope: 'appbase.ai-model',
    storageKey: 'model-prices.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_MODEL_PRICE_METRIC_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_model_price_metric',
    storageScope: 'appbase.ai-model',
    storageKey: 'model-price-metrics.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_MODEL_TAXONOMY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_model_taxonomy',
    storageScope: 'appbase.ai-model',
    storageKey: 'model-taxonomies.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_MODEL_TAXONOMY_REL_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_model_taxonomy_rel',
    storageScope: 'appbase.ai-model',
    storageKey: 'model-taxonomy-relations.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_TENANT_MODEL_POLICY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_tenant_model_policy',
    storageScope: 'appbase.ai-model',
    storageKey: 'tenant-model-policies.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_AGENT_TOOL_RELATION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_agent_tool_relation',
    storageScope: 'appbase.ai-agent',
    storageKey: 'agent-tool-relations.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_AGENT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_agent',
    storageScope: 'appbase.ai-agent',
    storageKey: 'agents.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_PROMPT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_prompt',
    storageScope: 'appbase.ai-prompt',
    storageKey: 'prompts.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_PROMPT_HISTORY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_prompt_history',
    storageScope: 'appbase.ai-prompt',
    storageKey: 'prompt-histories.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_AI_TOOL_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'ai_tool',
    storageScope: 'appbase.ai-tool',
    storageKey: 'tools.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_API_SECURITY_POLICY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'api_security_policy',
    storageScope: 'appbase.security.api',
    storageKey: 'api-security-policies.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_CATEGORY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'category',
    storageScope: 'appbase.category',
    storageKey: 'categories.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_ATTRIBUTE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'attribute',
    storageScope: 'appbase.category',
    storageKey: 'attributes.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_TAGS_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'tags',
    storageScope: 'appbase.tags',
    storageKey: 'tags.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_MEMORY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'memory',
    storageScope: 'appbase.memory',
    storageKey: 'memories.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_MEMORY_ITEM_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'memory_item',
    storageScope: 'appbase.memory',
    storageKey: 'memory-items.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_NOTIFICATION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'notification',
    storageScope: 'appbase.notification',
    storageKey: 'notifications.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_NOTIFICATION_CONTENT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'notification_content',
    storageScope: 'appbase.notification',
    storageKey: 'notification-contents.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_PUSH_DEVICE_ENDPOINT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'push_device_endpoint',
    storageScope: 'appbase.notification',
    storageKey: 'push-device-endpoints.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_PUSH_TOPIC_SUBSCRIPTION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'push_topic_subscription',
    storageScope: 'appbase.notification',
    storageKey: 'push-topic-subscriptions.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_CONVERSATION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'conversation',
    storageScope: 'appbase.conversation',
    storageKey: 'conversations.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_CHAT_MESSAGE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'chat_message',
    storageScope: 'appbase.conversation',
    storageKey: 'chat-messages.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_CHAT_MESSAGE_CONTENT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'chat_message_content',
    storageScope: 'appbase.conversation',
    storageKey: 'chat-message-contents.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_DETAIL_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'detail',
    storageScope: 'appbase.content',
    storageKey: 'details.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_COLLECTION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'collection',
    storageScope: 'appbase.collection',
    storageKey: 'collections.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_COLLECTION_ITEM_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'collection_item',
    storageScope: 'appbase.collection',
    storageKey: 'collection-items.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_FAVORITE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'favorite',
    storageScope: 'appbase.favorite',
    storageKey: 'favorites.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_FAVORITE_FOLDER_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'favorite_folder',
    storageScope: 'appbase.favorite',
    storageKey: 'favorite-folders.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_SHARE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'share',
  storageScope: 'appbase.share',
  storageKey: 'shares.java',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_SHARE_VISIT_RECORD_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'share_visit_record',
    storageScope: 'appbase.share',
    storageKey: 'share-visit-records.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_INVITATION_CODE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'invitation_code',
    storageScope: 'appbase.invitation',
    storageKey: 'invitation-codes.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_INVITATION_RELATION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'invitation_relation',
    storageScope: 'appbase.invitation',
    storageKey: 'invitation-relations.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_SNS_FOLLOW_RELATION_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'sns_follow_relation',
    storageScope: 'appbase.sns',
    storageKey: 'follow-relations.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_SNS_FOLLOW_STATISTICS_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'sns_follow_statistics',
    storageScope: 'appbase.sns',
    storageKey: 'follow-statistics.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_COMMENTS_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'comments',
    storageScope: 'appbase.content',
    storageKey: 'comments.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_CONTENT_VOTE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'content_vote',
    storageScope: 'appbase.content',
    storageKey: 'content-votes.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_VISIT_HISTORY_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'visit_history',
    storageScope: 'appbase.content',
    storageKey: 'visit-history.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_FEEDS_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'feeds',
  storageScope: 'appbase.feeds',
  storageKey: 'feeds.java',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_SHORT_URL_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'short_url',
    storageScope: 'appbase.url',
    storageKey: 'short-urls.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_FEEDBACK_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'feedback',
    storageScope: 'appbase.feedback',
    storageKey: 'feedback.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_EMAIL_MESSAGE_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'email_message',
    storageScope: 'appbase.email',
    storageKey: 'email-messages.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_EVENTS_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'events',
    storageScope: 'appbase.events',
    storageKey: 'events.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_DISK_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'disk',
  storageScope: 'appbase.files',
  storageKey: 'disks.java',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_DISK_MEMBER_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'disk_member',
    storageScope: 'appbase.files',
    storageKey: 'disk-members.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_FILE_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'file',
  storageScope: 'appbase.files',
  storageKey: 'files.java',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_APPBASE_FILE_CONTENT_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'file_content',
    storageScope: 'appbase.files',
    storageKey: 'file-contents.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_FILE_PART_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'file_part',
    storageScope: 'appbase.files',
    storageKey: 'file-parts.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_APPBASE_OSS_BUCKET_STORAGE_BINDING: BirdCoderEntityStorageBinding =
  {
    entityName: 'oss_bucket',
    storageScope: 'appbase.files',
    storageKey: 'oss-buckets.java',
    preferredProvider: 'sqlite',
    storageMode: 'table',
  };

export const BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'workbench_preference',
  storageScope: 'workbench',
  storageKey: 'workbench-preferences.global.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_ENGINE_REGISTRY_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'engine_registry',
  storageScope: 'engine',
  storageKey: 'engine-registry.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_MODEL_CATALOG_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'model_catalog',
  storageScope: 'engine',
  storageKey: 'model-catalog.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_ENGINE_BINDING_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'engine_binding',
  storageScope: 'engine',
  storageKey: 'engine-bindings.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_RUN_CONFIGURATION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'run_configuration',
  storageScope: 'runtime.run-configurations',
  storageKey: 'run-configs.global.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
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

export const BIRDCODER_PROJECT_CONTENT_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'project_content',
  storageScope: 'workspace',
  storageKey: 'project-contents.v1',
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

export const BIRDCODER_CODING_SESSION_PROMPT_ENTRY_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'coding_session_prompt_entry',
  storageScope: 'coding-session',
  storageKey: 'coding-session-prompt-entries.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};

export const BIRDCODER_SAVED_PROMPT_ENTRY_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'saved_prompt_entry',
  storageScope: 'prompt',
  storageKey: 'saved-prompt-entries.v1',
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
