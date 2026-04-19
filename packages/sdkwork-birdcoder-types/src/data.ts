export const BIRDCODER_DATABASE_PROVIDER_IDS = ['sqlite', 'postgresql'] as const;

export type BirdCoderDatabaseProviderId =
  (typeof BIRDCODER_DATABASE_PROVIDER_IDS)[number] | (string & {});

export type BirdCoderAggregateName =
  | 'user_center'
  | 'workspace'
  | 'coding_session'
  | 'engine'
  | 'prompt'
  | 'skillhub'
  | 'template'
  | 'collaboration'
  | 'delivery'
  | 'runtime'
  | 'governance';

export type BirdCoderLogicalColumnType =
  | 'id'
  | 'text'
  | 'json'
  | 'enum'
  | 'bool'
  | 'int'
  | 'bigint'
  | 'timestamp';

export type BirdCoderEntityName =
  | 'user_account'
  | 'user_profile'
  | 'vip_subscription'
  | 'workspace'
  | 'project'
  | 'file_asset'
  | 'coding_session'
  | 'coding_session_runtime'
  | 'coding_session_turn'
  | 'coding_session_message'
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
  | 'terminal_session'
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
  description: string;
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
  description: string;
}

export interface BirdCoderSchemaIndexDefinition {
  name: string;
  columns: readonly string[];
  description: string;
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

export interface BirdCoderRecordEnvelope {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isDeleted: boolean;
}

export interface BirdCoderScopedRecordEnvelope extends BirdCoderRecordEnvelope {
  workspaceId: string;
  projectId: string;
}

export interface BirdCoderRunConfigurationRecord extends BirdCoderScopedRecordEnvelope {
  name: string;
  command: string;
  profileId: string;
  cwdMode: 'project' | 'workspace' | 'custom';
  customCwd: string;
  group: 'dev' | 'build' | 'test' | 'custom';
  scopeType: 'global' | 'workspace' | 'project';
  scopeId: string;
}

export interface BirdCoderTerminalSessionRecord extends BirdCoderScopedRecordEnvelope {
  title: string;
  profileId: string;
  cwd: string;
  status: 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'closed';
  lastExitCode: number | null;
}

export interface BirdCoderTerminalExecutionRecord extends BirdCoderScopedRecordEnvelope {
  sessionId: string;
  command: string;
  argsJson: string;
  cwd: string;
  stdoutRef: string;
  stderrRef: string;
  exitCode: number | null;
  startedAt: string;
  endedAt: string | null;
}

export interface BirdCoderRepository<TEntity, TId = string> {
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
    description: 'Desktop and single-node persistence with offline-first startup.',
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
    description: 'Server-grade persistence for collaboration, governance, and analytics.',
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
    description: 'Stable primary identifier.',
  },
  {
    name: 'created_at',
    logicalType: 'timestamp',
    description: 'Creation timestamp.',
  },
  {
    name: 'updated_at',
    logicalType: 'timestamp',
    description: 'Last update timestamp.',
  },
  {
    name: 'version',
    logicalType: 'bigint',
    description: 'Optimistic concurrency version.',
  },
  {
    name: 'is_deleted',
    logicalType: 'bool',
    description: 'Soft-delete flag.',
  },
];

function withBaseColumns(
  columns: readonly BirdCoderSchemaColumnDefinition[],
): readonly BirdCoderSchemaColumnDefinition[] {
  return [...BASE_COLUMNS, ...columns];
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
    columns: withBaseColumns(columns),
    indexes,
  };
}

export const BIRDCODER_SCHEMA_MIGRATION_HISTORY_TABLE = 'schema_migration_history';

