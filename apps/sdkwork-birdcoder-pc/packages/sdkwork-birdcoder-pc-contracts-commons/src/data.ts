import { BIRDCODER_RUN_CONFIGURATION_ENTITY_DEFINITION } from './runConfigurationStorage.ts';

export const BIRDCODER_DATABASE_PROVIDER_IDS = ['sqlite', 'postgresql'] as const;

export type BirdCoderDatabaseProviderId =
  (typeof BIRDCODER_DATABASE_PROVIDER_IDS)[number] | (string & {});

export type BirdCoderAggregateName =
  | 'ai'
  | 'commerce'
  | 'comms'
  | 'content'
  | 'data'
  | 'iam'
  | 'integration'
  | 'media'
  | 'ops'
  | 'studio';

export type BirdCoderLogicalColumnType =
  | 'id'
  | 'text'
  | 'json'
  | 'enum'
  | 'bool'
  | 'int'
  | 'bigint'
  | 'decimal'
  | 'double'
  | 'date'
  | 'timestamp';

export type BirdCoderEntityName =
  | 'card'
  | 'user_card'
  | 'member_card'
  | 'member_level'
  | 'card_template'
  | 'coupon'
  | 'coupon_template'
  | 'user_coupon'
  | 'product'
  | 'sku'
  | 'currency'
  | 'exchange_rate'
  | 'agent_skill_package'
  | 'agent_skill'
  | 'user_agent_skill'
  | 'agent_plugin'
  | 'datasource'
  | 'datasource_schema'
  | 'datasource_table'
  | 'datasource_column'
  | 'ai_generation'
  | 'ai_generation_content'
  | 'ai_generation_style'
  | 'channel'
  | 'channel_account'
  | 'channel_proxy'
  | 'channel_resource'
  | 'app'
  | 'ai_model_availability'
  | 'ai_model_compliance_profile'
  | 'ai_model_info'
  | 'ai_model_price'
  | 'ai_model_price_metric'
  | 'ai_model_taxonomy'
  | 'ai_model_taxonomy_rel'
  | 'ai_tenant_model_policy'
  | 'ai_agent_tool_relation'
  | 'ai_agent'
  | 'ai_prompt'
  | 'ai_prompt_history'
  | 'ai_tool'
  | 'category'
  | 'attribute'
  | 'tags'
  | 'memory'
  | 'memory_item'
  | 'notification'
  | 'notification_content'
  | 'push_device_endpoint'
  | 'push_topic_subscription'
  | 'conversation'
  | 'chat_message'
  | 'chat_message_content'
  | 'detail'
  | 'collection'
  | 'collection_item'
  | 'favorite'
  | 'favorite_folder'
  | 'share'
  | 'share_visit_record'
  | 'sns_follow_relation'
  | 'sns_follow_statistics'
  | 'comments'
  | 'content_vote'
  | 'visit_history'
  | 'feeds'
  | 'short_url'
  | 'feedback'
  | 'email_message'
  | 'events'
  | 'disk'
  | 'disk_member'
  | 'file'
  | 'file_content'
  | 'file_part'
  | 'oss_bucket'
  | 'order'
  | 'order_item'
  | 'payment'
  | 'refund'
  | 'shopping_cart'
  | 'shopping_cart_item'
  | 'payment_webhook_event'
  | 'order_dispatch_rule'
  | 'order_worker_dispatch_profile'
  | 'account_history'
  | 'account_exchange_config'
  | 'ledger_bridge'
  | 'vip_level'
  | 'vip_benefit'
  | 'vip_level_benefit'
  | 'vip_pack_group'
  | 'vip_pack'
  | 'vip_recharge_method'
  | 'vip_recharge_pack'
  | 'vip_recharge'
  | 'vip_point_change'
  | 'vip_benefit_usage'
  | 'workspace'
  | 'project'
  | 'project_content'
  | 'file_asset'
  | 'coding_session'
  | 'coding_session_runtime'
  | 'coding_session_turn'
  | 'coding_session_message'
  | 'coding_session_prompt_entry'
  | 'saved_prompt_entry'
  | 'coding_session_event'
  | 'coding_session_artifact'
  | 'coding_session_checkpoint'
  | 'coding_session_operation'
  | 'model_catalog'
  | 'prompt_asset'
  | 'prompt_asset_version'
  | 'prompt_bundle'
  | 'prompt_bundle_item'
  | 'prompt_run'
  | 'prompt_evaluation'
  | 'skill_package'
  | 'skill_version'
  | 'skill_capability'
  | 'skill_installation'
  | 'skill_binding'
  | 'skill_runtime_config'
  | 'app_template'
  | 'app_template_version'
  | 'app_template_target_profile'
  | 'app_template_preset'
  | 'app_template_instantiation'
  | 'team'
  | 'team_member'
  | 'workspace_member'
  | 'project_collaborator'
  | 'project_document'
  | 'deployment_target'
  | 'deployment_record'
  | 'workbench_preference'
  | 'engine_registry'
  | 'engine_binding'
  | 'run_configuration'
  | 'terminal_execution'
  | 'build_execution'
  | 'preview_session'
  | 'simulator_session'
  | 'test_execution'
  | 'audit_event'
  | 'governance_policy'
  | 'release_record'
  | 'schema_migration_history';

export interface BirdCoderDatabaseProviderDefinition {
  id: BirdCoderDatabaseProviderId;
  displayName: string;
  description?: string;
  recommendedHosts: readonly ('browser' | 'tauri' | 'server')[];
  capabilities: {
    readonly concurrentTransactions: boolean;
    readonly jsonb: boolean;
    readonly offlineFirst: boolean;
    readonly transactionalDdl: boolean;
  };
}

export interface BirdCoderSchemaColumnDefinition {
  name: string;
  logicalType: BirdCoderLogicalColumnType;
  nullable?: boolean;
  description?: string;
}

export interface BirdCoderSchemaIndexDefinition {
  name: string;
  columns: readonly string[];
  description?: string;
  unique?: boolean;
}

export interface BirdCoderEntityDefinition {
  entityName: BirdCoderEntityName;
  tableName: string;
  aggregate: BirdCoderAggregateName;
  description: string;
  columns: readonly BirdCoderSchemaColumnDefinition[];
  indexes: readonly BirdCoderSchemaIndexDefinition[];
}

export interface BirdCoderEntityStorageBinding {
  entityName: BirdCoderEntityName;
  storageScope: string;
  storageKey: string;
  preferredProvider: BirdCoderDatabaseProviderId;
  storageMode: 'key-value' | 'table';
}

/**
 * Canonical JS/TS representation for BirdCoder Long/BIGINT identifiers.
 *
 * Database, Rust, and Java runtimes persist these identifiers as Long/BIGINT.
 * TypeScript transports them as decimal strings to avoid IEEE-754 precision loss.
 */
export type BirdCoderLongIntegerString = string;

export type BirdCoderLongIdString = BirdCoderLongIntegerString;

export type BirdCoderCanonicalEntityId = BirdCoderLongIdString;

export { BIRDCODER_DATA_SCOPES } from './dataScopes.ts';
export type { BirdCoderDataScope } from './dataScopes.ts';

export interface BirdCoderRecordEnvelope {
  id: BirdCoderCanonicalEntityId;
  createdAt: string;
  updatedAt: string;
  version: BirdCoderLongIntegerString;
  isDeleted: boolean;
}

export interface BirdCoderScopedRecordEnvelope extends BirdCoderRecordEnvelope {
  workspaceId: BirdCoderCanonicalEntityId;
  projectId: BirdCoderCanonicalEntityId;
}

export interface BirdCoderRunConfigurationRecord extends BirdCoderScopedRecordEnvelope {
  name: string;
  command: string;
  profileId: string;
  cwdMode: 'project' | 'workspace' | 'custom';
  customCwd: string;
  group: 'dev' | 'build' | 'test' | 'custom';
  scopeType: 'global' | 'workspace' | 'project';
  scopeId: BirdCoderCanonicalEntityId;
}

export interface BirdCoderTerminalExecutionRecord extends BirdCoderScopedRecordEnvelope {
  sessionId: BirdCoderCanonicalEntityId;
  command: string;
  argsJson: string;
  cwd: string;
  stdoutRef: string;
  stderrRef: string;
  exitCode: number | null;
  startedAt: string;
  endedAt: string | null;
}

export interface BirdCoderRepository<TEntity, TId = BirdCoderCanonicalEntityId> {
  delete(id: TId): Promise<void>;
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
}

export interface BirdCoderQueryRepository<TEntity> {
  count(filters?: Record<string, unknown>): Promise<number>;
  list(options?: {
    filters?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    orderBy?: readonly string[];
  }): Promise<TEntity[]>;
}

export interface BirdCoderUnitOfWork {
  providerId: BirdCoderDatabaseProviderId;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  withinTransaction<T>(operation: () => Promise<T>): Promise<T>;
}

export interface BirdCoderStorageDialect {
  providerId: BirdCoderDatabaseProviderId;
  buildPlaceholder(index: number): string;
  mapLogicalType(type: BirdCoderLogicalColumnType): string;
  supportsJsonb: boolean;
}

export interface BirdCoderSchemaMigrationDefinition {
  description: string;
  entityNames: readonly BirdCoderEntityName[];
  migrationId: string;
  sqlByProvider: Partial<Record<BirdCoderDatabaseProviderId, readonly string[]>>;
}

export interface BirdCoderStorageProvider {
  readonly dialect: BirdCoderStorageDialect;
  readonly providerId: BirdCoderDatabaseProviderId;
  beginUnitOfWork(): Promise<BirdCoderUnitOfWork>;
  close(): Promise<void>;
  healthCheck(): Promise<{ detail?: string; status: 'healthy' | 'degraded' | 'unavailable' }>;
  open(): Promise<void>;
  runMigrations(definitions: readonly BirdCoderSchemaMigrationDefinition[]): Promise<void>;
}

export const BIRDCODER_DATABASE_PROVIDERS: Record<
  'sqlite' | 'postgresql',
  BirdCoderDatabaseProviderDefinition
> = {
  sqlite: {
    id: 'sqlite',
    displayName: 'SQLite',

    recommendedHosts: ['tauri', 'server'],
    capabilities: {
      concurrentTransactions: false,
      jsonb: false,
      offlineFirst: true,
      transactionalDdl: false,
    },
  },
  postgresql: {
    id: 'postgresql',
    displayName: 'PostgreSQL',

    recommendedHosts: ['server'],
    capabilities: {
      concurrentTransactions: true,
      jsonb: true,
      offlineFirst: false,
      transactionalDdl: true,
    },
  },
};

const BASE_COLUMNS: readonly BirdCoderSchemaColumnDefinition[] = [
  {
    name: 'id',
    logicalType: 'id',

  },
  {
    name: 'uuid',
    logicalType: 'text',
    nullable: true,

  },
  {
    name: 'created_at',
    logicalType: 'timestamp',

  },
  {
    name: 'updated_at',
    logicalType: 'timestamp',

  },
  {
    name: 'version',
    logicalType: 'bigint',

  },
  {
    name: 'is_deleted',
    logicalType: 'bool',

  },
];

function withBaseColumns(
  columns: readonly BirdCoderSchemaColumnDefinition[],
): readonly BirdCoderSchemaColumnDefinition[] {
  const mergedColumnsByName = new Map<string, BirdCoderSchemaColumnDefinition>();
  for (const column of BASE_COLUMNS) {
    mergedColumnsByName.set(column.name, column);
  }
  for (const column of columns) {
    mergedColumnsByName.set(column.name, column);
  }
  return [...mergedColumnsByName.values()];
}

function defineEntity(
  entityName: BirdCoderEntityName,
  tableName: string,
  aggregate: BirdCoderAggregateName,
  description: string,
  columns: readonly BirdCoderSchemaColumnDefinition[],
  indexes: readonly BirdCoderSchemaIndexDefinition[] = [],
): BirdCoderEntityDefinition {
  return {
    entityName,
    tableName,
    aggregate,
    description,
    columns: withBaseColumns(columns).map(({ description: _desc, ...rest }) => rest as BirdCoderSchemaColumnDefinition),
    indexes: indexes.map(({ description: _desc, ...rest }) => rest as BirdCoderSchemaIndexDefinition),
  };
}

function defineExactEntity(
  entityName: BirdCoderEntityName,
  tableName: string,
  aggregate: BirdCoderAggregateName,
  description: string,
  columns: readonly BirdCoderSchemaColumnDefinition[],
  indexes: readonly BirdCoderSchemaIndexDefinition[] = [],
): BirdCoderEntityDefinition {
  return {
    entityName,
    tableName,
    aggregate,
    description,
    columns: columns.map(({ description: _desc, ...rest }) => rest as BirdCoderSchemaColumnDefinition),
    indexes: indexes.map(({ description: _desc, ...rest }) => rest as BirdCoderSchemaIndexDefinition),
  };
}

export const BIRDCODER_SCHEMA_MIGRATION_HISTORY_TABLE = 'ops_schema_migration_history';

