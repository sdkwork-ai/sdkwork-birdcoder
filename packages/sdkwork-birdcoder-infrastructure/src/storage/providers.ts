import {
  BIRDCODER_DATABASE_PROVIDERS,
  getBirdCoderEntityDefinition,
  type BirdCoderDatabaseProviderId,
  type BirdCoderEntityDefinition,
  type BirdCoderEntityName,
  type BirdCoderLogicalColumnType,
  type BirdCoderSchemaColumnDefinition,
  type BirdCoderSchemaMigrationDefinition,
  type BirdCoderStorageDialect,
} from '@sdkwork/birdcoder-types';

type SupportedBirdCoderProviderId = keyof typeof BIRDCODER_DATABASE_PROVIDERS;

const DIALECTS: Record<SupportedBirdCoderProviderId, BirdCoderStorageDialect> = {
  sqlite: {
    providerId: 'sqlite',
    buildPlaceholder(index) {
      return `?${index}`;
    },
    mapLogicalType(type) {
      return mapLogicalType('sqlite', type);
    },
    supportsJsonb: false,
  },
  postgresql: {
    providerId: 'postgresql',
    buildPlaceholder(index) {
      return `$${index}`;
    },
    mapLogicalType(type) {
      return mapLogicalType('postgresql', type);
    },
    supportsJsonb: true,
  },
};

const RUNTIME_DATA_KERNEL_ENTITY_NAMES = [
  'workbench_preference',
  'engine_registry',
  'model_catalog',
  'engine_binding',
  'run_configuration',
  'terminal_execution',
  'build_execution',
  'preview_session',
  'simulator_session',
  'test_execution',
  'schema_migration_history',
] as const satisfies readonly BirdCoderEntityName[];

const CODING_SERVER_KERNEL_ENTITY_NAMES = [
  'tenant',
  'organization',
  'organization_member',
  'member_relation',
  'department',
  'position',
  'role',
  'permission',
  'role_permission',
  'user_role',
  'user_account',
  'oauth_account',
  'user_address',
  'card',
  'user_card',
  'member_card',
  'member_level',
  'card_template',
  'coupon',
  'coupon_template',
  'user_coupon',
  'product',
  'sku',
  'currency',
  'exchange_rate',
  'agent_skill_package',
  'agent_skill',
  'user_agent_skill',
  'agent_plugin',
  'datasource',
  'datasource_schema',
  'datasource_table',
  'datasource_column',
  'ai_generation',
  'ai_generation_content',
  'ai_generation_style',
  'channel',
  'channel_account',
  'channel_proxy',
  'channel_resource',
  'api_key',
  'app',
  'ai_model_availability',
  'ai_model_compliance_profile',
  'ai_model_info',
  'ai_model_price',
  'ai_model_price_metric',
  'ai_model_taxonomy',
  'ai_model_taxonomy_rel',
  'ai_tenant_model_policy',
  'ai_agent_tool_relation',
  'ai_agent',
  'ai_prompt',
  'ai_prompt_history',
  'ai_tool',
  'api_security_policy',
  'category',
  'attribute',
  'tags',
  'memory',
  'memory_item',
  'notification',
  'notification_content',
  'push_device_endpoint',
  'push_topic_subscription',
  'conversation',
  'chat_message',
  'chat_message_content',
  'detail',
  'collection',
  'collection_item',
  'favorite',
  'favorite_folder',
  'share',
  'share_visit_record',
  'invitation_code',
  'invitation_relation',
  'sns_follow_relation',
  'sns_follow_statistics',
  'comments',
  'content_vote',
  'visit_history',
  'feeds',
  'short_url',
  'feedback',
  'email_message',
  'events',
  'disk',
  'disk_member',
  'file',
  'file_content',
  'file_part',
  'oss_bucket',
  'order',
  'order_item',
  'payment',
  'refund',
  'shopping_cart',
  'shopping_cart_item',
  'payment_webhook_event',
  'order_dispatch_rule',
  'order_worker_dispatch_profile',
  'vip_user',
  'account',
  'account_history',
  'account_exchange_config',
  'ledger_bridge',
  'vip_level',
  'vip_benefit',
  'vip_level_benefit',
  'vip_pack_group',
  'vip_pack',
  'vip_recharge_method',
  'vip_recharge_pack',
  'vip_recharge',
  'vip_point_change',
  'vip_benefit_usage',
  'workspace',
  'project',
  'project_content',
  'coding_session',
  'coding_session_runtime',
  'coding_session_turn',
  'coding_session_message',
  'coding_session_prompt_entry',
  'coding_session_event',
  'coding_session_artifact',
  'coding_session_checkpoint',
  'coding_session_operation',
  'saved_prompt_entry',
  'prompt_asset',
  'prompt_asset_version',
  'prompt_bundle',
  'prompt_bundle_item',
  'prompt_run',
  'prompt_evaluation',
  'skill_package',
  'skill_version',
  'skill_capability',
  'skill_installation',
  'skill_binding',
  'skill_runtime_config',
  'app_template',
  'app_template_version',
  'app_template_target_profile',
  'app_template_preset',
  'app_template_instantiation',
  'team',
  'team_member',
  'project_document',
  'audit_event',
  'governance_policy',
  'release_record',
  'deployment_target',
  'deployment_record',
] as const satisfies readonly BirdCoderEntityName[];