export const BIRDCODER_DATA_ENTITY_DEFINITIONS: readonly BirdCoderEntityDefinition[] = [
  defineEntity(
    'user_account',
    'plus_user',
    'user_center',
    'Primary plus_user account root aligned with spring-ai-plus local user-center storage.',
    [
      { name: 'uuid', logicalType: 'text', description: 'Stable business UUID.' },
      { name: 'tenant_id', logicalType: 'id', nullable: true, description: 'Tenant ownership id.' },
      {
        name: 'organization_id',
        logicalType: 'id',
        nullable: true,
        description: 'Organization ownership id.',
      },
      { name: 'username', logicalType: 'text', description: 'Login username.' },
      { name: 'nickname', logicalType: 'text', description: 'Preferred display name.' },
      { name: 'password', logicalType: 'text', description: 'Encrypted password hash.' },
      { name: 'email', logicalType: 'text', nullable: true, description: 'Primary user email.' },
      { name: 'bio', logicalType: 'text', nullable: true, description: 'User bio.' },
      { name: 'avatar_url', logicalType: 'text', nullable: true, description: 'Avatar URL.' },
      { name: 'provider_key', logicalType: 'text', description: 'Primary auth provider key.' },
      {
        name: 'external_subject',
        logicalType: 'text',
        nullable: true,
        description: 'External provider subject identifier.',
      },
      {
        name: 'metadata_json',
        logicalType: 'json',
        nullable: true,
        description: 'Extended profile metadata such as company, website, and location.',
      },
      { name: 'status', logicalType: 'enum', description: 'User lifecycle state.' },
    ],
    [
      {
        name: 'uk_plus_user_username',
        columns: ['username'],
        description: 'Uniqueness for username.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'user_profile',
    'plus_user',
    'user_center',
    'Profile projection stored on plus_user and metadata_json.',
    [
      { name: 'id', logicalType: 'id', description: 'Linked plus_user id.' },
      { name: 'bio', logicalType: 'text', nullable: true, description: 'User bio.' },
      {
        name: 'metadata_json',
        logicalType: 'json',
        nullable: true,
        description: 'Structured profile metadata with company, location, and website.',
      },
    ],
    [
      {
        name: 'uk_plus_user_profile_projection',
        columns: ['id'],
        description: 'One profile projection per plus_user record.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'vip_subscription',
    'plus_vip_user',
    'user_center',
    'VIP membership and entitlement state aligned with plus_vip_user.',
    [
      { name: 'uuid', logicalType: 'text', description: 'Stable business UUID.' },
      { name: 'user_id', logicalType: 'id', description: 'Linked plus_user id.' },
      { name: 'vip_level_id', logicalType: 'text', nullable: true, description: 'VIP level id.' },
      {
        name: 'vip_level_name',
        logicalType: 'text',
        nullable: true,
        description: 'VIP level display name.',
      },
      { name: 'status', logicalType: 'enum', description: 'Membership lifecycle state.' },
      { name: 'monthly_credits', logicalType: 'bigint', description: 'Monthly credits.' },
      { name: 'seat_limit', logicalType: 'int', description: 'Seat count limit.' },
      { name: 'valid_to', logicalType: 'timestamp', nullable: true, description: 'Membership end time.' },
    ],
    [
      {
        name: 'idx_plus_vip_user_user_status',
        columns: ['user_id', 'status'],
        description: 'Lookup by user and entitlement state.',
      },
    ],
  ),
  defineEntity(
    'workspace',
    'workspaces',
    'workspace',
    'Top-level workspace container with plus-style canonical business fields.',
    [
      { name: 'uuid', logicalType: 'text', nullable: true, description: 'Stable business UUID.' },
      { name: 'tenant_id', logicalType: 'id', nullable: true, description: 'Tenant ownership id.' },
      {
        name: 'organization_id',
        logicalType: 'id',
        nullable: true,
        description: 'Organization ownership id.',
      },
      { name: 'name', logicalType: 'text', description: 'Workspace name.' },
      { name: 'code', logicalType: 'text', nullable: true, description: 'Workspace business code.' },
      { name: 'title', logicalType: 'text', nullable: true, description: 'Workspace title.' },
      { name: 'description', logicalType: 'text', description: 'Workspace description.' },
      { name: 'owner_id', logicalType: 'id', nullable: true, description: 'Canonical owner user id.' },
      { name: 'leader_id', logicalType: 'id', nullable: true, description: 'Canonical leader user id.' },
      { name: 'created_by_user_id', logicalType: 'id', nullable: true, description: 'Canonical creator user id.' },
      { name: 'type', logicalType: 'enum', nullable: true, description: 'Workspace type.' },
      {
        name: 'settings_json',
        logicalType: 'json',
        nullable: true,
        description: 'Workspace settings JSON.',
      },
    ],
  ),
  defineEntity(
    'project',
    'projects',
    'workspace',
    'Project container within a workspace with plus-style canonical business fields.',
    [
      { name: 'uuid', logicalType: 'text', nullable: true, description: 'Stable business UUID.' },
      { name: 'tenant_id', logicalType: 'id', nullable: true, description: 'Tenant ownership id.' },
      {
        name: 'organization_id',
        logicalType: 'id',
        nullable: true,
        description: 'Organization ownership id.',
      },
      { name: 'workspace_id', logicalType: 'id', description: 'Parent workspace.' },
      {
        name: 'workspace_uuid',
        logicalType: 'text',
        nullable: true,
        description: 'Parent workspace UUID.',
      },
      { name: 'name', logicalType: 'text', description: 'Project name.' },
      { name: 'code', logicalType: 'text', nullable: true, description: 'Project business code.' },
      { name: 'title', logicalType: 'text', nullable: true, description: 'Project title.' },
      {
        name: 'description',
        logicalType: 'text',
        nullable: true,
        description: 'Project description.',
      },
      {
        name: 'root_path',
        logicalType: 'text',
        nullable: true,
        description: 'Filesystem root path.',
      },
      { name: 'owner_id', logicalType: 'id', nullable: true, description: 'Canonical owner user id.' },
      { name: 'leader_id', logicalType: 'id', nullable: true, description: 'Canonical leader user id.' },
      { name: 'created_by_user_id', logicalType: 'id', nullable: true, description: 'Canonical creator user id.' },
      { name: 'type', logicalType: 'enum', nullable: true, description: 'Project type.' },
      { name: 'author', logicalType: 'text', nullable: true, description: 'Project author.' },
      { name: 'status', logicalType: 'enum', description: 'Project lifecycle state.' },
    ],
    [
      {
        name: 'uk_projects_workspace_name',
        columns: ['workspace_id', 'name'],
        description: 'Unique project name within workspace.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'file_asset',
    'file_assets',
    'coding_session',
    'Referenced files, outputs, screenshots, or archives emitted during coding execution.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'coding_session_id', logicalType: 'id', description: 'Owning coding session.' },
      { name: 'path', logicalType: 'text', description: 'Asset path or URI.' },
      { name: 'media_type', logicalType: 'text', description: 'MIME or logical type.' },
      { name: 'size_bytes', logicalType: 'bigint', description: 'Asset size.' },
    ],
  ),
  defineEntity(
    'coding_session',
    'coding_sessions',
    'coding_session',
    'Stable IDE coding session container.',
    [
      { name: 'workspace_id', logicalType: 'id', description: 'Owning workspace.' },
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'title', logicalType: 'text', description: 'Session title.' },
      { name: 'status', logicalType: 'enum', description: 'Session lifecycle status.' },
      { name: 'entry_surface', logicalType: 'text', description: 'code/studio/terminal entry surface.' },
      { name: 'engine_id', logicalType: 'text', description: 'Preferred engine identifier.' },
      {
        name: 'model_id',
        logicalType: 'text',
        nullable: true,
        description: 'Preferred model identifier.',
      },
      {
        name: 'last_turn_at',
        logicalType: 'timestamp',
        nullable: true,
        description: 'Last turn timestamp.',
      },
    ],
    [
      {
        name: 'idx_coding_sessions_project_updated',
        columns: ['project_id', 'updated_at'],
        description: 'Recent coding sessions by project.',
      },
    ],
  ),
  defineEntity(
    'coding_session_runtime',
    'coding_session_runtimes',
    'coding_session',
    'Native engine runtime instances bound to a coding session.',
    [
      { name: 'coding_session_id', logicalType: 'id', description: 'Owning coding session.' },
      { name: 'engine_id', logicalType: 'text', description: 'Runtime engine identifier.' },
      {
        name: 'model_id',
        logicalType: 'text',
        nullable: true,
        description: 'Runtime model identifier.',
      },
      { name: 'host_mode', logicalType: 'enum', description: 'web/desktop/server host mode.' },
      { name: 'status', logicalType: 'enum', description: 'Runtime status.' },
      { name: 'transport_kind', logicalType: 'text', description: 'Native transport kind.' },
      {
        name: 'native_session_id',
        logicalType: 'text',
        nullable: true,
        description: 'Native session identifier.',
      },
      {
        name: 'native_turn_container_id',
        logicalType: 'text',
        nullable: true,
        description: 'Native turn or iteration container id.',
      },
      { name: 'capability_snapshot_json', logicalType: 'json', description: 'Capability snapshot.' },
      { name: 'metadata_json', logicalType: 'json', description: 'Runtime metadata.' },
    ],
    [
      {
        name: 'idx_coding_session_runtimes_session_updated',
        columns: ['coding_session_id', 'updated_at'],
        description: 'Runtime ordering within a coding session.',
      },
    ],
  ),
  defineEntity(
    'coding_session_turn',
    'coding_session_turns',
    'coding_session',
    'Turn-level execution records.',
    [
      { name: 'coding_session_id', logicalType: 'id', description: 'Owning coding session.' },
      { name: 'runtime_id', logicalType: 'id', description: 'Linked runtime.' },
      { name: 'request_kind', logicalType: 'enum', description: 'chat/plan/tool/review/apply.' },
      { name: 'status', logicalType: 'enum', description: 'Turn execution status.' },
      { name: 'input_summary', logicalType: 'text', description: 'Summarized turn input.' },
      { name: 'started_at', logicalType: 'timestamp', description: 'Turn start time.' },
      { name: 'completed_at', logicalType: 'timestamp', description: 'Turn completion time.' },
    ],
    [
      {
        name: 'idx_coding_session_turns_session_created',
        columns: ['coding_session_id', 'created_at'],
        description: 'Turn ordering within a coding session.',
      },
    ],
  ),
  defineEntity(
    'coding_session_message',
    'coding_session_messages',
    'coding_session',
    'Projected UI messages for a coding session.',
    [
      { name: 'coding_session_id', logicalType: 'id', description: 'Owning coding session.' },
      { name: 'turn_id', logicalType: 'id', description: 'Linked turn.' },
      { name: 'role', logicalType: 'enum', description: 'Projected message role.' },
      { name: 'content', logicalType: 'text', description: 'Projected message content.' },
      { name: 'metadata_json', logicalType: 'json', description: 'Message metadata.' },
    ],
    [
      {
        name: 'idx_coding_session_messages_session_created',
        columns: ['coding_session_id', 'created_at'],
        description: 'Message ordering within a coding session.',
      },
    ],
  ),
  defineEntity(
    'coding_session_event',
    'coding_session_events',
    'coding_session',
    'Raw event stream preserved from engine and runtime operations.',
    [
      { name: 'coding_session_id', logicalType: 'id', description: 'Owning coding session.' },
      { name: 'turn_id', logicalType: 'id', nullable: true, description: 'Linked turn.' },
      { name: 'runtime_id', logicalType: 'id', nullable: true, description: 'Linked runtime.' },
      { name: 'event_kind', logicalType: 'text', description: 'Event kind identifier.' },
      { name: 'sequence_no', logicalType: 'bigint', description: 'Sequence number.' },
      { name: 'payload_json', logicalType: 'json', description: 'Event payload.' },
    ],
    [
      {
        name: 'idx_coding_session_events_session_sequence',
        columns: ['coding_session_id', 'sequence_no'],
        description: 'Event ordering within a coding session.',
      },
    ],
  ),
  defineEntity(
    'coding_session_artifact',
    'coding_session_artifacts',
    'coding_session',
    'Diffs, logs, evidence, and files emitted by a coding session.',
    [
      { name: 'coding_session_id', logicalType: 'id', description: 'Owning coding session.' },
      { name: 'turn_id', logicalType: 'id', nullable: true, description: 'Linked turn.' },
      { name: 'artifact_kind', logicalType: 'text', description: 'Artifact kind.' },
      { name: 'title', logicalType: 'text', description: 'Artifact title.' },
      {
        name: 'blob_ref',
        logicalType: 'text',
        nullable: true,
        description: 'Blob or file-store reference.',
      },
      { name: 'metadata_json', logicalType: 'json', description: 'Artifact metadata.' },
    ],
    [
      {
        name: 'idx_coding_session_artifacts_session_created',
        columns: ['coding_session_id', 'created_at'],
        description: 'Artifact ordering within a coding session.',
      },
    ],
  ),
  defineEntity(
    'coding_session_checkpoint',
    'coding_session_checkpoints',
    'coding_session',
    'Resume, approval, and handoff checkpoints.',
    [
      { name: 'coding_session_id', logicalType: 'id', description: 'Owning coding session.' },
      { name: 'runtime_id', logicalType: 'id', nullable: true, description: 'Linked runtime.' },
      { name: 'checkpoint_kind', logicalType: 'enum', description: 'Checkpoint kind.' },
      { name: 'resumable', logicalType: 'bool', description: 'Whether checkpoint is resumable.' },
      { name: 'state_json', logicalType: 'json', description: 'Checkpoint state snapshot.' },
    ],
    [
      {
        name: 'idx_coding_session_checkpoints_session_created',
        columns: ['coding_session_id', 'created_at'],
        description: 'Checkpoint ordering within a coding session.',
      },
    ],
  ),
  defineEntity(
    'coding_session_operation',
    'coding_session_operations',
    'coding_session',
    'Projected long-running operation state for coding session turns.',
    [
      { name: 'coding_session_id', logicalType: 'id', description: 'Owning coding session.' },
      { name: 'turn_id', logicalType: 'id', description: 'Linked turn.' },
      { name: 'status', logicalType: 'enum', description: 'Operation status.' },
      { name: 'stream_url', logicalType: 'text', description: 'Replay or subscription URL.' },
      { name: 'stream_kind', logicalType: 'text', description: 'Stream transport kind.' },
      { name: 'artifact_refs_json', logicalType: 'json', description: 'Linked artifact identifiers.' },
    ],
    [
      {
        name: 'idx_coding_session_operations_session_created',
        columns: ['coding_session_id', 'created_at'],
        description: 'Operation ordering within a coding session.',
      },
      {
        name: 'uk_coding_session_operations_turn',
        columns: ['turn_id'],
        description: 'One operation projection per turn.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'prompt_asset',
    'prompt_assets',
    'prompt',
    'Prompt asset root.',
    [
      { name: 'scope_type', logicalType: 'enum', description: 'Asset scope type.' },
      { name: 'scope_id', logicalType: 'id', description: 'Asset scope id.' },
      { name: 'name', logicalType: 'text', description: 'Prompt asset name.' },
      { name: 'slug', logicalType: 'text', description: 'Prompt asset slug.' },
      { name: 'status', logicalType: 'enum', description: 'Prompt asset status.' },
    ],
  ),
  defineEntity(
    'prompt_asset_version',
    'prompt_asset_versions',
    'prompt',
    'Versioned prompt asset content.',
    [
      { name: 'prompt_asset_id', logicalType: 'id', description: 'Parent prompt asset.' },
      { name: 'version_label', logicalType: 'text', description: 'Version label.' },
      { name: 'content_ref', logicalType: 'text', description: 'Prompt content reference.' },
      { name: 'variables_json', logicalType: 'json', description: 'Prompt variables schema.' },
      { name: 'status', logicalType: 'enum', description: 'Version status.' },
    ],
  ),
  defineEntity(
    'prompt_bundle',
    'prompt_bundles',
    'prompt',
    'Prompt bundle root.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'name', logicalType: 'text', description: 'Bundle name.' },
      { name: 'description', logicalType: 'text', description: 'Bundle description.' },
      { name: 'status', logicalType: 'enum', description: 'Bundle status.' },
    ],
  ),
  defineEntity(
    'prompt_bundle_item',
    'prompt_bundle_items',
    'prompt',
    'Bundle to prompt version mapping.',
    [
      { name: 'prompt_bundle_id', logicalType: 'id', description: 'Owning bundle.' },
      { name: 'prompt_asset_version_id', logicalType: 'id', description: 'Linked prompt asset version.' },
      { name: 'slot_key', logicalType: 'text', description: 'Bundle slot key.' },
      { name: 'sort_order', logicalType: 'int', description: 'Sort order.' },
    ],
  ),
  defineEntity(
    'prompt_run',
    'prompt_runs',
    'prompt',
    'Prompt execution run.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'coding_session_id', logicalType: 'id', description: 'Linked coding session.' },
      { name: 'prompt_bundle_id', logicalType: 'id', description: 'Linked bundle.' },
      { name: 'prompt_asset_version_id', logicalType: 'id', description: 'Linked asset version.' },
      { name: 'status', logicalType: 'enum', description: 'Run status.' },
      { name: 'input_snapshot_ref', logicalType: 'text', description: 'Input snapshot reference.' },
      { name: 'output_snapshot_ref', logicalType: 'text', description: 'Output snapshot reference.' },
    ],
  ),
  defineEntity(
    'prompt_evaluation',
    'prompt_evaluations',
    'prompt',
    'Prompt evaluation result.',
    [
      { name: 'prompt_run_id', logicalType: 'id', description: 'Linked prompt run.' },
      { name: 'evaluator', logicalType: 'text', description: 'Evaluator name.' },
      { name: 'score', logicalType: 'int', description: 'Evaluation score.' },
      { name: 'summary_json', logicalType: 'json', description: 'Evaluation summary.' },
      { name: 'status', logicalType: 'enum', description: 'Evaluation status.' },
    ],
  ),
  defineEntity(
    'skill_package',
    'skill_packages',
    'skillhub',
    'Skill package root.',
    [
      { name: 'slug', logicalType: 'text', description: 'Skill package slug.' },
      { name: 'source_uri', logicalType: 'text', description: 'Source location.' },
      { name: 'status', logicalType: 'enum', description: 'Package status.' },
      { name: 'manifest_json', logicalType: 'json', description: 'Package manifest.' },
    ],
  ),
  defineEntity(
    'skill_version',
    'skill_versions',
    'skillhub',
    'Skill package version.',
    [
      { name: 'skill_package_id', logicalType: 'id', description: 'Parent skill package.' },
      { name: 'version_label', logicalType: 'text', description: 'Version label.' },
      { name: 'manifest_json', logicalType: 'json', description: 'Version manifest.' },
      { name: 'status', logicalType: 'enum', description: 'Version status.' },
    ],
  ),
  defineEntity(
    'skill_capability',
    'skill_capabilities',
    'skillhub',
    'Declared capability of a skill version.',
    [
      { name: 'skill_version_id', logicalType: 'id', description: 'Parent skill version.' },
      { name: 'capability_key', logicalType: 'text', description: 'Capability key.' },
      { name: 'description_text', logicalType: 'text', description: 'Capability description.' },
      { name: 'payload_json', logicalType: 'json', description: 'Capability payload.' },
    ],
  ),
  defineEntity(
    'skill_installation',
    'skill_installations',
    'skillhub',
    'Installed skill version for a scope.',
    [
      { name: 'scope_type', logicalType: 'enum', description: 'Installation scope type.' },
      { name: 'scope_id', logicalType: 'id', description: 'Installation scope id.' },
      { name: 'skill_version_id', logicalType: 'id', description: 'Installed skill version.' },
      { name: 'status', logicalType: 'enum', description: 'Installation status.' },
      { name: 'installed_at', logicalType: 'timestamp', description: 'Installation timestamp.' },
    ],
  ),
  defineEntity(
    'skill_binding',
    'skill_bindings',
    'skillhub',
    'Bound skill installation to a project or coding context.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'skill_installation_id', logicalType: 'id', description: 'Linked installation.' },
      { name: 'binding_mode', logicalType: 'enum', description: 'Binding mode.' },
      { name: 'status', logicalType: 'enum', description: 'Binding status.' },
      { name: 'config_json', logicalType: 'json', description: 'Binding configuration.' },
    ],
  ),
  defineEntity(
    'skill_runtime_config',
    'skill_runtime_configs',
    'skillhub',
    'Runtime configuration for a skill binding.',
    [
      { name: 'skill_binding_id', logicalType: 'id', description: 'Linked skill binding.' },
      { name: 'config_key', logicalType: 'text', description: 'Configuration key.' },
      { name: 'config_value_json', logicalType: 'json', description: 'Configuration value.' },
      { name: 'status', logicalType: 'enum', description: 'Configuration status.' },
    ],
  ),
  defineEntity(
    'app_template',
    'app_templates',
    'template',
    'Application template root.',
    [
      { name: 'slug', logicalType: 'text', description: 'Template slug.' },
      { name: 'name', logicalType: 'text', description: 'Template name.' },
      { name: 'category', logicalType: 'text', description: 'Template category.' },
      { name: 'status', logicalType: 'enum', description: 'Template status.' },
    ],
  ),
  defineEntity(
    'app_template_version',
    'app_template_versions',
    'template',
    'Application template version.',
    [
      { name: 'app_template_id', logicalType: 'id', description: 'Parent template.' },
      { name: 'version_label', logicalType: 'text', description: 'Version label.' },
      { name: 'manifest_json', logicalType: 'json', description: 'Template manifest.' },
      { name: 'status', logicalType: 'enum', description: 'Version status.' },
    ],
  ),
  defineEntity(
    'app_template_target_profile',
    'app_template_target_profiles',
    'template',
    'Target profile of a template version.',
    [
      { name: 'app_template_version_id', logicalType: 'id', description: 'Parent template version.' },
      { name: 'profile_key', logicalType: 'text', description: 'Target profile key.' },
      { name: 'runtime', logicalType: 'text', description: 'Target runtime.' },
      { name: 'deployment_mode', logicalType: 'text', description: 'Deployment mode.' },
      { name: 'status', logicalType: 'enum', description: 'Profile support status.' },
    ],
  ),
  defineEntity(
    'app_template_preset',
    'app_template_presets',
    'template',
    'Template preset variant.',
    [
      { name: 'app_template_version_id', logicalType: 'id', description: 'Parent template version.' },
      { name: 'preset_key', logicalType: 'text', description: 'Preset key.' },
      { name: 'description_text', logicalType: 'text', description: 'Preset description.' },
      { name: 'payload_json', logicalType: 'json', description: 'Preset payload.' },
    ],
  ),
  defineEntity(
    'app_template_instantiation',
    'app_template_instantiations',
    'template',
    'Concrete project instantiated from a template.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'app_template_version_id', logicalType: 'id', description: 'Used template version.' },
      { name: 'preset_key', logicalType: 'text', description: 'Used preset key.' },
      { name: 'status', logicalType: 'enum', description: 'Instantiation status.' },
      { name: 'output_root', logicalType: 'text', description: 'Generated output root.' },
    ],
  ),
  defineEntity(
    'team',
    'teams',
    'collaboration',
    'Team root for workspace collaboration with canonical business fields.',
    [
      { name: 'uuid', logicalType: 'text', nullable: true, description: 'Stable business UUID.' },
      { name: 'tenant_id', logicalType: 'id', nullable: true, description: 'Tenant ownership id.' },
      {
        name: 'organization_id',
        logicalType: 'id',
        nullable: true,
        description: 'Organization ownership id.',
      },
      { name: 'workspace_id', logicalType: 'id', description: 'Owning workspace.' },
      { name: 'name', logicalType: 'text', description: 'Team name.' },
      { name: 'code', logicalType: 'text', nullable: true, description: 'Team business code.' },
      { name: 'title', logicalType: 'text', nullable: true, description: 'Team title.' },
      {
        name: 'description',
        logicalType: 'text',
        nullable: true,
        description: 'Team description.',
      },
      { name: 'owner_id', logicalType: 'id', nullable: true, description: 'Canonical owner user id.' },
      { name: 'leader_id', logicalType: 'id', nullable: true, description: 'Canonical leader user id.' },
      { name: 'created_by_user_id', logicalType: 'id', nullable: true, description: 'Canonical creator user id.' },
      {
        name: 'metadata_json',
        logicalType: 'json',
        nullable: true,
        description: 'Team metadata JSON.',
      },
      { name: 'status', logicalType: 'enum', description: 'Team status.' },
    ],
  ),
  defineEntity(
    'team_member',
    'team_members',
    'collaboration',
    'Team membership and role aligned to plus_user user semantics.',
    [
      { name: 'team_id', logicalType: 'id', description: 'Owning team.' },
      {
        name: 'user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical linked plus_user id.',
      },
      {
        name: 'created_by_user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical creator plus_user id.',
      },
      {
        name: 'granted_by_user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical grantor plus_user id.',
      },
      { name: 'role', logicalType: 'enum', description: 'Member role.' },
      { name: 'status', logicalType: 'enum', description: 'Membership status.' },
    ],
  ),
  defineEntity(
    'workspace_member',
    'workspace_members',
    'collaboration',
    'Workspace membership projection aligned to plus_user ownership semantics.',
    [
      { name: 'workspace_id', logicalType: 'id', description: 'Owning workspace.' },
      {
        name: 'user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical linked plus_user id.',
      },
      { name: 'team_id', logicalType: 'id', nullable: true, description: 'Owning team id.' },
      {
        name: 'created_by_user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical creator plus_user id.',
      },
      {
        name: 'granted_by_user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical grantor plus_user id.',
      },
      { name: 'role', logicalType: 'enum', description: 'Member role.' },
      { name: 'status', logicalType: 'enum', description: 'Membership status.' },
    ],
  ),
  defineEntity(
    'project_collaborator',
    'project_collaborators',
    'collaboration',
    'Project collaborator projection aligned to plus_user ownership semantics.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'workspace_id', logicalType: 'id', description: 'Owning workspace.' },
      {
        name: 'user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical linked plus_user id.',
      },
      { name: 'team_id', logicalType: 'id', nullable: true, description: 'Owning team id.' },
      {
        name: 'created_by_user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical creator plus_user id.',
      },
      {
        name: 'granted_by_user_id',
        logicalType: 'id',
        nullable: true,
        description: 'Canonical grantor plus_user id.',
      },
      { name: 'role', logicalType: 'enum', description: 'Collaborator role.' },
      { name: 'status', logicalType: 'enum', description: 'Collaboration status.' },
    ],
  ),
  defineEntity(
    'project_document',
    'project_documents',
    'collaboration',
    'Project lifecycle documents.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'document_kind', logicalType: 'text', description: 'Document kind.' },
      { name: 'title', logicalType: 'text', description: 'Document title.' },
      { name: 'slug', logicalType: 'text', description: 'Document slug.' },
      { name: 'body_ref', logicalType: 'text', description: 'Document content reference.' },
      { name: 'status', logicalType: 'enum', description: 'Document status.' },
    ],
  ),
  defineEntity(
    'deployment_target',
    'deployment_targets',
    'delivery',
    'Deployment target definition.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'name', logicalType: 'text', description: 'Target name.' },
      { name: 'environment_key', logicalType: 'text', description: 'Environment key.' },
      { name: 'runtime', logicalType: 'text', description: 'Deployment runtime.' },
      { name: 'status', logicalType: 'enum', description: 'Target status.' },
    ],
  ),
  defineEntity(
    'deployment_record',
    'deployment_records',
    'delivery',
    'Deployment execution record.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'target_id', logicalType: 'id', description: 'Deployment target id.' },
      { name: 'release_record_id', logicalType: 'id', description: 'Linked release record.' },
      { name: 'status', logicalType: 'enum', description: 'Deployment status.' },
      { name: 'endpoint_url', logicalType: 'text', description: 'Resolved endpoint URL.' },
      { name: 'started_at', logicalType: 'timestamp', description: 'Deployment start time.' },
      { name: 'completed_at', logicalType: 'timestamp', description: 'Deployment completion time.' },
    ],
  ),
  defineEntity(
    'workbench_preference',
    'workbench_preferences',
    'workspace',
    'Shared workbench preference state.',
    [
      { name: 'scope_type', logicalType: 'enum', description: 'global/workspace/project.' },
      { name: 'scope_id', logicalType: 'id', description: 'Scope identifier.' },
      { name: 'code_engine_id', logicalType: 'text', description: 'Selected engine.' },
      { name: 'code_model_id', logicalType: 'text', description: 'Selected model.' },
      { name: 'terminal_profile_id', logicalType: 'text', description: 'Selected terminal profile.' },
      { name: 'payload_json', logicalType: 'json', description: 'Remaining preference payload.' },
    ],
    [
      {
        name: 'uk_workbench_preferences_scope',
        columns: ['scope_type', 'scope_id'],
        description: 'One preference row per scope.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'engine_registry',
    'engine_registry',
    'engine',
    'Available engine descriptors and capabilities.',
    [
      { name: 'engine_id', logicalType: 'text', description: 'Engine identifier.' },
      { name: 'display_name', logicalType: 'text', description: 'Engine display name.' },
      { name: 'vendor', logicalType: 'text', description: 'Engine vendor.' },
      { name: 'installation_kind', logicalType: 'text', description: 'Bundled/external/remote installation kind.' },
      { name: 'default_model_id', logicalType: 'text', description: 'Default model identifier.' },
      { name: 'transport_kinds_json', logicalType: 'json', description: 'Supported transport kinds.' },
      { name: 'capability_matrix_json', logicalType: 'json', description: 'Engine capability matrix.' },
      { name: 'status', logicalType: 'enum', description: 'Engine status.' },
    ],
    [
      {
        name: 'uk_engine_registry_engine_id',
        columns: ['engine_id'],
        description: 'Unique engine identifier.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'model_catalog',
    'model_catalog',
    'engine',
    'Model catalog entries grouped by engine.',
    [
      { name: 'engine_id', logicalType: 'text', description: 'Owning engine identifier.' },
      { name: 'model_id', logicalType: 'text', description: 'Model identifier.' },
      { name: 'display_name', logicalType: 'text', description: 'Model display name.' },
      { name: 'provider_id', logicalType: 'text', description: 'Provider identifier.' },
      { name: 'transport_kinds_json', logicalType: 'json', description: 'Transport kinds usable for this model.' },
      { name: 'capability_matrix_json', logicalType: 'json', description: 'Model capability matrix.' },
      { name: 'is_default', logicalType: 'bool', description: 'Whether this is the default model for the engine.' },
      { name: 'status', logicalType: 'enum', description: 'Model availability status.' },
    ],
    [
      {
        name: 'uk_model_catalog_engine_model',
        columns: ['engine_id', 'model_id'],
        description: 'Unique model identifier within an engine.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'engine_binding',
    'engine_bindings',
    'engine',
    'Per-project or per-workspace engine binding.',
    [
      { name: 'scope_type', logicalType: 'enum', description: 'Binding scope type.' },
      { name: 'scope_id', logicalType: 'id', description: 'Binding scope identifier.' },
      { name: 'engine_id', logicalType: 'text', description: 'Bound engine identifier.' },
      { name: 'model_id', logicalType: 'text', description: 'Bound model identifier.' },
      { name: 'host_modes_json', logicalType: 'json', description: 'Host modes where this binding applies.' },
    ],
    [
      {
        name: 'uk_engine_bindings_scope_engine',
        columns: ['scope_type', 'scope_id', 'engine_id'],
        description: 'Unique binding per scope and engine.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'run_configuration',
    'run_configurations',
    'runtime',
    'Unified run configuration model.',
    [
      { name: 'workspace_id', logicalType: 'id', description: 'Owning workspace.' },
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'scope_type', logicalType: 'enum', description: 'Storage scope.' },
      { name: 'scope_id', logicalType: 'id', description: 'Storage scope id.' },
      { name: 'name', logicalType: 'text', description: 'Configuration name.' },
      { name: 'command', logicalType: 'text', description: 'Command string.' },
      { name: 'profile_id', logicalType: 'text', description: 'Terminal profile identifier.' },
      { name: 'group_name', logicalType: 'enum', description: 'Configuration group.' },
      { name: 'cwd_mode', logicalType: 'enum', description: 'CWD resolution mode.' },
      { name: 'custom_cwd', logicalType: 'text', description: 'Explicit working directory.' },
    ],
    [
      {
        name: 'idx_run_configurations_scope_group',
        columns: ['scope_type', 'scope_id', 'group_name'],
        description: 'Query configurations by scope/group.',
      },
    ],
  ),
  defineEntity(
    'terminal_execution',
    'terminal_executions',
    'runtime',
    'Terminal command execution records.',
    [
      { name: 'workspace_id', logicalType: 'id', description: 'Owning workspace.' },
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'session_id', logicalType: 'id', description: 'Linked terminal session.' },
      { name: 'command', logicalType: 'text', description: 'Executed command.' },
      { name: 'args_json', logicalType: 'json', description: 'Structured command arguments.' },
      { name: 'cwd', logicalType: 'text', description: 'Execution working directory.' },
      { name: 'stdout_ref', logicalType: 'text', description: 'Stdout archive reference.' },
      { name: 'stderr_ref', logicalType: 'text', description: 'Stderr archive reference.' },
      { name: 'exit_code', logicalType: 'int', description: 'Exit code.' },
      { name: 'started_at', logicalType: 'timestamp', description: 'Start time.' },
      { name: 'ended_at', logicalType: 'timestamp', description: 'End time.' },
    ],
    [
      {
        name: 'idx_terminal_executions_session_started',
        columns: ['session_id', 'started_at'],
        description: 'Execution ordering within a session.',
      },
    ],
  ),
  defineEntity(
    'build_execution',
    'build_executions',
    'runtime',
    'Build execution records.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'run_configuration_id', logicalType: 'id', description: 'Linked configuration.' },
      { name: 'target_id', logicalType: 'text', description: 'Build target.' },
      { name: 'output_kind', logicalType: 'text', description: 'Output kind.' },
      { name: 'status', logicalType: 'enum', description: 'Execution status.' },
      { name: 'artifact_ref', logicalType: 'text', description: 'Artifact location.' },
    ],
  ),
  defineEntity(
    'preview_session',
    'preview_sessions',
    'runtime',
    'Preview runtime sessions.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'runtime', logicalType: 'text', description: 'Preview runtime.' },
      { name: 'channel', logicalType: 'text', description: 'Preview channel.' },
      { name: 'url', logicalType: 'text', description: 'Preview URL.' },
      { name: 'status', logicalType: 'enum', description: 'Preview status.' },
    ],
  ),
  defineEntity(
    'simulator_session',
    'simulator_sessions',
    'runtime',
    'Simulator launch sessions.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'host', logicalType: 'text', description: 'Simulator host.' },
      { name: 'platform', logicalType: 'text', description: 'Target platform.' },
      { name: 'runtime', logicalType: 'text', description: 'Target runtime.' },
      { name: 'orientation', logicalType: 'text', description: 'Target orientation.' },
      { name: 'status', logicalType: 'enum', description: 'Simulator status.' },
    ],
  ),
  defineEntity(
    'test_execution',
    'test_executions',
    'runtime',
    'Test execution results.',
    [
      { name: 'project_id', logicalType: 'id', description: 'Owning project.' },
      { name: 'run_configuration_id', logicalType: 'id', description: 'Linked configuration.' },
      { name: 'framework', logicalType: 'text', description: 'Test framework.' },
      { name: 'summary_json', logicalType: 'json', description: 'Structured summary.' },
      { name: 'status', logicalType: 'enum', description: 'Execution status.' },
    ],
  ),
  defineEntity(
    'audit_event',
    'audit_events',
    'governance',
    'Audit trail for runtime and governance operations.',
    [
      { name: 'scope_type', logicalType: 'enum', description: 'Audit scope type.' },
      { name: 'scope_id', logicalType: 'id', description: 'Audit scope id.' },
      { name: 'event_type', logicalType: 'text', description: 'Event type.' },
      { name: 'payload_json', logicalType: 'json', description: 'Structured audit payload.' },
    ],
    [
      {
        name: 'idx_audit_events_scope_created',
        columns: ['scope_type', 'scope_id', 'created_at'],
        description: 'Scope audit ordering.',
      },
    ],
  ),
  defineEntity(
    'governance_policy',
    'governance_policies',
    'governance',
    'Governed approval and execution policy authority.',
    [
      { name: 'scope_type', logicalType: 'enum', description: 'Policy scope type.' },
      { name: 'scope_id', logicalType: 'id', description: 'Policy scope id.' },
      { name: 'policy_category', logicalType: 'text', description: 'Policy category.' },
      { name: 'target_type', logicalType: 'text', description: 'Policy target type.' },
      { name: 'target_id', logicalType: 'text', description: 'Policy target id.' },
      {
        name: 'approval_policy',
        logicalType: 'enum',
        description: 'Approval policy baseline applied to the target.',
      },
      {
        name: 'rationale',
        logicalType: 'text',
        nullable: true,
        description: 'Optional governance rationale.',
      },
      { name: 'status', logicalType: 'enum', description: 'Policy lifecycle state.' },
    ],
    [
      {
        name: 'idx_governance_policies_scope_updated',
        columns: ['scope_type', 'scope_id', 'updated_at'],
        description: 'Recent policies by governance scope.',
      },
      {
        name: 'uk_governance_policies_scope_target',
        columns: ['scope_type', 'scope_id', 'policy_category', 'target_type', 'target_id'],
        description: 'Unique policy target per governance scope.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'release_record',
    'release_records',
    'governance',
    'Release manifests and evidence.',
    [
      { name: 'release_version', logicalType: 'text', description: 'Release version.' },
      { name: 'release_kind', logicalType: 'text', description: 'Release kind.' },
      { name: 'rollout_stage', logicalType: 'text', description: 'Rollout stage.' },
      { name: 'manifest_json', logicalType: 'json', description: 'Release manifest.' },
      { name: 'status', logicalType: 'enum', description: 'Release status.' },
    ],
    [
      {
        name: 'uk_release_records_version',
        columns: ['release_version'],
        description: 'Unique release version.',
        unique: true,
      },
    ],
  ),
  defineEntity(
    'schema_migration_history',
    BIRDCODER_SCHEMA_MIGRATION_HISTORY_TABLE,
    'governance',
    'Applied schema migrations by provider.',
    [
      { name: 'migration_id', logicalType: 'text', description: 'Logical migration identifier.' },
      { name: 'provider_id', logicalType: 'text', description: 'Provider identifier.' },
      { name: 'status', logicalType: 'enum', description: 'Migration status.' },
      { name: 'applied_at', logicalType: 'timestamp', description: 'Applied timestamp.' },
      { name: 'details_json', logicalType: 'json', description: 'Migration diagnostics.' },
    ],
    [
      {
        name: 'uk_schema_migration_history_provider_migration',
        columns: ['provider_id', 'migration_id'],
        description: 'Unique migration application per provider.',
        unique: true,
      },
    ],
  ),
];

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
