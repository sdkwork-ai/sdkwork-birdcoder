import type {
  BirdCoderEntityDefinition,
  BirdCoderEntityStorageBinding,
} from './data.ts';

export const BIRDCODER_RUN_CONFIGURATION_ENTITY_DEFINITION: BirdCoderEntityDefinition = {
  entityName: 'run_configuration',
  tableName: 'ops_run_configuration',
  aggregate: 'ops',
  description: 'Unified run configuration model.',
  columns: [
    { name: 'id', logicalType: 'id' },
    { name: 'uuid', logicalType: 'text', nullable: true },
    { name: 'created_at', logicalType: 'timestamp' },
    { name: 'updated_at', logicalType: 'timestamp' },
    { name: 'version', logicalType: 'bigint' },
    { name: 'is_deleted', logicalType: 'bool' },
    { name: 'tenant_id', logicalType: 'id' },
    { name: 'organization_id', logicalType: 'id' },
    { name: 'workspace_id', logicalType: 'id' },
    { name: 'project_id', logicalType: 'id' },
    { name: 'scope_type', logicalType: 'enum' },
    { name: 'scope_id', logicalType: 'id' },
    { name: 'config_key', logicalType: 'text' },
    { name: 'name', logicalType: 'text' },
    { name: 'command', logicalType: 'text' },
    { name: 'profile_id', logicalType: 'text' },
    { name: 'group_name', logicalType: 'enum' },
    { name: 'cwd_mode', logicalType: 'enum' },
    { name: 'custom_cwd', logicalType: 'text' },
  ],
  indexes: [
    {
      name: 'idx_ops_run_configuration_scope_group',
      columns: ['scope_type', 'scope_id', 'group_name'],
    },
    {
      name: 'uk_ops_run_configuration_scope_config_key',
      columns: ['scope_type', 'scope_id', 'config_key'],
      unique: true,
    },
  ],
};

export const BIRDCODER_RUN_CONFIGURATION_STORAGE_BINDING: BirdCoderEntityStorageBinding = {
  entityName: 'run_configuration',
  storageScope: 'runtime.run-configurations',
  storageKey: 'run-configs.global.v1',
  preferredProvider: 'sqlite',
  storageMode: 'table',
};