const JAVA_LONG_IDENTIFIER_COLUMNS_BY_ENTITY = {
  tenant: ['id', 'biz_id', 'admin_user_id'],
  organization: ['id', 'tenant_id', 'organization_id', 'parent_id'],
  organization_member: ['id', 'tenant_id', 'organization_id', 'user_id', 'owner_id'],
  member_relation: [
    'id',
    'tenant_id',
    'organization_id',
    'parent_id',
    'member_id',
    'owner_id',
    'target_id',
  ],
  department: ['id', 'tenant_id', 'organization_id', 'parent_id', 'owner_id', 'manager_id'],
  position: ['id', 'tenant_id', 'organization_id', 'parent_id', 'owner_id'],
  role: ['id', 'tenant_id', 'organization_id'],
  permission: ['id', 'tenant_id', 'organization_id'],
  role_permission: ['id', 'role_id', 'permission_id', 'operator_id'],
  user_role: ['id', 'user_id', 'role_id', 'operator_id'],
  user_account: ['id', 'tenant_id', 'organization_id'],
  oauth_account: ['id', 'tenant_id', 'organization_id', 'user_id', 'channel_account_id'],
  user_address: ['id', 'tenant_id', 'organization_id', 'user_id'],
  card: ['id', 'tenant_id', 'organization_id', 'card_organization_id'],
  user_card: ['id', 'tenant_id', 'organization_id', 'user_id', 'card_id'],
  member_card: ['id', 'tenant_id', 'organization_id', 'card_id'],
  member_level: ['id', 'tenant_id', 'organization_id', 'card_id', 'required_points'],
  card_template: ['id', 'tenant_id', 'organization_id'],
  coupon: ['id', 'tenant_id', 'organization_id', 'point_cost'],
  coupon_template: ['id', 'tenant_id', 'organization_id'],
  user_coupon: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'coupon_id',
    'point_cost',
    'order_id',
  ],
  product: ['id', 'tenant_id', 'organization_id', 'user_id', 'category_id'],
  sku: ['id', 'tenant_id', 'organization_id', 'product_id'],
  currency: ['id', 'tenant_id', 'organization_id'],
  exchange_rate: [
    'id',
    'tenant_id',
    'organization_id',
    'base_currency_id',
    'target_currency_id',
  ],
  agent_skill_package: ['id', 'tenant_id', 'organization_id', 'user_id', 'category_id'],
  agent_skill: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'category_id',
    'package_id',
    'reviewed_by',
  ],
  user_agent_skill: ['id', 'tenant_id', 'organization_id', 'user_id', 'skill_id'],
  agent_plugin: ['id', 'tenant_id', 'organization_id'],
  datasource: ['id', 'tenant_id', 'organization_id', 'user_id', 'project_id'],
  datasource_schema: ['id', 'tenant_id', 'organization_id', 'datasource_id'],
  datasource_table: ['id', 'tenant_id', 'organization_id', 'schema_id'],
  datasource_column: ['id', 'tenant_id', 'organization_id', 'table_id'],
  ai_generation: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'conversation_id',
    'message_id',
    'parent_id',
    'biz_id',
  ],
  ai_generation_content: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'generation_id',
    'content_id',
    'seed',
    'file_size',
  ],
  ai_generation_style: ['id', 'tenant_id', 'organization_id', 'user_id'],
  channel: ['id', 'tenant_id', 'organization_id', 'user_id'],
  channel_account: ['id', 'tenant_id', 'organization_id', 'user_id'],
  channel_proxy: ['id', 'tenant_id', 'organization_id', 'user_id'],
  channel_resource: ['id', 'tenant_id', 'organization_id', 'channel_account_id'],
  api_key: ['id', 'tenant_id', 'organization_id', 'user_id'],
  app: ['id', 'tenant_id', 'organization_id', 'user_id', 'project_id'],
  ai_model_availability: ['id', 'tenant_id', 'organization_id', 'model_id'],
  ai_model_compliance_profile: ['id', 'tenant_id', 'organization_id', 'model_id'],
  ai_model_info: ['id', 'tenant_id', 'organization_id'],
  ai_model_price: ['id', 'tenant_id', 'organization_id', 'model_id'],
  ai_model_price_metric: ['id', 'tenant_id', 'organization_id', 'price_rule_id', 'model_id'],
  ai_model_taxonomy: ['id', 'tenant_id', 'organization_id', 'parent_id'],
  ai_model_taxonomy_rel: ['id', 'tenant_id', 'organization_id', 'model_id', 'taxonomy_id'],
  ai_tenant_model_policy: ['id', 'tenant_id', 'organization_id', 'subject_id', 'model_id'],
  ai_agent_tool_relation: ['id', 'tenant_id', 'organization_id', 'agent_id', 'tool_id'],
  ai_agent: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'owner_id',
    'biz_type',
    'cate_id',
    'prompt_id',
  ],
  ai_prompt: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'cate_id',
    'usage_count',
    'avg_response_time',
  ],
  ai_prompt_history: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'prompt_id',
    'duration',
  ],
  ai_tool: ['id', 'tenant_id', 'organization_id', 'user_id', 'owner_id'],
  api_security_policy: ['id', 'tenant_id', 'organization_id'],
  category: ['id', 'tenant_id', 'organization_id', 'parent_id', 'shop_id'],
  attribute: ['id', 'tenant_id', 'organization_id', 'content_id', 'category_id'],
  tags: ['id', 'tenant_id', 'organization_id', 'user_id'],
  memory: ['id', 'tenant_id', 'organization_id', 'user_id', 'agent_id', 'conversation_id'],
  memory_item: ['id', 'tenant_id', 'organization_id', 'user_id', 'agent_id', 'conversation_id'],
  notification: ['id', 'tenant_id', 'organization_id', 'sender_id', 'receiver_id', 'group_id'],
  notification_content: [
    'id',
    'tenant_id',
    'organization_id',
    'notification_id',
    'sender_id',
    'receiver_id',
    'group_id',
  ],
  push_device_endpoint: ['id', 'tenant_id', 'organization_id', 'user_id', 'workspace_id'],
  push_topic_subscription: ['id', 'tenant_id', 'organization_id', 'user_id'],
  conversation: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'agent_id',
    'agent_biz_type',
    'last_message_id',
    'content_id',
    'model_id',
    'knowledge_base_id',
    'data_source_id',
  ],
  chat_message: [
    'id',
    'tenant_id',
    'organization_id',
    'sender_id',
    'receiver_id',
    'group_id',
    'conversation_id',
    'agent_id',
    'knowledge_base_id',
    'datasource_id',
    'agent_biz_type',
    'user_id',
    'channel_msg_seq',
    'parent_message_id',
    'processing_time',
    'model_id',
  ],
  chat_message_content: [
    'id',
    'tenant_id',
    'organization_id',
    'message_id',
    'conversation_id',
    'agent_id',
    'agent_biz_type',
  ],
  detail: ['id', 'tenant_id', 'organization_id', 'content_id'],
  collection: ['id', 'tenant_id', 'organization_id', 'parent_id', 'user_id', 'content_id'],
  collection_item: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'collection_id',
    'content_id',
  ],
  favorite: ['id', 'tenant_id', 'organization_id', 'user_id', 'content_id', 'folder_id'],
  favorite_folder: ['id', 'tenant_id', 'organization_id', 'user_id', 'parent_id'],
  share: ['id', 'tenant_id', 'organization_id', 'user_id'],
  share_visit_record: ['id', 'tenant_id', 'organization_id', 'user_id', 'share_id'],
  invitation_code: ['id', 'tenant_id', 'organization_id', 'creator_user_id'],
  invitation_relation: ['id', 'tenant_id', 'organization_id', 'inviter_user_id', 'invitee_user_id'],
  sns_follow_relation: ['id', 'tenant_id', 'organization_id', 'follower_id', 'following_id', 'owner_id'],
  sns_follow_statistics: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'owner_id',
    'following_count',
    'follower_count',
    'mutual_count',
    'special_count',
    'blocked_count',
    'total_interaction_count',
    'last_updated_at',
  ],
  comments: ['id', 'tenant_id', 'organization_id', 'parent_id', 'user_id', 'content_id'],
  content_vote: ['id', 'tenant_id', 'organization_id', 'user_id', 'content_id'],
  visit_history: ['id', 'tenant_id', 'organization_id', 'user_id', 'content_id'],
  feeds: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'category_id',
    'content_id',
    'view_count',
    'like_count',
    'comment_count',
    'share_count',
    'favorite_count',
  ],
  short_url: ['id', 'tenant_id', 'organization_id', 'created_by'],
  feedback: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'biz_id',
    'reply_user_id',
    'closed_by',
    'assigned_to',
  ],
  email_message: ['id', 'tenant_id', 'organization_id', 'user_id'],
  events: ['id', 'tenant_id', 'organization_id'],
  disk: ['id', 'tenant_id', 'organization_id', 'owner_id', 'knowledge_base_id', 'disk_size', 'used_size'],
  disk_member: ['id', 'tenant_id', 'organization_id', 'disk_id', 'user_id', 'knowledge_base_id'],
  file: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'disk_id',
    'size',
    'content_id',
    'biz_id',
    'workspace_id',
    'project_id',
    'generation_id',
    'owner_id',
    'channel_config_id',
    'parent_id',
    'reference_file_id',
  ],
  file_content: ['id', 'tenant_id', 'organization_id', 'file_id'],
  file_part: ['id', 'tenant_id', 'organization_id', 'file_id', 'chunk_size', 'total_size'],
  oss_bucket: ['id', 'tenant_id', 'organization_id', 'user_id', 'channel_config_id'],
  order: [
    'id',
    'tenant_id',
    'organization_id',
    'owner_id',
    'user_id',
    'worker_user_id',
    'dispatcher_user_id',
    'content_id',
    'category_id',
  ],
  order_item: [
    'id',
    'tenant_id',
    'organization_id',
    'order_id',
    'category_id',
    'product_id',
    'sku_id',
    'content_id',
  ],
  payment: ['id', 'tenant_id', 'organization_id', 'order_id', 'content_id'],
  refund: [
    'id',
    'tenant_id',
    'organization_id',
    'order_id',
    'payment_id',
    'content_id',
    'operator_id',
  ],
  shopping_cart: ['id', 'tenant_id', 'organization_id', 'user_id', 'owner_id'],
  shopping_cart_item: [
    'id',
    'tenant_id',
    'organization_id',
    'cart_id',
    'product_id',
    'sku_id',
  ],
  payment_webhook_event: ['id', 'tenant_id', 'organization_id', 'request_timestamp'],
  order_dispatch_rule: ['id', 'tenant_id', 'organization_id'],
  order_worker_dispatch_profile: ['id', 'tenant_id', 'organization_id', 'user_id'],
  vip_user: ['id', 'tenant_id', 'organization_id', 'user_id', 'vip_level_id'],
  account: ['id', 'tenant_id', 'organization_id', 'user_id', 'owner_id'],
  account_history: [
    'id',
    'tenant_id',
    'organization_id',
    'account_id',
    'related_account_id',
  ],
  account_exchange_config: ['id', 'tenant_id', 'organization_id'],
  ledger_bridge: ['id', 'tenant_id', 'organization_id', 'user_id'],
  vip_level: ['id', 'tenant_id', 'organization_id'],
  vip_benefit: ['id', 'tenant_id', 'organization_id'],
  vip_level_benefit: ['id', 'tenant_id', 'organization_id', 'vip_level_id', 'benefit_id'],
  vip_pack_group: ['id', 'tenant_id', 'organization_id', 'app_id', 'scope_id'],
  vip_pack: [
    'id',
    'tenant_id',
    'organization_id',
    'app_id',
    'group_id',
    'vip_level_id',
    'recharge_pack_id',
  ],
  vip_recharge_method: ['id', 'tenant_id', 'organization_id'],
  vip_recharge_pack: ['id', 'tenant_id', 'organization_id', 'app_id'],
  vip_recharge: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'vip_level_id',
    'recharge_method_id',
    'recharge_pack_id',
  ],
  vip_point_change: ['id', 'tenant_id', 'organization_id', 'user_id', 'source_id'],
  vip_benefit_usage: ['id', 'tenant_id', 'organization_id', 'user_id', 'source_id'],
  workspace: ['id', 'owner_id', 'leader_id', 'created_by_user_id'],
  project: [
    'id',
    'tenant_id',
    'organization_id',
    'user_id',
    'parent_id',
    'workspace_id',
    'leader_id',
    'file_id',
    'conversation_id',
    'budget_amount',
  ],
  project_content: ['id', 'tenant_id', 'organization_id', 'user_id', 'parent_id', 'project_id'],
  team: ['id', 'workspace_id', 'owner_id', 'leader_id', 'created_by_user_id'],
  team_member: ['id', 'team_id', 'user_id', 'created_by_user_id', 'granted_by_user_id'],
  workspace_member: [
    'id',
    'workspace_id',
    'user_id',
    'team_id',
    'created_by_user_id',
    'granted_by_user_id',
  ],
  project_collaborator: [
    'id',
    'project_id',
    'workspace_id',
    'user_id',
    'team_id',
    'created_by_user_id',
    'granted_by_user_id',
  ],
} as const satisfies Partial<Record<BirdCoderEntityName, readonly string[]>>;