export const BIRDCODER_DATA_ENTITY_DEFINITIONS: readonly BirdCoderEntityDefinition[] = [
  defineEntity(
    'card',
    'plus_card',
    'commerce',
    'Membership card root aligned with spring-ai-plus PlusCard.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      {
        name: 'card_organization_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'card_type', logicalType: 'enum', nullable: true },
      { name: 'code_type', logicalType: 'enum', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'brand_name', logicalType: 'text', nullable: true },
      { name: 'logo_url', logicalType: 'text', nullable: true },
      { name: 'notice', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'color', logicalType: 'text', nullable: true },
      { name: 'quantity', logicalType: 'int', nullable: true },
      { name: 'get_limit', logicalType: 'int', nullable: true },
      { name: 'can_share', logicalType: 'bool', nullable: true },
      {
        name: 'can_give_friend',
        logicalType: 'bool',
        nullable: true,

      },
      { name: 'start_time', logicalType: 'timestamp', nullable: true },
      { name: 'end_time', logicalType: 'timestamp', nullable: true },
      { name: 'status', logicalType: 'enum', nullable: true },
    ],
  ),
  defineEntity(
    'user_card',
    'plus_user_card',
    'commerce',
    'User-card binding aligned with spring-ai-plus PlusUserCard.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'card_id', logicalType: 'id', nullable: true },
      { name: 'card_code', logicalType: 'text', nullable: true },
      { name: 'acquire_time', logicalType: 'timestamp', nullable: true },
      { name: 'activate_time', logicalType: 'timestamp', nullable: true },
      { name: 'cancel_time', logicalType: 'timestamp', nullable: true },
      { name: 'points', logicalType: 'bigint', nullable: true },
      { name: 'balance', logicalType: 'bigint', nullable: true },
    ],
    [
      {
        name: 'idx_plus_user_card_user_card',
        columns: ['user_id', 'card_id'],

      },
    ],
  ),
  defineEntity(
    'member_card',
    'plus_member_card',
    'commerce',
    'Member card rules aligned with spring-ai-plus PlusMemberCard.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'card_id', logicalType: 'id', nullable: true },
      { name: 'supply_bonus', logicalType: 'bool', nullable: true },
      { name: 'supply_balance', logicalType: 'bool', nullable: true },
      { name: 'bonus_name', logicalType: 'text', nullable: true },
      { name: 'balance_name', logicalType: 'text', nullable: true },
      { name: 'prerogative', logicalType: 'text', nullable: true },
      { name: 'auto_activate', logicalType: 'bool', nullable: true },
      { name: 'wx_activate', logicalType: 'bool', nullable: true },
      { name: 'cost_money_unit', logicalType: 'int', nullable: true },
      { name: 'increase_bonus', logicalType: 'bigint', nullable: true },
      {
        name: 'init_increase_bonus',
        logicalType: 'bigint',
        nullable: true,

      },
      {
        name: 'max_increase_bonus',
        logicalType: 'bigint',
        nullable: true,

      },
      { name: 'cost_bonus_unit', logicalType: 'int', nullable: true },
      { name: 'reduce_money', logicalType: 'int', nullable: true },
      {
        name: 'least_money_to_use_bonus',
        logicalType: 'int',
        nullable: true,

      },
      { name: 'max_reduce_bonus', logicalType: 'int', nullable: true },
    ],
  ),
  defineEntity(
    'member_level',
    'plus_member_level',
    'commerce',
    'Member level aligned with spring-ai-plus PlusMemberLevel.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'card_id', logicalType: 'id', nullable: true },
      { name: 'level_name', logicalType: 'text', nullable: true },
      { name: 'required_points', logicalType: 'bigint', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'enum', nullable: true },
    ],
  ),
  defineEntity(
    'card_template',
    'plus_card_template',
    'commerce',
    'Membership card template aligned with spring-ai-plus PlusCardTemplate.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text', nullable: true },
      { name: 'template_code', logicalType: 'text', nullable: true },
      { name: 'card_type', logicalType: 'enum' },
      { name: 'code_type', logicalType: 'enum', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'brand_name', logicalType: 'text', nullable: true },
      { name: 'logo_url', logicalType: 'text', nullable: true },
      { name: 'notice', logicalType: 'text', nullable: true },
      { name: 'color', logicalType: 'text', nullable: true },
      { name: 'quantity', logicalType: 'int', nullable: true },
      { name: 'get_limit', logicalType: 'int', nullable: true },
      { name: 'can_share', logicalType: 'bool', nullable: true },
      {
        name: 'can_give_friend',
        logicalType: 'bool',
        nullable: true,

      },
      { name: 'minimum_balance', logicalType: 'decimal', nullable: true },
      { name: 'initial_balance', logicalType: 'decimal', nullable: true },
      { name: 'discount_rate', logicalType: 'decimal', nullable: true },
      { name: 'validity_type', logicalType: 'enum' },
      { name: 'start_time', logicalType: 'timestamp', nullable: true },
      { name: 'end_time', logicalType: 'timestamp', nullable: true },
      { name: 'validity_days', logicalType: 'int', nullable: true },
      { name: 'is_deleted', logicalType: 'bool', nullable: true },
    ],
    [
      {
        name: 'uk_plus_card_template_template_code',
        columns: ['template_code'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'coupon',
    'plus_coupon',
    'commerce',
    'Coupon root aligned with spring-ai-plus PlusCoupon.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'redeem_code', logicalType: 'text', nullable: true },
      { name: 'point_cost', logicalType: 'bigint', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'amount', logicalType: 'int', nullable: true },
      { name: 'discount', logicalType: 'double', nullable: true },
      {
        name: 'min_consume',
        logicalType: 'int',
        nullable: true,

      },
      { name: 'start_time', logicalType: 'timestamp', nullable: true },
      { name: 'end_time', logicalType: 'timestamp', nullable: true },
      { name: 'total', logicalType: 'int', nullable: true },
      { name: 'get_limit', logicalType: 'int', nullable: true },
      { name: 'received_count', logicalType: 'int', nullable: true },
      { name: 'used_count', logicalType: 'int', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'stackable', logicalType: 'bool' },
      { name: 'scope_type', logicalType: 'enum' },
      { name: 'scope_value', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_plus_coupon_redeem_code',
        columns: ['redeem_code'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'coupon_template',
    'plus_coupon_template',
    'commerce',
    'Coupon template aligned with spring-ai-plus PlusCouponTemplate.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'template_code', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'amount', logicalType: 'int', nullable: true },
      { name: 'discount', logicalType: 'double', nullable: true },
      {
        name: 'min_consume',
        logicalType: 'int',
        nullable: true,

      },
      { name: 'start_time', logicalType: 'timestamp', nullable: true },
      { name: 'end_time', logicalType: 'timestamp', nullable: true },
      { name: 'total', logicalType: 'int', nullable: true },
      { name: 'get_limit', logicalType: 'int', nullable: true },
      { name: 'received_count', logicalType: 'int', nullable: true },
      { name: 'used_count', logicalType: 'int', nullable: true },
      { name: 'status', logicalType: 'enum', nullable: true },
      { name: 'validity_type', logicalType: 'enum', nullable: true },
      { name: 'validity_days', logicalType: 'int', nullable: true },
      { name: 'can_share', logicalType: 'bool', nullable: true },
      { name: 'stackable', logicalType: 'bool', nullable: true },
      { name: 'scope_type', logicalType: 'enum', nullable: true },
      { name: 'scope_value', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_plus_coupon_template_template_code',
        columns: ['template_code'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'user_coupon',
    'plus_user_coupon',
    'commerce',
    'User coupon binding aligned with spring-ai-plus PlusUserCoupon.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'coupon_id', logicalType: 'id' },
      { name: 'coupon_code', logicalType: 'text' },
      { name: 'acquire_at', logicalType: 'timestamp' },
      {
        name: 'acquire_request_no',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'acquire_type', logicalType: 'enum' },
      { name: 'point_cost', logicalType: 'bigint', nullable: true },
      { name: 'points_refunded', logicalType: 'bool' },
      { name: 'points_refund_at', logicalType: 'timestamp', nullable: true },
      { name: 'use_at', logicalType: 'timestamp', nullable: true },
      { name: 'expire_at', logicalType: 'timestamp', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'order_id', logicalType: 'id', nullable: true },
      { name: 'can_shared', logicalType: 'bool' },
    ],
    [
      {
        name: 'uk_plus_user_coupon_code',
        columns: ['coupon_code'],

        unique: true,
      },
      {
        name: 'uk_plus_user_coupon_acquire_request_no',
        columns: ['user_id', 'acquire_request_no'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'product',
    'plus_product',
    'commerce',
    'Product catalog root aligned with spring-ai-plus PlusProduct.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'title', logicalType: 'text' },
      { name: 'code', logicalType: 'text', nullable: true },
      { name: 'subtitle', logicalType: 'text', nullable: true },
      { name: 'resources', logicalType: 'json', nullable: true },
      { name: 'price', logicalType: 'decimal' },
      { name: 'original_price', logicalType: 'decimal', nullable: true },
      { name: 'stock', logicalType: 'int' },
      { name: 'sales_count', logicalType: 'int', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'on_sale_at', logicalType: 'timestamp', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'category_id', logicalType: 'id' },
      { name: 'base_attributes', logicalType: 'json' },
      { name: 'spec_attributes', logicalType: 'json' },
    ],
    [
      {
        name: 'uk_plus_product_code',
        columns: ['code'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'sku',
    'plus_sku',
    'commerce',
    'Stock keeping unit aligned with spring-ai-plus PlusSku.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'product_id', logicalType: 'id' },
      { name: 'sku_code', logicalType: 'text' },
      { name: 'name', logicalType: 'text' },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'price', logicalType: 'decimal' },
      { name: 'original_price', logicalType: 'decimal', nullable: true },
      { name: 'stock', logicalType: 'int' },
      { name: 'sales', logicalType: 'int', nullable: true },
      { name: 'status', logicalType: 'int' },
      { name: 'image', logicalType: 'text', nullable: true },
      { name: 'specs', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_plus_sku_sku_code',
        columns: ['sku_code'],

        unique: true,
      },
      {
        name: 'idx_sku_product',
        columns: ['product_id'],

      },
      {
        name: 'idx_sku_code',
        columns: ['sku_code'],

      },
    ],
  ),
  defineEntity(
    'currency',
    'plus_currency',
    'commerce',
    'Currency catalog aligned with spring-ai-plus PlusCurrency.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'code', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'symbol', logicalType: 'text', nullable: true },
      { name: 'currency_type', logicalType: 'enum' },
      {
        name: 'precision_digits',
        logicalType: 'int',
        nullable: true,

      },
      { name: 'is_active', logicalType: 'bool', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_plus_currency_name',
        columns: ['name'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'exchange_rate',
    'plus_exchange_rate',
    'commerce',
    'Exchange rate aligned with spring-ai-plus PlusExchangeRate.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'base_currency_id', logicalType: 'id' },
      { name: 'target_currency_id', logicalType: 'id' },
      {
        name: 'base_currency_code',
        logicalType: 'enum',
        nullable: true,

      },
      {
        name: 'target_currency_code',
        logicalType: 'enum',
        nullable: true,

      },
      { name: 'rate', logicalType: 'decimal' },
      { name: 'effective_date', logicalType: 'date' },
    ],
    [
      {
        name: 'uk_exchange_rate_base_target_date',
        columns: ['base_currency_id', 'target_currency_id', 'effective_date'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'agent_skill_package',
    'plus_agent_skill_package',
    'ai',
    'Agent skill package aligned with spring-ai-plus PlusSkillBundle and PlusAgentSkillPackage.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'package_key', logicalType: 'text' },
      { name: 'name', logicalType: 'text' },
      { name: 'summary', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'icon', logicalType: 'text', nullable: true },
      { name: 'cover_image', logicalType: 'text', nullable: true },
      { name: 'category_id', logicalType: 'id', nullable: true },
      { name: 'enabled', logicalType: 'bool' },
      { name: 'featured', logicalType: 'bool' },
      { name: 'sort_weight', logicalType: 'int' },
      { name: 'tags', logicalType: 'json', nullable: true },
      {
        name: 'latest_published_at',
        logicalType: 'timestamp',
        nullable: true,

      },
    ],
    [
      {
        name: 'uk_plus_agent_skill_package_key',
        columns: ['tenant_id', 'organization_id', 'package_key'],

        unique: true,
      },
      {
        name: 'idx_plus_agent_skill_package_user',
        columns: ['user_id'],

      },
      {
        name: 'idx_plus_agent_skill_package_category',
        columns: ['category_id'],

      },
      {
        name: 'idx_plus_agent_skill_package_market',
        columns: ['enabled', 'featured', 'sort_weight'],

      },
    ],
  ),
  defineExactEntity(
    'agent_skill',
    'plus_agent_skill',
    'ai',
    'Agent skill aligned with spring-ai-plus PlusSkill and PlusAgentSkill.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'is_deleted', logicalType: 'bool' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'skill_key', logicalType: 'text' },
      { name: 'name', logicalType: 'text' },
      { name: 'summary', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'icon', logicalType: 'text', nullable: true },
      { name: 'cover_image', logicalType: 'text', nullable: true },
      { name: 'category_id', logicalType: 'id', nullable: true },
      { name: 'package_id', logicalType: 'id', nullable: true },
      { name: 'provider', logicalType: 'text', nullable: true },
      { name: 'version', logicalType: 'text', nullable: true },
      { name: 'version_name', logicalType: 'text', nullable: true },
      { name: 'runtime', logicalType: 'text', nullable: true },
      { name: 'entrypoint', logicalType: 'text', nullable: true },
      { name: 'manifest_url', logicalType: 'text', nullable: true },
      { name: 'repository_url', logicalType: 'text', nullable: true },
      { name: 'homepage_url', logicalType: 'text', nullable: true },
      { name: 'documentation_url', logicalType: 'text', nullable: true },
      { name: 'license_name', logicalType: 'text', nullable: true },
      { name: 'source_type', logicalType: 'enum' },
      { name: 'market_status', logicalType: 'enum' },
      { name: 'visibility', logicalType: 'enum' },
      { name: 'review_status', logicalType: 'enum' },
      { name: 'review_comment', logicalType: 'text', nullable: true },
      { name: 'reviewed_by', logicalType: 'id', nullable: true },
      { name: 'reviewed_at', logicalType: 'timestamp', nullable: true },
      { name: 'builtin', logicalType: 'bool' },
      { name: 'is_builtin', logicalType: 'bool' },
      { name: 'enabled', logicalType: 'bool' },
      { name: 'featured', logicalType: 'bool' },
      { name: 'recommend_weight', logicalType: 'int' },
      { name: 'price', logicalType: 'decimal', nullable: true },
      { name: 'currency', logicalType: 'text', nullable: true },
      { name: 'install_count', logicalType: 'bigint' },
      { name: 'rating_avg', logicalType: 'decimal', nullable: true },
      { name: 'rating_count', logicalType: 'bigint' },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'capabilities', logicalType: 'json', nullable: true },
      { name: 'config_schema', logicalType: 'json', nullable: true },
      { name: 'default_config', logicalType: 'json', nullable: true },
      {
        name: 'latest_published_at',
        logicalType: 'timestamp',
        nullable: true,

      },
    ],
    [
      {
        name: 'uk_plus_agent_skill_key',
        columns: ['tenant_id', 'organization_id', 'skill_key'],

        unique: true,
      },
      {
        name: 'idx_plus_agent_skill_user',
        columns: ['user_id'],

      },
      {
        name: 'idx_plus_agent_skill_category',
        columns: ['category_id'],

      },
      {
        name: 'idx_plus_agent_skill_package',
        columns: ['package_id'],

      },
      {
        name: 'idx_plus_agent_skill_market',
        columns: ['enabled', 'market_status', 'visibility', 'review_status'],

      },
      {
        name: 'idx_plus_agent_skill_featured',
        columns: ['featured', 'recommend_weight'],

      },
    ],
  ),
  defineEntity(
    'user_agent_skill',
    'plus_user_agent_skill',
    'ai',
    'User installed agent skill aligned with spring-ai-plus PlusUserSkillInstall and PlusUserAgentSkill.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'skill_id', logicalType: 'id' },
      { name: 'enabled', logicalType: 'bool' },
      { name: 'config', logicalType: 'json', nullable: true },
      { name: 'installed_at', logicalType: 'timestamp', nullable: true },
      { name: 'last_enabled_at', logicalType: 'timestamp', nullable: true },
      { name: 'last_used_at', logicalType: 'timestamp', nullable: true },
      { name: 'used_count', logicalType: 'bigint' },
    ],
    [
      {
        name: 'uk_plus_user_agent_skill',
        columns: ['tenant_id', 'organization_id', 'user_id', 'skill_id'],

        unique: true,
      },
      {
        name: 'idx_plus_user_agent_skill_user',
        columns: ['user_id'],

      },
      {
        name: 'idx_plus_user_agent_skill_skill',
        columns: ['skill_id'],

      },
      {
        name: 'idx_plus_user_agent_skill_enabled',
        columns: ['enabled'],

      },
    ],
  ),
  defineExactEntity(
    'agent_plugin',
    'plus_agent_plugin',
    'ai',
    'Agent plugin aligned with spring-ai-plus PlusAgentPlugin v1.0.4.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'code', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'version', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'text', nullable: true },
      { name: 'config', logicalType: 'json', nullable: true },
      { name: 'is_enabled', logicalType: 'bool' },
    ],
    [
      {
        name: 'idx_plus_agent_plugin_code',
        columns: ['code'],

      },
      {
        name: 'idx_plus_agent_plugin_type',
        columns: ['type'],

      },
      {
        name: 'idx_plus_agent_plugin_enabled',
        columns: ['is_enabled'],

      },
    ],
  ),
  defineExactEntity(
    'datasource',
    'plus_datasource',
    'data',
    'Datasource aligned with spring-ai-plus PlusDatasource v1.0.4.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'project_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'channel', logicalType: 'text' },
      { name: 'channel_id', logicalType: 'text' },
      { name: 'type', logicalType: 'int' },
      { name: 'status', logicalType: 'int' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'connection_config', logicalType: 'json' },
      { name: 'url', logicalType: 'text', nullable: true },
      { name: 'owner', logicalType: 'text', nullable: true },
      {
        name: 'last_connected_at',
        logicalType: 'timestamp',
        nullable: true,

      },
      {
        name: 'connection_timeout',
        logicalType: 'int',
        nullable: true,

      },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'db_version', logicalType: 'text', nullable: true },
      { name: 'security_level', logicalType: 'int', nullable: true },
      { name: 'access_count', logicalType: 'bigint' },
      { name: 'icon', logicalType: 'text', nullable: true },
      { name: 'color', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_plus_datasource_name',
        columns: ['name'],

      },
      {
        name: 'idx_plus_datasource_type',
        columns: ['type'],

      },
      {
        name: 'idx_plus_datasource_status',
        columns: ['status'],

      },
      {
        name: 'idx_plus_datasource_project_id',
        columns: ['project_id'],

      },
      {
        name: 'idx_plus_datasource_user_id',
        columns: ['user_id'],

      },
    ],
  ),
  defineExactEntity(
    'datasource_schema',
    'plus_schema',
    'data',
    'Datasource schema aligned with spring-ai-plus PlusSchema v1.0.4.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'datasource_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'int' },
      { name: 'table_count', logicalType: 'int' },
      {
        name: 'last_sync_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      { name: 'is_default', logicalType: 'bool' },
    ],
    [
      {
        name: 'idx_plus_schema_name',
        columns: ['name'],

      },
      {
        name: 'idx_plus_schema_datasource_id',
        columns: ['datasource_id'],

      },
      {
        name: 'uk_plus_schema_datasource_name',
        columns: ['datasource_id', 'name'],

        unique: true,
      },
    ],
  ),
  defineExactEntity(
    'datasource_table',
    'plus_table',
    'data',
    'Datasource table aligned with spring-ai-plus PlusTable v1.0.4.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'schema_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'text', nullable: true },
      { name: 'column_count', logicalType: 'int' },
      { name: 'row_count', logicalType: 'bigint' },
      {
        name: 'last_sync_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      { name: 'primary_keys', logicalType: 'text', nullable: true },
      { name: 'engine', logicalType: 'text', nullable: true },
      { name: 'create_sql', logicalType: 'text', nullable: true },
      { name: 'comment', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_plus_table_name',
        columns: ['name'],

      },
      {
        name: 'idx_plus_table_schema_id',
        columns: ['schema_id'],

      },
      {
        name: 'uk_plus_table_schema_name',
        columns: ['schema_id', 'name'],

        unique: true,
      },
    ],
  ),
  defineExactEntity(
    'datasource_column',
    'plus_column',
    'data',
    'Datasource column aligned with spring-ai-plus PlusColumn v1.0.4.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'table_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'data_type', logicalType: 'text', nullable: true },
      { name: 'column_type', logicalType: 'text', nullable: true },
      { name: 'ordinal_position', logicalType: 'int', nullable: true },
      { name: 'is_nullable', logicalType: 'bool' },
      { name: 'is_primary_key', logicalType: 'bool' },
      { name: 'is_auto_increment', logicalType: 'bool' },
      { name: 'default_value', logicalType: 'text', nullable: true },
      { name: 'comment', logicalType: 'text', nullable: true },
      { name: 'character_set', logicalType: 'text', nullable: true },
      { name: 'collation_rule', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_plus_column_name',
        columns: ['name'],

      },
      {
        name: 'idx_plus_column_table_id',
        columns: ['table_id'],

      },
      {
        name: 'idx_plus_column_ordinal_position',
        columns: ['ordinal_position'],

      },
      {
        name: 'uk_plus_column_table_name',
        columns: ['table_id', 'name'],

        unique: true,
      },
    ],
  ),
  defineExactEntity(
    'ai_generation',
    'plus_ai_generation',
    'ai',
    'AI generation task aligned with spring-ai-plus PlusAiGeneration v1.0.4.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'request_id', logicalType: 'text' },
      { name: 'idempotency_key', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'text' },
      { name: 'model', logicalType: 'text' },
      { name: 'channel', logicalType: 'text' },
      { name: 'input_params', logicalType: 'json', nullable: true },
      { name: 'output_result', logicalType: 'json', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'progress', logicalType: 'int' },
      { name: 'channel_task_id', logicalType: 'text', nullable: true },
      {
        name: 'channel_task_status',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'channel_task_info',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'cost', logicalType: 'decimal', nullable: true },
      { name: 'error_code', logicalType: 'text', nullable: true },
      { name: 'error_message', logicalType: 'text', nullable: true },
      { name: 'retry_count', logicalType: 'int' },
      { name: 'max_retry', logicalType: 'int' },
      { name: 'started_at', logicalType: 'timestamp', nullable: true },
      { name: 'completed_at', logicalType: 'timestamp', nullable: true },
      { name: 'conversation_id', logicalType: 'id', nullable: true },
      { name: 'message_id', logicalType: 'id', nullable: true },
      { name: 'parent_id', logicalType: 'id', nullable: true },
      { name: 'batch_id', logicalType: 'text', nullable: true },
      { name: 'callback_url', logicalType: 'text', nullable: true },
      { name: 'biz_scene', logicalType: 'text', nullable: true },
      { name: 'biz_id', logicalType: 'id', nullable: true },
      { name: 'is_public', logicalType: 'bool' },
      { name: 'view_count', logicalType: 'int' },
      { name: 'like_count', logicalType: 'int' },
    ],
    [
      {
        name: 'uk_plus_ai_generation_user_type_idempotency',
        columns: ['user_id', 'type', 'idempotency_key'],

        unique: true,
      },
      {
        name: 'idx_plus_ai_generation_user_status',
        columns: ['user_id', 'status'],

      },
      {
        name: 'idx_plus_ai_generation_type_status',
        columns: ['type', 'status'],

      },
      {
        name: 'idx_plus_ai_generation_channel_task',
        columns: ['channel_task_id'],

      },
      {
        name: 'idx_plus_ai_generation_conversation',
        columns: ['conversation_id'],

      },
    ],
  ),
  defineExactEntity(
    'ai_generation_content',
    'plus_ai_generation_content',
    'ai',
    'AI generation content aligned with spring-ai-plus PlusAiGenerationContent v1.0.4.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'channel', logicalType: 'text' },
      { name: 'type', logicalType: 'text' },
      { name: 'generation_id', logicalType: 'id' },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
      { name: 'input_params', logicalType: 'json', nullable: true },
      { name: 'output', logicalType: 'json', nullable: true },
      { name: 'content_format', logicalType: 'text', nullable: true },
      { name: 'original_prompt', logicalType: 'text', nullable: true },
      { name: 'optimized_prompt', logicalType: 'text', nullable: true },
      { name: 'negative_prompt', logicalType: 'text', nullable: true },
      { name: 'seed', logicalType: 'bigint', nullable: true },
      { name: 'steps', logicalType: 'int', nullable: true },
      { name: 'cfg_scale', logicalType: 'decimal', nullable: true },
      { name: 'sampler', logicalType: 'text', nullable: true },
      { name: 'width', logicalType: 'int', nullable: true },
      { name: 'height', logicalType: 'int', nullable: true },
      { name: 'duration', logicalType: 'decimal', nullable: true },
      { name: 'file_size', logicalType: 'bigint', nullable: true },
      { name: 'file_url', logicalType: 'text', nullable: true },
      { name: 'file_urls', logicalType: 'json', nullable: true },
      { name: 'thumbnail_url', logicalType: 'text', nullable: true },
      { name: 'preview_url', logicalType: 'text', nullable: true },
      { name: 'style', logicalType: 'text', nullable: true },
      { name: 'language', logicalType: 'text', nullable: true },
      { name: 'voice_id', logicalType: 'text', nullable: true },
      { name: 'is_hd', logicalType: 'bool' },
      { name: 'variant_index', logicalType: 'int', nullable: true },
      { name: 'extra_params', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'idx_plus_ai_generation_content_generation',
        columns: ['generation_id'],

      },
      {
        name: 'idx_plus_ai_generation_content_content_type',
        columns: ['content_type'],

      },
      {
        name: 'idx_plus_ai_generation_content_content_id',
        columns: ['content_id'],

      },
      {
        name: 'idx_plus_ai_generation_content_created_at',
        columns: ['created_at'],

      },
    ],
  ),
  defineExactEntity(
    'ai_generation_style',
    'plus_ai_generation_style',
    'ai',
    'AI generation style aligned with spring-ai-plus PlusAiGenerationStyle v1.0.4.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'config_params', logicalType: 'json', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'cover_image', logicalType: 'json', nullable: true },
      { name: 'assets', logicalType: 'json', nullable: true },
      { name: 'preview_image', logicalType: 'json', nullable: true },
      { name: 'is_public', logicalType: 'bool' },
      { name: 'status', logicalType: 'text' },
      { name: 'usage_count', logicalType: 'int' },
    ],
    [
      {
        name: 'idx_plus_ai_generation_style_user_id',
        columns: ['user_id'],

      },
      {
        name: 'idx_plus_ai_generation_style_name',
        columns: ['name'],

      },
      {
        name: 'idx_plus_ai_generation_style_type',
        columns: ['type'],

      },
      {
        name: 'idx_plus_ai_generation_style_status',
        columns: ['status'],

      },
    ],
  ),
  defineExactEntity(
    'channel',
    'plus_channel',
    'integration',
    'Platform integration channel aligned with spring-ai-plus PlusChannel.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'channel', logicalType: 'enum' },
      { name: 'types', logicalType: 'json', nullable: true },
      {
        name: 'support_resources',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'status', logicalType: 'enum' },
      { name: 'description', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_plus_channel_channel',
        columns: ['channel'],

      },
      {
        name: 'idx_plus_channel_status',
        columns: ['status'],

      },
    ],
  ),
  defineExactEntity(
    'channel_account',
    'plus_channel_account',
    'integration',
    'Platform channel account aligned with spring-ai-plus PlusChannelAccount.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'account_key', logicalType: 'text' },
      { name: 'channel', logicalType: 'enum' },
      { name: 'types', logicalType: 'json', nullable: true },
      {
        name: 'support_resources',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'configs', logicalType: 'json', nullable: true },
      {
        name: 'proxy_account_configs',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'status', logicalType: 'enum' },
      { name: 'description', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_plus_channel_account_key',
        columns: ['account_key'],

        unique: true,
      },
      {
        name: 'idx_plus_channel_account_channel',
        columns: ['channel'],

      },
      {
        name: 'idx_plus_channel_account_status',
        columns: ['status'],

      },
    ],
  ),
  defineExactEntity(
    'channel_proxy',
    'plus_channel_proxy',
    'integration',
    'Platform channel proxy aligned with spring-ai-plus PlusChannelProxy.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'channel', logicalType: 'enum' },
      { name: 'proxy', logicalType: 'enum' },
      { name: 'default_model', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'description', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_plus_channel_proxy_channel',
        columns: ['channel'],

      },
      {
        name: 'idx_plus_channel_proxy_status',
        columns: ['status'],

      },
    ],
  ),
  defineExactEntity(
    'channel_resource',
    'plus_channel_resource',
    'integration',
    'Platform channel resource aligned with spring-ai-plus PlusChannelResource.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'resource', logicalType: 'enum' },
      { name: 'channel', logicalType: 'enum' },
      { name: 'channel_account_id', logicalType: 'id' },
    ],
    [
      {
        name: 'idx_plus_channel_resource_account',
        columns: ['channel_account_id'],

      },
    ],
  ),
  defineExactEntity(
    'app',
    'studio_app',
    'studio',
    'Application root owned by the studio design-time aggregate.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'icon', logicalType: 'json', nullable: true },
      {
        name: 'resource_list',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'project_id', logicalType: 'id', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'version', logicalType: 'text', nullable: true },
      { name: 'icon_url', logicalType: 'text', nullable: true },
      { name: 'access_url', logicalType: 'text', nullable: true },
      { name: 'config', logicalType: 'json', nullable: true },
      { name: 'status', logicalType: 'enum', nullable: true },
      { name: 'app_type', logicalType: 'enum', nullable: true },
      { name: 'platforms', logicalType: 'json', nullable: true },
      {
        name: 'install_platforms',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'install_skill', logicalType: 'json', nullable: true },
      { name: 'install_config', logicalType: 'json', nullable: true },
      { name: 'release_notes', logicalType: 'json', nullable: true },
      { name: 'package_name', logicalType: 'text', nullable: true },
      { name: 'bundle_id', logicalType: 'text', nullable: true },
      { name: 'store_url', logicalType: 'text', nullable: true },
      { name: 'download_url', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_studio_app_user_id',
        columns: ['user_id'],

      },
      {
        name: 'idx_studio_app_project_id',
        columns: ['project_id'],

      },
      {
        name: 'idx_studio_app_status',
        columns: ['status'],

      },
    ],
  ),
  defineExactEntity(
    'ai_model_availability',
    'plus_ai_model_availability',
    'ai',
    'AI model availability matrix aligned with spring-ai-plus PlusAiModelAvailability.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'object_id', logicalType: 'text' },
      { name: 'model_id', logicalType: 'id', nullable: true },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'model_key', logicalType: 'text' },
      { name: 'platform', logicalType: 'text' },
      { name: 'environment', logicalType: 'text' },
      { name: 'region_code', logicalType: 'text' },
      { name: 'access_tier', logicalType: 'enum' },
      { name: 'available', logicalType: 'bool' },
      { name: 'status', logicalType: 'enum' },
      { name: 'effective_from', logicalType: 'timestamp', nullable: true },
      { name: 'effective_to', logicalType: 'timestamp', nullable: true },
      { name: 'reason', logicalType: 'text', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_ai_model_availability_scope',
        columns: [
          'tenant_id',
          'organization_id',
          'channel',
          'model_key',
          'platform',
          'environment',
          'region_code',
          'access_tier',
        ],

        unique: true,
      },
      {
        name: 'idx_ai_model_availability_model',
        columns: ['model_id'],

      },
      {
        name: 'idx_ai_model_availability_channel_key',
        columns: ['channel', 'model_key'],

      },
      {
        name: 'idx_ai_model_availability_platform_env',
        columns: ['platform', 'environment'],

      },
      {
        name: 'idx_ai_model_availability_region',
        columns: ['region_code'],

      },
      {
        name: 'idx_ai_model_availability_status',
        columns: ['status', 'available'],

      },
      {
        name: 'idx_ai_model_availability_time',
        columns: ['effective_from', 'effective_to'],

      },
    ],
  ),
  defineExactEntity(
    'ai_model_compliance_profile',
    'plus_ai_model_compliance_profile',
    'ai',
    'AI model compliance profile aligned with spring-ai-plus PlusAiModelComplianceProfile.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'object_id', logicalType: 'text' },
      { name: 'model_id', logicalType: 'id', nullable: true },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'model_key', logicalType: 'text' },
      { name: 'standard_code', logicalType: 'text' },
      { name: 'standard_name', logicalType: 'text', nullable: true },
      { name: 'level', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'verified_by', logicalType: 'text', nullable: true },
      { name: 'auditor', logicalType: 'text', nullable: true },
      { name: 'certificate_no', logicalType: 'text', nullable: true },
      { name: 'certificate_url', logicalType: 'text', nullable: true },
      { name: 'valid_from', logicalType: 'timestamp', nullable: true },
      { name: 'valid_to', logicalType: 'timestamp', nullable: true },
      {
        name: 'data_residency_regions',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'controls', logicalType: 'json', nullable: true },
      { name: 'notes', logicalType: 'text', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_ai_model_compliance_standard',
        columns: ['tenant_id', 'organization_id', 'channel', 'model_key', 'standard_code'],

        unique: true,
      },
      {
        name: 'idx_ai_model_compliance_model',
        columns: ['model_id'],

      },
      {
        name: 'idx_ai_model_compliance_channel_key',
        columns: ['channel', 'model_key'],

      },
      {
        name: 'idx_ai_model_compliance_standard',
        columns: ['standard_code'],

      },
      {
        name: 'idx_ai_model_compliance_level',
        columns: ['level'],

      },
      {
        name: 'idx_ai_model_compliance_status',
        columns: ['status'],

      },
      {
        name: 'idx_ai_model_compliance_valid',
        columns: ['valid_from', 'valid_to'],

      },
    ],
  ),
  defineExactEntity(
    'ai_model_info',
    'plus_ai_model_info',
    'ai',
    'AI model registry aligned with spring-ai-plus PlusAiModelInfo.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'object_id', logicalType: 'text' },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'vendor', logicalType: 'enum', nullable: true },
      { name: 'model', logicalType: 'text' },
      { name: 'model_id', logicalType: 'text' },
      { name: 'model_key', logicalType: 'text' },
      { name: 'vendor_model', logicalType: 'text' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'version', logicalType: 'text', nullable: true },
      { name: 'family', logicalType: 'text', nullable: true },
      { name: 'open_source', logicalType: 'bool', nullable: true },
      { name: 'api_endpoint', logicalType: 'text', nullable: true },
      { name: 'model_type', logicalType: 'enum', nullable: true },
      { name: 'pricing_type', logicalType: 'enum', nullable: true },
      {
        name: 'lifecycle_stage',
        logicalType: 'enum',
        nullable: true,

      },
      { name: 'release_date', logicalType: 'timestamp', nullable: true },
      { name: 'deprecated_at', logicalType: 'timestamp', nullable: true },
      { name: 'context_tokens', logicalType: 'bigint', nullable: true },
      { name: 'max_input_tokens', logicalType: 'bigint', nullable: true },
      { name: 'max_output_tokens', logicalType: 'bigint', nullable: true },
      { name: 'support_reasoning', logicalType: 'bool', nullable: true },
      { name: 'support_multimodal', logicalType: 'bool', nullable: true },
      {
        name: 'support_function_call',
        logicalType: 'bool',
        nullable: true,

      },
      {
        name: 'support_structured_output',
        logicalType: 'bool',
        nullable: true,

      },
      { name: 'support_realtime', logicalType: 'bool', nullable: true },
      {
        name: 'support_fine_tuning',
        logicalType: 'bool',
        nullable: true,

      },
      { name: 'popularity_score', logicalType: 'bigint', nullable: true },
      { name: 'scenes', logicalType: 'json', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'owned_by', logicalType: 'text', nullable: true },
      { name: 'function_info', logicalType: 'json', nullable: true },
      { name: 'limit_info', logicalType: 'json', nullable: true },
      { name: 'price_info', logicalType: 'json', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
      {
        name: 'product_support_info',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'supported_voices', logicalType: 'text', nullable: true },
      { name: 'default_temperature', logicalType: 'double', nullable: true },
      { name: 'default_top_p', logicalType: 'double', nullable: true },
      {
        name: 'default_frequency_penalty',
        logicalType: 'double',
        nullable: true,

      },
      {
        name: 'default_presence_penalty',
        logicalType: 'double',
        nullable: true,

      },
      { name: 'status', logicalType: 'enum', nullable: true },
      { name: 'usage_count', logicalType: 'bigint', nullable: true },
      { name: 'total_tokens', logicalType: 'bigint', nullable: true },
      { name: 'avg_response_time', logicalType: 'bigint', nullable: true },
      { name: 'config_params', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_model_channel_key',
        columns: ['channel', 'model_key'],

        unique: true,
      },
      { name: 'idx_model_channel', columns: ['channel'] },
      { name: 'idx_model_type', columns: ['model_type'] },
      { name: 'idx_model_status', columns: ['status'] },
      { name: 'idx_model_family', columns: ['family'] },
      { name: 'idx_model_vendor', columns: ['vendor'] },
      { name: 'idx_model_model_id', columns: ['model_id'] },
      { name: 'idx_model_model_key', columns: ['model_key'] },
      { name: 'idx_model_pricing_type', columns: ['pricing_type'] },
      {
        name: 'idx_model_lifecycle_stage',
        columns: ['lifecycle_stage'],

      },
      { name: 'idx_model_release_date', columns: ['release_date'] },
      {
        name: 'idx_model_context_tokens',
        columns: ['context_tokens'],

      },
      {
        name: 'idx_model_support_reasoning',
        columns: ['support_reasoning'],

      },
      {
        name: 'idx_model_support_multimodal',
        columns: ['support_multimodal'],

      },
      {
        name: 'idx_model_popularity_score',
        columns: ['popularity_score'],

      },
    ],
  ),
  defineExactEntity(
    'ai_model_price',
    'plus_ai_model_price',
    'ai',
    'AI model pricing rule aligned with spring-ai-plus PlusAiModelPrice.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'object_id', logicalType: 'text' },
      { name: 'model_id', logicalType: 'id', nullable: true },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'model_key', logicalType: 'text', nullable: true },
      { name: 'model', logicalType: 'text' },
      { name: 'product_code', logicalType: 'text', nullable: true },
      { name: 'feature_code', logicalType: 'text', nullable: true },
      { name: 'billing_type', logicalType: 'enum', nullable: true },
      { name: 'price_item_type', logicalType: 'enum', nullable: true },
      { name: 'tier_name', logicalType: 'text', nullable: true },
      { name: 'rule_priority', logicalType: 'int', nullable: true },
      { name: 'unit', logicalType: 'enum' },
      { name: 'unit_size', logicalType: 'double', nullable: true },
      { name: 'price', logicalType: 'double', nullable: true },
      { name: 'input_price', logicalType: 'double', nullable: true },
      { name: 'batch_input_price', logicalType: 'double', nullable: true },
      { name: 'cached_input_price', logicalType: 'double', nullable: true },
      {
        name: 'batch_cached_input_price',
        logicalType: 'double',
        nullable: true,

      },
      { name: 'output_price', logicalType: 'double', nullable: true },
      { name: 'batch_output_price', logicalType: 'double', nullable: true },
      { name: 'currency', logicalType: 'enum' },
      { name: 'min_usage', logicalType: 'double', nullable: true },
      { name: 'max_usage', logicalType: 'double', nullable: true },
      { name: 'effective_from', logicalType: 'timestamp', nullable: true },
      { name: 'effective_to', logicalType: 'timestamp', nullable: true },
      { name: 'is_default', logicalType: 'bool', nullable: true },
      { name: 'status', logicalType: 'enum', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      { name: 'idx_model_price_model_id', columns: ['model_id'] },
      {
        name: 'idx_model_price_channel_model_key',
        columns: ['channel', 'model_key'],

      },
      { name: 'idx_model_price_product', columns: ['product_code'] },
      { name: 'idx_model_price_feature', columns: ['feature_code'] },
      {
        name: 'idx_model_price_effective_time',
        columns: ['effective_from', 'effective_to'],

      },
      { name: 'idx_model_price_status', columns: ['status'] },
      {
        name: 'idx_model_price_lookup',
        columns: [
          'channel',
          'model_key',
          'product_code',
          'feature_code',
          'status',
          'effective_from',
          'effective_to',
          'is_default',
        ],

      },
    ],
  ),
  defineExactEntity(
    'ai_model_price_metric',
    'plus_ai_model_price_metric',
    'ai',
    'AI model detailed pricing metric aligned with spring-ai-plus PlusAiModelPriceMetric.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'object_id', logicalType: 'text' },
      { name: 'price_rule_id', logicalType: 'id' },
      { name: 'model_id', logicalType: 'id', nullable: true },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'model_key', logicalType: 'text', nullable: true },
      { name: 'product_code', logicalType: 'text', nullable: true },
      { name: 'feature_code', logicalType: 'text', nullable: true },
      { name: 'metric_type', logicalType: 'enum' },
      { name: 'billing_type', logicalType: 'enum' },
      { name: 'unit', logicalType: 'enum' },
      { name: 'unit_size', logicalType: 'double', nullable: true },
      { name: 'price', logicalType: 'double', nullable: true },
      { name: 'currency', logicalType: 'enum' },
      { name: 'min_usage', logicalType: 'double', nullable: true },
      { name: 'max_usage', logicalType: 'double', nullable: true },
      { name: 'tier_no', logicalType: 'int' },
      { name: 'tier_name', logicalType: 'text', nullable: true },
      { name: 'effective_from', logicalType: 'timestamp', nullable: true },
      { name: 'effective_to', logicalType: 'timestamp', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_ai_model_price_metric',
        columns: ['tenant_id', 'organization_id', 'price_rule_id', 'metric_type', 'tier_no'],

        unique: true,
      },
      {
        name: 'idx_ai_model_price_metric_price_rule',
        columns: ['price_rule_id'],

      },
      { name: 'idx_ai_model_price_metric_model', columns: ['model_id'] },
      {
        name: 'idx_ai_model_price_metric_channel_key',
        columns: ['channel', 'model_key'],

      },
      {
        name: 'idx_ai_model_price_metric_product_feature',
        columns: ['product_code', 'feature_code'],

      },
      {
        name: 'idx_ai_model_price_metric_effective',
        columns: ['effective_from', 'effective_to'],

      },
      { name: 'idx_ai_model_price_metric_status', columns: ['status'] },
    ],
  ),
  defineExactEntity(
    'ai_model_taxonomy',
    'plus_ai_model_taxonomy',
    'ai',
    'AI model taxonomy dictionary aligned with spring-ai-plus PlusAiModelTaxonomy.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'object_id', logicalType: 'text' },
      { name: 'type', logicalType: 'enum' },
      { name: 'code', logicalType: 'text' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'parent_id', logicalType: 'id', nullable: true },
      { name: 'path', logicalType: 'text', nullable: true },
      { name: 'level_no', logicalType: 'int', nullable: true },
      { name: 'icon', logicalType: 'text', nullable: true },
      { name: 'color', logicalType: 'text', nullable: true },
      { name: 'sort_weight', logicalType: 'int', nullable: true },
      { name: 'visible', logicalType: 'bool', nullable: true },
      { name: 'is_builtin', logicalType: 'bool', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_ai_model_taxonomy_code',
        columns: ['tenant_id', 'organization_id', 'type', 'code'],

        unique: true,
      },
      { name: 'idx_ai_model_taxonomy_type', columns: ['type'] },
      { name: 'idx_ai_model_taxonomy_parent', columns: ['parent_id'] },
      { name: 'idx_ai_model_taxonomy_status', columns: ['status'] },
      { name: 'idx_ai_model_taxonomy_sort', columns: ['sort_weight'] },
    ],
  ),
  defineExactEntity(
    'ai_model_taxonomy_rel',
    'plus_ai_model_taxonomy_rel',
    'ai',
    'AI model taxonomy relation aligned with spring-ai-plus PlusAiModelTaxonomyRel.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'object_id', logicalType: 'text' },
      { name: 'model_id', logicalType: 'id' },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'model_key', logicalType: 'text', nullable: true },
      { name: 'taxonomy_id', logicalType: 'id' },
      { name: 'taxonomy_type', logicalType: 'enum' },
      { name: 'taxonomy_code', logicalType: 'text', nullable: true },
      { name: 'relation_weight', logicalType: 'int', nullable: true },
      { name: 'is_primary_tag', logicalType: 'bool', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_ai_model_taxonomy_rel',
        columns: ['tenant_id', 'organization_id', 'model_id', 'taxonomy_id'],

        unique: true,
      },
      { name: 'idx_ai_model_taxonomy_rel_model', columns: ['model_id'] },
      {
        name: 'idx_ai_model_taxonomy_rel_taxonomy',
        columns: ['taxonomy_id'],

      },
      {
        name: 'idx_ai_model_taxonomy_rel_type',
        columns: ['taxonomy_type'],

      },
      {
        name: 'idx_ai_model_taxonomy_rel_channel_key',
        columns: ['channel', 'model_key'],

      },
      {
        name: 'idx_ai_model_taxonomy_rel_code',
        columns: ['taxonomy_code'],

      },
    ],
  ),
  defineExactEntity(
    'ai_tenant_model_policy',
    'plus_ai_tenant_model_policy',
    'ai',
    'Tenant model policy aligned with spring-ai-plus PlusAiTenantModelPolicy.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'object_id', logicalType: 'text' },
      { name: 'policy_code', logicalType: 'text' },
      { name: 'subject_type', logicalType: 'enum' },
      { name: 'subject_id', logicalType: 'id', nullable: true },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'model_id', logicalType: 'id', nullable: true },
      { name: 'model_key', logicalType: 'text', nullable: true },
      { name: 'feature_code', logicalType: 'text', nullable: true },
      { name: 'decision', logicalType: 'enum' },
      { name: 'enabled', logicalType: 'bool' },
      { name: 'priority', logicalType: 'int' },
      { name: 'qps_limit', logicalType: 'int', nullable: true },
      { name: 'concurrency_limit', logicalType: 'int', nullable: true },
      { name: 'daily_token_quota', logicalType: 'bigint', nullable: true },
      { name: 'monthly_token_quota', logicalType: 'bigint', nullable: true },
      { name: 'daily_request_quota', logicalType: 'bigint', nullable: true },
      { name: 'monthly_request_quota', logicalType: 'bigint', nullable: true },
      { name: 'effective_from', logicalType: 'timestamp', nullable: true },
      { name: 'effective_to', logicalType: 'timestamp', nullable: true },
      { name: 'reason', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_ai_tenant_model_policy_code',
        columns: ['tenant_id', 'organization_id', 'policy_code'],

        unique: true,
      },
      {
        name: 'idx_ai_tenant_model_policy_subject',
        columns: ['subject_type', 'subject_id'],

      },
      {
        name: 'idx_ai_tenant_model_policy_model',
        columns: ['channel', 'model_key'],

      },
      {
        name: 'idx_ai_tenant_model_policy_feature',
        columns: ['feature_code'],

      },
      {
        name: 'idx_ai_tenant_model_policy_effective',
        columns: ['effective_from', 'effective_to'],

      },
      {
        name: 'idx_ai_tenant_model_policy_priority',
        columns: ['enabled', 'priority'],

      },
      {
        name: 'idx_ai_tenant_model_policy_status',
        columns: ['status'],

      },
    ],
  ),
  defineExactEntity(
    'ai_agent_tool_relation',
    'plus_ai_agent_tool_relation',
    'ai',
    'AI agent tool relation aligned with spring-ai-plus PlusAgentToolRelation.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'agent_id', logicalType: 'id' },
      { name: 'tool_id', logicalType: 'id' },
      { name: 'sort_order', logicalType: 'int', nullable: true },
      { name: 'enabled', logicalType: 'bool' },
      {
        name: 'actions',
        logicalType: 'json',
        nullable: true,

      },
    ],
    [
      {
        name: 'uk_agent_tool',
        columns: ['agent_id', 'tool_id'],

        unique: true,
      },
    ],
  ),
  defineExactEntity(
    'ai_agent',
    'plus_ai_agent',
    'ai',
    'AI agent aligned with spring-ai-plus PlusAiAgentEntity.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'face_image', logicalType: 'json', nullable: true },
      { name: 'face_video', logicalType: 'json', nullable: true },
      { name: 'owner', logicalType: 'enum', nullable: true },
      { name: 'owner_id', logicalType: 'id' },
      { name: 'channel', logicalType: 'text', nullable: true },
      { name: 'channel_id', logicalType: 'text', nullable: true },
      { name: 'icon', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'biz_type', logicalType: 'bigint', nullable: true },
      { name: 'biz_scope', logicalType: 'enum', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'base_config', logicalType: 'json', nullable: true },
      {
        name: 'knowledge_config',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'memory_config', logicalType: 'json', nullable: true },
      { name: 'speech_config', logicalType: 'json', nullable: true },
      { name: 'tool_config', logicalType: 'json', nullable: true },
      { name: 'scene', logicalType: 'text', nullable: true },
      { name: 'chat_options', logicalType: 'json', nullable: true },
      { name: 'members', logicalType: 'json', nullable: true },
      { name: 'cate_id', logicalType: 'id', nullable: true },
      { name: 'prompt_id', logicalType: 'id', nullable: true },
    ],
    [
      {
        name: 'uk_ai_agent_user_id_name',
        columns: ['tenant_id', 'organization_id', 'user_id', 'name'],

        unique: true,
      },
    ],
  ),
  defineExactEntity(
    'ai_prompt',
    'plus_ai_prompt',
    'ai',
    'AI prompt aligned with spring-ai-plus PlusAiPrompt.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'title', logicalType: 'text' },
      { name: 'content', logicalType: 'text' },
      { name: 'type', logicalType: 'text' },
      { name: 'biz_type', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'cate_id', logicalType: 'id', nullable: true },
      { name: 'enabled', logicalType: 'bool' },
      { name: 'sort', logicalType: 'int', nullable: true },
      {
        name: 'parameters',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'creator', logicalType: 'text', nullable: true },
      { name: 'model', logicalType: 'text', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'usage_count', logicalType: 'bigint', nullable: true },
      {
        name: 'avg_response_time',
        logicalType: 'bigint',
        nullable: true,

      },
      { name: 'version', logicalType: 'text', nullable: true },
      { name: 'is_public', logicalType: 'bool', nullable: true },
      { name: 'is_favorite', logicalType: 'bool', nullable: true },
      { name: 'favorite_count', logicalType: 'int', nullable: true },
      { name: 'last_used_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      { name: 'idx_prompt_cate_id', columns: ['cate_id'] },
      { name: 'idx_prompt_type', columns: ['type'] },
      { name: 'idx_prompt_biz_type', columns: ['biz_type'] },
      { name: 'idx_prompt_enabled', columns: ['enabled'] },
      { name: 'idx_prompt_model', columns: ['model'] },
      { name: 'idx_prompt_created_at', columns: ['created_at'] },
    ],
  ),
  defineExactEntity(
    'ai_prompt_history',
    'plus_ai_prompt_history',
    'ai',
    'AI prompt history aligned with spring-ai-plus PlusAiPromptHistory.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'prompt_id', logicalType: 'id', nullable: true },
      { name: 'prompt_title', logicalType: 'text', nullable: true },
      { name: 'prompt_content', logicalType: 'text', nullable: true },
      { name: 'used_content', logicalType: 'text', nullable: true },
      { name: 'response_content', logicalType: 'text', nullable: true },
      { name: 'model', logicalType: 'text', nullable: true },
      { name: 'duration', logicalType: 'bigint', nullable: true },
      { name: 'input_tokens', logicalType: 'int', nullable: true },
      { name: 'output_tokens', logicalType: 'int', nullable: true },
      { name: 'success', logicalType: 'bool' },
      { name: 'error_message', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_prompt_history_user_id',
        columns: ['user_id'],

      },
      {
        name: 'idx_prompt_history_prompt_id',
        columns: ['prompt_id'],

      },
      {
        name: 'idx_prompt_history_created_at',
        columns: ['created_at'],

      },
    ],
  ),
  defineExactEntity(
    'ai_tool',
    'plus_ai_tool',
    'ai',
    'AI tool aligned with spring-ai-plus PlusToolEntity.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'owner', logicalType: 'enum', nullable: true },
      { name: 'owner_id', logicalType: 'id' },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'export_mcp', logicalType: 'bool' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'enabled', logicalType: 'bool' },
      {
        name: 'tool_definition',
        logicalType: 'json',
        nullable: true,

      },
    ],
  ),
  defineExactEntity(
    'category',
    'plus_category',
    'content',
    'Category tree aligned with spring-ai-plus PlusCategory.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'parent_id', logicalType: 'id', nullable: true },
      { name: 'parent_uuid', logicalType: 'text', nullable: true },
      { name: 'parent_metadata', logicalType: 'json', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'shop_id', logicalType: 'id' },
      { name: 'type', logicalType: 'enum' },
      { name: 'group_name', logicalType: 'text', nullable: true },
      { name: 'code', logicalType: 'text', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'icon', logicalType: 'text', nullable: true },
      { name: 'sort_weight', logicalType: 'int', nullable: true },
      {
        name: 'path',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'visible', logicalType: 'int' },
      { name: 'status', logicalType: 'enum' },
    ],
    [
      { name: 'idx_category_shop_id', columns: ['shop_id'] },
      {
        name: 'idx_category_type_shop',
        columns: ['type', 'shop_id'],

      },
    ],
  ),
  defineExactEntity(
    'attribute',
    'plus_attribute',
    'content',
    'Category/content attribute aligned with spring-ai-plus PlusAttribute.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'code', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id' },
      { name: 'category_id', logicalType: 'id' },
      { name: 'attribute_value', logicalType: 'text', nullable: true },
      { name: 'sort_weight', logicalType: 'int', nullable: true },
      { name: 'required', logicalType: 'int' },
      { name: 'status', logicalType: 'enum' },
    ],
    [
      {
        name: 'uk_plus_attribute_scope_code',
        columns: ['content_type', 'content_id', 'code'],

        unique: true,
      },
      {
        name: 'idx_plus_attribute_category_status',
        columns: ['category_id', 'status'],

      },
      {
        name: 'idx_plus_attribute_content_scope',
        columns: ['content_type', 'content_id', 'status'],

      },
    ],
  ),
  defineExactEntity(
    'tags',
    'plus_tags',
    'content',
    'User tag aligned with spring-ai-plus PlusTags.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
    ],
  ),
  defineExactEntity(
    'memory',
    'plus_memory',
    'data',
    'Agent memory profile aligned with spring-ai-plus PlusMemory.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text', nullable: true },
      { name: 'agent_id', logicalType: 'id', nullable: true },
      { name: 'conversation_id', logicalType: 'id', nullable: true },
      { name: 'profile', logicalType: 'json', nullable: true },
    ],
  ),
  defineExactEntity(
    'memory_item',
    'plus_memory_item',
    'data',
    'Agent memory item aligned with spring-ai-plus PlusMemoryItem.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'agent_id', logicalType: 'id', nullable: true },
      { name: 'conversation_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum', nullable: true },
      { name: 'content', logicalType: 'text', nullable: true },
    ],
  ),
  defineExactEntity(
    'notification',
    'plus_notification',
    'ops',
    'Notification envelope aligned with spring-ai-plus PlusNotification.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'role', logicalType: 'enum' },
      { name: 'sender_id', logicalType: 'id', nullable: true },
      { name: 'sender', logicalType: 'json', nullable: true },
      { name: 'receiver_id', logicalType: 'id', nullable: true },
      { name: 'receiver', logicalType: 'json', nullable: true },
      { name: 'group_id', logicalType: 'id', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'content', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'channel_type', logicalType: 'enum' },
      { name: 'template_id', logicalType: 'text', nullable: true },
      { name: 'template_params', logicalType: 'json', nullable: true },
      { name: 'redirect_url', logicalType: 'text', nullable: true },
      { name: 'mini_program_path', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'sent_at', logicalType: 'timestamp', nullable: true },
      { name: 'read_at', logicalType: 'timestamp', nullable: true },
      { name: 'extra_data', logicalType: 'json', nullable: true },
      { name: 'retry_count', logicalType: 'int', nullable: true },
      { name: 'max_retry_count', logicalType: 'int', nullable: true },
      { name: 'error_message', logicalType: 'text', nullable: true },
    ],
    [
      { name: 'idx_notification_receiver', columns: ['receiver_id'] },
      { name: 'idx_notification_sender', columns: ['sender_id'] },
      { name: 'idx_notification_group', columns: ['group_id'] },
      { name: 'idx_notification_status', columns: ['status'] },
      { name: 'idx_notification_type', columns: ['type'] },
      {
        name: 'idx_notification_channel',
        columns: ['channel_type'],

      },
      { name: 'idx_notification_tenant', columns: ['tenant_id'] },
      {
        name: 'idx_notification_org',
        columns: ['organization_id'],

      },
      {
        name: 'idx_notification_created',
        columns: ['created_at'],

      },
    ],
  ),
  defineExactEntity(
    'notification_content',
    'plus_notification_content',
    'ops',
    'Notification content aligned with spring-ai-plus PlusNotificationContent.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'notification_id', logicalType: 'id' },
      { name: 'notification_uuid', logicalType: 'text' },
      { name: 'role', logicalType: 'enum' },
      { name: 'message_type', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'type', logicalType: 'enum' },
      { name: 'channel_type', logicalType: 'enum' },
      { name: 'body', logicalType: 'json' },
      { name: 'sender_id', logicalType: 'id', nullable: true },
      { name: 'receiver_id', logicalType: 'id', nullable: true },
      { name: 'group_id', logicalType: 'id', nullable: true },
      {
        name: 'metadata',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'summary', logicalType: 'text', nullable: true },
      { name: 'priority', logicalType: 'int' },
      { name: 'expire_at', logicalType: 'timestamp', nullable: true },
      { name: 'is_muted', logicalType: 'bool' },
      { name: 'read_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      {
        name: 'idx_notification_content_notification',
        columns: ['notification_id'],

      },
      {
        name: 'idx_notification_content_message_type',
        columns: ['message_type'],

      },
      {
        name: 'idx_notification_content_status',
        columns: ['status'],

      },
      {
        name: 'idx_notification_content_receiver',
        columns: ['receiver_id'],

      },
      {
        name: 'idx_notification_content_group',
        columns: ['group_id'],

      },
      {
        name: 'idx_notification_content_notification_type',
        columns: ['type'],

      },
      {
        name: 'idx_notification_content_tenant',
        columns: ['tenant_id'],

      },
      {
        name: 'idx_notification_content_org',
        columns: ['organization_id'],

      },
    ],
  ),
  defineExactEntity(
    'push_device_endpoint',
    'plus_push_device_endpoint',
    'ops',
    'Push device endpoint aligned with spring-ai-plus PlusPushDeviceEndpoint.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'endpoint_id', logicalType: 'text' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'workspace_id', logicalType: 'id', nullable: true },
      { name: 'installation_id', logicalType: 'text' },
      { name: 'device_type', logicalType: 'text', nullable: true },
      { name: 'platform', logicalType: 'text', nullable: true },
      { name: 'vendor', logicalType: 'text', nullable: true },
      { name: 'device_token', logicalType: 'text', nullable: true },
      { name: 'permission_state', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'text' },
      { name: 'device_name', logicalType: 'text', nullable: true },
      { name: 'app_version', logicalType: 'text', nullable: true },
      { name: 'os_version', logicalType: 'text', nullable: true },
      { name: 'locale', logicalType: 'text', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
      { name: 'active', logicalType: 'bool' },
      { name: 'registered_at', logicalType: 'timestamp', nullable: true },
      { name: 'last_active_at', logicalType: 'timestamp', nullable: true },
      { name: 'disabled_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      {
        name: 'uk_plus_push_device_endpoint_endpoint_id',
        columns: ['endpoint_id'],

        unique: true,
      },
      { name: 'idx_push_endpoint_user', columns: ['user_id'] },
      { name: 'idx_push_endpoint_endpoint', columns: ['endpoint_id'] },
      {
        name: 'idx_push_endpoint_installation',
        columns: ['installation_id'],

      },
      { name: 'idx_push_endpoint_token', columns: ['device_token'] },
      { name: 'idx_push_endpoint_status', columns: ['status'] },
      {
        name: 'idx_push_endpoint_user_installation',
        columns: ['user_id', 'installation_id'],

      },
    ],
  ),
  defineExactEntity(
    'push_topic_subscription',
    'plus_push_topic_subscription',
    'ops',
    'Push topic subscription aligned with spring-ai-plus PlusPushTopicSubscription.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'endpoint_id', logicalType: 'text', nullable: true },
      { name: 'topic', logicalType: 'text' },
      { name: 'status', logicalType: 'text' },
      { name: 'metadata', logicalType: 'json', nullable: true },
      { name: 'subscribed_at', logicalType: 'timestamp', nullable: true },
      { name: 'unsubscribed_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      {
        name: 'uk_plus_push_topic_subscription_user_topic_endpoint',
        columns: ['user_id', 'topic', 'endpoint_id'],

        unique: true,
      },
      { name: 'idx_push_topic_user', columns: ['user_id'] },
      {
        name: 'idx_push_topic_endpoint',
        columns: ['endpoint_id'],

      },
      { name: 'idx_push_topic_topic', columns: ['topic'] },
      { name: 'idx_push_topic_status', columns: ['status'] },
    ],
  ),
  defineExactEntity(
    'conversation',
    'plus_conversation',
    'comms',
    'AI conversation aligned with spring-ai-plus PlusConversation.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum', nullable: true },
      { name: 'channel_id', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'knowledge_config', logicalType: 'json', nullable: true },
      { name: 'memory_config', logicalType: 'json', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'agent_id', logicalType: 'id', nullable: true },
      { name: 'agent_type', logicalType: 'enum', nullable: true },
      { name: 'agent_biz_type', logicalType: 'bigint', nullable: true },
      { name: 'scene', logicalType: 'text', nullable: true },
      { name: 'summary', logicalType: 'text', nullable: true },
      { name: 'last_message_id', logicalType: 'id', nullable: true },
      { name: 'message_count', logicalType: 'int' },
      { name: 'unread_count', logicalType: 'int' },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'content_type', logicalType: 'enum', nullable: true },
      { name: 'content_id', logicalType: 'id', nullable: true },
      { name: 'system_context', logicalType: 'text', nullable: true },
      { name: 'user_context', logicalType: 'text', nullable: true },
      {
        name: 'last_interaction_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      { name: 'model_id', logicalType: 'id', nullable: true },
      { name: 'model', logicalType: 'text', nullable: true },
      {
        name: 'knowledge_base_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'data_source_id', logicalType: 'id', nullable: true },
      { name: 'chat_options', logicalType: 'json', nullable: true },
      { name: 'pinned', logicalType: 'bool', nullable: true },
      { name: 'sort_order', logicalType: 'int', nullable: true },
    ],
    [
      { name: 'idx_plus_conversation_user_id', columns: ['user_id'] },
      { name: 'idx_plus_conversation_agent_id', columns: ['agent_id'] },
      { name: 'idx_plus_conversation_status', columns: ['status'] },
      {
        name: 'idx_plus_conversation_channel_id',
        columns: ['channel_id'],

      },
      {
        name: 'idx_plus_conversation_user_sort',
        columns: ['user_id', 'pinned', 'sort_order', 'updated_at'],

      },
      {
        name: 'idx_plus_conversation_agent_user_updated_at',
        columns: ['agent_id', 'user_id', 'updated_at'],

      },
      {
        name: 'idx_plus_conversation_last_interaction_time',
        columns: ['last_interaction_time'],

      },
    ],
  ),
  defineExactEntity(
    'chat_message',
    'plus_chat_message',
    'comms',
    'Chat message aligned with spring-ai-plus PlusChatMessage.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'role', logicalType: 'enum' },
      { name: 'sender_id', logicalType: 'id', nullable: true },
      { name: 'sender', logicalType: 'json', nullable: true },
      { name: 'receiver_id', logicalType: 'id', nullable: true },
      { name: 'receiver', logicalType: 'json', nullable: true },
      { name: 'group_id', logicalType: 'id', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      {
        name: 'conversation_type',
        logicalType: 'enum',
        nullable: true,

      },
      { name: 'conversation_id', logicalType: 'id' },
      { name: 'conversation_uuid', logicalType: 'text' },
      { name: 'channel_id', logicalType: 'text', nullable: true },
      { name: 'agent_id', logicalType: 'id', nullable: true },
      { name: 'knowledge_base_id', logicalType: 'id', nullable: true },
      { name: 'datasource_id', logicalType: 'id', nullable: true },
      { name: 'agent_type', logicalType: 'enum', nullable: true },
      { name: 'agent_biz_type', logicalType: 'bigint', nullable: true },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'channel_msg_id', logicalType: 'text' },
      { name: 'channel_client_msg_id', logicalType: 'text' },
      { name: 'channel_msg_seq', logicalType: 'bigint', nullable: true },
      {
        name: 'parent_message_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'token_count', logicalType: 'int', nullable: true },
      { name: 'send_at', logicalType: 'timestamp', nullable: true },
      { name: 'receive_at', logicalType: 'timestamp', nullable: true },
      { name: 'read_at', logicalType: 'timestamp', nullable: true },
      { name: 'processing_time', logicalType: 'bigint', nullable: true },
      { name: 'is_error', logicalType: 'bool', nullable: true },
      { name: 'error_code', logicalType: 'text', nullable: true },
      { name: 'error_message', logicalType: 'text', nullable: true },
      { name: 'model_id', logicalType: 'id', nullable: true },
      { name: 'model', logicalType: 'text', nullable: true },
      { name: 'temperature', logicalType: 'double', nullable: true },
      { name: 'used_rag', logicalType: 'bool', nullable: true },
      { name: 'chat_options', logicalType: 'json', nullable: true },
      { name: 'feedback_metadata', logicalType: 'json', nullable: true },
    ],
    [
      { name: 'idx_plus_chat_message_user_id', columns: ['user_id'] },
      {
        name: 'idx_plus_chat_message_conversation_id',
        columns: ['conversation_id'],

      },
      { name: 'idx_plus_chat_message_status', columns: ['status'] },
      { name: 'idx_plus_chat_message_sender_id', columns: ['sender_id'] },
      {
        name: 'idx_plus_chat_message_receiver_id',
        columns: ['receiver_id'],

      },
      { name: 'idx_plus_chat_message_group_id', columns: ['group_id'] },
      {
        name: 'idx_plus_chat_message_parent_message_id',
        columns: ['parent_message_id'],

      },
      {
        name: 'idx_plus_chat_message_channel_msg_id',
        columns: ['channel_msg_id'],

      },
      {
        name: 'idx_plus_chat_message_created_at',
        columns: ['created_at'],

      },
    ],
  ),
  defineExactEntity(
    'chat_message_content',
    'plus_chat_message_content',
    'comms',
    'Chat message content aligned with spring-ai-plus PlusChatMessageContent.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'message_id', logicalType: 'id' },
      { name: 'channel_msg_id', logicalType: 'text' },
      { name: 'role', logicalType: 'enum' },
      { name: 'type', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'conversation_id', logicalType: 'id' },
      { name: 'conversation_uuid', logicalType: 'text' },
      { name: 'agent_id', logicalType: 'id', nullable: true },
      { name: 'agent_type', logicalType: 'enum' },
      { name: 'agent_biz_type', logicalType: 'bigint', nullable: true },
      { name: 'content', logicalType: 'json' },
      {
        name: 'metadata',
        logicalType: 'json',
        nullable: true,

      },
    ],
    [
      {
        name: 'uk_plus_chat_message_content_message_id',
        columns: ['message_id'],

        unique: true,
      },
      {
        name: 'idx_plus_chat_message_content_channel_msg_id',
        columns: ['channel_msg_id'],

      },
      {
        name: 'idx_plus_chat_message_content_conversation_id',
        columns: ['conversation_id'],

      },
      {
        name: 'idx_plus_chat_message_content_status',
        columns: ['status'],

      },
    ],
  ),
  defineExactEntity(
    'detail',
    'plus_detail',
    'content',
    'Generic content detail aligned with spring-ai-plus PlusDetail.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id' },
      { name: 'content', logicalType: 'json', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
  ),
  defineExactEntity(
    'collection',
    'plus_collection',
    'content',
    'Collection tree aligned with spring-ai-plus PlusCollection.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'parent_id', logicalType: 'id', nullable: true },
      { name: 'parent_uuid', logicalType: 'text', nullable: true },
      { name: 'parent_metadata', logicalType: 'json', nullable: true },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id', nullable: true },
      { name: 'cover_image', logicalType: 'text', nullable: true },
      { name: 'is_public', logicalType: 'bool', nullable: true },
      { name: 'is_pinned', logicalType: 'bool', nullable: true },
      { name: 'sort', logicalType: 'int', nullable: true },
      { name: 'item_count', logicalType: 'int', nullable: true },
      { name: 'view_count', logicalType: 'int', nullable: true },
      { name: 'favorite_count', logicalType: 'int', nullable: true },
      { name: 'last_updated_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      { name: 'idx_collection_parent', columns: ['parent_id'] },
      { name: 'idx_collection_type', columns: ['type'] },
      { name: 'idx_collection_user', columns: ['user_id'] },
      { name: 'idx_collection_content', columns: ['content_id'] },
      { name: 'idx_collection_created', columns: ['created_at'] },
    ],
  ),
  defineExactEntity(
    'collection_item',
    'plus_collection_item',
    'content',
    'Collection item aligned with spring-ai-plus PlusCollectionItem.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'collection_id', logicalType: 'id' },
      { name: 'collection_uuid', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id' },
      { name: 'content_uuid', logicalType: 'text', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'cover_image', logicalType: 'text', nullable: true },
      { name: 'position', logicalType: 'int' },
      { name: 'is_pinned', logicalType: 'bool' },
      { name: 'tags', logicalType: 'text', nullable: true },
      { name: 'extra_data', logicalType: 'json', nullable: true },
      { name: 'source', logicalType: 'text', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'added_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      { name: 'idx_coll_item_collection', columns: ['collection_id'] },
      { name: 'idx_coll_item_content_type', columns: ['content_type'] },
      { name: 'idx_coll_item_content_id', columns: ['content_id'] },
      { name: 'idx_coll_item_position', columns: ['position'] },
      { name: 'idx_coll_item_created', columns: ['created_at'] },
    ],
  ),
  defineExactEntity(
    'favorite',
    'plus_favorite',
    'content',
    'Favorite item aligned with spring-ai-plus PlusFavorite.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'image', logicalType: 'json', nullable: true },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id' },
      { name: 'folder_id', logicalType: 'id', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'tags', logicalType: 'text', nullable: true },
      { name: 'sort_weight', logicalType: 'int', nullable: true },
      { name: 'is_private', logicalType: 'bool' },
      { name: 'status', logicalType: 'enum' },
      { name: 'view_count', logicalType: 'int', nullable: true },
      { name: 'last_viewed_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      {
        name: 'uk_favorite_user_content',
        columns: ['user_id', 'content_type', 'content_id'],

        unique: true,
      },
      { name: 'idx_favorite_user_id', columns: ['user_id'] },
      {
        name: 'idx_favorite_content',
        columns: ['content_type', 'content_id'],

      },
      { name: 'idx_favorite_folder_id', columns: ['folder_id'] },
      { name: 'idx_favorite_created_at', columns: ['created_at'] },
    ],
  ),
  defineExactEntity(
    'favorite_folder',
    'plus_favorite_folder',
    'content',
    'Favorite folder aligned with spring-ai-plus PlusFavoriteFolder.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'parent_id', logicalType: 'id', nullable: true },
      { name: 'item_count', logicalType: 'int', nullable: true },
      { name: 'sort_order', logicalType: 'int', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'is_private', logicalType: 'bool' },
      { name: 'is_default', logicalType: 'bool' },
      { name: 'is_deleted', logicalType: 'bool' },
    ],
    [
      { name: 'idx_folder_user', columns: ['user_id'] },
      { name: 'idx_folder_parent', columns: ['parent_id'] },
    ],
  ),
  defineExactEntity(
    'share',
    'plus_share',
    'content',
    'Share link aligned with spring-ai-plus PlusShare.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'contents', logicalType: 'json', nullable: true },
      { name: 'content_type', logicalType: 'enum', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'share_url', logicalType: 'text', nullable: true },
      { name: 'content_ids', logicalType: 'json', nullable: true },
      { name: 'password', logicalType: 'text', nullable: true },
      { name: 'expire_at', logicalType: 'timestamp', nullable: true },
      { name: 'click_count', logicalType: 'int', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'share_code', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_plus_share_share_code',
        columns: ['share_code'],

        unique: true,
      },
    ],
  ),
  defineExactEntity(
    'share_visit_record',
    'plus_share_visit_record',
    'content',
    'Share visit record aligned with spring-ai-plus PlusShareVisitRecord.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'share_id', logicalType: 'id' },
      { name: 'ip_address', logicalType: 'text', nullable: true },
      { name: 'user_agent', logicalType: 'text', nullable: true },
      { name: 'accessed_at', logicalType: 'timestamp' },
      { name: 'success', logicalType: 'bool', nullable: true },
    ],
    [
      { name: 'idx_share_id', columns: ['share_id'] },
      { name: 'idx_ip_address', columns: ['ip_address'] },
      { name: 'idx_created_at', columns: ['created_at'] },
    ],
  ),
  defineExactEntity(
    'sns_follow_relation',
    'plus_sns_follow_relation',
    'comms',
    'SNS follow relation aligned with spring-ai-plus PlusFollowRelation.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'follower_id', logicalType: 'id' },
      { name: 'following_id', logicalType: 'id' },
      { name: 'relation_type', logicalType: 'enum' },
      { name: 'owner', logicalType: 'enum' },
      { name: 'owner_id', logicalType: 'id' },
      { name: 'is_mutual', logicalType: 'bool' },
      { name: 'is_blocked', logicalType: 'bool' },
      { name: 'is_special', logicalType: 'bool' },
      { name: 'group_name', logicalType: 'text', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_sns_follow_relation',
        columns: ['follower_id', 'following_id'],

        unique: true,
      },
      { name: 'idx_sns_follow_rel_follower_id', columns: ['follower_id'] },
      { name: 'idx_sns_follow_rel_following_id', columns: ['following_id'] },
      { name: 'idx_sns_follow_rel_relation_type', columns: ['relation_type'] },
      { name: 'idx_sns_follow_rel_owner_id', columns: ['owner_id'] },
      { name: 'idx_sns_follow_rel_is_mutual', columns: ['is_mutual'] },
      { name: 'idx_sns_follow_rel_is_blocked', columns: ['is_blocked'] },
      { name: 'idx_sns_follow_rel_is_special', columns: ['is_special'] },
      { name: 'idx_sns_follow_rel_created_at', columns: ['created_at'] },
    ],
  ),
  defineExactEntity(
    'sns_follow_statistics',
    'plus_sns_follow_statistics',
    'comms',
    'SNS follow statistics aligned with spring-ai-plus PlusFollowStatistics.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'owner_id', logicalType: 'id' },
      { name: 'following_count', logicalType: 'bigint' },
      { name: 'follower_count', logicalType: 'bigint' },
      { name: 'mutual_count', logicalType: 'bigint' },
      { name: 'special_count', logicalType: 'bigint' },
      { name: 'blocked_count', logicalType: 'bigint' },
      { name: 'total_interaction_count', logicalType: 'bigint' },
      { name: 'last_updated_at', logicalType: 'bigint', nullable: true },
    ],
    [
      {
        name: 'uk_sns_follow_statistics',
        columns: ['user_id', 'owner_id'],

        unique: true,
      },
      { name: 'idx_sns_follow_stat_user_id', columns: ['user_id'] },
      { name: 'idx_sns_follow_stat_owner_id', columns: ['owner_id'] },
      { name: 'idx_sns_follow_stat_following_count', columns: ['following_count'] },
      { name: 'idx_sns_follow_stat_follower_count', columns: ['follower_count'] },
      { name: 'idx_sns_follow_stat_mutual_count', columns: ['mutual_count'] },
    ],
  ),
  defineExactEntity(
    'comments',
    'plus_comments',
    'content',
    'Content comments aligned with spring-ai-plus PlusComments.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'parent_id', logicalType: 'id', nullable: true },
      { name: 'parent_uuid', logicalType: 'text', nullable: true },
      { name: 'parent_metadata', logicalType: 'json', nullable: true },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'content', logicalType: 'text' },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id' },
      { name: 'status', logicalType: 'enum' },
      { name: 'likes', logicalType: 'int', nullable: true },
      { name: 'reply_count', logicalType: 'int', nullable: true },
      { name: 'is_top', logicalType: 'bool', nullable: true },
      { name: 'ip_address', logicalType: 'text', nullable: true },
      { name: 'device_info', logicalType: 'text', nullable: true },
      { name: 'author', logicalType: 'json', nullable: true },
    ],
    [
      { name: 'idx_comment_content_id_type', columns: ['content_id', 'content_type'] },
      { name: 'idx_comment_user_id', columns: ['user_id'] },
      { name: 'idx_comment_status', columns: ['status'] },
      { name: 'idx_comment_parent_id', columns: ['parent_id'] },
    ],
  ),
  defineExactEntity(
    'content_vote',
    'plus_content_vote',
    'content',
    'Content vote aligned with spring-ai-plus ContentVote.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id' },
      { name: 'rating', logicalType: 'enum' },
      { name: 'metadata', logicalType: 'json', nullable: true },
      { name: 'source', logicalType: 'text', nullable: true },
      { name: 'client_ip', logicalType: 'text', nullable: true },
      { name: 'device_info', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_vote_user_content',
        columns: ['user_id', 'content_type', 'content_id'],

        unique: true,
      },
      { name: 'idx_vote_content', columns: ['content_type', 'content_id'] },
      { name: 'idx_vote_rating', columns: ['rating'] },
      { name: 'idx_vote_created_at', columns: ['created_at'] },
    ],
  ),
  defineExactEntity(
    'visit_history',
    'plus_visit_history',
    'ops',
    'Content visit history aligned with spring-ai-plus PlusVisitHistory.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id' },
      { name: 'visit_count', logicalType: 'int', nullable: true },
      { name: 'last_visited_at', logicalType: 'timestamp' },
      { name: 'duration', logicalType: 'int', nullable: true },
      { name: 'source', logicalType: 'text', nullable: true },
    ],
    [
      { name: 'idx_visit_user_content', columns: ['user_id', 'content_type', 'content_id'] },
      { name: 'idx_visit_user_id', columns: ['user_id'] },
      { name: 'idx_visit_content_type', columns: ['content_type'] },
      { name: 'idx_visit_created_at', columns: ['created_at'] },
    ],
  ),
  defineExactEntity(
    'feeds',
    'plus_feeds',
    'content',
    'Content feed item aligned with spring-ai-plus PlusFeeds.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'title', logicalType: 'text' },
      { name: 'summary', logicalType: 'text', nullable: true },
      { name: 'category_id', logicalType: 'id' },
      { name: 'content_type', logicalType: 'enum' },
      { name: 'content_id', logicalType: 'id' },
      { name: 'cover_images', logicalType: 'json', nullable: true },
      { name: 'resource_list', logicalType: 'json', nullable: true },
      { name: 'author', logicalType: 'json', nullable: true },
      { name: 'source', logicalType: 'text', nullable: true },
      { name: 'source_url', logicalType: 'text', nullable: true },
      { name: 'publish_time', logicalType: 'timestamp', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'view_count', logicalType: 'bigint', nullable: true },
      { name: 'like_count', logicalType: 'bigint', nullable: true },
      { name: 'comment_count', logicalType: 'bigint', nullable: true },
      { name: 'share_count', logicalType: 'bigint', nullable: true },
      { name: 'favorite_count', logicalType: 'bigint', nullable: true },
      { name: 'is_top', logicalType: 'bool', nullable: true },
      { name: 'is_hot', logicalType: 'bool', nullable: true },
      { name: 'is_recommended', logicalType: 'bool', nullable: true },
      { name: 'sort_order', logicalType: 'int', nullable: true },
    ],
    [
      { name: 'idx_feeds_status', columns: ['status'] },
      { name: 'idx_feeds_user_id', columns: ['user_id'] },
      { name: 'idx_feeds_category_id', columns: ['category_id'] },
      { name: 'idx_feeds_content_type', columns: ['content_type'] },
      { name: 'idx_feeds_publish_time', columns: ['publish_time'] },
      { name: 'idx_feeds_status_publish_time', columns: ['status', 'publish_time'] },
    ],
  ),
  defineExactEntity(
    'short_url',
    'plus_short_url',
    'ops',
    'Short URL aligned with spring-ai-plus ShortUrl.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'original_url', logicalType: 'text' },
      { name: 'short_code', logicalType: 'text' },
      { name: 'expires_at', logicalType: 'timestamp', nullable: true },
      { name: 'click_count', logicalType: 'int' },
      { name: 'status', logicalType: 'enum' },
      { name: 'created_by', logicalType: 'id', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_plus_short_url_short_code',
        columns: ['short_code'],

        unique: true,
      },
    ],
  ),
  defineExactEntity(
    'feedback',
    'plus_feedback',
    'ops',
    'Feedback aligned with spring-ai-plus PlusFeedback.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'title', logicalType: 'text' },
      { name: 'feedback_content', logicalType: 'text' },
      { name: 'feedback_type', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'priority', logicalType: 'int', nullable: true },
      { name: 'biz_id', logicalType: 'id', nullable: true },
      { name: 'biz_type', logicalType: 'text', nullable: true },
      { name: 'rating', logicalType: 'int', nullable: true },
      { name: 'contact_info', logicalType: 'text', nullable: true },
      { name: 'attachments', logicalType: 'json', nullable: true },
      { name: 'images', logicalType: 'json', nullable: true },
      { name: 'reply_content', logicalType: 'text', nullable: true },
      { name: 'reply_time', logicalType: 'timestamp', nullable: true },
      { name: 'reply_user_id', logicalType: 'id', nullable: true },
      { name: 'resolved_at', logicalType: 'timestamp', nullable: true },
      { name: 'closed_at', logicalType: 'timestamp', nullable: true },
      { name: 'closed_by', logicalType: 'id', nullable: true },
      { name: 'close_reason', logicalType: 'text', nullable: true },
      { name: 'follow_up_count', logicalType: 'int', nullable: true },
      { name: 'last_follow_up_time', logicalType: 'timestamp', nullable: true },
      { name: 'assigned_to', logicalType: 'id', nullable: true },
      { name: 'assigned_at', logicalType: 'timestamp', nullable: true },
      { name: 'tags', logicalType: 'text', nullable: true },
      { name: 'source', logicalType: 'text', nullable: true },
      { name: 'device_info', logicalType: 'text', nullable: true },
      { name: 'app_version', logicalType: 'text', nullable: true },
    ],
    [
      { name: 'idx_feedback_user_id', columns: ['user_id'] },
      { name: 'idx_feedback_status', columns: ['status'] },
      { name: 'idx_feedback_type', columns: ['feedback_type'] },
      { name: 'idx_feedback_created_at', columns: ['created_at'] },
      { name: 'idx_feedback_status_created', columns: ['status', 'created_at'] },
    ],
  ),
  defineExactEntity(
    'email_message',
    'plus_email_message',
    'ops',
    'Email message aligned with spring-ai-plus PlusEmailMessage.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'folder', logicalType: 'text' },
      { name: 'direction', logicalType: 'text' },
      { name: 'external_message_id', logicalType: 'text' },
      { name: 'from_address', logicalType: 'text', nullable: true },
      { name: 'to_addresses', logicalType: 'json', nullable: true },
      { name: 'cc_addresses', logicalType: 'json', nullable: true },
      { name: 'bcc_addresses', logicalType: 'json', nullable: true },
      { name: 'subject', logicalType: 'text', nullable: true },
      { name: 'content', logicalType: 'text', nullable: true },
      { name: 'content_type', logicalType: 'text', nullable: true },
      { name: 'is_read', logicalType: 'bool' },
      { name: 'sent_at', logicalType: 'timestamp', nullable: true },
      { name: 'received_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      {
        name: 'uk_plus_email_message_user_external',
        columns: ['user_id', 'external_message_id'],

        unique: true,
      },
      { name: 'idx_plus_email_message_user_created', columns: ['user_id', 'created_at'] },
      { name: 'idx_plus_email_message_user_folder', columns: ['user_id', 'folder'] },
      { name: 'idx_plus_email_message_user_read', columns: ['user_id', 'is_read'] },
    ],
  ),
  defineExactEntity(
    'events',
    'plus_events',
    'ops',
    'Event record aligned with spring-ai-plus PlusEvents.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'event_type', logicalType: 'text', nullable: true },
      { name: 'source', logicalType: 'text', nullable: true },
      { name: 'target', logicalType: 'text', nullable: true },
      { name: 'payload', logicalType: 'json', nullable: true },
      { name: 'occurred_at', logicalType: 'timestamp', nullable: true },
      { name: 'is_processed', logicalType: 'bool' },
      { name: 'processed_at', logicalType: 'timestamp', nullable: true },
    ],
  ),
  defineExactEntity(
    'disk',
    'plus_disk',
    'media',
    'Cloud disk root aligned with spring-ai-plus PlusDisk.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'type', logicalType: 'enum' },
      { name: 'owner', logicalType: 'enum' },
      { name: 'owner_id', logicalType: 'id' },
      { name: 'knowledge_base_id', logicalType: 'id', nullable: true },
      { name: 'disk_size', logicalType: 'bigint' },
      { name: 'used_size', logicalType: 'bigint' },
      { name: 'description', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_plus_disk_name',
        columns: ['name'],

        unique: true,
      },
      {
        name: 'uk_plus_disk_owner_type',
        columns: ['owner', 'owner_id', 'type'],

        unique: true,
      },
      {
        name: 'idx_plus_disk_name',
        columns: ['name'],

      },
      {
        name: 'idx_plus_disk_owner_id',
        columns: ['owner_id'],

      },
      {
        name: 'idx_plus_disk_knowledge_base_id',
        columns: ['knowledge_base_id'],

      },
    ],
  ),
  defineExactEntity(
    'disk_member',
    'plus_disk_member',
    'media',
    'Cloud disk member aligned with spring-ai-plus PlusDiskMember.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'disk_id', logicalType: 'id' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'permission', logicalType: 'json' },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'is_owner', logicalType: 'bool' },
      { name: 'knowledge_base_id', logicalType: 'id', nullable: true },
      { name: 'pinned_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      {
        name: 'uk_disk_member_disk_user',
        columns: ['disk_id', 'user_id'],

        unique: true,
      },
      {
        name: 'idx_disk_member_disk_id',
        columns: ['disk_id'],

      },
      {
        name: 'idx_disk_member_user_id',
        columns: ['user_id'],

      },
      {
        name: 'idx_disk_member_pinned_at',
        columns: ['pinned_at'],

      },
      {
        name: 'idx_disk_member_knowledge_base_id',
        columns: ['knowledge_base_id'],

      },
    ],
  ),
  defineExactEntity(
    'file',
    'plus_file',
    'media',
    'File metadata aligned with spring-ai-plus PlusFile.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'type', logicalType: 'enum' },
      { name: 'disk_id', logicalType: 'id' },
      { name: 'size', logicalType: 'bigint', nullable: true },
      { name: 'content_type', logicalType: 'enum', nullable: true },
      { name: 'content_id', logicalType: 'id', nullable: true },
      { name: 'extension', logicalType: 'text', nullable: true },
      { name: 'etag', logicalType: 'text', nullable: true },
      { name: 'biz_type', logicalType: 'enum', nullable: true },
      { name: 'biz_id', logicalType: 'id', nullable: true },
      { name: 'asset_type', logicalType: 'text', nullable: true },
      { name: 'workspace_id', logicalType: 'id', nullable: true },
      { name: 'workspace_uuid', logicalType: 'text', nullable: true },
      { name: 'project_uuid', logicalType: 'text', nullable: true },
      { name: 'project_type', logicalType: 'enum', nullable: true },
      { name: 'project_id', logicalType: 'id', nullable: true },
      { name: 'channel', logicalType: 'text' },
      { name: 'generation_type', logicalType: 'enum' },
      { name: 'generation_id', logicalType: 'id', nullable: true },
      { name: 'prompt_uuid', logicalType: 'text', nullable: true },
      { name: 'owner', logicalType: 'text', nullable: true },
      { name: 'owner_id', logicalType: 'id', nullable: true },
      { name: 'author', logicalType: 'text', nullable: true },
      { name: 'channel_config_id', logicalType: 'id', nullable: true },
      { name: 'bucket', logicalType: 'json' },
      { name: 'path', logicalType: 'text', nullable: true },
      { name: 'relative_path', logicalType: 'text', nullable: true },
      { name: 'object_key', logicalType: 'text', nullable: true },
      { name: 'storage_class', logicalType: 'enum', nullable: true },
      { name: 'version', logicalType: 'text', nullable: true },
      { name: 'resource', logicalType: 'text', nullable: true },
      { name: 'last_modified', logicalType: 'timestamp', nullable: true },
      { name: 'upload_time', logicalType: 'timestamp', nullable: true },
      { name: 'last_access_time', logicalType: 'timestamp', nullable: true },
      { name: 'is_upload_temp', logicalType: 'bool' },
      { name: 'expire_at', logicalType: 'timestamp', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'tags', logicalType: 'json', nullable: true },
      { name: 'file_category', logicalType: 'enum', nullable: true },
      { name: 'access_scope', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'upload_status', logicalType: 'enum' },
      { name: 'parent_id', logicalType: 'id', nullable: true },
      { name: 'parent_metadata', logicalType: 'json', nullable: true },
      { name: 'parent_uuid', logicalType: 'text', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
      { name: 'permission', logicalType: 'json' },
      { name: 'reference_file_id', logicalType: 'id', nullable: true },
      { name: 'mime_type', logicalType: 'text', nullable: true },
      { name: 'cover_image', logicalType: 'json', nullable: true },
      { name: 'password', logicalType: 'text', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'sort_order', logicalType: 'int', nullable: true },
      { name: 'pinned_at', logicalType: 'timestamp', nullable: true },
    ],
    [
      {
        name: 'uk_file_disk_parent_path',
        columns: ['disk_id', 'parent_id', 'path'],

        unique: true,
      },
      {
        name: 'idx_file_name',
        columns: ['name'],

      },
      {
        name: 'idx_file_object_key',
        columns: ['object_key'],

      },
      {
        name: 'idx_file_project_uuid',
        columns: ['project_uuid'],

      },
      {
        name: 'idx_file_access_scope',
        columns: ['access_scope'],

      },
      {
        name: 'idx_file_prompt_uuid',
        columns: ['prompt_uuid'],

      },
      {
        name: 'idx_file_user_id',
        columns: ['user_id'],

      },
    ],
  ),
  defineExactEntity(
    'file_content',
    'plus_file_content',
    'media',
    'File content aligned with spring-ai-plus PlusFileContent.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'file_id', logicalType: 'id' },
      { name: 'file_uuid', logicalType: 'text' },
      { name: 'file_version', logicalType: 'text' },
      { name: 'prompt', logicalType: 'text', nullable: true },
      { name: 'thinking_content', logicalType: 'text', nullable: true },
      { name: 'encoding', logicalType: 'text', nullable: true },
      { name: 'content', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_plus_file_content_file_id',
        columns: ['file_id', 'file_version'],

      },
      {
        name: 'idx_plus_file_content_file_uuid',
        columns: ['file_uuid', 'file_version'],

      },
    ],
  ),
  defineExactEntity(
    'file_part',
    'plus_file_part',
    'media',
    'File multipart upload part aligned with spring-ai-plus PlusFilePart.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'file_id', logicalType: 'id' },
      { name: 'chunk_index', logicalType: 'int' },
      { name: 'chunk_size', logicalType: 'bigint' },
      { name: 'total_size', logicalType: 'bigint' },
      { name: 'checksum', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'storage_path', logicalType: 'text', nullable: true },
    ],
  ),
  defineExactEntity(
    'oss_bucket',
    'plus_oss_bucket',
    'media',
    'Object storage bucket aligned with spring-ai-plus PlusOssBucket.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'region', logicalType: 'text', nullable: true },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'channel_config_id', logicalType: 'id', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'text', nullable: true },
      { name: 'creation_date', logicalType: 'timestamp', nullable: true },
      { name: 'arn', logicalType: 'text', nullable: true },
      { name: 'endpoint', logicalType: 'text', nullable: true },
      { name: 'storage_class', logicalType: 'text', nullable: true },
      { name: 'versioning_enabled', logicalType: 'bool', nullable: true },
      { name: 'encryption_enabled', logicalType: 'bool', nullable: true },
      { name: 'encryption_type', logicalType: 'text', nullable: true },
      { name: 'acl', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'idx_oss_bucket_name',
        columns: ['name'],

      },
      {
        name: 'idx_oss_bucket_user_id',
        columns: ['user_id'],

      },
      {
        name: 'idx_oss_bucket_region',
        columns: ['region'],

      },
    ],
  ),
  defineEntity(
    'order',
    'plus_order',
    'commerce',
    'Order aggregate aligned with spring-ai-plus PlusOrder.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'subject', logicalType: 'text' },
      { name: 'order_type', logicalType: 'enum' },
      { name: 'owner', logicalType: 'enum', nullable: true },
      { name: 'owner_id', logicalType: 'id' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'order_sn', logicalType: 'text' },
      { name: 'transaction_id', logicalType: 'text', nullable: true },
      { name: 'out_trade_no', logicalType: 'text' },
      { name: 'total_amount', logicalType: 'decimal' },
      { name: 'paid_amount', logicalType: 'decimal' },
      { name: 'paid_points_amount', logicalType: 'int', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'pay_success_time', logicalType: 'timestamp', nullable: true },
      { name: 'expire_time', logicalType: 'timestamp', nullable: true },
      { name: 'task_code', logicalType: 'text', nullable: true },
      { name: 'dispatch_mode', logicalType: 'enum', nullable: true },
      { name: 'dispatch_status', logicalType: 'enum', nullable: true },
      { name: 'worker_user_id', logicalType: 'id', nullable: true },
      { name: 'dispatcher_user_id', logicalType: 'id', nullable: true },
      { name: 'accepted_time', logicalType: 'timestamp', nullable: true },
      { name: 'service_start_time', logicalType: 'timestamp', nullable: true },
      {
        name: 'dispatch_expire_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      { name: 'task_payload', logicalType: 'json', nullable: true },
      { name: 'content_type', logicalType: 'enum', nullable: true },
      { name: 'content_id', logicalType: 'id', nullable: true },
      { name: 'category_id', logicalType: 'id' },
      { name: 'pay_objects', logicalType: 'json', nullable: true },
      { name: 'deliver_info', logicalType: 'json', nullable: true },
      { name: 'coupon_info', logicalType: 'json', nullable: true },
      { name: 'buyer_info', logicalType: 'json', nullable: true },
      { name: 'seller_info', logicalType: 'json', nullable: true },
      { name: 'complete_time', logicalType: 'timestamp', nullable: true },
      { name: 'cancel_time', logicalType: 'timestamp', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'product_amount', logicalType: 'decimal', nullable: true },
      { name: 'shipping_amount', logicalType: 'decimal', nullable: true },
      { name: 'discount_amount', logicalType: 'decimal', nullable: true },
      { name: 'tax_amount', logicalType: 'decimal', nullable: true },
      { name: 'refunded_amount', logicalType: 'decimal', nullable: true },
      { name: 'currency', logicalType: 'enum', nullable: true },
      { name: 'client_info', logicalType: 'json', nullable: true },
      { name: 'payment_method', logicalType: 'text', nullable: true },
      { name: 'source_channel', logicalType: 'text', nullable: true },
      { name: 'merchant_remark', logicalType: 'text', nullable: true },
      {
        name: 'payment_expire_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      { name: 'refund_status', logicalType: 'enum', nullable: true },
      {
        name: 'product_image',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'payment_provider', logicalType: 'enum', nullable: true },
      {
        name: 'payment_product_type',
        logicalType: 'enum',
        nullable: true,

      },
    ],
    [
      {
        name: 'uk_plus_order_order_sn',
        columns: ['order_sn'],

        unique: true,
      },
      {
        name: 'uk_plus_order_out_trade_no',
        columns: ['out_trade_no'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'order_item',
    'plus_order_item',
    'commerce',
    'Order item aligned with spring-ai-plus PlusOrderItem.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'order_id', logicalType: 'id' },
      { name: 'category_id', logicalType: 'id' },
      { name: 'product_type', logicalType: 'enum' },
      { name: 'product_id', logicalType: 'id' },
      { name: 'sku_id', logicalType: 'id' },
      { name: 'quantity', logicalType: 'int' },
      { name: 'unit_price', logicalType: 'decimal' },
      { name: 'total_amount', logicalType: 'decimal' },
      { name: 'expire_time', logicalType: 'timestamp', nullable: true },
      { name: 'content_type', logicalType: 'enum', nullable: true },
      { name: 'content_id', logicalType: 'id', nullable: true },
      { name: 'product_name', logicalType: 'text', nullable: true },
      { name: 'sku_spec', logicalType: 'text', nullable: true },
      { name: 'buyer_info', logicalType: 'json', nullable: true },
      { name: 'seller_info', logicalType: 'json', nullable: true },
      { name: 'discount_amount', logicalType: 'decimal', nullable: true },
      { name: 'paid_amount', logicalType: 'decimal', nullable: true },
      { name: 'refunded_amount', logicalType: 'decimal', nullable: true },
      { name: 'currency', logicalType: 'enum', nullable: true },
      {
        name: 'product_image',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'refund_status', logicalType: 'enum', nullable: true },
      { name: 'review_status', logicalType: 'enum', nullable: true },
      { name: 'payment_provider', logicalType: 'enum', nullable: true },
      {
        name: 'payment_product_type',
        logicalType: 'enum',
        nullable: true,

      },
    ],
  ),
  defineEntity(
    'payment',
    'plus_payment',
    'commerce',
    'Payment record aligned with spring-ai-plus PlusPayment.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'subject', logicalType: 'text', nullable: true },
      { name: 'purpose', logicalType: 'enum' },
      { name: 'order_id', logicalType: 'id' },
      { name: 'transaction_id', logicalType: 'text', nullable: true },
      { name: 'out_trade_no', logicalType: 'text' },
      { name: 'channel', logicalType: 'enum' },
      { name: 'provider', logicalType: 'enum' },
      { name: 'product_type', logicalType: 'enum', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'amount', logicalType: 'decimal' },
      { name: 'expire_time', logicalType: 'timestamp', nullable: true },
      { name: 'success_time', logicalType: 'timestamp', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'content_type', logicalType: 'enum', nullable: true },
      { name: 'content_id', logicalType: 'id', nullable: true },
      { name: 'pay_objects', logicalType: 'json', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
      { name: 'client_info', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_plus_payment_out_trade_no',
        columns: ['out_trade_no'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'refund',
    'plus_refund',
    'commerce',
    'Refund record aligned with spring-ai-plus PlusRefund.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'order_id', logicalType: 'id' },
      { name: 'payment_id', logicalType: 'id' },
      { name: 'out_refund_no', logicalType: 'text' },
      { name: 'out_trade_no', logicalType: 'text', nullable: true },
      { name: 'refund_id', logicalType: 'text', nullable: true },
      { name: 'amount', logicalType: 'decimal' },
      { name: 'channel', logicalType: 'enum', nullable: true },
      { name: 'provider', logicalType: 'enum', nullable: true },
      { name: 'product_type', logicalType: 'enum', nullable: true },
      { name: 'type', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'apply_time', logicalType: 'timestamp' },
      { name: 'complete_time', logicalType: 'timestamp', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'content_type', logicalType: 'enum', nullable: true },
      { name: 'content_id', logicalType: 'id', nullable: true },
      { name: 'operator_id', logicalType: 'id', nullable: true },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_plus_refund_out_refund_no',
        columns: ['out_refund_no'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'shopping_cart',
    'plus_shopping_cart',
    'commerce',
    'Shopping cart aligned with spring-ai-plus PlusShoppingCart.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'owner', logicalType: 'enum' },
      { name: 'owner_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text', nullable: true },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'group_list', logicalType: 'json', nullable: true },
      { name: 'status', logicalType: 'enum', nullable: true },
    ],
  ),
  defineEntity(
    'shopping_cart_item',
    'plus_shopping_cart_item',
    'commerce',
    'Shopping cart item aligned with spring-ai-plus PlusShoppingCartItem.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'cart_id', logicalType: 'id' },
      { name: 'cart_group_uuid', logicalType: 'text' },
      { name: 'product_id', logicalType: 'id' },
      { name: 'sku_id', logicalType: 'id' },
      { name: 'quantity', logicalType: 'int' },
      { name: 'price', logicalType: 'decimal' },
      { name: 'is_selected', logicalType: 'bool', nullable: true },
    ],
    [
      {
        name: 'uk_plus_shopping_cart_item_cart_sku',
        columns: ['cart_id', 'sku_id'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'payment_webhook_event',
    'plus_payment_webhook_event',
    'commerce',
    'Payment webhook idempotency record aligned with spring-ai-plus PlusPaymentWebhookEvent.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'provider', logicalType: 'enum' },
      { name: 'event_id', logicalType: 'text' },
      { name: 'nonce', logicalType: 'text' },
      { name: 'signature', logicalType: 'text', nullable: true },
      {
        name: 'request_timestamp',
        logicalType: 'bigint',
        nullable: true,

      },
      { name: 'out_trade_no', logicalType: 'text', nullable: true },
      { name: 'transaction_id', logicalType: 'text', nullable: true },
      { name: 'payload_digest', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'processed_at', logicalType: 'timestamp', nullable: true },
      { name: 'message', logicalType: 'text', nullable: true },
    ],
    [
      {
        name: 'uk_payment_webhook_provider_event',
        columns: ['provider', 'event_id'],

        unique: true,
      },
      {
        name: 'uk_payment_webhook_provider_nonce',
        columns: ['provider', 'nonce'],

        unique: true,
      },
      {
        name: 'idx_payment_webhook_out_trade_no',
        columns: ['out_trade_no'],

      },
      {
        name: 'idx_payment_webhook_created_at',
        columns: ['created_at'],

      },
    ],
  ),
  defineEntity(
    'order_dispatch_rule',
    'plus_order_dispatch_rule',
    'commerce',
    'Service order dispatch rule aligned with spring-ai-plus PlusOrderDispatchRule.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'task_code', logicalType: 'text' },
      { name: 'task_name', logicalType: 'text' },
      { name: 'enabled', logicalType: 'bool' },
      { name: 'allow_grab', logicalType: 'bool' },
      { name: 'allow_assign', logicalType: 'bool' },
      {
        name: 'default_task_concurrent_limit',
        logicalType: 'int',

      },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_order_dispatch_rule_task_code',
        columns: ['task_code'],

        unique: true,
      },
      {
        name: 'idx_order_dispatch_rule_task_code',
        columns: ['task_code'],

      },
      {
        name: 'idx_order_dispatch_rule_enabled',
        columns: ['enabled'],

      },
    ],
  ),
  defineEntity(
    'order_worker_dispatch_profile',
    'plus_order_worker_dispatch_profile',
    'commerce',
    'Worker dispatch profile aligned with spring-ai-plus PlusOrderWorkerDispatchProfile.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'rating_level', logicalType: 'text', nullable: true },
      { name: 'enabled', logicalType: 'bool' },
      {
        name: 'global_max_in_progress',
        logicalType: 'int',

      },
      { name: 'metadata', logicalType: 'json', nullable: true },
    ],
    [
      {
        name: 'uk_order_worker_dispatch_profile_user_id',
        columns: ['user_id'],

        unique: true,
      },
      {
        name: 'idx_order_worker_dispatch_profile_user_id',
        columns: ['user_id'],

      },
      {
        name: 'idx_order_worker_dispatch_profile_enabled',
        columns: ['enabled'],

      },
      {
        name: 'idx_order_worker_dispatch_profile_rating_level',
        columns: ['rating_level'],

      },
    ],
  ),
  defineEntity(
    'account_history',
    'plus_account_history',
    'commerce',
    'Account ledger history aligned with spring-ai-plus PlusAccountHistoryEntity.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'account_type', logicalType: 'enum' },
      { name: 'asset_type', logicalType: 'enum' },
      { name: 'account_id', logicalType: 'id' },
      { name: 'transaction_id', logicalType: 'text' },
      { name: 'transaction_type', logicalType: 'enum' },
      { name: 'amount', logicalType: 'decimal', nullable: true },
      { name: 'balance_before', logicalType: 'decimal', nullable: true },
      { name: 'balance_after', logicalType: 'decimal', nullable: true },
      { name: 'related_account_id', logicalType: 'id', nullable: true },
      { name: 'points_change', logicalType: 'bigint', nullable: true },
      { name: 'points_before', logicalType: 'bigint', nullable: true },
      { name: 'points_after', logicalType: 'bigint', nullable: true },
      { name: 'token_change', logicalType: 'bigint', nullable: true },
      { name: 'token_before', logicalType: 'bigint', nullable: true },
      { name: 'token_after', logicalType: 'bigint', nullable: true },
      { name: 'source_type', logicalType: 'enum', nullable: true },
      { name: 'source_id', logicalType: 'text', nullable: true },
      { name: 'expired_at', logicalType: 'timestamp', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'usage_result', logicalType: 'enum' },
      { name: 'remarks', logicalType: 'text', nullable: true },
    ],
  ),
  defineEntity(
    'account_exchange_config',
    'plus_account_exchange_config',
    'commerce',
    'Account exchange configuration aligned with spring-ai-plus PlusAccountExchangeConfigEntity.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'config_key', logicalType: 'text' },
      { name: 'config_value', logicalType: 'bigint' },
      { name: 'remarks', logicalType: 'text', nullable: true },
    ],
  ),
  defineEntity(
    'ledger_bridge',
    'plus_ledger_bridge',
    'commerce',
    'Explicit bridge between VIP and account ledgers.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'bridge_type', logicalType: 'enum' },
      { name: 'source_ledger', logicalType: 'enum' },
      { name: 'target_ledger', logicalType: 'enum' },
      { name: 'bridge_amount', logicalType: 'decimal' },
      { name: 'source_business_type', logicalType: 'text' },
      { name: 'source_business_id', logicalType: 'text' },
      { name: 'source_record_key', logicalType: 'text', nullable: true },
      { name: 'target_record_key', logicalType: 'text', nullable: true },
      { name: 'compensation_record_key', logicalType: 'text', nullable: true },
      { name: 'idempotency_key', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
      { name: 'attempt_count', logicalType: 'int' },
      { name: 'failure_reason', logicalType: 'text', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
    ],
  ),
  defineEntity(
    'vip_level',
    'plus_vip_level',
    'commerce',
    'VIP level aligned with spring-ai-plus PlusVipLevel.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'level_value', logicalType: 'int' },
      { name: 'required_points', logicalType: 'bigint' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'vip_benefit',
    'plus_vip_benefit',
    'commerce',
    'VIP benefit aligned with spring-ai-plus PlusVipBenefit.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'benefit_key', logicalType: 'text' },
      { name: 'type', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'vip_level_benefit',
    'plus_vip_level_benefit',
    'commerce',
    'VIP level benefit binding aligned with spring-ai-plus PlusVipLevelBenefit.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'vip_level_id', logicalType: 'id' },
      { name: 'benefit_id', logicalType: 'id' },
      { name: 'daily_limit', logicalType: 'bigint', nullable: true },
      { name: 'monthly_limit', logicalType: 'bigint', nullable: true },
      { name: 'total_limit', logicalType: 'bigint', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'metadata', logicalType: 'json', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
    ],
  ),
  defineEntity(
    'vip_pack_group',
    'plus_vip_pack_group',
    'commerce',
    'VIP pack group aligned with spring-ai-plus PlusVipPackGroup.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'app_id', logicalType: 'id', nullable: true },
      { name: 'scope_type', logicalType: 'enum' },
      { name: 'scope_id', logicalType: 'id' },
      { name: 'group_key', logicalType: 'text' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'sort_weight', logicalType: 'int' },
      { name: 'status', logicalType: 'enum' },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'packs', logicalType: 'json', nullable: true },
    ],
  ),
  defineEntity(
    'vip_pack',
    'plus_vip_pack',
    'commerce',
    'VIP pack aligned with spring-ai-plus PlusVipPack.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'app_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'group_id', logicalType: 'id', nullable: true },
      { name: 'vip_level_id', logicalType: 'id', nullable: true },
      { name: 'price', logicalType: 'decimal' },
      { name: 'point_amount', logicalType: 'bigint' },
      { name: 'vip_duration_days', logicalType: 'int' },
      { name: 'billing_cycle', logicalType: 'enum', nullable: true },
      { name: 'status', logicalType: 'enum' },
      { name: 'sort_weight', logicalType: 'int' },
      { name: 'valid_from', logicalType: 'timestamp', nullable: true },
      { name: 'valid_to', logicalType: 'timestamp', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'recharge_pack_id', logicalType: 'id', nullable: true },
      { name: 'point_reward_config', logicalType: 'json', nullable: true },
    ],
  ),
  defineEntity(
    'vip_recharge_method',
    'plus_vip_recharge_method',
    'commerce',
    'VIP recharge method aligned with spring-ai-plus PlusVipRechargeMethod.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'method_key', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
      { name: 'sort_weight', logicalType: 'int' },
      { name: 'remark', logicalType: 'text', nullable: true },
    ],
  ),
  defineEntity(
    'vip_recharge_pack',
    'plus_vip_recharge_pack',
    'commerce',
    'VIP recharge pack aligned with spring-ai-plus PlusVipRechargePack.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'app_id', logicalType: 'id', nullable: true },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text', nullable: true },
      { name: 'price', logicalType: 'decimal' },
      { name: 'point_amount', logicalType: 'bigint' },
      { name: 'vip_duration_days', logicalType: 'int' },
      { name: 'status', logicalType: 'enum' },
      { name: 'sort_weight', logicalType: 'int' },
      { name: 'valid_from', logicalType: 'timestamp', nullable: true },
      { name: 'valid_to', logicalType: 'timestamp', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'recharge_type', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'vip_recharge',
    'plus_vip_recharge',
    'commerce',
    'VIP recharge record aligned with spring-ai-plus PlusVipRecharge.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'vip_level_id', logicalType: 'id', nullable: true },
      { name: 'amount', logicalType: 'decimal' },
      { name: 'point_amount', logicalType: 'bigint' },
      { name: 'recharge_type', logicalType: 'enum' },
      { name: 'recharge_time', logicalType: 'timestamp' },
      { name: 'transaction_no', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
      { name: 'remark', logicalType: 'text', nullable: true },
      { name: 'recharge_method_id', logicalType: 'id', nullable: true },
      { name: 'recharge_pack_id', logicalType: 'id', nullable: true },
    ],
  ),
  defineEntity(
    'vip_point_change',
    'plus_vip_point_change',
    'commerce',
    'VIP point change record aligned with spring-ai-plus PlusVipPointChange.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'change_type', logicalType: 'enum' },
      { name: 'change_amount', logicalType: 'bigint' },
      { name: 'before_balance', logicalType: 'bigint' },
      { name: 'after_balance', logicalType: 'bigint' },
      { name: 'source_id', logicalType: 'id', nullable: true },
      { name: 'source_type', logicalType: 'text', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
    ],
  ),
  defineEntity(
    'vip_benefit_usage',
    'plus_vip_benefit_usage',
    'commerce',
    'VIP benefit usage aligned with spring-ai-plus PlusVipBenefitUsage.',
    [
      { name: 'uuid', logicalType: 'text' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      { name: 'user_id', logicalType: 'id' },
      { name: 'benefit_type', logicalType: 'enum' },
      { name: 'usage_time', logicalType: 'timestamp' },
      { name: 'usage_count', logicalType: 'bigint' },
      { name: 'status', logicalType: 'enum' },
      { name: 'source_id', logicalType: 'id', nullable: true },
      { name: 'source_type', logicalType: 'text', nullable: true },
      { name: 'remark', logicalType: 'text', nullable: true },
    ],
  ),
  defineEntity(
    'workspace',
    'studio_workspace',
    'studio',
    'Top-level workspace container with SDKWork studio-domain business fields.',
    [
      { name: 'tenant_id', logicalType: 'id' },
      {
        name: 'organization_id',
        logicalType: 'id',

      },
      {
        name: 'data_scope',
        logicalType: 'enum',

      },
      { name: 'name', logicalType: 'text' },
      { name: 'code', logicalType: 'text', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      {
        name: 'description',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'owner_id', logicalType: 'id' },
      { name: 'leader_id', logicalType: 'id', nullable: true },
      { name: 'created_by_user_id', logicalType: 'id', nullable: true },
      { name: 'icon', logicalType: 'text', nullable: true },
      { name: 'color', logicalType: 'text', nullable: true },
      { name: 'type', logicalType: 'enum', nullable: true },
      { name: 'status', logicalType: 'enum' },
      {
        name: 'start_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      {
        name: 'end_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      {
        name: 'max_members',
        logicalType: 'int',
        nullable: true,

      },
      {
        name: 'current_members',
        logicalType: 'int',
        nullable: true,

      },
      {
        name: 'member_count',
        logicalType: 'int',
        nullable: true,

      },
      {
        name: 'max_storage',
        logicalType: 'bigint',
        nullable: true,

      },
      {
        name: 'used_storage',
        logicalType: 'bigint',
        nullable: true,

      },
      {
        name: 'settings_json',
        logicalType: 'json',
        nullable: true,

      },
      {
        name: 'is_public',
        logicalType: 'bool',

      },
      {
        name: 'is_template',
        logicalType: 'bool',

      },
    ],
  ),
  defineExactEntity(
    'project',
    'studio_project',
    'studio',
    'Project aligned with SDKWork studio-domain project storage.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      {
        name: 'parent_id',
        logicalType: 'id',
        nullable: true,

      },
      {
        name: 'parent_uuid',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'parent_metadata',
        logicalType: 'json',
        nullable: true,

      },
      {
        name: 'user_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'name', logicalType: 'text' },
      { name: 'title', logicalType: 'text' },
      {
        name: 'cover_image',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'author', logicalType: 'text', nullable: true },
      {
        name: 'file_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'code', logicalType: 'text' },
      { name: 'type', logicalType: 'enum' },
      {
        name: 'site_path',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'domain_prefix',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'description',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'status', logicalType: 'enum' },
      {
        name: 'conversation_id',
        logicalType: 'id',
        nullable: true,

      },
      {
        name: 'workspace_id',
        logicalType: 'id',
        nullable: true,

      },
      {
        name: 'workspace_uuid',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'leader_id',
        logicalType: 'id',
        nullable: true,

      },
      {
        name: 'start_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      {
        name: 'end_time',
        logicalType: 'timestamp',
        nullable: true,

      },
      {
        name: 'budget_amount',
        logicalType: 'bigint',
        nullable: true,

      },
      { name: 'is_deleted', logicalType: 'bool' },
      { name: 'is_template', logicalType: 'bool' },
    ],
    [
      {
        name: 'uk_studio_project_name',
        columns: ['name'],

        unique: true,
      },
      {
        name: 'uk_studio_project_code',
        columns: ['code'],

        unique: true,
      },
    ],
  ),
  defineExactEntity(
    'project_content',
    'studio_project_content',
    'studio',
    'Project content aligned with SDKWork studio-domain project content storage.',
    [
      { name: 'id', logicalType: 'id' },
      { name: 'uuid', logicalType: 'text' },
      { name: 'created_at', logicalType: 'timestamp' },
      { name: 'updated_at', logicalType: 'timestamp' },
      { name: 'v', logicalType: 'bigint' },
      { name: 'tenant_id', logicalType: 'id' },
      { name: 'organization_id', logicalType: 'id' },
      { name: 'data_scope', logicalType: 'enum' },
      {
        name: 'user_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'parent_id', logicalType: 'id', nullable: true },
      { name: 'project_id', logicalType: 'id' },
      { name: 'project_uuid', logicalType: 'text' },
      {
        name: 'config_data',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'content_data',
        logicalType: 'json',
        nullable: true,

      },
      {
        name: 'metadata',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'content_version',
        logicalType: 'text',

      },
      {
        name: 'content_hash',
        logicalType: 'text',
        nullable: true,

      },
    ],
    [
      {
        name: 'idx_studio_project_content_project_id',
        columns: ['project_id'],

      },
      {
        name: 'idx_studio_project_content_project_uuid',
        columns: ['project_uuid'],

      },
    ],
  ),
  defineEntity(
    'file_asset',
    'media_file_asset',
    'media',
    'Referenced files, outputs, screenshots, or archives emitted during coding execution.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'path', logicalType: 'text' },
      { name: 'media_type', logicalType: 'text' },
      { name: 'size_bytes', logicalType: 'bigint' },
    ],
  ),
  defineEntity(
    'coding_session',
    'ai_coding_session',
    'ai',
    'Stable IDE coding session container.',
    [
      { name: 'workspace_id', logicalType: 'id' },
      { name: 'project_id', logicalType: 'id' },
      {
        name: 'runtime_location_id',
        logicalType: 'text',
        nullable: true,
      },
      { name: 'title', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
      {
        name: 'entry_surface',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'host_mode', logicalType: 'enum' },
      { name: 'engine_id', logicalType: 'text' },
      {
        name: 'model_id',
        logicalType: 'text',

      },
      {
        name: 'last_turn_at',
        logicalType: 'timestamp',
        nullable: true,

      },
      {
        name: 'native_session_id',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'native_session_tree_id', logicalType: 'text', nullable: true },
      { name: 'native_parent_session_id', logicalType: 'text', nullable: true },
      { name: 'native_forked_from_session_id', logicalType: 'text', nullable: true },
      { name: 'native_title', logicalType: 'text', nullable: true },
      { name: 'native_preview', logicalType: 'text', nullable: true },
      { name: 'native_source', logicalType: 'text', nullable: true },
      { name: 'provider_version', logicalType: 'text', nullable: true },
      { name: 'model_provider', logicalType: 'text', nullable: true },
      { name: 'native_project_id', logicalType: 'text', nullable: true },
      { name: 'native_cwd', logicalType: 'text', nullable: true },
      { name: 'native_git_branch', logicalType: 'text', nullable: true },
      { name: 'native_git_commit', logicalType: 'text', nullable: true },
      { name: 'native_git_repository_url', logicalType: 'text', nullable: true },
      { name: 'native_agent_name', logicalType: 'text', nullable: true },
      { name: 'native_agent_role', logicalType: 'text', nullable: true },
      { name: 'native_is_ephemeral', logicalType: 'bool' },
      { name: 'native_is_sidechain', logicalType: 'bool' },
      { name: 'native_schema_version', logicalType: 'int' },
      { name: 'native_metadata_json', logicalType: 'json' },
      {
        name: 'sort_timestamp',
        logicalType: 'bigint',
        nullable: true,

      },
      {
        name: 'transcript_updated_at',
        logicalType: 'timestamp',
        nullable: true,

      },
      {
        name: 'pinned',
        logicalType: 'bool',

      },
      {
        name: 'archived',
        logicalType: 'bool',

      },
      {
        name: 'unread',
        logicalType: 'bool',

      },
    ],
    [
      {
        name: 'idx_ai_coding_session_project_updated',
        columns: ['project_id', 'updated_at'],

      },
      {
        name: 'idx_ai_coding_session_project_sort',
        columns: ['project_id', 'sort_timestamp'],

      },
    ],
  ),
  defineEntity(
    'coding_session_runtime',
    'ai_coding_session_runtime',
    'ai',
    'Native engine runtime instances bound to a coding session.',
    [
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'engine_id', logicalType: 'text' },
      {
        name: 'model_id',
        logicalType: 'text',

      },
      { name: 'host_mode', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'transport_kind', logicalType: 'text' },
      {
        name: 'native_session_id',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'native_turn_container_id',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'capability_snapshot_json', logicalType: 'json' },
      { name: 'metadata_json', logicalType: 'json' },
    ],
    [
      {
        name: 'idx_ai_coding_session_runtime_session_updated',
        columns: ['coding_session_id', 'updated_at'],

      },
    ],
  ),
  defineEntity(
    'coding_session_turn',
    'ai_coding_session_turn',
    'ai',
    'Turn-level execution records.',
    [
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'runtime_id', logicalType: 'id' },
      { name: 'request_kind', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'input_summary', logicalType: 'text' },
      { name: 'started_at', logicalType: 'timestamp' },
      { name: 'completed_at', logicalType: 'timestamp' },
    ],
    [
      {
        name: 'idx_ai_coding_session_turn_session_created',
        columns: ['coding_session_id', 'created_at'],

      },
    ],
  ),
  defineEntity(
    'coding_session_message',
    'ai_coding_session_message',
    'ai',
    'Projected UI messages for a coding session.',
    [
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'turn_id', logicalType: 'id', nullable: true },
      { name: 'role', logicalType: 'enum' },
      { name: 'content', logicalType: 'text' },
      { name: 'metadata_json', logicalType: 'json' },
      {
        name: 'timestamp_ms',
        logicalType: 'bigint',
        nullable: true,

      },
      {
        name: 'name',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'tool_calls_json',
        logicalType: 'json',
        nullable: true,

      },
      {
        name: 'tool_call_id',
        logicalType: 'text',
        nullable: true,

      },
      {
        name: 'file_changes_json',
        logicalType: 'json',
        nullable: true,

      },
      {
        name: 'commands_json',
        logicalType: 'json',
        nullable: true,

      },
      {
        name: 'task_progress_json',
        logicalType: 'json',
        nullable: true,

      },
    ],
    [
      {
        name: 'idx_ai_coding_session_message_session_created',
        columns: ['coding_session_id', 'created_at'],

      },
    ],
  ),
  defineEntity(
    'coding_session_prompt_entry',
    'ai_coding_session_prompt_entry',
    'ai',
    'Prompt history entries scoped to a coding session composer.',
    [
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'prompt_text', logicalType: 'text' },
      {
        name: 'normalized_prompt_text',
        logicalType: 'text',

      },
      {
        name: 'last_used_at',
        logicalType: 'timestamp',

      },
      {
        name: 'use_count',
        logicalType: 'bigint',

      },
    ],
    [
      {
        name: 'idx_ai_coding_session_prompt_entry_session_last_used',
        columns: ['coding_session_id', 'last_used_at'],

      },
      {
        name: 'uk_ai_coding_session_prompt_entry_session_normalized_prompt',
        columns: ['coding_session_id', 'normalized_prompt_text'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'saved_prompt_entry',
    'ai_saved_prompt_entry',
    'ai',
    'Reusable saved prompt snippets available across coding sessions in the local IDE runtime.',
    [
      { name: 'prompt_text', logicalType: 'text' },
      {
        name: 'normalized_prompt_text',
        logicalType: 'text',

      },
      {
        name: 'last_saved_at',
        logicalType: 'timestamp',

      },
      {
        name: 'use_count',
        logicalType: 'bigint',

      },
    ],
    [
      {
        name: 'idx_ai_saved_prompt_entry_last_saved',
        columns: ['last_saved_at'],

      },
      {
        name: 'uk_ai_saved_prompt_entry_normalized_prompt',
        columns: ['normalized_prompt_text'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'coding_session_event',
    'ai_coding_session_event',
    'ai',
    'Raw event stream preserved from engine and runtime operations.',
    [
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'turn_id', logicalType: 'id', nullable: true },
      { name: 'runtime_id', logicalType: 'id', nullable: true },
      { name: 'event_kind', logicalType: 'text' },
      { name: 'sequence_no', logicalType: 'bigint' },
      { name: 'payload_json', logicalType: 'json' },
    ],
    [
      {
        name: 'idx_ai_coding_session_event_session_sequence',
        columns: ['coding_session_id', 'sequence_no'],

      },
    ],
  ),
  defineEntity(
    'coding_session_artifact',
    'ai_coding_session_artifact',
    'ai',
    'Diffs, logs, evidence, and files emitted by a coding session.',
    [
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'turn_id', logicalType: 'id', nullable: true },
      { name: 'artifact_kind', logicalType: 'text' },
      { name: 'title', logicalType: 'text' },
      {
        name: 'blob_ref',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'metadata_json', logicalType: 'json' },
    ],
    [
      {
        name: 'idx_ai_coding_session_artifact_session_created',
        columns: ['coding_session_id', 'created_at'],

      },
    ],
  ),
  defineEntity(
    'coding_session_checkpoint',
    'ai_coding_session_checkpoint',
    'ai',
    'Resume, approval, and handoff checkpoints.',
    [
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'runtime_id', logicalType: 'id', nullable: true },
      { name: 'checkpoint_kind', logicalType: 'enum' },
      { name: 'resumable', logicalType: 'bool' },
      { name: 'state_json', logicalType: 'json' },
    ],
    [
      {
        name: 'idx_ai_coding_session_checkpoint_session_created',
        columns: ['coding_session_id', 'created_at'],

      },
    ],
  ),
  defineEntity(
    'coding_session_operation',
    'ai_coding_session_operation',
    'ai',
    'Projected long-running operation state for coding session turns.',
    [
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'turn_id', logicalType: 'id' },
      { name: 'status', logicalType: 'enum' },
      { name: 'stream_url', logicalType: 'text' },
      { name: 'stream_kind', logicalType: 'text' },
      { name: 'artifact_refs_json', logicalType: 'json' },
    ],
    [
      {
        name: 'idx_ai_coding_session_operation_session_created',
        columns: ['coding_session_id', 'created_at'],

      },
      {
        name: 'uk_ai_coding_session_operation_turn',
        columns: ['turn_id'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'prompt_asset',
    'ai_prompt_asset',
    'ai',
    'Prompt asset root.',
    [
      { name: 'scope_type', logicalType: 'enum' },
      { name: 'scope_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'slug', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'prompt_asset_version',
    'ai_prompt_asset_version',
    'ai',
    'Versioned prompt asset content.',
    [
      { name: 'prompt_asset_id', logicalType: 'id' },
      { name: 'version_label', logicalType: 'text' },
      { name: 'content_ref', logicalType: 'text' },
      { name: 'variables_json', logicalType: 'json' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'prompt_bundle',
    'ai_prompt_bundle',
    'ai',
    'Prompt bundle root.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'description', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'prompt_bundle_item',
    'ai_prompt_bundle_item',
    'ai',
    'Bundle to prompt version mapping.',
    [
      { name: 'prompt_bundle_id', logicalType: 'id' },
      { name: 'prompt_asset_version_id', logicalType: 'id' },
      { name: 'slot_key', logicalType: 'text' },
      { name: 'sort_order', logicalType: 'int' },
    ],
  ),
  defineEntity(
    'prompt_run',
    'ai_prompt_run',
    'ai',
    'Prompt execution run.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'coding_session_id', logicalType: 'id' },
      { name: 'prompt_bundle_id', logicalType: 'id' },
      { name: 'prompt_asset_version_id', logicalType: 'id' },
      { name: 'status', logicalType: 'enum' },
      { name: 'input_snapshot_ref', logicalType: 'text' },
      { name: 'output_snapshot_ref', logicalType: 'text' },
    ],
  ),
  defineEntity(
    'prompt_evaluation',
    'ai_prompt_evaluation',
    'ai',
    'Prompt evaluation result.',
    [
      { name: 'prompt_run_id', logicalType: 'id' },
      { name: 'evaluator', logicalType: 'text' },
      { name: 'score', logicalType: 'int' },
      { name: 'summary_json', logicalType: 'json' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'skill_package',
    'ai_skill_package',
    'ai',
    'Skill package root.',
    [
      { name: 'slug', logicalType: 'text' },
      { name: 'source_uri', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
      { name: 'manifest_json', logicalType: 'json' },
    ],
  ),
  defineEntity(
    'skill_version',
    'ai_skill_version',
    'ai',
    'Skill package version.',
    [
      { name: 'skill_package_id', logicalType: 'id' },
      { name: 'version_label', logicalType: 'text' },
      { name: 'manifest_json', logicalType: 'json' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'skill_capability',
    'ai_skill_capability',
    'ai',
    'Declared capability of a skill version.',
    [
      { name: 'skill_version_id', logicalType: 'id' },
      { name: 'capability_key', logicalType: 'text' },
      { name: 'description_text', logicalType: 'text' },
      { name: 'payload_json', logicalType: 'json' },
    ],
  ),
  defineEntity(
    'skill_installation',
    'ai_skill_installation',
    'ai',
    'Installed skill version for a scope.',
    [
      { name: 'scope_type', logicalType: 'enum' },
      { name: 'scope_id', logicalType: 'id' },
      { name: 'skill_version_id', logicalType: 'id' },
      { name: 'status', logicalType: 'enum' },
      { name: 'installed_at', logicalType: 'timestamp' },
    ],
  ),
  defineEntity(
    'skill_binding',
    'ai_skill_binding',
    'ai',
    'Bound skill installation to a project or coding context.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'skill_installation_id', logicalType: 'id' },
      { name: 'binding_mode', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
      { name: 'config_json', logicalType: 'json' },
    ],
  ),
  defineEntity(
    'skill_runtime_config',
    'ai_skill_runtime_config',
    'ai',
    'Runtime configuration for a skill binding.',
    [
      { name: 'skill_binding_id', logicalType: 'id' },
      { name: 'config_key', logicalType: 'text' },
      { name: 'config_value_json', logicalType: 'json' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'app_template',
    'studio_app_template',
    'studio',
    'Application template root.',
    [
      { name: 'slug', logicalType: 'text' },
      { name: 'name', logicalType: 'text' },
      { name: 'category', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'app_template_version',
    'studio_app_template_version',
    'studio',
    'Application template version.',
    [
      { name: 'app_template_id', logicalType: 'id' },
      { name: 'version_label', logicalType: 'text' },
      { name: 'manifest_json', logicalType: 'json' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'app_template_target_profile',
    'studio_app_template_target_profile',
    'studio',
    'Target profile of a template version.',
    [
      { name: 'app_template_version_id', logicalType: 'id' },
      { name: 'profile_key', logicalType: 'text' },
      { name: 'runtime', logicalType: 'text' },
      { name: 'deployment_mode', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'app_template_preset',
    'studio_app_template_preset',
    'studio',
    'Template preset variant.',
    [
      { name: 'app_template_version_id', logicalType: 'id' },
      { name: 'preset_key', logicalType: 'text' },
      { name: 'description_text', logicalType: 'text' },
      { name: 'payload_json', logicalType: 'json' },
    ],
  ),
  defineEntity(
    'app_template_instantiation',
    'studio_app_template_instantiation',
    'studio',
    'Concrete project instantiated from a template.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'app_template_version_id', logicalType: 'id' },
      { name: 'preset_key', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
      { name: 'output_root', logicalType: 'text' },
    ],
  ),
  defineEntity(
    'team',
    'studio_team',
    'studio',
    'Team root for workspace collaboration with canonical business fields.',
    [
      { name: 'uuid', logicalType: 'text', nullable: true },
      { name: 'tenant_id', logicalType: 'id' },
      {
        name: 'organization_id',
        logicalType: 'id',

      },
      { name: 'workspace_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'code', logicalType: 'text', nullable: true },
      { name: 'title', logicalType: 'text', nullable: true },
      {
        name: 'description',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'owner_id', logicalType: 'id', nullable: true },
      { name: 'leader_id', logicalType: 'id', nullable: true },
      { name: 'created_by_user_id', logicalType: 'id', nullable: true },
      {
        name: 'metadata_json',
        logicalType: 'json',
        nullable: true,

      },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'team_member',
    'studio_team_member',
    'studio',
    'Team membership and role aligned to iam_user user semantics.',
    [
      { name: 'team_id', logicalType: 'id' },
      {
        name: 'user_id',
        logicalType: 'id',
        nullable: true,

      },
      {
        name: 'created_by_user_id',
        logicalType: 'id',
        nullable: true,

      },
      {
        name: 'granted_by_user_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'role', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'workspace_member',
    'studio_workspace_member',
    'studio',
    'Workspace membership projection aligned to iam_user ownership semantics.',
    [
      { name: 'workspace_id', logicalType: 'id' },
      {
        name: 'user_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'team_id', logicalType: 'id', nullable: true },
      {
        name: 'created_by_user_id',
        logicalType: 'id',
        nullable: true,

      },
      {
        name: 'granted_by_user_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'role', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'project_collaborator',
    'studio_project_collaborator',
    'studio',
    'Project collaborator projection aligned to iam_user ownership semantics.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'workspace_id', logicalType: 'id' },
      {
        name: 'user_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'team_id', logicalType: 'id', nullable: true },
      {
        name: 'created_by_user_id',
        logicalType: 'id',
        nullable: true,

      },
      {
        name: 'granted_by_user_id',
        logicalType: 'id',
        nullable: true,

      },
      { name: 'role', logicalType: 'enum' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'project_document',
    'studio_project_document',
    'studio',
    'Project lifecycle documents.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'document_kind', logicalType: 'text' },
      { name: 'title', logicalType: 'text' },
      { name: 'slug', logicalType: 'text' },
      { name: 'body_ref', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'deployment_target',
    'studio_deployment_target',
    'studio',
    'Deployment target definition.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'name', logicalType: 'text' },
      { name: 'environment_key', logicalType: 'text' },
      { name: 'runtime', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'deployment_record',
    'studio_deployment_record',
    'studio',
    'Deployment execution record.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'target_id', logicalType: 'id' },
      { name: 'release_record_id', logicalType: 'id' },
      { name: 'status', logicalType: 'enum' },
      { name: 'endpoint_url', logicalType: 'text' },
      { name: 'started_at', logicalType: 'timestamp' },
      { name: 'completed_at', logicalType: 'timestamp' },
    ],
  ),
  defineEntity(
    'workbench_preference',
    'studio_workbench_preference',
    'studio',
    'Shared workbench preference state.',
    [
      { name: 'tenant_id', logicalType: 'id' },
      {
        name: 'organization_id',
        logicalType: 'id',

      },
      { name: 'scope_type', logicalType: 'enum' },
      { name: 'scope_id', logicalType: 'id' },
      { name: 'code_engine_id', logicalType: 'text' },
      { name: 'code_model_id', logicalType: 'text' },
      { name: 'terminal_profile_id', logicalType: 'text' },
      { name: 'payload_json', logicalType: 'json' },
    ],
    [
      {
        name: 'uk_studio_workbench_preference_scope',
        columns: ['scope_type', 'scope_id'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'engine_registry',
    'ai_engine_registry',
    'ai',
    'Available engine descriptors and capabilities.',
    [
      { name: 'tenant_id', logicalType: 'id' },
      {
        name: 'organization_id',
        logicalType: 'id',

      },
      { name: 'engine_id', logicalType: 'text' },
      { name: 'display_name', logicalType: 'text' },
      { name: 'vendor', logicalType: 'text' },
      { name: 'installation_kind', logicalType: 'text' },
      { name: 'default_model_id', logicalType: 'text' },
      { name: 'transport_kinds_json', logicalType: 'json' },
      { name: 'capability_matrix_json', logicalType: 'json' },
      { name: 'status', logicalType: 'enum' },
    ],
    [
      {
        name: 'uk_ai_engine_registry_engine_id',
        columns: ['engine_id'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'model_catalog',
    'ai_model_catalog',
    'ai',
    'Model catalog entries grouped by engine.',
    [
      { name: 'tenant_id', logicalType: 'id' },
      {
        name: 'organization_id',
        logicalType: 'id',

      },
      { name: 'engine_id', logicalType: 'text' },
      { name: 'model_id', logicalType: 'text' },
      { name: 'display_name', logicalType: 'text' },
      { name: 'provider_id', logicalType: 'text' },
      { name: 'transport_kinds_json', logicalType: 'json' },
      { name: 'capability_matrix_json', logicalType: 'json' },
      { name: 'is_default', logicalType: 'bool' },
      { name: 'status', logicalType: 'enum' },
    ],
    [
      {
        name: 'uk_ai_model_catalog_engine_model',
        columns: ['engine_id', 'model_id'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'engine_binding',
    'ai_engine_binding',
    'ai',
    'Per-project or per-workspace engine binding.',
    [
      { name: 'tenant_id', logicalType: 'id' },
      {
        name: 'organization_id',
        logicalType: 'id',

      },
      { name: 'scope_type', logicalType: 'enum' },
      { name: 'scope_id', logicalType: 'id' },
      { name: 'engine_id', logicalType: 'text' },
      { name: 'model_id', logicalType: 'text' },
      { name: 'host_modes_json', logicalType: 'json' },
    ],
    [
      {
        name: 'uk_ai_engine_binding_scope_engine',
        columns: ['scope_type', 'scope_id', 'engine_id'],

        unique: true,
      },
    ],
  ),
  BIRDCODER_RUN_CONFIGURATION_ENTITY_DEFINITION,
  defineEntity(
    'terminal_execution',
    'ops_terminal_execution',
    'ops',
    'Terminal command execution records.',
    [
      { name: 'tenant_id', logicalType: 'id' },
      {
        name: 'organization_id',
        logicalType: 'id',

      },
      { name: 'workspace_id', logicalType: 'id' },
      { name: 'project_id', logicalType: 'id' },
      { name: 'session_id', logicalType: 'id' },
      { name: 'command', logicalType: 'text' },
      { name: 'args_json', logicalType: 'json' },
      { name: 'cwd', logicalType: 'text' },
      { name: 'stdout_ref', logicalType: 'text' },
      { name: 'stderr_ref', logicalType: 'text' },
      { name: 'exit_code', logicalType: 'int' },
      { name: 'started_at', logicalType: 'timestamp' },
      { name: 'ended_at', logicalType: 'timestamp' },
    ],
    [
      {
        name: 'idx_ops_terminal_execution_session_started',
        columns: ['session_id', 'started_at'],

      },
    ],
  ),
  defineEntity(
    'build_execution',
    'ops_build_execution',
    'ops',
    'Build execution records.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'run_configuration_id', logicalType: 'id' },
      { name: 'target_id', logicalType: 'text' },
      { name: 'output_kind', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
      { name: 'artifact_ref', logicalType: 'text' },
    ],
  ),
  defineEntity(
    'preview_session',
    'ops_preview_session',
    'ops',
    'Preview runtime sessions.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'runtime', logicalType: 'text' },
      { name: 'channel', logicalType: 'text' },
      { name: 'url', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'simulator_session',
    'ops_simulator_session',
    'ops',
    'Simulator launch sessions.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'host', logicalType: 'text' },
      { name: 'platform', logicalType: 'text' },
      { name: 'runtime', logicalType: 'text' },
      { name: 'orientation', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'test_execution',
    'ops_test_execution',
    'ops',
    'Test execution results.',
    [
      { name: 'project_id', logicalType: 'id' },
      { name: 'run_configuration_id', logicalType: 'id' },
      { name: 'framework', logicalType: 'text' },
      { name: 'summary_json', logicalType: 'json' },
      { name: 'status', logicalType: 'enum' },
    ],
  ),
  defineEntity(
    'audit_event',
    'ops_audit_event',
    'ops',
    'Audit trail for runtime and governance operations.',
    [
      { name: 'scope_type', logicalType: 'enum' },
      { name: 'scope_id', logicalType: 'id' },
      { name: 'event_type', logicalType: 'text' },
      { name: 'payload_json', logicalType: 'json' },
    ],
    [
      {
        name: 'idx_ops_audit_event_scope_created',
        columns: ['scope_type', 'scope_id', 'created_at'],

      },
    ],
  ),
  defineEntity(
    'governance_policy',
    'ops_governance_policy',
    'ops',
    'Governed approval and execution policy authority.',
    [
      { name: 'scope_type', logicalType: 'enum' },
      { name: 'scope_id', logicalType: 'id' },
      { name: 'policy_category', logicalType: 'text' },
      { name: 'target_type', logicalType: 'text' },
      { name: 'target_id', logicalType: 'text' },
      {
        name: 'approval_policy',
        logicalType: 'enum',

      },
      {
        name: 'rationale',
        logicalType: 'text',
        nullable: true,

      },
      { name: 'status', logicalType: 'enum' },
    ],
    [
      {
        name: 'idx_ops_governance_policy_scope_updated',
        columns: ['scope_type', 'scope_id', 'updated_at'],

      },
      {
        name: 'uk_ops_governance_policy_scope_target',
        columns: ['scope_type', 'scope_id', 'policy_category', 'target_type', 'target_id'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'release_record',
    'ops_release_record',
    'ops',
    'Release manifests and evidence.',
    [
      { name: 'release_version', logicalType: 'text' },
      { name: 'release_kind', logicalType: 'text' },
      { name: 'rollout_stage', logicalType: 'text' },
      { name: 'manifest_json', logicalType: 'json' },
      { name: 'status', logicalType: 'enum' },
    ],
    [
      {
        name: 'uk_ops_release_record_version',
        columns: ['release_version'],

        unique: true,
      },
    ],
  ),
  defineEntity(
    'schema_migration_history',
    BIRDCODER_SCHEMA_MIGRATION_HISTORY_TABLE,
    'ops',
    'Applied schema migrations by provider.',
    [
      { name: 'migration_id', logicalType: 'text' },
      { name: 'provider_id', logicalType: 'text' },
      { name: 'status', logicalType: 'enum' },
      { name: 'applied_at', logicalType: 'timestamp' },
      { name: 'details_json', logicalType: 'json' },
    ],
    [
      {
        name: 'uk_ops_schema_migration_history_provider_migration',
        columns: ['provider_id', 'migration_id'],

        unique: true,
      },
    ],
  ),
];

export { BIRDCODER_LONG_INTEGER_JSON_SCALAR_KEYS } from './jsonScalarKeys.ts';

export function getBirdCoderEntityDefinition(
  entityName: BirdCoderEntityName,
): BirdCoderEntityDefinition {
  const definition = BIRDCODER_DATA_ENTITY_DEFINITIONS.find(
    (entityDefinition) => entityDefinition.entityName === entityName,
  );

  if (!definition) {
    throw new Error(`Unknown BirdCoder entity definition: ${entityName}`);
  }

  return definition;
}

export * from './storageBindings.ts';