const V104_BOOTSTRAP_ENTITY_NAMES = new Set<BirdCoderEntityName>([
  'agent_plugin',
  'datasource',
  'datasource_schema',
  'datasource_table',
  'datasource_column',
  'ai_generation',
  'ai_generation_content',
  'ai_generation_style',
]);

const JAVA_PLUS_BASE_BOOTSTRAP_ENTITY_NAMES = new Set<BirdCoderEntityName>([
  ...V104_BOOTSTRAP_ENTITY_NAMES,
  'channel',
  'channel_account',
  'channel_proxy',
  'channel_resource',
  'api_key',
  'app',
  'ai_model_availability',
  'ai_model_compliance_profile',
  'ai_model_info',
  'ai_model_price',
  'ai_model_price_metric',
  'ai_model_taxonomy',
  'ai_model_taxonomy_rel',
  'ai_tenant_model_policy',
  'ai_agent_tool_relation',
  'ai_agent',
  'ai_prompt',
  'ai_prompt_history',
  'ai_tool',
  'api_security_policy',
  'category',
  'attribute',
  'tags',
  'memory',
  'memory_item',
  'notification',
  'notification_content',
  'push_device_endpoint',
  'push_topic_subscription',
  'conversation',
  'chat_message',
  'chat_message_content',
  'detail',
  'collection',
  'collection_item',
  'favorite',
  'favorite_folder',
  'share',
  'share_visit_record',
  'invitation_code',
  'invitation_relation',
  'sns_follow_relation',
  'sns_follow_statistics',
  'comments',
  'content_vote',
  'visit_history',
  'feeds',
  'short_url',
  'feedback',
  'email_message',
  'events',
  'disk',
  'disk_member',
  'file',
  'file_content',
  'file_part',
  'oss_bucket',
  'project',
  'project_content',
]);

const JAVA_BASE_JSON_CONVERTER_TEXT_COLUMNS_BY_ENTITY = {
  datasource: ['connection_config'],
  ai_generation_content: ['metadata'],
  ai_agent_tool_relation: ['actions'],
  ai_prompt: ['parameters'],
  ai_tool: ['tool_definition'],
  notification_content: ['metadata'],
  conversation: ['chat_options'],
  chat_message: ['chat_options'],
  chat_message_content: ['metadata'],
  detail: ['content'],
  order: ['product_image'],
  order_item: ['product_image'],
} as const satisfies Partial<Record<BirdCoderEntityName, readonly string[]>>;

const SQLITE_INLINE_UNIQUE_TEXT_COLUMNS_BY_ENTITY = {
  order: ['order_sn', 'out_trade_no'],
  payment: ['out_trade_no'],
  refund: ['out_refund_no'],
} as const satisfies Partial<Record<BirdCoderEntityName, readonly string[]>>;

function assertSupportedProviderId(
  providerId: BirdCoderDatabaseProviderId,
): SupportedBirdCoderProviderId {
  if (providerId === 'sqlite' || providerId === 'postgresql') {
    return providerId as SupportedBirdCoderProviderId;
  }

  throw new Error(`Unsupported BirdCoder storage provider: ${providerId}`);
}

function mapLogicalType(
  providerId: SupportedBirdCoderProviderId,
  logicalType: BirdCoderLogicalColumnType,
): string {
  switch (logicalType) {
    case 'bool':
      return providerId === 'sqlite' ? 'INTEGER' : 'BOOLEAN';
    case 'int':
      return 'INTEGER';
    case 'bigint':
      return providerId === 'sqlite' ? 'INTEGER' : 'BIGINT';
    case 'decimal':
      return 'NUMERIC';
    case 'double':
      return providerId === 'sqlite' ? 'REAL' : 'DOUBLE PRECISION';
    case 'date':
      return providerId === 'sqlite' ? 'TEXT' : 'DATE';
    case 'json':
      return providerId === 'sqlite' ? 'TEXT' : 'JSONB';
    case 'timestamp':
      return providerId === 'sqlite' ? 'TEXT' : 'TIMESTAMPTZ';
    case 'id':
    case 'text':
    case 'enum':
    default:
      return 'TEXT';
  }
}

function buildJavaScopedColumnSql(
  definition: BirdCoderEntityDefinition,
  column: BirdCoderSchemaColumnDefinition,
  providerId: SupportedBirdCoderProviderId,
): string | null {
  if (column.name === 'tenant_id' || column.name === 'organization_id') {
    const storageType = providerId === 'postgresql' ? 'BIGINT' : 'INTEGER';
    return `${column.name} ${storageType} NOT NULL DEFAULT 0`;
  }

  if (column.name === 'data_scope') {
    const defaultValue = V104_BOOTSTRAP_ENTITY_NAMES.has(definition.entityName) ? 0 : 1;
    return `${column.name} INTEGER NOT NULL DEFAULT ${defaultValue}`;
  }

  return null;
}

function buildV104BootstrapColumnSql(
  definition: BirdCoderEntityDefinition,
  column: BirdCoderSchemaColumnDefinition,
  providerId: SupportedBirdCoderProviderId,
): string | null {
  if (!JAVA_PLUS_BASE_BOOTSTRAP_ENTITY_NAMES.has(definition.entityName)) {
    return null;
  }

  if (column.name === 'uuid') {
    return `${column.name} TEXT NOT NULL UNIQUE`;
  }

  if (definition.entityName === 'ai_generation' && column.name === 'request_id') {
    return `${column.name} TEXT NOT NULL UNIQUE`;
  }

  if (column.name === 'v') {
    const storageType = providerId === 'postgresql' ? 'BIGINT' : 'INTEGER';
    return `${column.name} ${storageType} NOT NULL DEFAULT 0`;
  }

  if (!V104_BOOTSTRAP_ENTITY_NAMES.has(definition.entityName)) {
    return null;
  }

  const storageType = providerId === 'postgresql' ? 'BOOLEAN' : 'INTEGER';
  const trueValue = providerId === 'postgresql' ? 'TRUE' : '1';
  const falseValue = providerId === 'postgresql' ? 'FALSE' : '0';
  if (definition.entityName === 'agent_plugin' && column.name === 'is_enabled') {
    return `${column.name} ${storageType} NOT NULL DEFAULT ${trueValue}`;
  }

  if (
    (
      definition.entityName === 'ai_generation' &&
      column.name === 'is_public'
    ) ||
    (
      definition.entityName === 'ai_generation_content' &&
      column.name === 'is_hd'
    ) ||
    (
      definition.entityName === 'ai_generation_style' &&
      column.name === 'is_public'
    )
  ) {
    return `${column.name} ${storageType} NOT NULL DEFAULT ${falseValue}`;
  }

  if (definition.entityName === 'ai_generation_style' && column.name === 'status') {
    return `${column.name} TEXT NOT NULL DEFAULT 'ACTIVE'`;
  }

  if (definition.entityName === 'datasource_schema' && column.name === 'is_default') {
    return `${column.name} ${storageType} NOT NULL DEFAULT ${falseValue}`;
  }

  if (
    definition.entityName === 'datasource_column' &&
    (column.name === 'is_nullable' ||
      column.name === 'is_primary_key' ||
      column.name === 'is_auto_increment')
  ) {
    const defaultValue = column.name === 'is_nullable' ? trueValue : falseValue;
    return `${column.name} ${storageType} NOT NULL DEFAULT ${defaultValue}`;
  }

  if (definition.entityName === 'datasource' && column.name === 'access_count') {
    const integerStorageType = providerId === 'postgresql' ? 'BIGINT' : 'INTEGER';
    return `${column.name} ${integerStorageType} NOT NULL DEFAULT 0`;
  }

  if (
    definition.entityName === 'datasource_schema' &&
    (column.name === 'status' || column.name === 'table_count')
  ) {
    const defaultValue = column.name === 'status' ? 1 : 0;
    return `${column.name} INTEGER NOT NULL DEFAULT ${defaultValue}`;
  }

  if (definition.entityName === 'datasource_table' && column.name === 'column_count') {
    return `${column.name} INTEGER NOT NULL DEFAULT 0`;
  }

  if (definition.entityName === 'datasource_table' && column.name === 'row_count') {
    const integerStorageType = providerId === 'postgresql' ? 'BIGINT' : 'INTEGER';
    return `${column.name} ${integerStorageType} NOT NULL DEFAULT 0`;
  }

  if (
    definition.entityName === 'ai_generation' &&
    (
      column.name === 'progress' ||
      column.name === 'retry_count' ||
      column.name === 'max_retry' ||
      column.name === 'view_count' ||
      column.name === 'like_count'
    )
  ) {
    const defaultValue = column.name === 'max_retry' ? 3 : 0;
    return `${column.name} INTEGER NOT NULL DEFAULT ${defaultValue}`;
  }

  if (definition.entityName === 'ai_generation_content' && column.name === 'generation_id') {
    const integerStorageType = providerId === 'postgresql' ? 'BIGINT' : 'INTEGER';
    return `${column.name} ${integerStorageType} NOT NULL DEFAULT 0`;
  }

  if (definition.entityName === 'ai_generation_style' && column.name === 'usage_count') {
    return `${column.name} INTEGER NOT NULL DEFAULT 0`;
  }

  return null;
}

function buildJavaLongIdentifierColumnSql(
  definition: BirdCoderEntityDefinition,
  column: BirdCoderSchemaColumnDefinition,
  providerId: SupportedBirdCoderProviderId,
): string | null {
  const javaLongColumns = JAVA_LONG_IDENTIFIER_COLUMNS_BY_ENTITY[definition.entityName];
  if (!(javaLongColumns as readonly string[] | undefined)?.includes(column.name)) {
    return null;
  }

  const storageType = providerId === 'postgresql' ? 'BIGINT' : 'INTEGER';
  if (definition.entityName === 'user_role' && column.name === 'id') {
    return `${column.name} ${storageType} NULL`;
  }

  if (column.name === 'id') {
    return `${column.name} ${storageType} PRIMARY KEY`;
  }

  const nullability = column.nullable ? ' NULL' : ' NOT NULL';
  return `${column.name} ${storageType}${nullability}`;
}

function buildJavaConvertedEnumColumnSql(
  definition: BirdCoderEntityDefinition,
  column: BirdCoderSchemaColumnDefinition,
): string | null {
  if (definition.entityName === 'organization' && column.name === 'status') {
    return `${column.name} INTEGER NOT NULL DEFAULT 1`;
  }

  if (
    (
      definition.entityName === 'organization_member' ||
      definition.entityName === 'member_relation' ||
      definition.entityName === 'department' ||
      definition.entityName === 'position'
    ) &&
    column.name === 'owner'
  ) {
    return `${column.name} INTEGER NOT NULL`;
  }

  if (definition.entityName === 'member_relation' && column.name === 'relation_type') {
    return `${column.name} INTEGER NOT NULL`;
  }

  if (definition.entityName === 'role' && column.name === 'status') {
    return `${column.name} INTEGER NOT NULL DEFAULT 1`;
  }

  if (definition.entityName === 'permission' && column.name === 'status') {
    return `${column.name} INTEGER NOT NULL`;
  }

  if (definition.entityName === 'role_permission' && column.name === 'status') {
    return `${column.name} INTEGER NOT NULL DEFAULT 1`;
  }

  if (
    (
      definition.entityName === 'card' &&
      (column.name === 'card_type' || column.name === 'code_type' || column.name === 'status')
    ) ||
    (definition.entityName === 'member_level' && column.name === 'status') ||
    (
      definition.entityName === 'card_template' &&
      (column.name === 'card_type' || column.name === 'code_type' || column.name === 'validity_type')
    )
  ) {
    const nullability = column.nullable ? ' NULL' : ' NOT NULL';
    return `${column.name} INTEGER${nullability}`;
  }

  if (
    (
      definition.entityName === 'product' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'currency' &&
      column.name === 'currency_type'
    ) ||
    (
      definition.entityName === 'order' &&
      (
        column.name === 'order_type' ||
        column.name === 'owner' ||
        column.name === 'status' ||
        column.name === 'dispatch_mode' ||
        column.name === 'dispatch_status' ||
        column.name === 'content_type' ||
        column.name === 'refund_status' ||
        column.name === 'payment_provider'
      )
    ) ||
    (
      definition.entityName === 'order_item' &&
      (
        column.name === 'content_type' ||
        column.name === 'refund_status' ||
        column.name === 'review_status' ||
        column.name === 'payment_provider'
      )
    ) ||
    (
      definition.entityName === 'payment' &&
      (
        column.name === 'channel' ||
        column.name === 'provider' ||
        column.name === 'status' ||
        column.name === 'content_type'
      )
    ) ||
    (
      definition.entityName === 'refund' &&
      (
        column.name === 'channel' ||
        column.name === 'provider' ||
        column.name === 'status' ||
        column.name === 'content_type'
      )
    ) ||
    (
      definition.entityName === 'shopping_cart' &&
      (column.name === 'owner' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'payment_webhook_event' &&
      column.name === 'provider'
    ) ||
    (
      definition.entityName === 'ai_generation' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'ai_generation_content' &&
      column.name === 'content_type'
    ) ||
    (
      definition.entityName === 'ai_generation_style' &&
      column.name === 'type'
    ) ||
    (
      definition.entityName === 'channel' &&
      (column.name === 'channel' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'channel_account' &&
      (column.name === 'channel' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'channel_proxy' &&
      (column.name === 'channel' || column.name === 'proxy' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'channel_resource' &&
      (column.name === 'resource' || column.name === 'channel')
    ) ||
    (
      definition.entityName === 'api_key' &&
      (column.name === 'key_type' || column.name === 'owner' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'app' &&
      (column.name === 'status' || column.name === 'app_type')
    ) ||
    (
      definition.entityName === 'ai_model_availability' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'ai_model_info' &&
      (
        column.name === 'channel' ||
        column.name === 'vendor' ||
        column.name === 'model_type' ||
        column.name === 'status'
      )
    ) ||
    (
      definition.entityName === 'ai_model_price_metric' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'ai_model_taxonomy' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'ai_tenant_model_policy' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'ai_agent' &&
      (
        column.name === 'owner' ||
        column.name === 'type' ||
        column.name === 'biz_scope' ||
        column.name === 'status'
      )
    ) ||
    (
      definition.entityName === 'ai_tool' &&
      (column.name === 'owner' || column.name === 'type' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'category' &&
      (column.name === 'type' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'attribute' &&
      (column.name === 'type' || column.name === 'content_type' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'tags' &&
      column.name === 'type'
    ) ||
    (
      definition.entityName === 'memory_item' &&
      column.name === 'type'
    ) ||
    (
      definition.entityName === 'notification' &&
      (
        column.name === 'role' ||
        column.name === 'type' ||
        column.name === 'channel_type' ||
        column.name === 'status'
      )
    ) ||
    (
      definition.entityName === 'notification_content' &&
      (
        column.name === 'role' ||
        column.name === 'message_type' ||
        column.name === 'status' ||
        column.name === 'type' ||
        column.name === 'channel_type'
      )
    ) ||
    (
      definition.entityName === 'conversation' &&
      (
        column.name === 'type' ||
        column.name === 'status' ||
        column.name === 'agent_type' ||
        column.name === 'content_type'
      )
    ) ||
    (
      definition.entityName === 'chat_message' &&
      (
        column.name === 'role' ||
        column.name === 'type' ||
        column.name === 'status' ||
        column.name === 'conversation_type' ||
        column.name === 'agent_type'
      )
    ) ||
    (
      definition.entityName === 'chat_message_content' &&
      (
        column.name === 'role' ||
        column.name === 'type' ||
        column.name === 'status' ||
        column.name === 'agent_type'
      )
    ) ||
    (
      definition.entityName === 'detail' &&
      column.name === 'content_type'
    ) ||
    (
      definition.entityName === 'collection' &&
      column.name === 'type'
    ) ||
    (
      definition.entityName === 'collection_item' &&
      (column.name === 'type' || column.name === 'content_type')
    ) ||
    (
      definition.entityName === 'favorite' &&
      (column.name === 'content_type' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'favorite_folder' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'invitation_code' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'invitation_relation' &&
      (column.name === 'reward_status' || column.name === 'reward_type')
    ) ||
    (
      definition.entityName === 'sns_follow_relation' &&
      (column.name === 'relation_type' || column.name === 'owner')
    ) ||
    (
      definition.entityName === 'comments' &&
      (column.name === 'content_type' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'content_vote' &&
      (column.name === 'content_type' || column.name === 'rating')
    ) ||
    (
      definition.entityName === 'visit_history' &&
      column.name === 'content_type'
    ) ||
    (
      definition.entityName === 'feeds' &&
      (column.name === 'content_type' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'short_url' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'feedback' &&
      (column.name === 'feedback_type' || column.name === 'status')
    ) ||
    (
      definition.entityName === 'disk' &&
      (column.name === 'type' || column.name === 'owner')
    ) ||
    (
      definition.entityName === 'file' &&
      (
        column.name === 'type' ||
        column.name === 'content_type' ||
        column.name === 'biz_type' ||
        column.name === 'project_type' ||
        column.name === 'generation_type' ||
        column.name === 'storage_class' ||
        column.name === 'file_category' ||
        column.name === 'access_scope' ||
        column.name === 'status' ||
        column.name === 'upload_status'
      )
    ) ||
    (
      definition.entityName === 'file_part' &&
      column.name === 'status'
    ) ||
    (
      definition.entityName === 'oss_bucket' &&
      column.name === 'channel'
    ) ||
    (
      definition.entityName === 'project' &&
      (column.name === 'type' || column.name === 'status')
    )
  ) {
    const nullability = column.nullable ? ' NULL' : ' NOT NULL';
    return `${column.name} INTEGER${nullability}`;
  }

  if (
    (
      definition.entityName === 'coupon' &&
      (column.name === 'type' || column.name === 'status' || column.name === 'scope_type')
    ) ||
    (
      definition.entityName === 'coupon_template' &&
      (
        column.name === 'type' ||
        column.name === 'status' ||
        column.name === 'validity_type' ||
        column.name === 'scope_type'
      )
    ) ||
    (
      definition.entityName === 'user_coupon' &&
      (column.name === 'acquire_type' || column.name === 'status')
    )
  ) {
    const nullability = column.nullable ? ' NULL' : ' NOT NULL';
    return `${column.name} INTEGER${nullability}`;
  }

  return null;
}

function buildJavaBooleanDefaultColumnSql(
  definition: BirdCoderEntityDefinition,
  column: BirdCoderSchemaColumnDefinition,
  providerId: SupportedBirdCoderProviderId,
): string | null {
  if (definition.entityName === 'user_address' && column.name === 'is_default') {
    const storageType = providerId === 'postgresql' ? 'BOOLEAN' : 'INTEGER';
    const defaultClause = providerId === 'postgresql' ? '' : ' DEFAULT 0';
    return `${column.name} ${storageType} NOT NULL${defaultClause}`;
  }

  return null;
}

function buildJavaBaseJsonConverterTextColumnSql(
  definition: BirdCoderEntityDefinition,
  column: BirdCoderSchemaColumnDefinition,
): string | null {
  const textColumns = JAVA_BASE_JSON_CONVERTER_TEXT_COLUMNS_BY_ENTITY[definition.entityName];
  if (!(textColumns as readonly string[] | undefined)?.includes(column.name)) {
    return null;
  }

  const nullability = column.nullable ? ' NULL' : ' NOT NULL';
  return `${column.name} TEXT${nullability}`;
}

function buildSqliteInlineUniqueTextColumnSql(
  definition: BirdCoderEntityDefinition,
  column: BirdCoderSchemaColumnDefinition,
  providerId: SupportedBirdCoderProviderId,
): string | null {
  if (providerId !== 'sqlite') {
    return null;
  }

  const uniqueTextColumns = SQLITE_INLINE_UNIQUE_TEXT_COLUMNS_BY_ENTITY[definition.entityName];
  if (!(uniqueTextColumns as readonly string[] | undefined)?.includes(column.name)) {
    return null;
  }

  return `${column.name} TEXT NOT NULL UNIQUE`;
}

function buildColumnSql(
  column: BirdCoderSchemaColumnDefinition,
  dialect: BirdCoderStorageDialect,
  definition: BirdCoderEntityDefinition,
): string {
  const providerId = assertSupportedProviderId(dialect.providerId);
  const v104BootstrapColumnSql = buildV104BootstrapColumnSql(
    definition,
    column,
    providerId,
  );
  if (v104BootstrapColumnSql) {
    return v104BootstrapColumnSql;
  }

  const javaScopedColumnSql = buildJavaScopedColumnSql(
    definition,
    column,
    providerId,
  );
  if (javaScopedColumnSql) {
    return javaScopedColumnSql;
  }

  const javaLongIdentifierColumnSql = buildJavaLongIdentifierColumnSql(
    definition,
    column,
    providerId,
  );
  if (javaLongIdentifierColumnSql) {
    return javaLongIdentifierColumnSql;
  }

  const javaConvertedEnumColumnSql = buildJavaConvertedEnumColumnSql(
    definition,
    column,
  );
  if (javaConvertedEnumColumnSql) {
    return javaConvertedEnumColumnSql;
  }

  const javaBooleanDefaultColumnSql = buildJavaBooleanDefaultColumnSql(
    definition,
    column,
    providerId,
  );
  if (javaBooleanDefaultColumnSql) {
    return javaBooleanDefaultColumnSql;
  }

  const javaBaseJsonConverterTextColumnSql = buildJavaBaseJsonConverterTextColumnSql(
    definition,
    column,
  );
  if (javaBaseJsonConverterTextColumnSql) {
    return javaBaseJsonConverterTextColumnSql;
  }

  const sqliteInlineUniqueTextColumnSql = buildSqliteInlineUniqueTextColumnSql(
    definition,
    column,
    providerId,
  );
  if (sqliteInlineUniqueTextColumnSql) {
    return sqliteInlineUniqueTextColumnSql;
  }

  const parts = [column.name, dialect.mapLogicalType(column.logicalType)];

  if (column.name === 'id') {
    parts.push('PRIMARY KEY');
  } else if (!column.nullable) {
    parts.push('NOT NULL');
  }

  return parts.join(' ');
}

function buildCreateTableSql(
  definition: BirdCoderEntityDefinition,
  dialect: BirdCoderStorageDialect,
): string {
  const columnSql = definition.columns
    .map((column) => buildColumnSql(column, dialect, definition))
    .join(', ');
  const tableConstraints =
    definition.entityName === 'user_role' ? ', PRIMARY KEY (user_id, role_id)' : '';
  return `CREATE TABLE IF NOT EXISTS ${definition.tableName} (${columnSql}${tableConstraints});`;
}

function buildCreateIndexSql(definition: BirdCoderEntityDefinition): string[] {
  return definition.indexes.map((indexDefinition) => {
    const uniquePrefix = indexDefinition.unique ? 'UNIQUE ' : '';
    return `CREATE ${uniquePrefix}INDEX IF NOT EXISTS ${indexDefinition.name} ON ${definition.tableName} (${indexDefinition.columns.join(', ')});`;
  });
}

function buildMigrationStatements(
  providerId: SupportedBirdCoderProviderId,
  entityNames: readonly BirdCoderEntityName[],
): string[] {
  const dialect = createBirdCoderStorageDialect(providerId);

  return entityNames.flatMap((entityName) => {
    const definition = getBirdCoderEntityDefinition(entityName);
    return [buildCreateTableSql(definition, dialect), ...buildCreateIndexSql(definition)];
  });
}

export function createBirdCoderStorageDialect(
  providerId: BirdCoderDatabaseProviderId,
): BirdCoderStorageDialect {
  return DIALECTS[assertSupportedProviderId(providerId)];
}

export const BIRDCODER_SCHEMA_MIGRATIONS: readonly BirdCoderSchemaMigrationDefinition[] = [
  {
    migrationId: 'runtime-data-kernel-v1',
    description:
      'Bootstrap runtime/workbench schema, migration history, and provider-compatible SQL.',
    entityNames: RUNTIME_DATA_KERNEL_ENTITY_NAMES,
    sqlByProvider: {
      sqlite: buildMigrationStatements('sqlite', RUNTIME_DATA_KERNEL_ENTITY_NAMES),
      postgresql: buildMigrationStatements('postgresql', RUNTIME_DATA_KERNEL_ENTITY_NAMES),
    },
  },
  {
    migrationId: 'coding-server-kernel-v2',
    description:
      'Bootstrap coding session, prompt, skillhub, template, collaboration, and deployment schema.',
    entityNames: CODING_SERVER_KERNEL_ENTITY_NAMES,
    sqlByProvider: {
      sqlite: buildMigrationStatements('sqlite', CODING_SERVER_KERNEL_ENTITY_NAMES),
      postgresql: buildMigrationStatements('postgresql', CODING_SERVER_KERNEL_ENTITY_NAMES),
    },
  },
] as const;

export function getBirdCoderSchemaMigrationDefinition(
  migrationId: string,
): BirdCoderSchemaMigrationDefinition {
  const definition = BIRDCODER_SCHEMA_MIGRATIONS.find(
    (candidate) => candidate.migrationId === migrationId,
  );

  if (!definition) {
    throw new Error(`Unknown BirdCoder schema migration: ${migrationId}`);
  }

  return definition;
}
