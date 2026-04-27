import assert from 'node:assert/strict';

const providersModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts',
  import.meta.url,
);

const providersModule = await import(`${providersModulePath.href}?t=${Date.now()}`);

assert.equal(typeof providersModule.createBirdCoderStorageDialect, 'function');
assert.equal(typeof providersModule.getBirdCoderSchemaMigrationDefinition, 'function');

const sqliteDialect = providersModule.createBirdCoderStorageDialect('sqlite');
assert.equal(sqliteDialect.providerId, 'sqlite');
assert.equal(sqliteDialect.buildPlaceholder(2), '?2');
assert.equal(sqliteDialect.mapLogicalType('json'), 'TEXT');
assert.equal(sqliteDialect.mapLogicalType('timestamp'), 'TEXT');
assert.equal(sqliteDialect.mapLogicalType('date'), 'TEXT');
assert.equal(sqliteDialect.mapLogicalType('double'), 'REAL');

const postgresDialect = providersModule.createBirdCoderStorageDialect('postgresql');
assert.equal(postgresDialect.providerId, 'postgresql');
assert.equal(postgresDialect.buildPlaceholder(2), '$2');
assert.equal(postgresDialect.mapLogicalType('json'), 'JSONB');
assert.equal(postgresDialect.mapLogicalType('timestamp'), 'TIMESTAMPTZ');
assert.equal(postgresDialect.mapLogicalType('date'), 'DATE');
assert.equal(postgresDialect.mapLogicalType('double'), 'DOUBLE PRECISION');

const runtimeMigration = providersModule.getBirdCoderSchemaMigrationDefinition('runtime-data-kernel-v1');
assert.ok(runtimeMigration.sqlByProvider.sqlite?.some((statement) => statement.includes('terminal_executions')));
assert.ok(runtimeMigration.sqlByProvider.postgresql?.some((statement) => statement.includes('terminal_executions')));

const codingServerMigration = providersModule.getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2');
assert.ok(codingServerMigration.sqlByProvider.sqlite?.some((statement) => statement.includes('coding_sessions')));
assert.ok(codingServerMigration.sqlByProvider.postgresql?.some((statement) => statement.includes('deployment_records')));

function findCreateTableStatement(migration, providerId, tableName) {
  return migration.sqlByProvider[providerId]?.find((statement) =>
    statement.includes(`CREATE TABLE IF NOT EXISTS ${tableName} (`),
  );
}

function assertSqliteLongIdentifierColumns(statement, tableName, requiredColumns) {
  for (const [columnName, columnDefinition] of Object.entries(requiredColumns)) {
    assert.match(
      statement,
      new RegExp(`\\b${columnName} ${columnDefinition}\\b`),
      `SQLite ${tableName}.${columnName} must use Java Long-compatible integer storage.`,
    );
  }
}

const sqliteWorkspaceMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_workspace',
);
assert.ok(sqliteWorkspaceMigration, 'SQLite coding server migration must declare plus_workspace.');
const sqliteOrganizationMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_organization',
);
assert.ok(sqliteOrganizationMigration, 'SQLite coding server migration must declare plus_organization.');
assertSqliteLongIdentifierColumns(sqliteOrganizationMigration, 'plus_organization', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
  parent_id: 'INTEGER NULL',
});
assert.match(
  sqliteOrganizationMigration,
  /\bdata_scope INTEGER NOT NULL DEFAULT 1\b/,
  'SQLite plus_organization.data_scope must store PlusDataScope.PRIVATE as integer value 1 by default.',
);
const sqliteOrganizationMemberMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_organization_member',
);
assert.ok(
  sqliteOrganizationMemberMigration,
  'SQLite coding server migration must declare plus_organization_member.',
);
assertSqliteLongIdentifierColumns(sqliteOrganizationMemberMigration, 'plus_organization_member', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
  user_id: 'INTEGER NOT NULL',
  owner_id: 'INTEGER NOT NULL',
});
assert.match(
  sqliteOrganizationMemberMigration,
  /\bowner INTEGER NOT NULL\b/,
  'SQLite plus_organization_member.owner must store PlusPlatformOwner converter values as integer.',
);
const sqliteMemberRelationsMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_member_relations',
);
assert.ok(
  sqliteMemberRelationsMigration,
  'SQLite coding server migration must declare plus_member_relations.',
);
assertSqliteLongIdentifierColumns(sqliteMemberRelationsMigration, 'plus_member_relations', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
  parent_id: 'INTEGER NULL',
  member_id: 'INTEGER NOT NULL',
  owner_id: 'INTEGER NOT NULL',
  target_id: 'INTEGER NOT NULL',
});
assert.match(
  sqliteMemberRelationsMigration,
  /\bowner INTEGER NOT NULL\b/,
  'SQLite plus_member_relations.owner must store PlusPlatformOwner converter values as integer.',
);
assert.match(
  sqliteMemberRelationsMigration,
  /\brelation_type INTEGER NOT NULL\b/,
  'SQLite plus_member_relations.relation_type must store MemberRelationType converter values as integer.',
);
const sqliteDepartmentMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_department',
);
assert.ok(sqliteDepartmentMigration, 'SQLite coding server migration must declare plus_department.');
assertSqliteLongIdentifierColumns(sqliteDepartmentMigration, 'plus_department', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
  parent_id: 'INTEGER NULL',
  owner_id: 'INTEGER NOT NULL',
  manager_id: 'INTEGER NULL',
});
assert.match(
  sqliteDepartmentMigration,
  /\bowner INTEGER NOT NULL\b/,
  'SQLite plus_department.owner must store PlusPlatformOwner converter values as integer.',
);
const sqlitePositionMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_position',
);
assert.ok(sqlitePositionMigration, 'SQLite coding server migration must declare plus_position.');
assertSqliteLongIdentifierColumns(sqlitePositionMigration, 'plus_position', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
  parent_id: 'INTEGER NULL',
  owner_id: 'INTEGER NOT NULL',
});
assert.match(
  sqlitePositionMigration,
  /\bowner INTEGER NOT NULL\b/,
  'SQLite plus_position.owner must store PlusPlatformOwner converter values as integer.',
);
const sqliteRoleMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_role',
);
assert.ok(sqliteRoleMigration, 'SQLite coding server migration must declare plus_role.');
assertSqliteLongIdentifierColumns(sqliteRoleMigration, 'plus_role', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
});
assert.match(
  sqliteRoleMigration,
  /\bstatus INTEGER NOT NULL DEFAULT 1\b/,
  'SQLite plus_role.status must store RoleStatus converter values as integer.',
);
const sqlitePermissionMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_permission',
);
assert.ok(sqlitePermissionMigration, 'SQLite coding server migration must declare plus_permission.');
assertSqliteLongIdentifierColumns(sqlitePermissionMigration, 'plus_permission', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
});
assert.match(
  sqlitePermissionMigration,
  /\bstatus INTEGER NOT NULL\b/,
  'SQLite plus_permission.status must store PermissionStatus converter values as integer.',
);
const sqliteRolePermissionMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_role_permission',
);
assert.ok(
  sqliteRolePermissionMigration,
  'SQLite coding server migration must declare plus_role_permission.',
);
assertSqliteLongIdentifierColumns(sqliteRolePermissionMigration, 'plus_role_permission', {
  id: 'INTEGER PRIMARY KEY',
  role_id: 'INTEGER NOT NULL',
  permission_id: 'INTEGER NOT NULL',
  operator_id: 'INTEGER NULL',
});
assert.match(
  sqliteRolePermissionMigration,
  /\bstatus INTEGER NOT NULL DEFAULT 1\b/,
  'SQLite plus_role_permission.status must store PlusCommonStatus.ACTIVE as integer value 1 by default.',
);
assert.doesNotMatch(
  sqliteRolePermissionMigration,
  /\b(?:tenant_id|organization_id|data_scope|version|is_deleted)\b/,
  'SQLite plus_role_permission must follow Java join-table columns and not emit scoped/base extras.',
);
const sqliteUserRoleMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_user_role',
);
assert.ok(sqliteUserRoleMigration, 'SQLite coding server migration must declare plus_user_role.');
assertSqliteLongIdentifierColumns(sqliteUserRoleMigration, 'plus_user_role', {
  id: 'INTEGER NULL',
  user_id: 'INTEGER NOT NULL',
  role_id: 'INTEGER NOT NULL',
  operator_id: 'INTEGER NULL',
});
assert.match(
  sqliteUserRoleMigration,
  /\bPRIMARY KEY \(user_id, role_id\)/,
  'SQLite plus_user_role must preserve Java composite primary key user_id, role_id.',
);
assert.doesNotMatch(
  sqliteUserRoleMigration,
  /\b(?:tenant_id|organization_id|data_scope|version|is_deleted)\b/,
  'SQLite plus_user_role must follow Java join-table columns and not emit scoped/base extras.',
);
const sqliteUserMigration = findCreateTableStatement(codingServerMigration, 'sqlite', 'plus_user');
assert.ok(sqliteUserMigration, 'SQLite coding server migration must declare plus_user.');
assertSqliteLongIdentifierColumns(sqliteUserMigration, 'plus_user', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
});
assert.match(
  sqliteUserMigration,
  /\bdata_scope INTEGER NOT NULL DEFAULT 1\b/,
  'SQLite plus_user.data_scope must store PlusDataScope.PRIVATE as integer value 1 by default.',
);
const sqliteOAuthAccountMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_oauth_account',
);
assert.ok(
  sqliteOAuthAccountMigration,
  'SQLite coding server migration must declare plus_oauth_account.',
);
assertSqliteLongIdentifierColumns(sqliteOAuthAccountMigration, 'plus_oauth_account', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
  user_id: 'INTEGER NOT NULL',
  channel_account_id: 'INTEGER NULL',
});
assert.ok(
  codingServerMigration.sqlByProvider.sqlite?.some((statement) =>
    statement.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_auth_relations_openid ON plus_oauth_account (oauth_provider, open_id)',
    ),
  ),
  'SQLite plus_oauth_account must preserve Java unique provider/open_id constraint.',
);
assert.ok(
  codingServerMigration.sqlByProvider.sqlite?.some((statement) =>
    statement.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_auth_relations_unionid ON plus_oauth_account (oauth_provider, union_id)',
    ),
  ),
  'SQLite plus_oauth_account must preserve Java unique provider/union_id constraint.',
);
const sqliteUserAddressMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_user_address',
);
assert.ok(sqliteUserAddressMigration, 'SQLite coding server migration must declare plus_user_address.');
assertSqliteLongIdentifierColumns(sqliteUserAddressMigration, 'plus_user_address', {
  id: 'INTEGER PRIMARY KEY',
  tenant_id: 'INTEGER NOT NULL DEFAULT 0',
  organization_id: 'INTEGER NOT NULL DEFAULT 0',
  user_id: 'INTEGER NOT NULL',
});
assert.match(
  sqliteUserAddressMigration,
  /\bis_default INTEGER NOT NULL DEFAULT 0\b/,
  'SQLite plus_user_address.is_default must use Java Boolean-compatible integer storage with false default.',
);

const canonicalUserCenterBusinessTables = [
  'plus_tenant',
  'plus_account',
  'plus_account_history',
  'plus_account_exchange_config',
  'plus_ledger_bridge',
  'plus_card',
  'plus_user_card',
  'plus_member_card',
  'plus_member_level',
  'plus_card_template',
  'plus_coupon',
  'plus_coupon_template',
  'plus_user_coupon',
  'plus_product',
  'plus_sku',
  'plus_currency',
  'plus_exchange_rate',
  'plus_agent_skill_package',
  'plus_agent_skill',
  'plus_user_agent_skill',
  'plus_agent_plugin',
  'plus_datasource',
  'plus_schema',
  'plus_table',
  'plus_column',
  'plus_ai_generation',
  'plus_ai_generation_content',
  'plus_ai_generation_style',
  'plus_channel',
  'plus_channel_account',
  'plus_channel_proxy',
  'plus_channel_resource',
  'plus_api_key',
  'plus_app',
  'plus_ai_model_availability',
  'plus_ai_model_compliance_profile',
  'plus_ai_model_info',
  'plus_ai_model_price',
  'plus_ai_model_price_metric',
  'plus_ai_model_taxonomy',
  'plus_ai_model_taxonomy_rel',
  'plus_ai_tenant_model_policy',
  'plus_ai_agent_tool_relation',
  'plus_ai_agent',
  'plus_ai_prompt',
  'plus_ai_prompt_history',
  'plus_ai_tool',
  'plus_api_security_policy',
  'plus_category',
  'plus_attribute',
  'plus_tags',
  'plus_memory',
  'plus_memory_item',
  'plus_notification',
  'plus_notification_content',
  'plus_push_device_endpoint',
  'plus_push_topic_subscription',
  'plus_conversation',
  'plus_chat_message',
  'plus_chat_message_content',
  'plus_detail',
  'plus_collection',
  'plus_collection_item',
  'plus_favorite',
  'plus_favorite_folder',
  'plus_share',
  'plus_share_visit_record',
  'plus_invitation_code',
  'plus_invitation_relation',
  'plus_sns_follow_relation',
  'plus_sns_follow_statistics',
  'plus_comments',
  'plus_content_vote',
  'plus_visit_history',
  'plus_feeds',
  'plus_short_url',
  'plus_feedback',
  'plus_email_message',
  'plus_events',
  'plus_disk',
  'plus_disk_member',
  'plus_file',
  'plus_file_content',
  'plus_file_part',
  'plus_oss_bucket',
  'plus_order',
  'plus_order_item',
  'plus_payment',
  'plus_refund',
  'plus_shopping_cart',
  'plus_shopping_cart_item',
  'plus_payment_webhook_event',
  'plus_order_dispatch_rule',
  'plus_order_worker_dispatch_profile',
  'plus_vip_user',
  'plus_vip_level',
  'plus_vip_benefit',
  'plus_vip_level_benefit',
  'plus_vip_pack_group',
  'plus_vip_pack',
  'plus_vip_recharge_method',
  'plus_vip_recharge_pack',
  'plus_vip_recharge',
  'plus_vip_point_change',
  'plus_vip_benefit_usage',
];

for (const tableName of canonicalUserCenterBusinessTables) {
  assert.ok(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    `SQLite coding server migration must declare ${tableName}.`,
  );
  assert.ok(
    findCreateTableStatement(codingServerMigration, 'postgresql', tableName),
    `PostgreSQL coding server migration must declare ${tableName}.`,
  );
}

const sqliteLongIdentifierColumnsByTable = {
  plus_tenant: { id: 'INTEGER PRIMARY KEY', biz_id: 'INTEGER NULL', admin_user_id: 'INTEGER NULL' },
  plus_account: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    owner_id: 'INTEGER NOT NULL',
  },
  plus_account_history: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    account_id: 'INTEGER NOT NULL',
    related_account_id: 'INTEGER NULL',
  },
  plus_account_exchange_config: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_ledger_bridge: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
  },
  plus_card: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    card_organization_id: 'INTEGER NULL',
  },
  plus_user_card: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    card_id: 'INTEGER NULL',
  },
  plus_member_card: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    card_id: 'INTEGER NULL',
  },
  plus_member_level: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    card_id: 'INTEGER NULL',
    required_points: 'INTEGER NULL',
  },
  plus_card_template: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_coupon: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    point_cost: 'INTEGER NULL',
  },
  plus_coupon_template: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_user_coupon: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    coupon_id: 'INTEGER NOT NULL',
    point_cost: 'INTEGER NULL',
    order_id: 'INTEGER NULL',
  },
  plus_product: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    category_id: 'INTEGER NOT NULL',
  },
  plus_sku: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    product_id: 'INTEGER NOT NULL',
  },
  plus_currency: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_exchange_rate: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    base_currency_id: 'INTEGER NOT NULL',
    target_currency_id: 'INTEGER NOT NULL',
  },
  plus_agent_skill_package: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    category_id: 'INTEGER NULL',
  },
  plus_agent_skill: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    category_id: 'INTEGER NULL',
    package_id: 'INTEGER NULL',
    reviewed_by: 'INTEGER NULL',
  },
  plus_user_agent_skill: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    skill_id: 'INTEGER NOT NULL',
  },
  plus_agent_plugin: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_datasource: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    project_id: 'INTEGER NOT NULL',
  },
  plus_schema: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    datasource_id: 'INTEGER NOT NULL',
  },
  plus_table: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    schema_id: 'INTEGER NOT NULL',
    row_count: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_column: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    table_id: 'INTEGER NOT NULL',
  },
  plus_ai_generation: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    conversation_id: 'INTEGER NULL',
    message_id: 'INTEGER NULL',
    parent_id: 'INTEGER NULL',
    biz_id: 'INTEGER NULL',
  },
  plus_ai_generation_content: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    generation_id: 'INTEGER NOT NULL DEFAULT 0',
    content_id: 'INTEGER NULL',
    seed: 'INTEGER NULL',
    file_size: 'INTEGER NULL',
  },
  plus_ai_generation_style: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
  },
  plus_channel: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
  },
  plus_channel_account: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
  },
  plus_channel_proxy: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
  },
  plus_channel_resource: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    channel_account_id: 'INTEGER NOT NULL',
  },
  plus_api_key: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
  },
  plus_app: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    project_id: 'INTEGER NULL',
  },
  plus_ai_model_availability: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    model_id: 'INTEGER NULL',
  },
  plus_ai_model_compliance_profile: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    model_id: 'INTEGER NULL',
  },
  plus_ai_model_info: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_ai_model_price: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    model_id: 'INTEGER NULL',
  },
  plus_ai_model_price_metric: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    price_rule_id: 'INTEGER NOT NULL',
    model_id: 'INTEGER NULL',
  },
  plus_ai_model_taxonomy: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    parent_id: 'INTEGER NULL',
  },
  plus_ai_model_taxonomy_rel: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    model_id: 'INTEGER NOT NULL',
    taxonomy_id: 'INTEGER NOT NULL',
  },
  plus_ai_tenant_model_policy: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    subject_id: 'INTEGER NULL',
    model_id: 'INTEGER NULL',
  },
  plus_ai_agent_tool_relation: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    agent_id: 'INTEGER NOT NULL',
    tool_id: 'INTEGER NOT NULL',
  },
  plus_ai_agent: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    owner_id: 'INTEGER NOT NULL',
    biz_type: 'INTEGER NULL',
    cate_id: 'INTEGER NULL',
    prompt_id: 'INTEGER NULL',
  },
  plus_ai_prompt: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    cate_id: 'INTEGER NULL',
    usage_count: 'INTEGER NULL',
    avg_response_time: 'INTEGER NULL',
  },
  plus_ai_prompt_history: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    prompt_id: 'INTEGER NULL',
    duration: 'INTEGER NULL',
  },
  plus_ai_tool: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    owner_id: 'INTEGER NOT NULL',
  },
  plus_api_security_policy: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_category: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    parent_id: 'INTEGER NULL',
    shop_id: 'INTEGER NOT NULL',
  },
  plus_attribute: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    content_id: 'INTEGER NOT NULL',
    category_id: 'INTEGER NOT NULL',
  },
  plus_tags: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
  },
  plus_memory: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    agent_id: 'INTEGER NULL',
    conversation_id: 'INTEGER NULL',
  },
  plus_memory_item: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    agent_id: 'INTEGER NULL',
    conversation_id: 'INTEGER NULL',
  },
  plus_notification: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    sender_id: 'INTEGER NULL',
    receiver_id: 'INTEGER NULL',
    group_id: 'INTEGER NULL',
  },
  plus_notification_content: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    notification_id: 'INTEGER NOT NULL',
    sender_id: 'INTEGER NULL',
    receiver_id: 'INTEGER NULL',
    group_id: 'INTEGER NULL',
  },
  plus_push_device_endpoint: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    workspace_id: 'INTEGER NULL',
  },
  plus_push_topic_subscription: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
  },
  plus_conversation: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    agent_id: 'INTEGER NULL',
    agent_biz_type: 'INTEGER NULL',
    last_message_id: 'INTEGER NULL',
    content_id: 'INTEGER NULL',
    model_id: 'INTEGER NULL',
    knowledge_base_id: 'INTEGER NULL',
    data_source_id: 'INTEGER NULL',
  },
  plus_chat_message: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    sender_id: 'INTEGER NULL',
    receiver_id: 'INTEGER NULL',
    group_id: 'INTEGER NULL',
    conversation_id: 'INTEGER NOT NULL',
    agent_id: 'INTEGER NULL',
    knowledge_base_id: 'INTEGER NULL',
    datasource_id: 'INTEGER NULL',
    agent_biz_type: 'INTEGER NULL',
    user_id: 'INTEGER NULL',
    channel_msg_seq: 'INTEGER NULL',
    parent_message_id: 'INTEGER NULL',
    processing_time: 'INTEGER NULL',
    model_id: 'INTEGER NULL',
  },
  plus_chat_message_content: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    message_id: 'INTEGER NOT NULL',
    conversation_id: 'INTEGER NOT NULL',
    agent_id: 'INTEGER NULL',
    agent_biz_type: 'INTEGER NULL',
  },
  plus_detail: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    content_id: 'INTEGER NOT NULL',
  },
  plus_collection: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    parent_id: 'INTEGER NULL',
    user_id: 'INTEGER NULL',
    content_id: 'INTEGER NULL',
  },
  plus_collection_item: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    collection_id: 'INTEGER NOT NULL',
    content_id: 'INTEGER NOT NULL',
  },
  plus_favorite: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    content_id: 'INTEGER NOT NULL',
    folder_id: 'INTEGER NULL',
  },
  plus_favorite_folder: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    parent_id: 'INTEGER NULL',
  },
  plus_share: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
  },
  plus_share_visit_record: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    share_id: 'INTEGER NOT NULL',
  },
  plus_invitation_code: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    creator_user_id: 'INTEGER NOT NULL',
  },
  plus_invitation_relation: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    inviter_user_id: 'INTEGER NOT NULL',
    invitee_user_id: 'INTEGER NOT NULL',
  },
  plus_sns_follow_relation: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    follower_id: 'INTEGER NOT NULL',
    following_id: 'INTEGER NOT NULL',
    owner_id: 'INTEGER NOT NULL',
  },
  plus_sns_follow_statistics: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    owner_id: 'INTEGER NOT NULL',
    following_count: 'INTEGER NOT NULL',
    follower_count: 'INTEGER NOT NULL',
    mutual_count: 'INTEGER NOT NULL',
    special_count: 'INTEGER NOT NULL',
    blocked_count: 'INTEGER NOT NULL',
    total_interaction_count: 'INTEGER NOT NULL',
    last_updated_at: 'INTEGER NULL',
  },
  plus_comments: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    parent_id: 'INTEGER NULL',
    user_id: 'INTEGER NULL',
    content_id: 'INTEGER NOT NULL',
  },
  plus_content_vote: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    content_id: 'INTEGER NOT NULL',
  },
  plus_visit_history: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    content_id: 'INTEGER NOT NULL',
  },
  plus_feeds: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    category_id: 'INTEGER NOT NULL',
    content_id: 'INTEGER NOT NULL',
    view_count: 'INTEGER NULL',
    like_count: 'INTEGER NULL',
    comment_count: 'INTEGER NULL',
    share_count: 'INTEGER NULL',
    favorite_count: 'INTEGER NULL',
  },
  plus_short_url: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    created_by: 'INTEGER NULL',
  },
  plus_feedback: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    biz_id: 'INTEGER NULL',
    reply_user_id: 'INTEGER NULL',
    closed_by: 'INTEGER NULL',
    assigned_to: 'INTEGER NULL',
  },
  plus_email_message: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
  },
  plus_events: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_disk: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    owner_id: 'INTEGER NOT NULL',
    knowledge_base_id: 'INTEGER NULL',
    disk_size: 'INTEGER NOT NULL',
    used_size: 'INTEGER NOT NULL',
  },
  plus_disk_member: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    disk_id: 'INTEGER NOT NULL',
    user_id: 'INTEGER NOT NULL',
    knowledge_base_id: 'INTEGER NULL',
  },
  plus_file: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    disk_id: 'INTEGER NOT NULL',
    size: 'INTEGER NULL',
    content_id: 'INTEGER NULL',
    biz_id: 'INTEGER NULL',
    workspace_id: 'INTEGER NULL',
    project_id: 'INTEGER NULL',
    generation_id: 'INTEGER NULL',
    owner_id: 'INTEGER NULL',
    channel_config_id: 'INTEGER NULL',
    parent_id: 'INTEGER NULL',
    reference_file_id: 'INTEGER NULL',
  },
  plus_file_content: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    file_id: 'INTEGER NOT NULL',
  },
  plus_file_part: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    file_id: 'INTEGER NOT NULL',
    chunk_size: 'INTEGER NOT NULL',
    total_size: 'INTEGER NOT NULL',
  },
  plus_oss_bucket: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NULL',
    channel_config_id: 'INTEGER NULL',
  },
  plus_order: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    owner_id: 'INTEGER NOT NULL',
    user_id: 'INTEGER NOT NULL',
    worker_user_id: 'INTEGER NULL',
    dispatcher_user_id: 'INTEGER NULL',
    content_id: 'INTEGER NULL',
    category_id: 'INTEGER NOT NULL',
  },
  plus_order_item: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    order_id: 'INTEGER NOT NULL',
    category_id: 'INTEGER NOT NULL',
    product_id: 'INTEGER NOT NULL',
    sku_id: 'INTEGER NOT NULL',
    content_id: 'INTEGER NULL',
  },
  plus_payment: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    order_id: 'INTEGER NOT NULL',
    content_id: 'INTEGER NULL',
  },
  plus_refund: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    order_id: 'INTEGER NOT NULL',
    payment_id: 'INTEGER NOT NULL',
    content_id: 'INTEGER NULL',
    operator_id: 'INTEGER NULL',
  },
  plus_shopping_cart: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    owner_id: 'INTEGER NOT NULL',
  },
  plus_shopping_cart_item: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    cart_id: 'INTEGER NOT NULL',
    product_id: 'INTEGER NOT NULL',
    sku_id: 'INTEGER NOT NULL',
  },
  plus_payment_webhook_event: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    request_timestamp: 'INTEGER NULL',
  },
  plus_order_dispatch_rule: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_order_worker_dispatch_profile: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
  },
  plus_vip_user: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    vip_level_id: 'INTEGER NULL',
  },
  plus_vip_level: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_vip_benefit: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_vip_level_benefit: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    vip_level_id: 'INTEGER NOT NULL',
    benefit_id: 'INTEGER NOT NULL',
  },
  plus_vip_pack_group: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    app_id: 'INTEGER NULL',
    scope_id: 'INTEGER NOT NULL',
  },
  plus_vip_pack: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    app_id: 'INTEGER NULL',
    group_id: 'INTEGER NULL',
    vip_level_id: 'INTEGER NULL',
    recharge_pack_id: 'INTEGER NULL',
  },
  plus_vip_recharge_method: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
  },
  plus_vip_recharge_pack: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    app_id: 'INTEGER NULL',
  },
  plus_vip_recharge: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    vip_level_id: 'INTEGER NULL',
    recharge_method_id: 'INTEGER NULL',
    recharge_pack_id: 'INTEGER NULL',
  },
  plus_vip_point_change: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    source_id: 'INTEGER NULL',
  },
  plus_vip_benefit_usage: {
    id: 'INTEGER PRIMARY KEY',
    tenant_id: 'INTEGER NOT NULL DEFAULT 0',
    organization_id: 'INTEGER NOT NULL DEFAULT 0',
    user_id: 'INTEGER NOT NULL',
    source_id: 'INTEGER NULL',
  },
};

for (const [tableName, columns] of Object.entries(sqliteLongIdentifierColumnsByTable)) {
  assertSqliteLongIdentifierColumns(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    tableName,
    columns,
  );
}

for (const tableName of [
  'plus_agent_plugin',
  'plus_datasource',
  'plus_schema',
  'plus_table',
  'plus_column',
  'plus_ai_generation',
  'plus_ai_generation_content',
  'plus_ai_generation_style',
]) {
  const statement = findCreateTableStatement(codingServerMigration, 'sqlite', tableName);
  assert.match(
    statement,
    /\buuid TEXT NOT NULL UNIQUE\b/,
    `SQLite ${tableName}.uuid must preserve V104 NOT NULL UNIQUE bootstrap standard.`,
  );
  assert.match(
    statement,
    /\bv INTEGER NOT NULL DEFAULT 0\b/,
    `SQLite ${tableName}.v must preserve PlusBaseEntity optimistic lock default 0.`,
  );
  assert.match(
    statement,
    /\bdata_scope INTEGER NOT NULL DEFAULT 0\b/,
    `SQLite ${tableName}.data_scope must preserve V104 bootstrap default 0.`,
  );
}

for (const tableName of [
  'plus_channel',
  'plus_channel_account',
  'plus_channel_proxy',
  'plus_channel_resource',
  'plus_api_key',
  'plus_app',
  'plus_ai_model_availability',
  'plus_ai_model_compliance_profile',
  'plus_ai_model_info',
  'plus_ai_model_price',
  'plus_ai_model_price_metric',
  'plus_ai_model_taxonomy',
  'plus_ai_model_taxonomy_rel',
  'plus_ai_tenant_model_policy',
  'plus_ai_agent_tool_relation',
  'plus_ai_agent',
  'plus_ai_prompt',
  'plus_ai_prompt_history',
  'plus_ai_tool',
  'plus_api_security_policy',
  'plus_category',
  'plus_attribute',
  'plus_tags',
  'plus_memory',
  'plus_memory_item',
  'plus_notification',
  'plus_notification_content',
  'plus_push_device_endpoint',
  'plus_push_topic_subscription',
  'plus_conversation',
  'plus_chat_message',
  'plus_chat_message_content',
  'plus_detail',
  'plus_collection',
  'plus_collection_item',
  'plus_favorite',
  'plus_favorite_folder',
  'plus_share',
  'plus_share_visit_record',
  'plus_invitation_code',
  'plus_invitation_relation',
  'plus_sns_follow_relation',
  'plus_sns_follow_statistics',
  'plus_comments',
  'plus_content_vote',
  'plus_visit_history',
  'plus_feeds',
  'plus_short_url',
  'plus_feedback',
  'plus_email_message',
  'plus_events',
  'plus_disk',
  'plus_disk_member',
  'plus_file',
  'plus_file_content',
  'plus_file_part',
  'plus_oss_bucket',
]) {
  const statement = findCreateTableStatement(codingServerMigration, 'sqlite', tableName);
  assert.match(
    statement,
    /\buuid TEXT NOT NULL UNIQUE\b/,
    `SQLite ${tableName}.uuid must preserve Java PlusBaseEntity NOT NULL UNIQUE standard.`,
  );
  assert.match(
    statement,
    /\bv INTEGER NOT NULL DEFAULT 0\b/,
    `SQLite ${tableName}.v must preserve Java PlusBaseEntity optimistic lock default 0.`,
  );
  assert.match(
    statement,
    /\bdata_scope INTEGER NOT NULL DEFAULT 1\b/,
    `SQLite ${tableName}.data_scope must preserve PlusDataScope.PRIVATE default 1.`,
  );
}

for (const [tableName, columnName, defaultValue] of [
  ['plus_agent_plugin', 'is_enabled', '1'],
  ['plus_schema', 'is_default', '0'],
  ['plus_column', 'is_nullable', '1'],
  ['plus_column', 'is_primary_key', '0'],
  ['plus_column', 'is_auto_increment', '0'],
  ['plus_ai_generation', 'is_public', '0'],
  ['plus_ai_generation_content', 'is_hd', '0'],
  ['plus_ai_generation_style', 'is_public', '0'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    new RegExp(`\\b${columnName} INTEGER NOT NULL DEFAULT ${defaultValue}\\b`),
    `SQLite ${tableName}.${columnName} must preserve V104 boolean default ${defaultValue}.`,
  );
}

for (const [tableName, columnName, defaultValue] of [
  ['plus_datasource', 'access_count', '0'],
  ['plus_schema', 'status', '1'],
  ['plus_schema', 'table_count', '0'],
  ['plus_table', 'column_count', '0'],
  ['plus_table', 'row_count', '0'],
  ['plus_ai_generation', 'progress', '0'],
  ['plus_ai_generation', 'retry_count', '0'],
  ['plus_ai_generation', 'max_retry', '3'],
  ['plus_ai_generation', 'view_count', '0'],
  ['plus_ai_generation', 'like_count', '0'],
  ['plus_ai_generation_content', 'generation_id', '0'],
  ['plus_ai_generation_style', 'usage_count', '0'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    new RegExp(`\\b${columnName} INTEGER NOT NULL DEFAULT ${defaultValue}\\b`),
    `SQLite ${tableName}.${columnName} must preserve V104 integer default ${defaultValue}.`,
  );
}

assert.match(
  findCreateTableStatement(codingServerMigration, 'sqlite', 'plus_datasource'),
  /\bconnection_config TEXT NOT NULL\b/,
  'SQLite plus_datasource.connection_config must preserve DataSourceConfigConverter TEXT NOT NULL storage.',
);
assert.match(
  findCreateTableStatement(codingServerMigration, 'sqlite', 'plus_ai_generation'),
  /\brequest_id TEXT NOT NULL UNIQUE\b/,
  'SQLite plus_ai_generation.request_id must preserve V104 NOT NULL UNIQUE bootstrap standard.',
);
assert.match(
  findCreateTableStatement(codingServerMigration, 'sqlite', 'plus_ai_generation_style'),
  /\bstatus TEXT NOT NULL DEFAULT 'ACTIVE'/,
  'SQLite plus_ai_generation_style.status must preserve V104 ACTIVE default.',
);

for (const [tableName, columnName] of [
  ['plus_account', 'available_balance'],
  ['plus_account', 'frozen_balance'],
  ['plus_account_history', 'amount'],
  ['plus_account_history', 'balance_before'],
  ['plus_account_history', 'balance_after'],
  ['plus_ledger_bridge', 'bridge_amount'],
  ['plus_card_template', 'minimum_balance'],
  ['plus_card_template', 'initial_balance'],
  ['plus_card_template', 'discount_rate'],
  ['plus_vip_pack', 'price'],
  ['plus_vip_recharge_pack', 'price'],
  ['plus_vip_recharge', 'amount'],
  ['plus_order', 'total_amount'],
  ['plus_order', 'paid_amount'],
  ['plus_order', 'product_amount'],
  ['plus_order', 'shipping_amount'],
  ['plus_order', 'discount_amount'],
  ['plus_order', 'tax_amount'],
  ['plus_order', 'refunded_amount'],
  ['plus_order_item', 'unit_price'],
  ['plus_order_item', 'total_amount'],
  ['plus_order_item', 'discount_amount'],
  ['plus_order_item', 'paid_amount'],
  ['plus_order_item', 'refunded_amount'],
  ['plus_payment', 'amount'],
  ['plus_refund', 'amount'],
  ['plus_shopping_cart_item', 'price'],
  ['plus_product', 'price'],
  ['plus_product', 'original_price'],
  ['plus_sku', 'price'],
  ['plus_sku', 'original_price'],
  ['plus_exchange_rate', 'rate'],
  ['plus_agent_skill', 'price'],
  ['plus_agent_skill', 'rating_avg'],
  ['plus_ai_generation', 'cost'],
  ['plus_ai_generation_content', 'cfg_scale'],
  ['plus_ai_generation_content', 'duration'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    new RegExp(`\\b${columnName} NUMERIC\\b`),
    `SQLite ${tableName}.${columnName} must use Java BigDecimal-compatible NUMERIC storage.`,
  );
}

for (const [tableName, columnName] of [
  ['plus_coupon', 'discount'],
  ['plus_coupon_template', 'discount'],
  ['plus_ai_model_info', 'default_temperature'],
  ['plus_ai_model_info', 'default_top_p'],
  ['plus_ai_model_info', 'default_frequency_penalty'],
  ['plus_ai_model_info', 'default_presence_penalty'],
  ['plus_ai_model_price', 'unit_size'],
  ['plus_ai_model_price', 'price'],
  ['plus_ai_model_price', 'input_price'],
  ['plus_ai_model_price', 'batch_input_price'],
  ['plus_ai_model_price', 'cached_input_price'],
  ['plus_ai_model_price', 'batch_cached_input_price'],
  ['plus_ai_model_price', 'output_price'],
  ['plus_ai_model_price', 'batch_output_price'],
  ['plus_ai_model_price', 'min_usage'],
  ['plus_ai_model_price', 'max_usage'],
  ['plus_ai_model_price_metric', 'unit_size'],
  ['plus_ai_model_price_metric', 'price'],
  ['plus_ai_model_price_metric', 'min_usage'],
  ['plus_ai_model_price_metric', 'max_usage'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    new RegExp(`\\b${columnName} REAL\\b`),
    `SQLite ${tableName}.${columnName} must use Java Double-compatible REAL storage.`,
  );
}

for (const [tableName, columnName, nullability] of [
  ['plus_card', 'card_type', 'NULL'],
  ['plus_card', 'code_type', 'NULL'],
  ['plus_card', 'status', 'NULL'],
  ['plus_member_level', 'status', 'NULL'],
  ['plus_card_template', 'card_type', 'NOT NULL'],
  ['plus_card_template', 'code_type', 'NULL'],
  ['plus_card_template', 'validity_type', 'NOT NULL'],
  ['plus_coupon', 'type', 'NOT NULL'],
  ['plus_coupon', 'status', 'NOT NULL'],
  ['plus_coupon', 'scope_type', 'NOT NULL'],
  ['plus_coupon_template', 'type', 'NOT NULL'],
  ['plus_coupon_template', 'status', 'NULL'],
  ['plus_coupon_template', 'validity_type', 'NULL'],
  ['plus_coupon_template', 'scope_type', 'NULL'],
  ['plus_user_coupon', 'acquire_type', 'NOT NULL'],
  ['plus_user_coupon', 'status', 'NOT NULL'],
  ['plus_order', 'order_type', 'NOT NULL'],
  ['plus_order', 'owner', 'NULL'],
  ['plus_order', 'status', 'NOT NULL'],
  ['plus_order', 'dispatch_mode', 'NULL'],
  ['plus_order', 'dispatch_status', 'NULL'],
  ['plus_order', 'content_type', 'NULL'],
  ['plus_order', 'refund_status', 'NULL'],
  ['plus_order', 'payment_provider', 'NULL'],
  ['plus_order_item', 'content_type', 'NULL'],
  ['plus_order_item', 'refund_status', 'NULL'],
  ['plus_order_item', 'review_status', 'NULL'],
  ['plus_order_item', 'payment_provider', 'NULL'],
  ['plus_payment', 'channel', 'NOT NULL'],
  ['plus_payment', 'provider', 'NOT NULL'],
  ['plus_payment', 'status', 'NOT NULL'],
  ['plus_payment', 'content_type', 'NULL'],
  ['plus_refund', 'channel', 'NULL'],
  ['plus_refund', 'provider', 'NULL'],
  ['plus_refund', 'status', 'NOT NULL'],
  ['plus_refund', 'content_type', 'NULL'],
  ['plus_shopping_cart', 'owner', 'NOT NULL'],
  ['plus_shopping_cart', 'status', 'NULL'],
  ['plus_payment_webhook_event', 'provider', 'NOT NULL'],
  ['plus_product', 'status', 'NOT NULL'],
  ['plus_currency', 'currency_type', 'NOT NULL'],
  ['plus_datasource', 'type', 'NOT NULL'],
  ['plus_datasource', 'status', 'NOT NULL'],
  ['plus_ai_generation', 'status', 'NOT NULL'],
  ['plus_ai_generation_content', 'content_type', 'NOT NULL'],
  ['plus_ai_generation_style', 'type', 'NOT NULL'],
  ['plus_channel', 'channel', 'NOT NULL'],
  ['plus_channel', 'status', 'NOT NULL'],
  ['plus_channel_account', 'channel', 'NOT NULL'],
  ['plus_channel_account', 'status', 'NOT NULL'],
  ['plus_channel_proxy', 'channel', 'NOT NULL'],
  ['plus_channel_proxy', 'proxy', 'NOT NULL'],
  ['plus_channel_proxy', 'status', 'NOT NULL'],
  ['plus_channel_resource', 'resource', 'NOT NULL'],
  ['plus_channel_resource', 'channel', 'NOT NULL'],
  ['plus_api_key', 'key_type', 'NOT NULL'],
  ['plus_api_key', 'owner', 'NULL'],
  ['plus_api_key', 'status', 'NOT NULL'],
  ['plus_app', 'status', 'NULL'],
  ['plus_app', 'app_type', 'NULL'],
  ['plus_ai_model_availability', 'status', 'NOT NULL'],
  ['plus_ai_model_info', 'channel', 'NULL'],
  ['plus_ai_model_info', 'vendor', 'NULL'],
  ['plus_ai_model_info', 'model_type', 'NULL'],
  ['plus_ai_model_info', 'status', 'NULL'],
  ['plus_ai_model_price_metric', 'status', 'NOT NULL'],
  ['plus_ai_model_taxonomy', 'status', 'NOT NULL'],
  ['plus_ai_tenant_model_policy', 'status', 'NOT NULL'],
  ['plus_ai_agent', 'owner', 'NULL'],
  ['plus_ai_agent', 'type', 'NOT NULL'],
  ['plus_ai_agent', 'biz_scope', 'NULL'],
  ['plus_ai_agent', 'status', 'NOT NULL'],
  ['plus_ai_tool', 'owner', 'NULL'],
  ['plus_ai_tool', 'type', 'NOT NULL'],
  ['plus_ai_tool', 'status', 'NOT NULL'],
  ['plus_category', 'type', 'NOT NULL'],
  ['plus_category', 'status', 'NOT NULL'],
  ['plus_attribute', 'type', 'NOT NULL'],
  ['plus_attribute', 'content_type', 'NOT NULL'],
  ['plus_attribute', 'status', 'NOT NULL'],
  ['plus_tags', 'type', 'NULL'],
  ['plus_memory_item', 'type', 'NULL'],
  ['plus_notification', 'role', 'NOT NULL'],
  ['plus_notification', 'type', 'NOT NULL'],
  ['plus_notification', 'channel_type', 'NOT NULL'],
  ['plus_notification', 'status', 'NOT NULL'],
  ['plus_notification_content', 'role', 'NOT NULL'],
  ['plus_notification_content', 'message_type', 'NOT NULL'],
  ['plus_notification_content', 'status', 'NOT NULL'],
  ['plus_notification_content', 'type', 'NOT NULL'],
  ['plus_notification_content', 'channel_type', 'NOT NULL'],
  ['plus_conversation', 'type', 'NULL'],
  ['plus_conversation', 'status', 'NOT NULL'],
  ['plus_conversation', 'agent_type', 'NULL'],
  ['plus_conversation', 'content_type', 'NULL'],
  ['plus_chat_message', 'role', 'NOT NULL'],
  ['plus_chat_message', 'type', 'NOT NULL'],
  ['plus_chat_message', 'status', 'NOT NULL'],
  ['plus_chat_message', 'conversation_type', 'NULL'],
  ['plus_chat_message', 'agent_type', 'NULL'],
  ['plus_chat_message_content', 'role', 'NOT NULL'],
  ['plus_chat_message_content', 'type', 'NOT NULL'],
  ['plus_chat_message_content', 'status', 'NOT NULL'],
  ['plus_chat_message_content', 'agent_type', 'NOT NULL'],
  ['plus_detail', 'content_type', 'NOT NULL'],
  ['plus_collection', 'type', 'NOT NULL'],
  ['plus_collection_item', 'type', 'NOT NULL'],
  ['plus_collection_item', 'content_type', 'NOT NULL'],
  ['plus_favorite', 'content_type', 'NOT NULL'],
  ['plus_favorite', 'status', 'NOT NULL'],
  ['plus_favorite_folder', 'status', 'NOT NULL'],
  ['plus_invitation_code', 'status', 'NOT NULL'],
  ['plus_invitation_relation', 'reward_status', 'NOT NULL'],
  ['plus_invitation_relation', 'reward_type', 'NULL'],
  ['plus_sns_follow_relation', 'relation_type', 'NOT NULL'],
  ['plus_sns_follow_relation', 'owner', 'NOT NULL'],
  ['plus_comments', 'content_type', 'NOT NULL'],
  ['plus_comments', 'status', 'NOT NULL'],
  ['plus_content_vote', 'content_type', 'NOT NULL'],
  ['plus_content_vote', 'rating', 'NOT NULL'],
  ['plus_visit_history', 'content_type', 'NOT NULL'],
  ['plus_feeds', 'content_type', 'NOT NULL'],
  ['plus_feeds', 'status', 'NOT NULL'],
  ['plus_short_url', 'status', 'NOT NULL'],
  ['plus_feedback', 'feedback_type', 'NOT NULL'],
  ['plus_feedback', 'status', 'NOT NULL'],
  ['plus_disk', 'type', 'NOT NULL'],
  ['plus_disk', 'owner', 'NOT NULL'],
  ['plus_file', 'type', 'NOT NULL'],
  ['plus_file', 'content_type', 'NULL'],
  ['plus_file', 'biz_type', 'NULL'],
  ['plus_file', 'project_type', 'NULL'],
  ['plus_file', 'generation_type', 'NOT NULL'],
  ['plus_file', 'storage_class', 'NULL'],
  ['plus_file', 'file_category', 'NULL'],
  ['plus_file', 'access_scope', 'NOT NULL'],
  ['plus_file', 'status', 'NOT NULL'],
  ['plus_file', 'upload_status', 'NOT NULL'],
  ['plus_oss_bucket', 'channel', 'NULL'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    new RegExp(`\\b${columnName} INTEGER ${nullability}\\b`),
    `SQLite ${tableName}.${columnName} must store Java converter enum values as INTEGER ${nullability}.`,
  );
}

assert.match(
  findCreateTableStatement(codingServerMigration, 'postgresql', 'plus_exchange_rate'),
  /\beffective_date DATE NOT NULL\b/,
  'PostgreSQL plus_exchange_rate.effective_date must use Java LocalDate-compatible DATE storage.',
);

assert.match(
  findCreateTableStatement(codingServerMigration, 'sqlite', 'plus_exchange_rate'),
  /\beffective_date TEXT NOT NULL\b/,
  'SQLite plus_exchange_rate.effective_date must use TEXT date storage.',
);

for (const [tableName, columnName, nullability] of [
  ['plus_product', 'resources', 'NULL'],
  ['plus_product', 'tags', 'NULL'],
  ['plus_product', 'base_attributes', 'NOT NULL'],
  ['plus_product', 'spec_attributes', 'NOT NULL'],
  ['plus_sku', 'specs', 'NULL'],
  ['plus_agent_skill_package', 'tags', 'NULL'],
  ['plus_agent_skill', 'tags', 'NULL'],
  ['plus_agent_skill', 'capabilities', 'NULL'],
  ['plus_agent_skill', 'config_schema', 'NULL'],
  ['plus_agent_skill', 'default_config', 'NULL'],
  ['plus_user_agent_skill', 'config', 'NULL'],
  ['plus_agent_plugin', 'config', 'NULL'],
  ['plus_datasource', 'tags', 'NULL'],
  ['plus_ai_generation', 'input_params', 'NULL'],
  ['plus_ai_generation', 'output_result', 'NULL'],
  ['plus_ai_generation', 'channel_task_info', 'NULL'],
  ['plus_ai_generation_content', 'tags', 'NULL'],
  ['plus_ai_generation_content', 'input_params', 'NULL'],
  ['plus_ai_generation_content', 'output', 'NULL'],
  ['plus_ai_generation_content', 'file_urls', 'NULL'],
  ['plus_ai_generation_content', 'extra_params', 'NULL'],
  ['plus_ai_generation_style', 'config_params', 'NULL'],
  ['plus_ai_generation_style', 'tags', 'NULL'],
  ['plus_ai_generation_style', 'cover_image', 'NULL'],
  ['plus_ai_generation_style', 'assets', 'NULL'],
  ['plus_ai_generation_style', 'preview_image', 'NULL'],
  ['plus_channel', 'types', 'NULL'],
  ['plus_channel', 'support_resources', 'NULL'],
  ['plus_channel_account', 'types', 'NULL'],
  ['plus_channel_account', 'support_resources', 'NULL'],
  ['plus_channel_account', 'configs', 'NULL'],
  ['plus_channel_account', 'proxy_account_configs', 'NULL'],
  ['plus_app', 'icon', 'NULL'],
  ['plus_app', 'resource_list', 'NULL'],
  ['plus_app', 'config', 'NULL'],
  ['plus_app', 'platforms', 'NULL'],
  ['plus_app', 'install_platforms', 'NULL'],
  ['plus_app', 'install_skill', 'NULL'],
  ['plus_app', 'install_config', 'NULL'],
  ['plus_app', 'release_notes', 'NULL'],
  ['plus_ai_model_availability', 'metadata', 'NULL'],
  ['plus_ai_model_compliance_profile', 'data_residency_regions', 'NULL'],
  ['plus_ai_model_compliance_profile', 'controls', 'NULL'],
  ['plus_ai_model_compliance_profile', 'metadata', 'NULL'],
  ['plus_ai_model_info', 'scenes', 'NULL'],
  ['plus_ai_model_info', 'tags', 'NULL'],
  ['plus_ai_model_info', 'function_info', 'NULL'],
  ['plus_ai_model_info', 'limit_info', 'NULL'],
  ['plus_ai_model_info', 'price_info', 'NULL'],
  ['plus_ai_model_info', 'metadata', 'NULL'],
  ['plus_ai_model_info', 'product_support_info', 'NULL'],
  ['plus_ai_model_price', 'metadata', 'NULL'],
  ['plus_ai_model_price_metric', 'metadata', 'NULL'],
  ['plus_ai_model_taxonomy', 'metadata', 'NULL'],
  ['plus_ai_model_taxonomy_rel', 'metadata', 'NULL'],
  ['plus_ai_tenant_model_policy', 'metadata', 'NULL'],
  ['plus_ai_agent', 'face_image', 'NULL'],
  ['plus_ai_agent', 'face_video', 'NULL'],
  ['plus_ai_agent', 'tags', 'NULL'],
  ['plus_ai_agent', 'base_config', 'NULL'],
  ['plus_ai_agent', 'knowledge_config', 'NULL'],
  ['plus_ai_agent', 'memory_config', 'NULL'],
  ['plus_ai_agent', 'speech_config', 'NULL'],
  ['plus_ai_agent', 'tool_config', 'NULL'],
  ['plus_ai_agent', 'chat_options', 'NULL'],
  ['plus_ai_agent', 'members', 'NULL'],
  ['plus_ai_prompt', 'tags', 'NULL'],
  ['plus_ai_tool', 'tags', 'NULL'],
  ['plus_category', 'parent_metadata', 'NULL'],
  ['plus_category', 'tags', 'NULL'],
  ['plus_memory', 'profile', 'NULL'],
  ['plus_notification', 'sender', 'NULL'],
  ['plus_notification', 'receiver', 'NULL'],
  ['plus_notification', 'template_params', 'NULL'],
  ['plus_notification', 'extra_data', 'NULL'],
  ['plus_notification_content', 'body', 'NOT NULL'],
  ['plus_push_device_endpoint', 'metadata', 'NULL'],
  ['plus_push_topic_subscription', 'metadata', 'NULL'],
  ['plus_conversation', 'knowledge_config', 'NULL'],
  ['plus_conversation', 'memory_config', 'NULL'],
  ['plus_conversation', 'tags', 'NULL'],
  ['plus_chat_message', 'sender', 'NULL'],
  ['plus_chat_message', 'receiver', 'NULL'],
  ['plus_chat_message', 'feedback_metadata', 'NULL'],
  ['plus_chat_message_content', 'content', 'NOT NULL'],
  ['plus_detail', 'metadata', 'NULL'],
  ['plus_collection', 'parent_metadata', 'NULL'],
  ['plus_collection_item', 'extra_data', 'NULL'],
  ['plus_favorite', 'image', 'NULL'],
  ['plus_share', 'contents', 'NULL'],
  ['plus_share', 'content_ids', 'NULL'],
  ['plus_share', 'tags', 'NULL'],
  ['plus_comments', 'parent_metadata', 'NULL'],
  ['plus_comments', 'author', 'NULL'],
  ['plus_content_vote', 'metadata', 'NULL'],
  ['plus_feeds', 'cover_images', 'NULL'],
  ['plus_feeds', 'resource_list', 'NULL'],
  ['plus_feeds', 'author', 'NULL'],
  ['plus_feeds', 'tags', 'NULL'],
  ['plus_feedback', 'attachments', 'NULL'],
  ['plus_feedback', 'images', 'NULL'],
  ['plus_email_message', 'to_addresses', 'NULL'],
  ['plus_email_message', 'cc_addresses', 'NULL'],
  ['plus_email_message', 'bcc_addresses', 'NULL'],
  ['plus_events', 'payload', 'NULL'],
  ['plus_disk_member', 'permission', 'NOT NULL'],
  ['plus_file', 'bucket', 'NOT NULL'],
  ['plus_file', 'tags', 'NULL'],
  ['plus_file', 'parent_metadata', 'NULL'],
  ['plus_file', 'metadata', 'NULL'],
  ['plus_file', 'permission', 'NOT NULL'],
  ['plus_file', 'cover_image', 'NULL'],
]) {
  const nullabilityPattern = nullability === 'NULL' ? '(?: NULL)?' : ' NOT NULL';

  assert.match(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    new RegExp(`\\b${columnName} TEXT${nullabilityPattern}\\b`),
    `SQLite ${tableName}.${columnName} must use JSON-compatible TEXT storage.`,
  );
  assert.match(
    findCreateTableStatement(codingServerMigration, 'postgresql', tableName),
    new RegExp(`\\b${columnName} JSONB${nullabilityPattern}\\b`),
    `PostgreSQL ${tableName}.${columnName} must use Java JSONB-compatible storage.`,
  );
}

assert.ok(
  codingServerMigration.sqlByProvider.sqlite.includes(
    'CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_coupon_redeem_code ON plus_coupon (redeem_code);',
  ),
  'SQLite plus_coupon must preserve Java unique redeem_code constraint.',
);
assert.ok(
  codingServerMigration.sqlByProvider.sqlite.includes(
    'CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_coupon_template_template_code ON plus_coupon_template (template_code);',
  ),
  'SQLite plus_coupon_template must preserve Java unique template_code constraint.',
);
assert.ok(
  codingServerMigration.sqlByProvider.sqlite.includes(
    'CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_user_coupon_code ON plus_user_coupon (coupon_code);',
  ),
  'SQLite plus_user_coupon must preserve Java unique coupon_code constraint.',
);
assert.ok(
  codingServerMigration.sqlByProvider.sqlite.includes(
    'CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_user_coupon_acquire_request_no ON plus_user_coupon (user_id, acquire_request_no);',
  ),
  'SQLite plus_user_coupon must preserve Java unique user_id/acquire_request_no constraint.',
);

for (const [tableName, columnName] of [
  ['plus_order', 'product_image'],
  ['plus_order_item', 'product_image'],
  ['plus_datasource', 'connection_config'],
  ['plus_ai_generation_content', 'metadata'],
  ['plus_ai_agent_tool_relation', 'actions'],
  ['plus_ai_prompt', 'parameters'],
  ['plus_ai_tool', 'tool_definition'],
  ['plus_notification_content', 'metadata'],
  ['plus_conversation', 'chat_options'],
  ['plus_chat_message', 'chat_options'],
  ['plus_chat_message_content', 'metadata'],
  ['plus_detail', 'content'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'sqlite', tableName),
    new RegExp(`\\b${columnName} TEXT(?: NULL| NOT NULL)?\\b`),
    `SQLite ${tableName}.${columnName} must store BaseJsonConverter payloads as TEXT.`,
  );
}

for (const [indexName, tableName, columnNames] of [
  ['uk_plus_product_code', 'plus_product', 'code'],
  ['uk_plus_sku_sku_code', 'plus_sku', 'sku_code'],
  ['UK_plus_currency_name', 'plus_currency', 'name'],
  [
    'UK_exchange_rate_base_target_date',
    'plus_exchange_rate',
    'base_currency_id, target_currency_id, effective_date',
  ],
  [
    'uk_plus_agent_skill_package_key',
    'plus_agent_skill_package',
    'tenant_id, organization_id, package_key',
  ],
  [
    'uk_plus_agent_skill_key',
    'plus_agent_skill',
    'tenant_id, organization_id, skill_key',
  ],
  [
    'uk_plus_user_agent_skill',
    'plus_user_agent_skill',
    'tenant_id, organization_id, user_id, skill_id',
  ],
  ['uk_plus_schema_datasource_name', 'plus_schema', 'datasource_id, name'],
  ['uk_plus_table_schema_name', 'plus_table', 'schema_id, name'],
  ['uk_plus_column_table_name', 'plus_column', 'table_id, name'],
  ['uk_plus_order_order_sn', 'plus_order', 'order_sn'],
  ['uk_plus_order_out_trade_no', 'plus_order', 'out_trade_no'],
  ['uk_plus_payment_out_trade_no', 'plus_payment', 'out_trade_no'],
  ['uk_plus_refund_out_refund_no', 'plus_refund', 'out_refund_no'],
  ['uk_plus_shopping_cart_item_cart_sku', 'plus_shopping_cart_item', 'cart_id, sku_id'],
  ['uk_payment_webhook_provider_event', 'plus_payment_webhook_event', 'provider, event_id'],
  ['uk_payment_webhook_provider_nonce', 'plus_payment_webhook_event', 'provider, nonce'],
  ['uk_order_dispatch_rule_task_code', 'plus_order_dispatch_rule', 'task_code'],
  [
    'uk_order_worker_dispatch_profile_user_id',
    'plus_order_worker_dispatch_profile',
    'user_id',
  ],
  ['uk_plus_schema_datasource_name', 'plus_schema', 'datasource_id, name'],
  ['uk_plus_table_schema_name', 'plus_table', 'schema_id, name'],
  ['uk_plus_column_table_name', 'plus_column', 'table_id, name'],
  [
    'uk_plus_ai_generation_user_type_idempotency',
    'plus_ai_generation',
    'user_id, type, idempotency_key',
  ],
  ['uk_plus_channel_account_key', 'plus_channel_account', 'account_key'],
  ['uk_plus_api_key_key_value', 'plus_api_key', 'key_value'],
  [
    'uk_ai_model_availability_scope',
    'plus_ai_model_availability',
    'tenant_id, organization_id, channel, model_key, platform, environment, region_code, access_tier',
  ],
  [
    'uk_ai_model_compliance_standard',
    'plus_ai_model_compliance_profile',
    'tenant_id, organization_id, channel, model_key, standard_code',
  ],
  ['uk_model_channel_key', 'plus_ai_model_info', 'channel, model_key'],
  [
    'uk_ai_model_price_metric',
    'plus_ai_model_price_metric',
    'tenant_id, organization_id, price_rule_id, metric_type, tier_no',
  ],
  [
    'uk_ai_model_taxonomy_code',
    'plus_ai_model_taxonomy',
    'tenant_id, organization_id, type, code',
  ],
  [
    'uk_ai_model_taxonomy_rel',
    'plus_ai_model_taxonomy_rel',
    'tenant_id, organization_id, model_id, taxonomy_id',
  ],
  [
    'uk_ai_tenant_model_policy_code',
    'plus_ai_tenant_model_policy',
    'tenant_id, organization_id, policy_code',
  ],
  ['uk_agent_tool', 'plus_ai_agent_tool_relation', 'agent_id, tool_id'],
  ['uk_plus_api_security_policy_policy_code', 'plus_api_security_policy', 'policy_code'],
  ['uk_plus_attribute_scope_code', 'plus_attribute', 'content_type, content_id, code'],
  ['uk_plus_push_device_endpoint_endpoint_id', 'plus_push_device_endpoint', 'endpoint_id'],
  [
    'uk_plus_push_topic_subscription_user_topic_endpoint',
    'plus_push_topic_subscription',
    'user_id, topic, endpoint_id',
  ],
  ['uk_plus_chat_message_content_message_id', 'plus_chat_message_content', 'message_id'],
  ['idx_favorite_user_content', 'plus_favorite', 'user_id, content_type, content_id'],
  ['uk_plus_share_share_code', 'plus_share', 'share_code'],
  ['uk_plus_invitation_code_code', 'plus_invitation_code', 'code'],
  ['UK_sns_follow_relation', 'plus_sns_follow_relation', 'follower_id, following_id'],
  ['UK_sns_follow_statistics', 'plus_sns_follow_statistics', 'user_id, owner_id'],
  ['idx_vote_user_content', 'plus_content_vote', 'user_id, content_type, content_id'],
  ['uk_plus_short_url_short_code', 'plus_short_url', 'short_code'],
  ['uk_plus_email_message_user_external', 'plus_email_message', 'user_id, external_message_id'],
  ['uk_plus_disk_name', 'plus_disk', 'name'],
  ['idx_plus_disk_owner_id2', 'plus_disk', 'owner, owner_id, type'],
  ['idx_disk_member_disk_user', 'plus_disk_member', 'disk_id, user_id'],
  ['idx_file_disk_parent_path', 'plus_file', 'disk_id, parent_id, path'],
]) {
  assert.ok(
    codingServerMigration.sqlByProvider.sqlite.includes(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnNames});`,
    ),
    `SQLite ${tableName}.${columnNames} must preserve Java unique text constraint.`,
  );
}

for (const [indexName, tableName, columnNames] of [
  ['idx_sku_product', 'plus_sku', 'product_id'],
  ['idx_sku_code', 'plus_sku', 'sku_code'],
  ['idx_plus_agent_skill_package_user', 'plus_agent_skill_package', 'user_id'],
  ['idx_plus_agent_skill_package_category', 'plus_agent_skill_package', 'category_id'],
  [
    'idx_plus_agent_skill_package_market',
    'plus_agent_skill_package',
    'enabled, featured, sort_weight',
  ],
  ['idx_plus_agent_skill_user', 'plus_agent_skill', 'user_id'],
  ['idx_plus_agent_skill_category', 'plus_agent_skill', 'category_id'],
  ['idx_plus_agent_skill_package', 'plus_agent_skill', 'package_id'],
  [
    'idx_plus_agent_skill_market',
    'plus_agent_skill',
    'enabled, market_status, visibility, review_status',
  ],
  ['idx_plus_agent_skill_featured', 'plus_agent_skill', 'featured, recommend_weight'],
  ['idx_plus_user_agent_skill_user', 'plus_user_agent_skill', 'user_id'],
  ['idx_plus_user_agent_skill_skill', 'plus_user_agent_skill', 'skill_id'],
  ['idx_plus_user_agent_skill_enabled', 'plus_user_agent_skill', 'enabled'],
  ['idx_plus_agent_plugin_code', 'plus_agent_plugin', 'code'],
  ['idx_plus_agent_plugin_type', 'plus_agent_plugin', 'type'],
  ['idx_plus_agent_plugin_enabled', 'plus_agent_plugin', 'is_enabled'],
  ['idx_plus_datasource_name', 'plus_datasource', 'name'],
  ['idx_plus_datasource_type', 'plus_datasource', 'type'],
  ['idx_plus_datasource_status', 'plus_datasource', 'status'],
  ['idx_plus_datasource_project_id', 'plus_datasource', 'project_id'],
  ['idx_plus_datasource_user_id', 'plus_datasource', 'user_id'],
  ['idx_plus_schema_name', 'plus_schema', 'name'],
  ['idx_plus_schema_datasource_id', 'plus_schema', 'datasource_id'],
  ['idx_plus_table_name', 'plus_table', 'name'],
  ['idx_plus_table_schema_id', 'plus_table', 'schema_id'],
  ['idx_plus_column_name', 'plus_column', 'name'],
  ['idx_plus_column_table_id', 'plus_column', 'table_id'],
  ['idx_plus_column_ordinal_position', 'plus_column', 'ordinal_position'],
  ['idx_plus_ai_generation_user_status', 'plus_ai_generation', 'user_id, status'],
  ['idx_plus_ai_generation_type_status', 'plus_ai_generation', 'type, status'],
  ['idx_plus_ai_generation_channel_task', 'plus_ai_generation', 'channel_task_id'],
  ['idx_plus_ai_generation_conversation', 'plus_ai_generation', 'conversation_id'],
  ['idx_plus_ai_generation_content_generation', 'plus_ai_generation_content', 'generation_id'],
  ['idx_plus_ai_generation_content_content_type', 'plus_ai_generation_content', 'content_type'],
  ['idx_plus_ai_generation_content_content_id', 'plus_ai_generation_content', 'content_id'],
  ['idx_plus_ai_generation_content_created_at', 'plus_ai_generation_content', 'created_at'],
  ['idx_plus_ai_generation_style_user_id', 'plus_ai_generation_style', 'user_id'],
  ['idx_plus_ai_generation_style_name', 'plus_ai_generation_style', 'name'],
  ['idx_plus_ai_generation_style_type', 'plus_ai_generation_style', 'type'],
  ['idx_plus_ai_generation_style_status', 'plus_ai_generation_style', 'status'],
  ['idx_plus_channel_channel', 'plus_channel', 'channel'],
  ['idx_plus_channel_status', 'plus_channel', 'status'],
  ['idx_plus_channel_account_channel', 'plus_channel_account', 'channel'],
  ['idx_plus_channel_account_status', 'plus_channel_account', 'status'],
  ['idx_plus_channel_proxy_channel', 'plus_channel_proxy', 'channel'],
  ['idx_plus_channel_proxy_status', 'plus_channel_proxy', 'status'],
  ['idx_plus_channel_resource_account', 'plus_channel_resource', 'channel_account_id'],
  ['idx_plus_api_key_user', 'plus_api_key', 'user_id'],
  ['idx_plus_api_key_status', 'plus_api_key', 'status'],
  ['idx_app_user_id', 'plus_app', 'user_id'],
  ['idx_app_project_id', 'plus_app', 'project_id'],
  ['idx_app_status', 'plus_app', 'status'],
  ['idx_ai_model_availability_model', 'plus_ai_model_availability', 'model_id'],
  ['idx_ai_model_availability_channel_key', 'plus_ai_model_availability', 'channel, model_key'],
  ['idx_ai_model_availability_platform_env', 'plus_ai_model_availability', 'platform, environment'],
  ['idx_ai_model_availability_region', 'plus_ai_model_availability', 'region_code'],
  ['idx_ai_model_availability_status', 'plus_ai_model_availability', 'status, available'],
  ['idx_ai_model_availability_time', 'plus_ai_model_availability', 'effective_from, effective_to'],
  ['idx_ai_model_compliance_model', 'plus_ai_model_compliance_profile', 'model_id'],
  ['idx_ai_model_compliance_channel_key', 'plus_ai_model_compliance_profile', 'channel, model_key'],
  ['idx_ai_model_compliance_standard', 'plus_ai_model_compliance_profile', 'standard_code'],
  ['idx_ai_model_compliance_level', 'plus_ai_model_compliance_profile', 'level'],
  ['idx_ai_model_compliance_status', 'plus_ai_model_compliance_profile', 'status'],
  ['idx_ai_model_compliance_valid', 'plus_ai_model_compliance_profile', 'valid_from, valid_to'],
  ['idx_model_channel', 'plus_ai_model_info', 'channel'],
  ['idx_model_type', 'plus_ai_model_info', 'model_type'],
  ['idx_model_status', 'plus_ai_model_info', 'status'],
  ['idx_model_family', 'plus_ai_model_info', 'family'],
  ['idx_model_vendor', 'plus_ai_model_info', 'vendor'],
  ['idx_model_model_id', 'plus_ai_model_info', 'model_id'],
  ['idx_model_model_key', 'plus_ai_model_info', 'model_key'],
  ['idx_model_pricing_type', 'plus_ai_model_info', 'pricing_type'],
  ['idx_model_lifecycle_stage', 'plus_ai_model_info', 'lifecycle_stage'],
  ['idx_model_release_date', 'plus_ai_model_info', 'release_date'],
  ['idx_model_context_tokens', 'plus_ai_model_info', 'context_tokens'],
  ['idx_model_support_reasoning', 'plus_ai_model_info', 'support_reasoning'],
  ['idx_model_support_multimodal', 'plus_ai_model_info', 'support_multimodal'],
  ['idx_model_popularity_score', 'plus_ai_model_info', 'popularity_score'],
  ['idx_model_price_model_id', 'plus_ai_model_price', 'model_id'],
  ['idx_model_price_channel_model_key', 'plus_ai_model_price', 'channel, model_key'],
  ['idx_model_price_product', 'plus_ai_model_price', 'product_code'],
  ['idx_model_price_feature', 'plus_ai_model_price', 'feature_code'],
  ['idx_model_price_effective_time', 'plus_ai_model_price', 'effective_from, effective_to'],
  ['idx_model_price_status', 'plus_ai_model_price', 'status'],
  [
    'idx_model_price_lookup',
    'plus_ai_model_price',
    'channel, model_key, product_code, feature_code, status, effective_from, effective_to, is_default',
  ],
  ['idx_ai_model_price_metric_price_rule', 'plus_ai_model_price_metric', 'price_rule_id'],
  ['idx_ai_model_price_metric_model', 'plus_ai_model_price_metric', 'model_id'],
  ['idx_ai_model_price_metric_channel_key', 'plus_ai_model_price_metric', 'channel, model_key'],
  [
    'idx_ai_model_price_metric_product_feature',
    'plus_ai_model_price_metric',
    'product_code, feature_code',
  ],
  [
    'idx_ai_model_price_metric_effective',
    'plus_ai_model_price_metric',
    'effective_from, effective_to',
  ],
  ['idx_ai_model_price_metric_status', 'plus_ai_model_price_metric', 'status'],
  ['idx_ai_model_taxonomy_type', 'plus_ai_model_taxonomy', 'type'],
  ['idx_ai_model_taxonomy_parent', 'plus_ai_model_taxonomy', 'parent_id'],
  ['idx_ai_model_taxonomy_status', 'plus_ai_model_taxonomy', 'status'],
  ['idx_ai_model_taxonomy_sort', 'plus_ai_model_taxonomy', 'sort_weight'],
  ['idx_ai_model_taxonomy_rel_model', 'plus_ai_model_taxonomy_rel', 'model_id'],
  ['idx_ai_model_taxonomy_rel_taxonomy', 'plus_ai_model_taxonomy_rel', 'taxonomy_id'],
  ['idx_ai_model_taxonomy_rel_type', 'plus_ai_model_taxonomy_rel', 'taxonomy_type'],
  ['idx_ai_model_taxonomy_rel_channel_key', 'plus_ai_model_taxonomy_rel', 'channel, model_key'],
  ['idx_ai_model_taxonomy_rel_code', 'plus_ai_model_taxonomy_rel', 'taxonomy_code'],
  ['idx_ai_tenant_model_policy_subject', 'plus_ai_tenant_model_policy', 'subject_type, subject_id'],
  ['idx_ai_tenant_model_policy_model', 'plus_ai_tenant_model_policy', 'channel, model_key'],
  ['idx_ai_tenant_model_policy_feature', 'plus_ai_tenant_model_policy', 'feature_code'],
  ['idx_ai_tenant_model_policy_effective', 'plus_ai_tenant_model_policy', 'effective_from, effective_to'],
  ['idx_ai_tenant_model_policy_priority', 'plus_ai_tenant_model_policy', 'enabled, priority'],
  ['idx_ai_tenant_model_policy_status', 'plus_ai_tenant_model_policy', 'status'],
  ['uk_ai_agent_user_id_name', 'plus_ai_agent', 'tenant_id, organization_id, user_id, name'],
  ['idx_prompt_cate_id', 'plus_ai_prompt', 'cate_id'],
  ['idx_prompt_type', 'plus_ai_prompt', 'type'],
  ['idx_prompt_biz_type', 'plus_ai_prompt', 'biz_type'],
  ['idx_prompt_enabled', 'plus_ai_prompt', 'enabled'],
  ['idx_prompt_model', 'plus_ai_prompt', 'model'],
  ['idx_prompt_created_at', 'plus_ai_prompt', 'created_at'],
  ['idx_prompt_history_user_id', 'plus_ai_prompt_history', 'user_id'],
  ['idx_prompt_history_prompt_id', 'plus_ai_prompt_history', 'prompt_id'],
  ['idx_prompt_history_created_at', 'plus_ai_prompt_history', 'created_at'],
  ['idx_category_shop_id', 'plus_category', 'shop_id'],
  ['idx_category_type_shop', 'plus_category', 'type, shop_id'],
  ['idx_plus_attribute_category_status', 'plus_attribute', 'category_id, status'],
  ['idx_plus_attribute_content_scope', 'plus_attribute', 'content_type, content_id, status'],
  ['idx_notification_receiver', 'plus_notification', 'receiver_id'],
  ['idx_notification_sender', 'plus_notification', 'sender_id'],
  ['idx_notification_group', 'plus_notification', 'group_id'],
  ['idx_notification_status', 'plus_notification', 'status'],
  ['idx_notification_type', 'plus_notification', 'type'],
  ['idx_notification_channel', 'plus_notification', 'channel_type'],
  ['idx_notification_tenant', 'plus_notification', 'tenant_id'],
  ['idx_notification_org', 'plus_notification', 'organization_id'],
  ['idx_notification_created', 'plus_notification', 'created_at'],
  ['idx_notification_content_notification', 'plus_notification_content', 'notification_id'],
  ['idx_notification_content_message_type', 'plus_notification_content', 'message_type'],
  ['idx_notification_content_status', 'plus_notification_content', 'status'],
  ['idx_notification_content_receiver', 'plus_notification_content', 'receiver_id'],
  ['idx_notification_content_group', 'plus_notification_content', 'group_id'],
  ['idx_notification_content_notification_type', 'plus_notification_content', 'type'],
  ['idx_notification_content_tenant', 'plus_notification_content', 'tenant_id'],
  ['idx_notification_content_org', 'plus_notification_content', 'organization_id'],
  ['idx_push_endpoint_user', 'plus_push_device_endpoint', 'user_id'],
  ['idx_push_endpoint_endpoint', 'plus_push_device_endpoint', 'endpoint_id'],
  ['idx_push_endpoint_installation', 'plus_push_device_endpoint', 'installation_id'],
  ['idx_push_endpoint_token', 'plus_push_device_endpoint', 'device_token'],
  ['idx_push_endpoint_status', 'plus_push_device_endpoint', 'status'],
  ['idx_push_endpoint_user_installation', 'plus_push_device_endpoint', 'user_id, installation_id'],
  ['idx_push_topic_user', 'plus_push_topic_subscription', 'user_id'],
  ['idx_push_topic_endpoint', 'plus_push_topic_subscription', 'endpoint_id'],
  ['idx_push_topic_topic', 'plus_push_topic_subscription', 'topic'],
  ['idx_push_topic_status', 'plus_push_topic_subscription', 'status'],
  ['idx_plus_conversation_user_id', 'plus_conversation', 'user_id'],
  ['idx_plus_conversation_agent_id', 'plus_conversation', 'agent_id'],
  ['idx_plus_conversation_status', 'plus_conversation', 'status'],
  ['idx_plus_conversation_channel_id', 'plus_conversation', 'channel_id'],
  ['idx_plus_conversation_user_sort', 'plus_conversation', 'user_id, pinned, sort_order, updated_at'],
  [
    'idx_plus_conversation_agent_user_updated_at',
    'plus_conversation',
    'agent_id, user_id, updated_at',
  ],
  ['idx_plus_conversation_last_interaction_time', 'plus_conversation', 'last_interaction_time'],
  ['idx_plus_chat_message_user_id', 'plus_chat_message', 'user_id'],
  ['idx_plus_chat_message_conversation_id', 'plus_chat_message', 'conversation_id'],
  ['idx_plus_chat_message_status', 'plus_chat_message', 'status'],
  ['idx_plus_chat_message_sender_id', 'plus_chat_message', 'sender_id'],
  ['idx_plus_chat_message_receiver_id', 'plus_chat_message', 'receiver_id'],
  ['idx_plus_chat_message_group_id', 'plus_chat_message', 'group_id'],
  ['idx_plus_chat_message_parent_message_id', 'plus_chat_message', 'parent_message_id'],
  ['idx_plus_chat_message_channel_msg_id', 'plus_chat_message', 'channel_msg_id'],
  ['idx_plus_chat_message_created_at', 'plus_chat_message', 'created_at'],
  ['idx_plus_chat_message_content_channel_msg_id', 'plus_chat_message_content', 'channel_msg_id'],
  ['idx_plus_chat_message_content_conversation_id', 'plus_chat_message_content', 'conversation_id'],
  ['idx_plus_chat_message_content_status', 'plus_chat_message_content', 'status'],
  ['idx_collection_parent', 'plus_collection', 'parent_id'],
  ['idx_collection_type', 'plus_collection', 'type'],
  ['idx_collection_user', 'plus_collection', 'user_id'],
  ['idx_collection_content', 'plus_collection', 'content_id'],
  ['idx_collection_created', 'plus_collection', 'created_at'],
  ['idx_coll_item_collection', 'plus_collection_item', 'collection_id'],
  ['idx_coll_item_content_type', 'plus_collection_item', 'content_type'],
  ['idx_coll_item_content_id', 'plus_collection_item', 'content_id'],
  ['idx_coll_item_position', 'plus_collection_item', 'position'],
  ['idx_coll_item_created', 'plus_collection_item', 'created_at'],
  ['idx_favorite_user_id', 'plus_favorite', 'user_id'],
  ['idx_favorite_content', 'plus_favorite', 'content_type, content_id'],
  ['idx_favorite_folder_id', 'plus_favorite', 'folder_id'],
  ['idx_favorite_created_at', 'plus_favorite', 'created_at'],
  ['idx_folder_user', 'plus_favorite_folder', 'user_id'],
  ['idx_folder_parent', 'plus_favorite_folder', 'parent_id'],
  ['idx_share_id', 'plus_share_visit_record', 'share_id'],
  ['idx_ip_address', 'plus_share_visit_record', 'ip_address'],
  ['idx_created_at', 'plus_share_visit_record', 'created_at'],
  ['idx_sns_follow_rel_follower_id', 'plus_sns_follow_relation', 'follower_id'],
  ['idx_sns_follow_rel_following_id', 'plus_sns_follow_relation', 'following_id'],
  ['idx_sns_follow_rel_relation_type', 'plus_sns_follow_relation', 'relation_type'],
  ['idx_sns_follow_rel_owner_id', 'plus_sns_follow_relation', 'owner_id'],
  ['idx_sns_follow_rel_is_mutual', 'plus_sns_follow_relation', 'is_mutual'],
  ['idx_sns_follow_rel_is_blocked', 'plus_sns_follow_relation', 'is_blocked'],
  ['idx_sns_follow_rel_is_special', 'plus_sns_follow_relation', 'is_special'],
  ['idx_sns_follow_rel_created_at', 'plus_sns_follow_relation', 'created_at'],
  ['idx_sns_follow_stat_user_id', 'plus_sns_follow_statistics', 'user_id'],
  ['idx_sns_follow_stat_owner_id', 'plus_sns_follow_statistics', 'owner_id'],
  ['idx_sns_follow_stat_following_count', 'plus_sns_follow_statistics', 'following_count'],
  ['idx_sns_follow_stat_follower_count', 'plus_sns_follow_statistics', 'follower_count'],
  ['idx_sns_follow_stat_mutual_count', 'plus_sns_follow_statistics', 'mutual_count'],
  ['idx_comment_content_id_type', 'plus_comments', 'content_id, content_type'],
  ['idx_comment_user_id', 'plus_comments', 'user_id'],
  ['idx_comment_status', 'plus_comments', 'status'],
  ['idx_comment_parent_id', 'plus_comments', 'parent_id'],
  ['idx_vote_content', 'plus_content_vote', 'content_type, content_id'],
  ['idx_vote_rating', 'plus_content_vote', 'rating'],
  ['idx_vote_created_at', 'plus_content_vote', 'created_at'],
  ['idx_visit_user_content', 'plus_visit_history', 'user_id, content_type, content_id'],
  ['idx_visit_user_id', 'plus_visit_history', 'user_id'],
  ['idx_visit_content_type', 'plus_visit_history', 'content_type'],
  ['idx_visit_created_at', 'plus_visit_history', 'created_at'],
  ['idx_feeds_status', 'plus_feeds', 'status'],
  ['idx_feeds_user_id', 'plus_feeds', 'user_id'],
  ['idx_feeds_category_id', 'plus_feeds', 'category_id'],
  ['idx_feeds_content_type', 'plus_feeds', 'content_type'],
  ['idx_feeds_publish_time', 'plus_feeds', 'publish_time'],
  ['idx_feeds_status_publish_time', 'plus_feeds', 'status, publish_time'],
  ['idx_feedback_user_id', 'plus_feedback', 'user_id'],
  ['idx_feedback_status', 'plus_feedback', 'status'],
  ['idx_feedback_type', 'plus_feedback', 'feedback_type'],
  ['idx_feedback_created_at', 'plus_feedback', 'created_at'],
  ['idx_feedback_status_created', 'plus_feedback', 'status, created_at'],
  ['idx_plus_email_message_user_created', 'plus_email_message', 'user_id, created_at'],
  ['idx_plus_email_message_user_folder', 'plus_email_message', 'user_id, folder'],
  ['idx_plus_email_message_user_read', 'plus_email_message', 'user_id, is_read'],
  ['idx_plus_disk_name', 'plus_disk', 'name'],
  ['idx_plus_disk_owner_id', 'plus_disk', 'owner_id'],
  ['idx_plus_disk_knowledge_base_id', 'plus_disk', 'knowledge_base_id'],
  ['idx_disk_member_disk_id', 'plus_disk_member', 'disk_id'],
  ['idx_disk_member_user_id', 'plus_disk_member', 'user_id'],
  ['idx_disk_member_pinned_at', 'plus_disk_member', 'pinned_at'],
  ['idx_disk_member_knowledge_base_id', 'plus_disk_member', 'knowledge_base_id'],
  ['idx_file_name', 'plus_file', 'name'],
  ['idx_file_object_key', 'plus_file', 'object_key'],
  ['idx_file_project_uuid', 'plus_file', 'project_uuid'],
  ['idx_file_access_scope', 'plus_file', 'access_scope'],
  ['idx_file_prompt_uuid', 'plus_file', 'prompt_uuid'],
  ['idx_file_user_id', 'plus_file', 'user_id'],
  ['idx_plus_file_content_file_id', 'plus_file_content', 'file_id, file_version'],
  ['idx_plus_file_content_file_uuid', 'plus_file_content', 'file_uuid, file_version'],
  ['idx_oss_bucket_name', 'plus_oss_bucket', 'name'],
  ['idx_oss_bucket_user_id', 'plus_oss_bucket', 'user_id'],
  ['idx_oss_bucket_region', 'plus_oss_bucket', 'region'],
]) {
  assert.ok(
    codingServerMigration.sqlByProvider.sqlite.includes(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnNames});`,
    ),
    `SQLite ${tableName}.${columnNames} must preserve Java index ${indexName}.`,
  );
}

assertSqliteLongIdentifierColumns(sqliteWorkspaceMigration, 'plus_workspace', {
  id: 'INTEGER PRIMARY KEY',
  owner_id: 'INTEGER NOT NULL',
});
assert.match(
  sqliteWorkspaceMigration,
  /\bdescription TEXT(?:,|\))/,
  'SQLite workspaces.description must stay nullable like PlusWorkspace.description.',
);
assert.doesNotMatch(
  sqliteWorkspaceMigration,
  /\bdescription TEXT NOT NULL\b/,
  'SQLite workspaces.description must not be generated as NOT NULL.',
);

const sqliteProjectMigration = codingServerMigration.sqlByProvider.sqlite?.find((statement) =>
  statement.includes('CREATE TABLE IF NOT EXISTS plus_project'),
);
assert.ok(sqliteProjectMigration, 'SQLite coding server migration must declare plus_project.');
assertSqliteLongIdentifierColumns(sqliteProjectMigration, 'plus_project', {
  id: 'INTEGER PRIMARY KEY',
  user_id: 'INTEGER NULL',
  parent_id: 'INTEGER NULL',
  file_id: 'INTEGER NULL',
  conversation_id: 'INTEGER NULL',
  workspace_id: 'INTEGER NULL',
  leader_id: 'INTEGER NULL',
  budget_amount: 'INTEGER NULL',
});
assert.match(
  sqliteProjectMigration,
  /\buuid TEXT NOT NULL UNIQUE\b/,
  'SQLite plus_project.uuid must match PlusBaseEntity uuid uniqueness.',
);
assert.match(
  sqliteProjectMigration,
  /\bv INTEGER NOT NULL DEFAULT 0\b/,
  'SQLite plus_project.v must match PlusBaseEntity optimistic-lock column.',
);
for (const [columnName, columnDefinition] of [
  ['name', 'TEXT NOT NULL'],
  ['title', 'TEXT NOT NULL'],
  ['code', 'TEXT NOT NULL'],
  ['cover_image', 'TEXT(?: NULL)?'],
  ['parent_metadata', 'TEXT(?: NULL)?'],
  ['type', 'INTEGER NOT NULL'],
  ['status', 'INTEGER NOT NULL'],
  ['is_deleted', 'INTEGER NOT NULL'],
  ['is_template', 'INTEGER NOT NULL'],
]) {
  assert.match(
    sqliteProjectMigration,
    new RegExp(`\\b${columnName} ${columnDefinition}\\b`),
    `SQLite plus_project.${columnName} must match Java PlusProject storage.`,
  );
}
for (const forbiddenColumnName of ['version', 'root_path', 'cover_image_json', 'owner_id', 'created_by_user_id']) {
  assert.doesNotMatch(
    sqliteProjectMigration,
    new RegExp(`\\b${forbiddenColumnName}\\b`),
    `SQLite plus_project must not retain non-Java column ${forbiddenColumnName}.`,
  );
}
for (const [indexName, columnNames] of [
  ['uk_plus_project_name', 'name'],
  ['uk_plus_project_code', 'code'],
]) {
  assert.ok(
    codingServerMigration.sqlByProvider.sqlite?.includes(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON plus_project (${columnNames});`,
    ),
    `SQLite plus_project must expose Java unique key ${indexName}.`,
  );
}
const sqliteProjectContentMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'plus_project_content',
);
assert.ok(
  sqliteProjectContentMigration,
  'SQLite coding server migration must declare plus_project_content.',
);
assertSqliteLongIdentifierColumns(sqliteProjectContentMigration, 'plus_project_content', {
  id: 'INTEGER PRIMARY KEY',
  user_id: 'INTEGER NULL',
  parent_id: 'INTEGER NULL',
  project_id: 'INTEGER NOT NULL',
});
for (const [columnName, columnDefinition] of [
  ['uuid', 'TEXT NOT NULL UNIQUE'],
  ['v', 'INTEGER NOT NULL DEFAULT 0'],
  ['project_uuid', 'TEXT NOT NULL'],
  ['config_data', 'TEXT(?: NULL)?'],
  ['content_data', 'TEXT(?: NULL)?'],
  ['metadata', 'TEXT(?: NULL)?'],
  ['content_version', 'TEXT NOT NULL'],
  ['content_hash', 'TEXT(?: NULL)?'],
]) {
  assert.match(
    sqliteProjectContentMigration,
    new RegExp(`\\b${columnName} ${columnDefinition}\\b`),
    `SQLite plus_project_content.${columnName} must match Java PlusProjectContent storage.`,
  );
}
for (const [indexName, columnNames] of [
  ['idx_plus_project_content_project_id', 'project_id'],
  ['idx_plus_project_content_project_uuid', 'project_uuid'],
]) {
  assert.ok(
    codingServerMigration.sqlByProvider.sqlite?.includes(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON plus_project_content (${columnNames});`,
    ),
    `SQLite plus_project_content must preserve Java index ${indexName}.`,
  );
}
assert.equal(
  codingServerMigration.sqlByProvider.sqlite?.some((statement) =>
    statement.includes('CREATE TABLE IF NOT EXISTS workspaces'),
  ),
  false,
  'SQLite coding server migration must not emit the legacy workspaces physical table.',
);
assert.equal(
  codingServerMigration.sqlByProvider.sqlite?.some((statement) =>
    statement.includes('CREATE TABLE IF NOT EXISTS projects'),
  ),
  false,
  'SQLite coding server migration must not emit the legacy projects physical table.',
);
assert.match(
  sqliteProjectMigration,
  /\btenant_id INTEGER NOT NULL DEFAULT 0\b/,
  'SQLite scoped migrations must store tenant_id as Java Long-compatible integer with default 0.',
);
assert.match(
  sqliteProjectMigration,
  /\borganization_id INTEGER NOT NULL DEFAULT 0\b/,
  'SQLite scoped migrations must store organization_id as Java Long-compatible integer with default 0.',
);
assert.match(
  sqliteProjectMigration,
  /\bdata_scope INTEGER NOT NULL DEFAULT 1\b/,
  'SQLite scoped migrations must store PlusDataScope.PRIVATE as integer value 1 by default.',
);
assert.doesNotMatch(
  sqliteProjectMigration,
  /\b(?:tenant_id|organization_id|data_scope) TEXT NOT NULL\b/,
  'SQLite scoped migrations must not generate text scoped columns.',
);

const sqliteTeamMigration = findCreateTableStatement(codingServerMigration, 'sqlite', 'teams');
assert.ok(sqliteTeamMigration, 'SQLite coding server migration must declare teams.');
assertSqliteLongIdentifierColumns(sqliteTeamMigration, 'teams', {
  id: 'INTEGER PRIMARY KEY',
  workspace_id: 'INTEGER NOT NULL',
});

const sqliteTeamMemberMigration = findCreateTableStatement(
  codingServerMigration,
  'sqlite',
  'team_members',
);
assert.ok(sqliteTeamMemberMigration, 'SQLite coding server migration must declare team_members.');
assertSqliteLongIdentifierColumns(sqliteTeamMemberMigration, 'team_members', {
  id: 'INTEGER PRIMARY KEY',
  team_id: 'INTEGER NOT NULL',
});

const postgresProjectMigration = codingServerMigration.sqlByProvider.postgresql?.find((statement) =>
  statement.includes('CREATE TABLE IF NOT EXISTS plus_project'),
);
assert.ok(postgresProjectMigration, 'PostgreSQL coding server migration must declare plus_project.');
const postgresWorkspaceMigration = findCreateTableStatement(codingServerMigration, 'postgresql', 'plus_workspace');
assert.ok(postgresWorkspaceMigration, 'PostgreSQL coding server migration must declare plus_workspace.');
const postgresOrganizationMigration = findCreateTableStatement(codingServerMigration, 'postgresql', 'plus_organization');
assert.ok(postgresOrganizationMigration, 'PostgreSQL coding server migration must declare plus_organization.');
assert.match(
  postgresOrganizationMigration,
  /\bid BIGINT PRIMARY KEY\b/,
  'PostgreSQL plus_organization.id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresOrganizationMigration,
  /\btenant_id BIGINT NOT NULL DEFAULT 0\b/,
  'PostgreSQL plus_organization.tenant_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresOrganizationMigration,
  /\borganization_id BIGINT NOT NULL DEFAULT 0\b/,
  'PostgreSQL plus_organization.organization_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresOrganizationMigration,
  /\bparent_id BIGINT NULL\b/,
  'PostgreSQL plus_organization.parent_id must use Java Long-compatible bigint storage.',
);
const postgresOrganizationMemberMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_organization_member',
);
assert.ok(
  postgresOrganizationMemberMigration,
  'PostgreSQL coding server migration must declare plus_organization_member.',
);
assert.match(
  postgresOrganizationMemberMigration,
  /\buser_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_organization_member.user_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresOrganizationMemberMigration,
  /\bowner_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_organization_member.owner_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresOrganizationMemberMigration,
  /\bowner INTEGER NOT NULL\b/,
  'PostgreSQL plus_organization_member.owner must store converter values as integer.',
);
const postgresMemberRelationsMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_member_relations',
);
assert.ok(
  postgresMemberRelationsMigration,
  'PostgreSQL coding server migration must declare plus_member_relations.',
);
assert.match(
  postgresMemberRelationsMigration,
  /\bmember_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_member_relations.member_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresMemberRelationsMigration,
  /\btarget_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_member_relations.target_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresMemberRelationsMigration,
  /\brelation_type INTEGER NOT NULL\b/,
  'PostgreSQL plus_member_relations.relation_type must store converter values as integer.',
);
const postgresDepartmentMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_department',
);
assert.ok(postgresDepartmentMigration, 'PostgreSQL coding server migration must declare plus_department.');
assert.match(
  postgresDepartmentMigration,
  /\bowner_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_department.owner_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresDepartmentMigration,
  /\bmanager_id BIGINT NULL\b/,
  'PostgreSQL plus_department.manager_id must use Java Long-compatible bigint storage.',
);
const postgresPositionMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_position',
);
assert.ok(postgresPositionMigration, 'PostgreSQL coding server migration must declare plus_position.');
assert.match(
  postgresPositionMigration,
  /\bowner_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_position.owner_id must use Java Long-compatible bigint storage.',
);
const postgresRoleMigration = findCreateTableStatement(codingServerMigration, 'postgresql', 'plus_role');
assert.ok(postgresRoleMigration, 'PostgreSQL coding server migration must declare plus_role.');
assert.match(
  postgresRoleMigration,
  /\bstatus INTEGER NOT NULL DEFAULT 1\b/,
  'PostgreSQL plus_role.status must store RoleStatus converter values as integer.',
);
const postgresPermissionMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_permission',
);
assert.ok(postgresPermissionMigration, 'PostgreSQL coding server migration must declare plus_permission.');
assert.match(
  postgresPermissionMigration,
  /\bstatus INTEGER NOT NULL\b/,
  'PostgreSQL plus_permission.status must store PermissionStatus converter values as integer.',
);
const postgresRolePermissionMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_role_permission',
);
assert.ok(
  postgresRolePermissionMigration,
  'PostgreSQL coding server migration must declare plus_role_permission.',
);
assert.match(
  postgresRolePermissionMigration,
  /\brole_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_role_permission.role_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresRolePermissionMigration,
  /\bpermission_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_role_permission.permission_id must use Java Long-compatible bigint storage.',
);
assert.doesNotMatch(
  postgresRolePermissionMigration,
  /\b(?:tenant_id|organization_id|data_scope|version|is_deleted)\b/,
  'PostgreSQL plus_role_permission must follow Java join-table columns and not emit scoped/base extras.',
);
const postgresUserRoleMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_user_role',
);
assert.ok(postgresUserRoleMigration, 'PostgreSQL coding server migration must declare plus_user_role.');
assert.match(
  postgresUserRoleMigration,
  /\buser_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_user_role.user_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresUserRoleMigration,
  /\brole_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_user_role.role_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresUserRoleMigration,
  /\bPRIMARY KEY \(user_id, role_id\)/,
  'PostgreSQL plus_user_role must preserve Java composite primary key user_id, role_id.',
);
assert.doesNotMatch(
  postgresUserRoleMigration,
  /\b(?:tenant_id|organization_id|data_scope|version|is_deleted)\b/,
  'PostgreSQL plus_user_role must follow Java join-table columns and not emit scoped/base extras.',
);
const postgresUserMigration = findCreateTableStatement(codingServerMigration, 'postgresql', 'plus_user');
assert.ok(postgresUserMigration, 'PostgreSQL coding server migration must declare plus_user.');
assert.match(
  postgresUserMigration,
  /\bid BIGINT PRIMARY KEY\b/,
  'PostgreSQL plus_user.id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresUserMigration,
  /\btenant_id BIGINT NOT NULL DEFAULT 0\b/,
  'PostgreSQL plus_user.tenant_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresUserMigration,
  /\borganization_id BIGINT NOT NULL DEFAULT 0\b/,
  'PostgreSQL plus_user.organization_id must use Java Long-compatible bigint storage.',
);
const postgresOAuthAccountMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_oauth_account',
);
assert.ok(
  postgresOAuthAccountMigration,
  'PostgreSQL coding server migration must declare plus_oauth_account.',
);
assert.match(
  postgresOAuthAccountMigration,
  /\buser_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_oauth_account.user_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresOAuthAccountMigration,
  /\bchannel_account_id BIGINT NULL\b/,
  'PostgreSQL plus_oauth_account.channel_account_id must use Java Long-compatible bigint storage.',
);
assert.ok(
  codingServerMigration.sqlByProvider.postgresql?.some((statement) =>
    statement.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_auth_relations_openid ON plus_oauth_account (oauth_provider, open_id)',
    ),
  ),
  'PostgreSQL plus_oauth_account must preserve Java unique provider/open_id constraint.',
);
assert.ok(
  codingServerMigration.sqlByProvider.postgresql?.some((statement) =>
    statement.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_auth_relations_unionid ON plus_oauth_account (oauth_provider, union_id)',
    ),
  ),
  'PostgreSQL plus_oauth_account must preserve Java unique provider/union_id constraint.',
);
const postgresUserAddressMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_user_address',
);
assert.ok(
  postgresUserAddressMigration,
  'PostgreSQL coding server migration must declare plus_user_address.',
);
assert.match(
  postgresUserAddressMigration,
  /\buser_id BIGINT NOT NULL\b/,
  'PostgreSQL plus_user_address.user_id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresUserAddressMigration,
  /\bis_default BOOLEAN NOT NULL\b/,
  'PostgreSQL plus_user_address.is_default must use Java Boolean-compatible boolean storage.',
);

const postgresLongIdentifierColumnsByTable = {
  plus_tenant: { id: 'BIGINT PRIMARY KEY', biz_id: 'BIGINT NULL', admin_user_id: 'BIGINT NULL' },
  plus_account: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    owner_id: 'BIGINT NOT NULL',
  },
  plus_account_history: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    account_id: 'BIGINT NOT NULL',
    related_account_id: 'BIGINT NULL',
  },
  plus_account_exchange_config: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_ledger_bridge: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
  },
  plus_card: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    card_organization_id: 'BIGINT NULL',
  },
  plus_user_card: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    card_id: 'BIGINT NULL',
  },
  plus_member_card: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    card_id: 'BIGINT NULL',
  },
  plus_member_level: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    card_id: 'BIGINT NULL',
    required_points: 'BIGINT NULL',
  },
  plus_card_template: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_coupon: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    point_cost: 'BIGINT NULL',
  },
  plus_coupon_template: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_user_coupon: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    coupon_id: 'BIGINT NOT NULL',
    point_cost: 'BIGINT NULL',
    order_id: 'BIGINT NULL',
  },
  plus_order: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    owner_id: 'BIGINT NOT NULL',
    user_id: 'BIGINT NOT NULL',
    worker_user_id: 'BIGINT NULL',
    dispatcher_user_id: 'BIGINT NULL',
    content_id: 'BIGINT NULL',
    category_id: 'BIGINT NOT NULL',
  },
  plus_order_item: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    order_id: 'BIGINT NOT NULL',
    category_id: 'BIGINT NOT NULL',
    product_id: 'BIGINT NOT NULL',
    sku_id: 'BIGINT NOT NULL',
    content_id: 'BIGINT NULL',
  },
  plus_payment: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    order_id: 'BIGINT NOT NULL',
    content_id: 'BIGINT NULL',
  },
  plus_refund: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    order_id: 'BIGINT NOT NULL',
    payment_id: 'BIGINT NOT NULL',
    content_id: 'BIGINT NULL',
    operator_id: 'BIGINT NULL',
  },
  plus_shopping_cart: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    owner_id: 'BIGINT NOT NULL',
  },
  plus_shopping_cart_item: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    cart_id: 'BIGINT NOT NULL',
    product_id: 'BIGINT NOT NULL',
    sku_id: 'BIGINT NOT NULL',
  },
  plus_payment_webhook_event: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    request_timestamp: 'BIGINT NULL',
  },
  plus_order_dispatch_rule: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_order_worker_dispatch_profile: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
  },
  plus_vip_user: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    vip_level_id: 'BIGINT NULL',
  },
  plus_vip_level: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_vip_benefit: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_vip_level_benefit: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    vip_level_id: 'BIGINT NOT NULL',
    benefit_id: 'BIGINT NOT NULL',
  },
  plus_vip_pack_group: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    app_id: 'BIGINT NULL',
    scope_id: 'BIGINT NOT NULL',
  },
  plus_vip_pack: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    app_id: 'BIGINT NULL',
    group_id: 'BIGINT NULL',
    vip_level_id: 'BIGINT NULL',
    recharge_pack_id: 'BIGINT NULL',
  },
  plus_vip_recharge_method: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_vip_recharge_pack: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    app_id: 'BIGINT NULL',
  },
  plus_vip_recharge: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    vip_level_id: 'BIGINT NULL',
    recharge_method_id: 'BIGINT NULL',
    recharge_pack_id: 'BIGINT NULL',
  },
  plus_vip_point_change: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    source_id: 'BIGINT NULL',
  },
  plus_vip_benefit_usage: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    source_id: 'BIGINT NULL',
  },
  plus_agent_plugin: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_datasource: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    project_id: 'BIGINT NOT NULL',
  },
  plus_schema: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    datasource_id: 'BIGINT NOT NULL',
  },
  plus_table: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    schema_id: 'BIGINT NOT NULL',
    row_count: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_column: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    table_id: 'BIGINT NOT NULL',
  },
  plus_ai_generation: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    conversation_id: 'BIGINT NULL',
    message_id: 'BIGINT NULL',
    parent_id: 'BIGINT NULL',
    biz_id: 'BIGINT NULL',
  },
  plus_ai_generation_content: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    generation_id: 'BIGINT NOT NULL DEFAULT 0',
    content_id: 'BIGINT NULL',
    seed: 'BIGINT NULL',
    file_size: 'BIGINT NULL',
  },
  plus_ai_generation_style: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
  },
  plus_channel: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
  },
  plus_channel_account: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
  },
  plus_channel_proxy: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
  },
  plus_channel_resource: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    channel_account_id: 'BIGINT NOT NULL',
  },
  plus_api_key: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
  },
  plus_app: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    project_id: 'BIGINT NULL',
  },
  plus_ai_model_availability: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    model_id: 'BIGINT NULL',
  },
  plus_ai_model_compliance_profile: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    model_id: 'BIGINT NULL',
  },
  plus_ai_model_info: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_ai_model_price: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    model_id: 'BIGINT NULL',
  },
  plus_ai_model_price_metric: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    price_rule_id: 'BIGINT NOT NULL',
    model_id: 'BIGINT NULL',
  },
  plus_ai_model_taxonomy: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    parent_id: 'BIGINT NULL',
  },
  plus_ai_model_taxonomy_rel: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    model_id: 'BIGINT NOT NULL',
    taxonomy_id: 'BIGINT NOT NULL',
  },
  plus_ai_tenant_model_policy: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    subject_id: 'BIGINT NULL',
    model_id: 'BIGINT NULL',
  },
  plus_ai_agent_tool_relation: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    agent_id: 'BIGINT NOT NULL',
    tool_id: 'BIGINT NOT NULL',
  },
  plus_ai_agent: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    owner_id: 'BIGINT NOT NULL',
    biz_type: 'BIGINT NULL',
    cate_id: 'BIGINT NULL',
    prompt_id: 'BIGINT NULL',
  },
  plus_ai_prompt: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    cate_id: 'BIGINT NULL',
    usage_count: 'BIGINT NULL',
    avg_response_time: 'BIGINT NULL',
  },
  plus_ai_prompt_history: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    prompt_id: 'BIGINT NULL',
    duration: 'BIGINT NULL',
  },
  plus_ai_tool: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    owner_id: 'BIGINT NOT NULL',
  },
  plus_api_security_policy: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_category: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    parent_id: 'BIGINT NULL',
    shop_id: 'BIGINT NOT NULL',
  },
  plus_attribute: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    content_id: 'BIGINT NOT NULL',
    category_id: 'BIGINT NOT NULL',
  },
  plus_tags: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
  },
  plus_memory: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    agent_id: 'BIGINT NULL',
    conversation_id: 'BIGINT NULL',
  },
  plus_memory_item: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    agent_id: 'BIGINT NULL',
    conversation_id: 'BIGINT NULL',
  },
  plus_notification: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    sender_id: 'BIGINT NULL',
    receiver_id: 'BIGINT NULL',
    group_id: 'BIGINT NULL',
  },
  plus_notification_content: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    notification_id: 'BIGINT NOT NULL',
    sender_id: 'BIGINT NULL',
    receiver_id: 'BIGINT NULL',
    group_id: 'BIGINT NULL',
  },
  plus_push_device_endpoint: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    workspace_id: 'BIGINT NULL',
  },
  plus_push_topic_subscription: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
  },
  plus_conversation: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    agent_id: 'BIGINT NULL',
    agent_biz_type: 'BIGINT NULL',
    last_message_id: 'BIGINT NULL',
    content_id: 'BIGINT NULL',
    model_id: 'BIGINT NULL',
    knowledge_base_id: 'BIGINT NULL',
    data_source_id: 'BIGINT NULL',
  },
  plus_chat_message: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    sender_id: 'BIGINT NULL',
    receiver_id: 'BIGINT NULL',
    group_id: 'BIGINT NULL',
    conversation_id: 'BIGINT NOT NULL',
    agent_id: 'BIGINT NULL',
    knowledge_base_id: 'BIGINT NULL',
    datasource_id: 'BIGINT NULL',
    agent_biz_type: 'BIGINT NULL',
    user_id: 'BIGINT NULL',
    channel_msg_seq: 'BIGINT NULL',
    parent_message_id: 'BIGINT NULL',
    processing_time: 'BIGINT NULL',
    model_id: 'BIGINT NULL',
  },
  plus_chat_message_content: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    message_id: 'BIGINT NOT NULL',
    conversation_id: 'BIGINT NOT NULL',
    agent_id: 'BIGINT NULL',
    agent_biz_type: 'BIGINT NULL',
  },
  plus_detail: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    content_id: 'BIGINT NOT NULL',
  },
  plus_collection: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    parent_id: 'BIGINT NULL',
    user_id: 'BIGINT NULL',
    content_id: 'BIGINT NULL',
  },
  plus_collection_item: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    collection_id: 'BIGINT NOT NULL',
    content_id: 'BIGINT NOT NULL',
  },
  plus_favorite: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    content_id: 'BIGINT NOT NULL',
    folder_id: 'BIGINT NULL',
  },
  plus_favorite_folder: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    parent_id: 'BIGINT NULL',
  },
  plus_share: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
  },
  plus_share_visit_record: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    share_id: 'BIGINT NOT NULL',
  },
  plus_invitation_code: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    creator_user_id: 'BIGINT NOT NULL',
  },
  plus_invitation_relation: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    inviter_user_id: 'BIGINT NOT NULL',
    invitee_user_id: 'BIGINT NOT NULL',
  },
  plus_sns_follow_relation: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    follower_id: 'BIGINT NOT NULL',
    following_id: 'BIGINT NOT NULL',
    owner_id: 'BIGINT NOT NULL',
  },
  plus_sns_follow_statistics: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
    owner_id: 'BIGINT NOT NULL',
    following_count: 'BIGINT NOT NULL',
    follower_count: 'BIGINT NOT NULL',
    mutual_count: 'BIGINT NOT NULL',
    special_count: 'BIGINT NOT NULL',
    blocked_count: 'BIGINT NOT NULL',
    total_interaction_count: 'BIGINT NOT NULL',
    last_updated_at: 'BIGINT NULL',
  },
  plus_comments: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    parent_id: 'BIGINT NULL',
    user_id: 'BIGINT NULL',
    content_id: 'BIGINT NOT NULL',
  },
  plus_content_vote: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    content_id: 'BIGINT NOT NULL',
  },
  plus_visit_history: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    content_id: 'BIGINT NOT NULL',
  },
  plus_feeds: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    category_id: 'BIGINT NOT NULL',
    content_id: 'BIGINT NOT NULL',
    view_count: 'BIGINT NULL',
    like_count: 'BIGINT NULL',
    comment_count: 'BIGINT NULL',
    share_count: 'BIGINT NULL',
    favorite_count: 'BIGINT NULL',
  },
  plus_short_url: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    created_by: 'BIGINT NULL',
  },
  plus_feedback: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    biz_id: 'BIGINT NULL',
    reply_user_id: 'BIGINT NULL',
    closed_by: 'BIGINT NULL',
    assigned_to: 'BIGINT NULL',
  },
  plus_email_message: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NOT NULL',
  },
  plus_events: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
  },
  plus_disk: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    owner_id: 'BIGINT NOT NULL',
    knowledge_base_id: 'BIGINT NULL',
    disk_size: 'BIGINT NOT NULL',
    used_size: 'BIGINT NOT NULL',
  },
  plus_disk_member: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    disk_id: 'BIGINT NOT NULL',
    user_id: 'BIGINT NOT NULL',
    knowledge_base_id: 'BIGINT NULL',
  },
  plus_file: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    disk_id: 'BIGINT NOT NULL',
    size: 'BIGINT NULL',
    content_id: 'BIGINT NULL',
    biz_id: 'BIGINT NULL',
    workspace_id: 'BIGINT NULL',
    project_id: 'BIGINT NULL',
    generation_id: 'BIGINT NULL',
    owner_id: 'BIGINT NULL',
    channel_config_id: 'BIGINT NULL',
    parent_id: 'BIGINT NULL',
    reference_file_id: 'BIGINT NULL',
  },
  plus_file_content: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    file_id: 'BIGINT NOT NULL',
  },
  plus_file_part: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    file_id: 'BIGINT NOT NULL',
    chunk_size: 'BIGINT NOT NULL',
    total_size: 'BIGINT NOT NULL',
  },
  plus_oss_bucket: {
    id: 'BIGINT PRIMARY KEY',
    tenant_id: 'BIGINT NOT NULL DEFAULT 0',
    organization_id: 'BIGINT NOT NULL DEFAULT 0',
    user_id: 'BIGINT NULL',
    channel_config_id: 'BIGINT NULL',
  },
};

for (const [tableName, columns] of Object.entries(postgresLongIdentifierColumnsByTable)) {
  const statement = findCreateTableStatement(codingServerMigration, 'postgresql', tableName);
  for (const [columnName, columnDefinition] of Object.entries(columns)) {
    assert.match(
      statement,
      new RegExp(`\\b${columnName} ${columnDefinition}\\b`),
      `PostgreSQL ${tableName}.${columnName} must use Java Long-compatible bigint storage.`,
    );
  }
}

for (const tableName of [
  'plus_agent_plugin',
  'plus_datasource',
  'plus_schema',
  'plus_table',
  'plus_column',
  'plus_ai_generation',
  'plus_ai_generation_content',
  'plus_ai_generation_style',
]) {
  const statement = findCreateTableStatement(codingServerMigration, 'postgresql', tableName);
  assert.match(
    statement,
    /\buuid TEXT NOT NULL UNIQUE\b/,
    `PostgreSQL ${tableName}.uuid must preserve V104 NOT NULL UNIQUE bootstrap standard.`,
  );
  assert.match(
    statement,
    /\bv BIGINT NOT NULL DEFAULT 0\b/,
    `PostgreSQL ${tableName}.v must preserve PlusBaseEntity optimistic lock default 0.`,
  );
  assert.match(
    statement,
    /\bdata_scope INTEGER NOT NULL DEFAULT 0\b/,
    `PostgreSQL ${tableName}.data_scope must preserve V104 bootstrap default 0.`,
  );
}

for (const tableName of [
  'plus_channel',
  'plus_channel_account',
  'plus_channel_proxy',
  'plus_channel_resource',
  'plus_api_key',
  'plus_app',
  'plus_ai_model_availability',
  'plus_ai_model_compliance_profile',
  'plus_ai_model_info',
  'plus_ai_model_price',
  'plus_ai_model_price_metric',
  'plus_ai_model_taxonomy',
  'plus_ai_model_taxonomy_rel',
  'plus_ai_tenant_model_policy',
  'plus_ai_agent_tool_relation',
  'plus_ai_agent',
  'plus_ai_prompt',
  'plus_ai_prompt_history',
  'plus_ai_tool',
  'plus_api_security_policy',
  'plus_category',
  'plus_attribute',
  'plus_tags',
  'plus_memory',
  'plus_memory_item',
  'plus_notification',
  'plus_notification_content',
  'plus_push_device_endpoint',
  'plus_push_topic_subscription',
  'plus_conversation',
  'plus_chat_message',
  'plus_chat_message_content',
  'plus_detail',
  'plus_collection',
  'plus_collection_item',
  'plus_favorite',
  'plus_favorite_folder',
  'plus_share',
  'plus_share_visit_record',
  'plus_invitation_code',
  'plus_invitation_relation',
  'plus_sns_follow_relation',
  'plus_sns_follow_statistics',
  'plus_comments',
  'plus_content_vote',
  'plus_visit_history',
  'plus_feeds',
  'plus_short_url',
  'plus_feedback',
  'plus_email_message',
  'plus_events',
  'plus_disk',
  'plus_disk_member',
  'plus_file',
  'plus_file_content',
  'plus_file_part',
  'plus_oss_bucket',
]) {
  const statement = findCreateTableStatement(codingServerMigration, 'postgresql', tableName);
  assert.match(
    statement,
    /\buuid TEXT NOT NULL UNIQUE\b/,
    `PostgreSQL ${tableName}.uuid must preserve Java PlusBaseEntity NOT NULL UNIQUE standard.`,
  );
  assert.match(
    statement,
    /\bv BIGINT NOT NULL DEFAULT 0\b/,
    `PostgreSQL ${tableName}.v must preserve Java PlusBaseEntity optimistic lock default 0.`,
  );
  assert.match(
    statement,
    /\bdata_scope INTEGER NOT NULL DEFAULT 1\b/,
    `PostgreSQL ${tableName}.data_scope must preserve PlusDataScope.PRIVATE default 1.`,
  );
}

for (const [tableName, columnName, defaultValue] of [
  ['plus_agent_plugin', 'is_enabled', 'TRUE'],
  ['plus_schema', 'is_default', 'FALSE'],
  ['plus_column', 'is_nullable', 'TRUE'],
  ['plus_column', 'is_primary_key', 'FALSE'],
  ['plus_column', 'is_auto_increment', 'FALSE'],
  ['plus_ai_generation', 'is_public', 'FALSE'],
  ['plus_ai_generation_content', 'is_hd', 'FALSE'],
  ['plus_ai_generation_style', 'is_public', 'FALSE'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'postgresql', tableName),
    new RegExp(`\\b${columnName} BOOLEAN NOT NULL DEFAULT ${defaultValue}\\b`),
    `PostgreSQL ${tableName}.${columnName} must preserve V104 boolean default ${defaultValue}.`,
  );
}

for (const [tableName, columnName, storageType, defaultValue] of [
  ['plus_datasource', 'access_count', 'BIGINT', '0'],
  ['plus_schema', 'status', 'INTEGER', '1'],
  ['plus_schema', 'table_count', 'INTEGER', '0'],
  ['plus_table', 'column_count', 'INTEGER', '0'],
  ['plus_table', 'row_count', 'BIGINT', '0'],
  ['plus_ai_generation', 'progress', 'INTEGER', '0'],
  ['plus_ai_generation', 'retry_count', 'INTEGER', '0'],
  ['plus_ai_generation', 'max_retry', 'INTEGER', '3'],
  ['plus_ai_generation', 'view_count', 'INTEGER', '0'],
  ['plus_ai_generation', 'like_count', 'INTEGER', '0'],
  ['plus_ai_generation_content', 'generation_id', 'BIGINT', '0'],
  ['plus_ai_generation_style', 'usage_count', 'INTEGER', '0'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'postgresql', tableName),
    new RegExp(`\\b${columnName} ${storageType} NOT NULL DEFAULT ${defaultValue}\\b`),
    `PostgreSQL ${tableName}.${columnName} must preserve V104 ${storageType} default ${defaultValue}.`,
  );
}

assert.match(
  findCreateTableStatement(codingServerMigration, 'postgresql', 'plus_datasource'),
  /\bconnection_config TEXT NOT NULL\b/,
  'PostgreSQL plus_datasource.connection_config must preserve DataSourceConfigConverter TEXT NOT NULL storage.',
);
assert.match(
  findCreateTableStatement(codingServerMigration, 'postgresql', 'plus_ai_generation'),
  /\brequest_id TEXT NOT NULL UNIQUE\b/,
  'PostgreSQL plus_ai_generation.request_id must preserve V104 NOT NULL UNIQUE bootstrap standard.',
);
assert.match(
  findCreateTableStatement(codingServerMigration, 'postgresql', 'plus_ai_generation_style'),
  /\bstatus TEXT NOT NULL DEFAULT 'ACTIVE'/,
  'PostgreSQL plus_ai_generation_style.status must preserve V104 ACTIVE default.',
);

for (const [tableName, columnName] of [
  ['plus_account', 'available_balance'],
  ['plus_account', 'frozen_balance'],
  ['plus_account_history', 'amount'],
  ['plus_account_history', 'balance_before'],
  ['plus_account_history', 'balance_after'],
  ['plus_ledger_bridge', 'bridge_amount'],
  ['plus_card_template', 'minimum_balance'],
  ['plus_card_template', 'initial_balance'],
  ['plus_card_template', 'discount_rate'],
  ['plus_vip_pack', 'price'],
  ['plus_vip_recharge_pack', 'price'],
  ['plus_vip_recharge', 'amount'],
  ['plus_order', 'total_amount'],
  ['plus_order', 'paid_amount'],
  ['plus_order', 'product_amount'],
  ['plus_order', 'shipping_amount'],
  ['plus_order', 'discount_amount'],
  ['plus_order', 'tax_amount'],
  ['plus_order', 'refunded_amount'],
  ['plus_order_item', 'unit_price'],
  ['plus_order_item', 'total_amount'],
  ['plus_order_item', 'discount_amount'],
  ['plus_order_item', 'paid_amount'],
  ['plus_order_item', 'refunded_amount'],
  ['plus_payment', 'amount'],
  ['plus_refund', 'amount'],
  ['plus_shopping_cart_item', 'price'],
  ['plus_ai_generation', 'cost'],
  ['plus_ai_generation_content', 'cfg_scale'],
  ['plus_ai_generation_content', 'duration'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'postgresql', tableName),
    new RegExp(`\\b${columnName} NUMERIC\\b`),
    `PostgreSQL ${tableName}.${columnName} must use Java BigDecimal-compatible NUMERIC storage.`,
  );
}

for (const [tableName, columnName] of [
  ['plus_coupon', 'discount'],
  ['plus_coupon_template', 'discount'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'postgresql', tableName),
    new RegExp(`\\b${columnName} DOUBLE PRECISION\\b`),
    `PostgreSQL ${tableName}.${columnName} must use Java Double-compatible DOUBLE PRECISION storage.`,
  );
}

for (const [tableName, columnName, nullability] of [
  ['plus_card', 'card_type', 'NULL'],
  ['plus_card', 'code_type', 'NULL'],
  ['plus_card', 'status', 'NULL'],
  ['plus_member_level', 'status', 'NULL'],
  ['plus_card_template', 'card_type', 'NOT NULL'],
  ['plus_card_template', 'code_type', 'NULL'],
  ['plus_card_template', 'validity_type', 'NOT NULL'],
  ['plus_coupon', 'type', 'NOT NULL'],
  ['plus_coupon', 'status', 'NOT NULL'],
  ['plus_coupon', 'scope_type', 'NOT NULL'],
  ['plus_coupon_template', 'type', 'NOT NULL'],
  ['plus_coupon_template', 'status', 'NULL'],
  ['plus_coupon_template', 'validity_type', 'NULL'],
  ['plus_coupon_template', 'scope_type', 'NULL'],
  ['plus_user_coupon', 'acquire_type', 'NOT NULL'],
  ['plus_user_coupon', 'status', 'NOT NULL'],
  ['plus_order', 'order_type', 'NOT NULL'],
  ['plus_order', 'owner', 'NULL'],
  ['plus_order', 'status', 'NOT NULL'],
  ['plus_order', 'dispatch_mode', 'NULL'],
  ['plus_order', 'dispatch_status', 'NULL'],
  ['plus_order', 'content_type', 'NULL'],
  ['plus_order', 'refund_status', 'NULL'],
  ['plus_order', 'payment_provider', 'NULL'],
  ['plus_order_item', 'content_type', 'NULL'],
  ['plus_order_item', 'refund_status', 'NULL'],
  ['plus_order_item', 'review_status', 'NULL'],
  ['plus_order_item', 'payment_provider', 'NULL'],
  ['plus_payment', 'channel', 'NOT NULL'],
  ['plus_payment', 'provider', 'NOT NULL'],
  ['plus_payment', 'status', 'NOT NULL'],
  ['plus_payment', 'content_type', 'NULL'],
  ['plus_refund', 'channel', 'NULL'],
  ['plus_refund', 'provider', 'NULL'],
  ['plus_refund', 'status', 'NOT NULL'],
  ['plus_refund', 'content_type', 'NULL'],
  ['plus_shopping_cart', 'owner', 'NOT NULL'],
  ['plus_shopping_cart', 'status', 'NULL'],
  ['plus_payment_webhook_event', 'provider', 'NOT NULL'],
  ['plus_datasource', 'type', 'NOT NULL'],
  ['plus_datasource', 'status', 'NOT NULL'],
  ['plus_ai_generation', 'status', 'NOT NULL'],
  ['plus_ai_generation_content', 'content_type', 'NOT NULL'],
  ['plus_ai_generation_style', 'type', 'NOT NULL'],
  ['plus_channel', 'channel', 'NOT NULL'],
  ['plus_channel', 'status', 'NOT NULL'],
  ['plus_channel_account', 'channel', 'NOT NULL'],
  ['plus_channel_account', 'status', 'NOT NULL'],
  ['plus_channel_proxy', 'channel', 'NOT NULL'],
  ['plus_channel_proxy', 'proxy', 'NOT NULL'],
  ['plus_channel_proxy', 'status', 'NOT NULL'],
  ['plus_channel_resource', 'resource', 'NOT NULL'],
  ['plus_channel_resource', 'channel', 'NOT NULL'],
  ['plus_api_key', 'key_type', 'NOT NULL'],
  ['plus_api_key', 'owner', 'NULL'],
  ['plus_api_key', 'status', 'NOT NULL'],
  ['plus_app', 'status', 'NULL'],
  ['plus_app', 'app_type', 'NULL'],
  ['plus_ai_model_availability', 'status', 'NOT NULL'],
  ['plus_ai_model_info', 'channel', 'NULL'],
  ['plus_ai_model_info', 'vendor', 'NULL'],
  ['plus_ai_model_info', 'model_type', 'NULL'],
  ['plus_ai_model_info', 'status', 'NULL'],
  ['plus_ai_model_price_metric', 'status', 'NOT NULL'],
  ['plus_ai_model_taxonomy', 'status', 'NOT NULL'],
  ['plus_ai_tenant_model_policy', 'status', 'NOT NULL'],
  ['plus_ai_agent', 'owner', 'NULL'],
  ['plus_ai_agent', 'type', 'NOT NULL'],
  ['plus_ai_agent', 'biz_scope', 'NULL'],
  ['plus_ai_agent', 'status', 'NOT NULL'],
  ['plus_ai_tool', 'owner', 'NULL'],
  ['plus_ai_tool', 'type', 'NOT NULL'],
  ['plus_ai_tool', 'status', 'NOT NULL'],
  ['plus_category', 'type', 'NOT NULL'],
  ['plus_category', 'status', 'NOT NULL'],
  ['plus_attribute', 'type', 'NOT NULL'],
  ['plus_attribute', 'content_type', 'NOT NULL'],
  ['plus_attribute', 'status', 'NOT NULL'],
  ['plus_tags', 'type', 'NULL'],
  ['plus_memory_item', 'type', 'NULL'],
  ['plus_notification', 'role', 'NOT NULL'],
  ['plus_notification', 'type', 'NOT NULL'],
  ['plus_notification', 'channel_type', 'NOT NULL'],
  ['plus_notification', 'status', 'NOT NULL'],
  ['plus_notification_content', 'role', 'NOT NULL'],
  ['plus_notification_content', 'message_type', 'NOT NULL'],
  ['plus_notification_content', 'status', 'NOT NULL'],
  ['plus_notification_content', 'type', 'NOT NULL'],
  ['plus_notification_content', 'channel_type', 'NOT NULL'],
  ['plus_conversation', 'type', 'NULL'],
  ['plus_conversation', 'status', 'NOT NULL'],
  ['plus_conversation', 'agent_type', 'NULL'],
  ['plus_conversation', 'content_type', 'NULL'],
  ['plus_chat_message', 'role', 'NOT NULL'],
  ['plus_chat_message', 'type', 'NOT NULL'],
  ['plus_chat_message', 'status', 'NOT NULL'],
  ['plus_chat_message', 'conversation_type', 'NULL'],
  ['plus_chat_message', 'agent_type', 'NULL'],
  ['plus_chat_message_content', 'role', 'NOT NULL'],
  ['plus_chat_message_content', 'type', 'NOT NULL'],
  ['plus_chat_message_content', 'status', 'NOT NULL'],
  ['plus_chat_message_content', 'agent_type', 'NOT NULL'],
  ['plus_detail', 'content_type', 'NOT NULL'],
  ['plus_collection', 'type', 'NOT NULL'],
  ['plus_collection_item', 'type', 'NOT NULL'],
  ['plus_collection_item', 'content_type', 'NOT NULL'],
  ['plus_favorite', 'content_type', 'NOT NULL'],
  ['plus_favorite', 'status', 'NOT NULL'],
  ['plus_favorite_folder', 'status', 'NOT NULL'],
  ['plus_invitation_code', 'status', 'NOT NULL'],
  ['plus_invitation_relation', 'reward_status', 'NOT NULL'],
  ['plus_invitation_relation', 'reward_type', 'NULL'],
  ['plus_sns_follow_relation', 'relation_type', 'NOT NULL'],
  ['plus_sns_follow_relation', 'owner', 'NOT NULL'],
  ['plus_comments', 'content_type', 'NOT NULL'],
  ['plus_comments', 'status', 'NOT NULL'],
  ['plus_content_vote', 'content_type', 'NOT NULL'],
  ['plus_content_vote', 'rating', 'NOT NULL'],
  ['plus_visit_history', 'content_type', 'NOT NULL'],
  ['plus_feeds', 'content_type', 'NOT NULL'],
  ['plus_feeds', 'status', 'NOT NULL'],
  ['plus_short_url', 'status', 'NOT NULL'],
  ['plus_feedback', 'feedback_type', 'NOT NULL'],
  ['plus_feedback', 'status', 'NOT NULL'],
  ['plus_disk', 'type', 'NOT NULL'],
  ['plus_disk', 'owner', 'NOT NULL'],
  ['plus_file', 'type', 'NOT NULL'],
  ['plus_file', 'content_type', 'NULL'],
  ['plus_file', 'biz_type', 'NULL'],
  ['plus_file', 'project_type', 'NULL'],
  ['plus_file', 'generation_type', 'NOT NULL'],
  ['plus_file', 'storage_class', 'NULL'],
  ['plus_file', 'file_category', 'NULL'],
  ['plus_file', 'access_scope', 'NOT NULL'],
  ['plus_file', 'status', 'NOT NULL'],
  ['plus_file', 'upload_status', 'NOT NULL'],
  ['plus_oss_bucket', 'channel', 'NULL'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'postgresql', tableName),
    new RegExp(`\\b${columnName} INTEGER ${nullability}\\b`),
    `PostgreSQL ${tableName}.${columnName} must store Java converter enum values as INTEGER ${nullability}.`,
  );
}

assert.ok(
  codingServerMigration.sqlByProvider.postgresql.includes(
    'CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_coupon_redeem_code ON plus_coupon (redeem_code);',
  ),
  'PostgreSQL plus_coupon must preserve Java unique redeem_code constraint.',
);
assert.ok(
  codingServerMigration.sqlByProvider.postgresql.includes(
    'CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_coupon_template_template_code ON plus_coupon_template (template_code);',
  ),
  'PostgreSQL plus_coupon_template must preserve Java unique template_code constraint.',
);
assert.ok(
  codingServerMigration.sqlByProvider.postgresql.includes(
    'CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_user_coupon_code ON plus_user_coupon (coupon_code);',
  ),
  'PostgreSQL plus_user_coupon must preserve Java unique coupon_code constraint.',
);
assert.ok(
  codingServerMigration.sqlByProvider.postgresql.includes(
    'CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_user_coupon_acquire_request_no ON plus_user_coupon (user_id, acquire_request_no);',
  ),
  'PostgreSQL plus_user_coupon must preserve Java unique user_id/acquire_request_no constraint.',
);

for (const [tableName, columnName] of [
  ['plus_order', 'product_image'],
  ['plus_order_item', 'product_image'],
  ['plus_datasource', 'connection_config'],
  ['plus_ai_generation_content', 'metadata'],
  ['plus_ai_agent_tool_relation', 'actions'],
  ['plus_ai_prompt', 'parameters'],
  ['plus_ai_tool', 'tool_definition'],
]) {
  assert.match(
    findCreateTableStatement(codingServerMigration, 'postgresql', tableName),
    new RegExp(`\\b${columnName} TEXT(?: NULL| NOT NULL)?\\b`),
    `PostgreSQL ${tableName}.${columnName} must store BaseJsonConverter payloads as TEXT.`,
  );
}

for (const [indexName, tableName, columnNames] of [
  ['uk_plus_order_order_sn', 'plus_order', 'order_sn'],
  ['uk_plus_order_out_trade_no', 'plus_order', 'out_trade_no'],
  ['uk_plus_payment_out_trade_no', 'plus_payment', 'out_trade_no'],
  ['uk_plus_refund_out_refund_no', 'plus_refund', 'out_refund_no'],
  ['uk_plus_shopping_cart_item_cart_sku', 'plus_shopping_cart_item', 'cart_id, sku_id'],
  ['uk_payment_webhook_provider_event', 'plus_payment_webhook_event', 'provider, event_id'],
  ['uk_payment_webhook_provider_nonce', 'plus_payment_webhook_event', 'provider, nonce'],
  ['uk_order_dispatch_rule_task_code', 'plus_order_dispatch_rule', 'task_code'],
  [
    'uk_order_worker_dispatch_profile_user_id',
    'plus_order_worker_dispatch_profile',
    'user_id',
  ],
  [
    'uk_plus_ai_generation_user_type_idempotency',
    'plus_ai_generation',
    'user_id, type, idempotency_key',
  ],
  ['uk_plus_channel_account_key', 'plus_channel_account', 'account_key'],
  ['uk_plus_api_key_key_value', 'plus_api_key', 'key_value'],
  [
    'uk_ai_model_availability_scope',
    'plus_ai_model_availability',
    'tenant_id, organization_id, channel, model_key, platform, environment, region_code, access_tier',
  ],
  [
    'uk_ai_model_compliance_standard',
    'plus_ai_model_compliance_profile',
    'tenant_id, organization_id, channel, model_key, standard_code',
  ],
  ['uk_model_channel_key', 'plus_ai_model_info', 'channel, model_key'],
  [
    'uk_ai_model_price_metric',
    'plus_ai_model_price_metric',
    'tenant_id, organization_id, price_rule_id, metric_type, tier_no',
  ],
  [
    'uk_ai_model_taxonomy_code',
    'plus_ai_model_taxonomy',
    'tenant_id, organization_id, type, code',
  ],
  [
    'uk_ai_model_taxonomy_rel',
    'plus_ai_model_taxonomy_rel',
    'tenant_id, organization_id, model_id, taxonomy_id',
  ],
  [
    'uk_ai_tenant_model_policy_code',
    'plus_ai_tenant_model_policy',
    'tenant_id, organization_id, policy_code',
  ],
  ['uk_agent_tool', 'plus_ai_agent_tool_relation', 'agent_id, tool_id'],
  ['uk_plus_api_security_policy_policy_code', 'plus_api_security_policy', 'policy_code'],
  ['uk_plus_attribute_scope_code', 'plus_attribute', 'content_type, content_id, code'],
  ['uk_plus_push_device_endpoint_endpoint_id', 'plus_push_device_endpoint', 'endpoint_id'],
  [
    'uk_plus_push_topic_subscription_user_topic_endpoint',
    'plus_push_topic_subscription',
    'user_id, topic, endpoint_id',
  ],
  ['uk_plus_chat_message_content_message_id', 'plus_chat_message_content', 'message_id'],
  ['idx_favorite_user_content', 'plus_favorite', 'user_id, content_type, content_id'],
  ['uk_plus_share_share_code', 'plus_share', 'share_code'],
  ['uk_plus_invitation_code_code', 'plus_invitation_code', 'code'],
  ['UK_sns_follow_relation', 'plus_sns_follow_relation', 'follower_id, following_id'],
  ['UK_sns_follow_statistics', 'plus_sns_follow_statistics', 'user_id, owner_id'],
  ['idx_vote_user_content', 'plus_content_vote', 'user_id, content_type, content_id'],
  ['uk_plus_short_url_short_code', 'plus_short_url', 'short_code'],
  ['uk_plus_email_message_user_external', 'plus_email_message', 'user_id, external_message_id'],
  ['uk_plus_disk_name', 'plus_disk', 'name'],
  ['idx_plus_disk_owner_id2', 'plus_disk', 'owner, owner_id, type'],
  ['idx_disk_member_disk_user', 'plus_disk_member', 'disk_id, user_id'],
  ['idx_file_disk_parent_path', 'plus_file', 'disk_id, parent_id, path'],
]) {
  assert.ok(
    codingServerMigration.sqlByProvider.postgresql.includes(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnNames});`,
    ),
    `PostgreSQL ${tableName}.${columnNames} must preserve Java unique text constraint.`,
  );
}

for (const [indexName, tableName, columnNames] of [
  ['idx_plus_ai_generation_user_status', 'plus_ai_generation', 'user_id, status'],
  ['idx_plus_ai_generation_type_status', 'plus_ai_generation', 'type, status'],
  ['idx_plus_ai_generation_channel_task', 'plus_ai_generation', 'channel_task_id'],
  ['idx_plus_ai_generation_conversation', 'plus_ai_generation', 'conversation_id'],
  ['idx_plus_ai_generation_content_generation', 'plus_ai_generation_content', 'generation_id'],
  ['idx_plus_ai_generation_content_content_type', 'plus_ai_generation_content', 'content_type'],
  ['idx_plus_ai_generation_content_content_id', 'plus_ai_generation_content', 'content_id'],
  ['idx_plus_ai_generation_content_created_at', 'plus_ai_generation_content', 'created_at'],
  ['idx_plus_ai_generation_style_user_id', 'plus_ai_generation_style', 'user_id'],
  ['idx_plus_ai_generation_style_name', 'plus_ai_generation_style', 'name'],
  ['idx_plus_ai_generation_style_type', 'plus_ai_generation_style', 'type'],
  ['idx_plus_ai_generation_style_status', 'plus_ai_generation_style', 'status'],
  ['idx_plus_channel_channel', 'plus_channel', 'channel'],
  ['idx_plus_channel_status', 'plus_channel', 'status'],
  ['idx_plus_channel_account_channel', 'plus_channel_account', 'channel'],
  ['idx_plus_channel_account_status', 'plus_channel_account', 'status'],
  ['idx_plus_channel_proxy_channel', 'plus_channel_proxy', 'channel'],
  ['idx_plus_channel_proxy_status', 'plus_channel_proxy', 'status'],
  ['idx_plus_channel_resource_account', 'plus_channel_resource', 'channel_account_id'],
  ['idx_plus_api_key_user', 'plus_api_key', 'user_id'],
  ['idx_plus_api_key_status', 'plus_api_key', 'status'],
  ['idx_app_user_id', 'plus_app', 'user_id'],
  ['idx_app_project_id', 'plus_app', 'project_id'],
  ['idx_app_status', 'plus_app', 'status'],
  ['idx_ai_model_availability_model', 'plus_ai_model_availability', 'model_id'],
  ['idx_ai_model_availability_channel_key', 'plus_ai_model_availability', 'channel, model_key'],
  ['idx_ai_model_availability_platform_env', 'plus_ai_model_availability', 'platform, environment'],
  ['idx_ai_model_availability_region', 'plus_ai_model_availability', 'region_code'],
  ['idx_ai_model_availability_status', 'plus_ai_model_availability', 'status, available'],
  ['idx_ai_model_availability_time', 'plus_ai_model_availability', 'effective_from, effective_to'],
  ['idx_ai_model_compliance_model', 'plus_ai_model_compliance_profile', 'model_id'],
  ['idx_ai_model_compliance_channel_key', 'plus_ai_model_compliance_profile', 'channel, model_key'],
  ['idx_ai_model_compliance_standard', 'plus_ai_model_compliance_profile', 'standard_code'],
  ['idx_ai_model_compliance_level', 'plus_ai_model_compliance_profile', 'level'],
  ['idx_ai_model_compliance_status', 'plus_ai_model_compliance_profile', 'status'],
  ['idx_ai_model_compliance_valid', 'plus_ai_model_compliance_profile', 'valid_from, valid_to'],
  ['idx_model_channel', 'plus_ai_model_info', 'channel'],
  ['idx_model_type', 'plus_ai_model_info', 'model_type'],
  ['idx_model_status', 'plus_ai_model_info', 'status'],
  ['idx_model_family', 'plus_ai_model_info', 'family'],
  ['idx_model_vendor', 'plus_ai_model_info', 'vendor'],
  ['idx_model_model_id', 'plus_ai_model_info', 'model_id'],
  ['idx_model_model_key', 'plus_ai_model_info', 'model_key'],
  ['idx_model_pricing_type', 'plus_ai_model_info', 'pricing_type'],
  ['idx_model_lifecycle_stage', 'plus_ai_model_info', 'lifecycle_stage'],
  ['idx_model_release_date', 'plus_ai_model_info', 'release_date'],
  ['idx_model_context_tokens', 'plus_ai_model_info', 'context_tokens'],
  ['idx_model_support_reasoning', 'plus_ai_model_info', 'support_reasoning'],
  ['idx_model_support_multimodal', 'plus_ai_model_info', 'support_multimodal'],
  ['idx_model_popularity_score', 'plus_ai_model_info', 'popularity_score'],
  ['idx_model_price_model_id', 'plus_ai_model_price', 'model_id'],
  ['idx_model_price_channel_model_key', 'plus_ai_model_price', 'channel, model_key'],
  ['idx_model_price_product', 'plus_ai_model_price', 'product_code'],
  ['idx_model_price_feature', 'plus_ai_model_price', 'feature_code'],
  ['idx_model_price_effective_time', 'plus_ai_model_price', 'effective_from, effective_to'],
  ['idx_model_price_status', 'plus_ai_model_price', 'status'],
  [
    'idx_model_price_lookup',
    'plus_ai_model_price',
    'channel, model_key, product_code, feature_code, status, effective_from, effective_to, is_default',
  ],
  ['idx_ai_model_price_metric_price_rule', 'plus_ai_model_price_metric', 'price_rule_id'],
  ['idx_ai_model_price_metric_model', 'plus_ai_model_price_metric', 'model_id'],
  ['idx_ai_model_price_metric_channel_key', 'plus_ai_model_price_metric', 'channel, model_key'],
  [
    'idx_ai_model_price_metric_product_feature',
    'plus_ai_model_price_metric',
    'product_code, feature_code',
  ],
  [
    'idx_ai_model_price_metric_effective',
    'plus_ai_model_price_metric',
    'effective_from, effective_to',
  ],
  ['idx_ai_model_price_metric_status', 'plus_ai_model_price_metric', 'status'],
  ['idx_ai_model_taxonomy_type', 'plus_ai_model_taxonomy', 'type'],
  ['idx_ai_model_taxonomy_parent', 'plus_ai_model_taxonomy', 'parent_id'],
  ['idx_ai_model_taxonomy_status', 'plus_ai_model_taxonomy', 'status'],
  ['idx_ai_model_taxonomy_sort', 'plus_ai_model_taxonomy', 'sort_weight'],
  ['idx_ai_model_taxonomy_rel_model', 'plus_ai_model_taxonomy_rel', 'model_id'],
  ['idx_ai_model_taxonomy_rel_taxonomy', 'plus_ai_model_taxonomy_rel', 'taxonomy_id'],
  ['idx_ai_model_taxonomy_rel_type', 'plus_ai_model_taxonomy_rel', 'taxonomy_type'],
  ['idx_ai_model_taxonomy_rel_channel_key', 'plus_ai_model_taxonomy_rel', 'channel, model_key'],
  ['idx_ai_model_taxonomy_rel_code', 'plus_ai_model_taxonomy_rel', 'taxonomy_code'],
  ['idx_ai_tenant_model_policy_subject', 'plus_ai_tenant_model_policy', 'subject_type, subject_id'],
  ['idx_ai_tenant_model_policy_model', 'plus_ai_tenant_model_policy', 'channel, model_key'],
  ['idx_ai_tenant_model_policy_feature', 'plus_ai_tenant_model_policy', 'feature_code'],
  ['idx_ai_tenant_model_policy_effective', 'plus_ai_tenant_model_policy', 'effective_from, effective_to'],
  ['idx_ai_tenant_model_policy_priority', 'plus_ai_tenant_model_policy', 'enabled, priority'],
  ['idx_ai_tenant_model_policy_status', 'plus_ai_tenant_model_policy', 'status'],
  ['uk_ai_agent_user_id_name', 'plus_ai_agent', 'tenant_id, organization_id, user_id, name'],
  ['idx_prompt_cate_id', 'plus_ai_prompt', 'cate_id'],
  ['idx_prompt_type', 'plus_ai_prompt', 'type'],
  ['idx_prompt_biz_type', 'plus_ai_prompt', 'biz_type'],
  ['idx_prompt_enabled', 'plus_ai_prompt', 'enabled'],
  ['idx_prompt_model', 'plus_ai_prompt', 'model'],
  ['idx_prompt_created_at', 'plus_ai_prompt', 'created_at'],
  ['idx_prompt_history_user_id', 'plus_ai_prompt_history', 'user_id'],
  ['idx_prompt_history_prompt_id', 'plus_ai_prompt_history', 'prompt_id'],
  ['idx_prompt_history_created_at', 'plus_ai_prompt_history', 'created_at'],
  ['idx_category_shop_id', 'plus_category', 'shop_id'],
  ['idx_category_type_shop', 'plus_category', 'type, shop_id'],
  ['idx_plus_attribute_category_status', 'plus_attribute', 'category_id, status'],
  ['idx_plus_attribute_content_scope', 'plus_attribute', 'content_type, content_id, status'],
  ['idx_notification_receiver', 'plus_notification', 'receiver_id'],
  ['idx_notification_sender', 'plus_notification', 'sender_id'],
  ['idx_notification_group', 'plus_notification', 'group_id'],
  ['idx_notification_status', 'plus_notification', 'status'],
  ['idx_notification_type', 'plus_notification', 'type'],
  ['idx_notification_channel', 'plus_notification', 'channel_type'],
  ['idx_notification_tenant', 'plus_notification', 'tenant_id'],
  ['idx_notification_org', 'plus_notification', 'organization_id'],
  ['idx_notification_created', 'plus_notification', 'created_at'],
  ['idx_notification_content_notification', 'plus_notification_content', 'notification_id'],
  ['idx_notification_content_message_type', 'plus_notification_content', 'message_type'],
  ['idx_notification_content_status', 'plus_notification_content', 'status'],
  ['idx_notification_content_receiver', 'plus_notification_content', 'receiver_id'],
  ['idx_notification_content_group', 'plus_notification_content', 'group_id'],
  ['idx_notification_content_notification_type', 'plus_notification_content', 'type'],
  ['idx_notification_content_tenant', 'plus_notification_content', 'tenant_id'],
  ['idx_notification_content_org', 'plus_notification_content', 'organization_id'],
  ['idx_push_endpoint_user', 'plus_push_device_endpoint', 'user_id'],
  ['idx_push_endpoint_endpoint', 'plus_push_device_endpoint', 'endpoint_id'],
  ['idx_push_endpoint_installation', 'plus_push_device_endpoint', 'installation_id'],
  ['idx_push_endpoint_token', 'plus_push_device_endpoint', 'device_token'],
  ['idx_push_endpoint_status', 'plus_push_device_endpoint', 'status'],
  ['idx_push_endpoint_user_installation', 'plus_push_device_endpoint', 'user_id, installation_id'],
  ['idx_push_topic_user', 'plus_push_topic_subscription', 'user_id'],
  ['idx_push_topic_endpoint', 'plus_push_topic_subscription', 'endpoint_id'],
  ['idx_push_topic_topic', 'plus_push_topic_subscription', 'topic'],
  ['idx_push_topic_status', 'plus_push_topic_subscription', 'status'],
  ['idx_plus_conversation_user_id', 'plus_conversation', 'user_id'],
  ['idx_plus_conversation_agent_id', 'plus_conversation', 'agent_id'],
  ['idx_plus_conversation_status', 'plus_conversation', 'status'],
  ['idx_plus_conversation_channel_id', 'plus_conversation', 'channel_id'],
  ['idx_plus_conversation_user_sort', 'plus_conversation', 'user_id, pinned, sort_order, updated_at'],
  [
    'idx_plus_conversation_agent_user_updated_at',
    'plus_conversation',
    'agent_id, user_id, updated_at',
  ],
  ['idx_plus_conversation_last_interaction_time', 'plus_conversation', 'last_interaction_time'],
  ['idx_plus_chat_message_user_id', 'plus_chat_message', 'user_id'],
  ['idx_plus_chat_message_conversation_id', 'plus_chat_message', 'conversation_id'],
  ['idx_plus_chat_message_status', 'plus_chat_message', 'status'],
  ['idx_plus_chat_message_sender_id', 'plus_chat_message', 'sender_id'],
  ['idx_plus_chat_message_receiver_id', 'plus_chat_message', 'receiver_id'],
  ['idx_plus_chat_message_group_id', 'plus_chat_message', 'group_id'],
  ['idx_plus_chat_message_parent_message_id', 'plus_chat_message', 'parent_message_id'],
  ['idx_plus_chat_message_channel_msg_id', 'plus_chat_message', 'channel_msg_id'],
  ['idx_plus_chat_message_created_at', 'plus_chat_message', 'created_at'],
  ['idx_plus_chat_message_content_channel_msg_id', 'plus_chat_message_content', 'channel_msg_id'],
  ['idx_plus_chat_message_content_conversation_id', 'plus_chat_message_content', 'conversation_id'],
  ['idx_plus_chat_message_content_status', 'plus_chat_message_content', 'status'],
  ['idx_collection_parent', 'plus_collection', 'parent_id'],
  ['idx_collection_type', 'plus_collection', 'type'],
  ['idx_collection_user', 'plus_collection', 'user_id'],
  ['idx_collection_content', 'plus_collection', 'content_id'],
  ['idx_collection_created', 'plus_collection', 'created_at'],
  ['idx_coll_item_collection', 'plus_collection_item', 'collection_id'],
  ['idx_coll_item_content_type', 'plus_collection_item', 'content_type'],
  ['idx_coll_item_content_id', 'plus_collection_item', 'content_id'],
  ['idx_coll_item_position', 'plus_collection_item', 'position'],
  ['idx_coll_item_created', 'plus_collection_item', 'created_at'],
  ['idx_favorite_user_id', 'plus_favorite', 'user_id'],
  ['idx_favorite_content', 'plus_favorite', 'content_type, content_id'],
  ['idx_favorite_folder_id', 'plus_favorite', 'folder_id'],
  ['idx_favorite_created_at', 'plus_favorite', 'created_at'],
  ['idx_folder_user', 'plus_favorite_folder', 'user_id'],
  ['idx_folder_parent', 'plus_favorite_folder', 'parent_id'],
  ['idx_share_id', 'plus_share_visit_record', 'share_id'],
  ['idx_ip_address', 'plus_share_visit_record', 'ip_address'],
  ['idx_created_at', 'plus_share_visit_record', 'created_at'],
  ['idx_sns_follow_rel_follower_id', 'plus_sns_follow_relation', 'follower_id'],
  ['idx_sns_follow_rel_following_id', 'plus_sns_follow_relation', 'following_id'],
  ['idx_sns_follow_rel_relation_type', 'plus_sns_follow_relation', 'relation_type'],
  ['idx_sns_follow_rel_owner_id', 'plus_sns_follow_relation', 'owner_id'],
  ['idx_sns_follow_rel_is_mutual', 'plus_sns_follow_relation', 'is_mutual'],
  ['idx_sns_follow_rel_is_blocked', 'plus_sns_follow_relation', 'is_blocked'],
  ['idx_sns_follow_rel_is_special', 'plus_sns_follow_relation', 'is_special'],
  ['idx_sns_follow_rel_created_at', 'plus_sns_follow_relation', 'created_at'],
  ['idx_sns_follow_stat_user_id', 'plus_sns_follow_statistics', 'user_id'],
  ['idx_sns_follow_stat_owner_id', 'plus_sns_follow_statistics', 'owner_id'],
  ['idx_sns_follow_stat_following_count', 'plus_sns_follow_statistics', 'following_count'],
  ['idx_sns_follow_stat_follower_count', 'plus_sns_follow_statistics', 'follower_count'],
  ['idx_sns_follow_stat_mutual_count', 'plus_sns_follow_statistics', 'mutual_count'],
  ['idx_comment_content_id_type', 'plus_comments', 'content_id, content_type'],
  ['idx_comment_user_id', 'plus_comments', 'user_id'],
  ['idx_comment_status', 'plus_comments', 'status'],
  ['idx_comment_parent_id', 'plus_comments', 'parent_id'],
  ['idx_vote_content', 'plus_content_vote', 'content_type, content_id'],
  ['idx_vote_rating', 'plus_content_vote', 'rating'],
  ['idx_vote_created_at', 'plus_content_vote', 'created_at'],
  ['idx_visit_user_content', 'plus_visit_history', 'user_id, content_type, content_id'],
  ['idx_visit_user_id', 'plus_visit_history', 'user_id'],
  ['idx_visit_content_type', 'plus_visit_history', 'content_type'],
  ['idx_visit_created_at', 'plus_visit_history', 'created_at'],
  ['idx_feeds_status', 'plus_feeds', 'status'],
  ['idx_feeds_user_id', 'plus_feeds', 'user_id'],
  ['idx_feeds_category_id', 'plus_feeds', 'category_id'],
  ['idx_feeds_content_type', 'plus_feeds', 'content_type'],
  ['idx_feeds_publish_time', 'plus_feeds', 'publish_time'],
  ['idx_feeds_status_publish_time', 'plus_feeds', 'status, publish_time'],
  ['idx_feedback_user_id', 'plus_feedback', 'user_id'],
  ['idx_feedback_status', 'plus_feedback', 'status'],
  ['idx_feedback_type', 'plus_feedback', 'feedback_type'],
  ['idx_feedback_created_at', 'plus_feedback', 'created_at'],
  ['idx_feedback_status_created', 'plus_feedback', 'status, created_at'],
  ['idx_plus_email_message_user_created', 'plus_email_message', 'user_id, created_at'],
  ['idx_plus_email_message_user_folder', 'plus_email_message', 'user_id, folder'],
  ['idx_plus_email_message_user_read', 'plus_email_message', 'user_id, is_read'],
  ['idx_plus_disk_name', 'plus_disk', 'name'],
  ['idx_plus_disk_owner_id', 'plus_disk', 'owner_id'],
  ['idx_plus_disk_knowledge_base_id', 'plus_disk', 'knowledge_base_id'],
  ['idx_disk_member_disk_id', 'plus_disk_member', 'disk_id'],
  ['idx_disk_member_user_id', 'plus_disk_member', 'user_id'],
  ['idx_disk_member_pinned_at', 'plus_disk_member', 'pinned_at'],
  ['idx_disk_member_knowledge_base_id', 'plus_disk_member', 'knowledge_base_id'],
  ['idx_file_name', 'plus_file', 'name'],
  ['idx_file_object_key', 'plus_file', 'object_key'],
  ['idx_file_project_uuid', 'plus_file', 'project_uuid'],
  ['idx_file_access_scope', 'plus_file', 'access_scope'],
  ['idx_file_prompt_uuid', 'plus_file', 'prompt_uuid'],
  ['idx_file_user_id', 'plus_file', 'user_id'],
  ['idx_plus_file_content_file_id', 'plus_file_content', 'file_id, file_version'],
  ['idx_plus_file_content_file_uuid', 'plus_file_content', 'file_uuid, file_version'],
  ['idx_oss_bucket_name', 'plus_oss_bucket', 'name'],
  ['idx_oss_bucket_user_id', 'plus_oss_bucket', 'user_id'],
  ['idx_oss_bucket_region', 'plus_oss_bucket', 'region'],
]) {
  assert.ok(
    codingServerMigration.sqlByProvider.postgresql.includes(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columnNames});`,
    ),
    `PostgreSQL ${tableName}.${columnNames} must preserve V104 Java/bootstrap index ${indexName}.`,
  );
}

assert.match(
  postgresWorkspaceMigration,
  /\bowner_id BIGINT NOT NULL\b/,
  'PostgreSQL workspaces.owner_id must use non-null Java Long-compatible bigint storage.',
);
assert.match(
  postgresWorkspaceMigration,
  /\bdescription TEXT(?:,|\))/,
  'PostgreSQL workspaces.description must stay nullable like PlusWorkspace.description.',
);
assert.doesNotMatch(
  postgresWorkspaceMigration,
  /\bdescription TEXT NOT NULL\b/,
  'PostgreSQL workspaces.description must not be generated as NOT NULL.',
);
assert.match(
  postgresProjectMigration,
  /\bid BIGINT PRIMARY KEY\b/,
  'PostgreSQL plus_project.id must use Java Long-compatible bigint storage.',
);
assert.match(
  postgresProjectMigration,
  /\bworkspace_id BIGINT NULL\b/,
  'PostgreSQL plus_project.workspace_id must use Java Long-compatible bigint storage.',
);
for (const [columnName, columnDefinition] of [
  ['uuid', 'TEXT NOT NULL UNIQUE'],
  ['v', 'BIGINT NOT NULL DEFAULT 0'],
  ['name', 'TEXT NOT NULL'],
  ['title', 'TEXT NOT NULL'],
  ['code', 'TEXT NOT NULL'],
  ['cover_image', 'JSONB(?: NULL)?'],
  ['parent_metadata', 'JSONB(?: NULL)?'],
  ['type', 'INTEGER NOT NULL'],
  ['status', 'INTEGER NOT NULL'],
  ['is_deleted', 'BOOLEAN NOT NULL'],
  ['is_template', 'BOOLEAN NOT NULL'],
]) {
  assert.match(
    postgresProjectMigration,
    new RegExp(`\\b${columnName} ${columnDefinition}\\b`),
    `PostgreSQL plus_project.${columnName} must match Java PlusProject storage.`,
  );
}
for (const forbiddenColumnName of ['version', 'root_path', 'cover_image_json', 'owner_id', 'created_by_user_id']) {
  assert.doesNotMatch(
    postgresProjectMigration,
    new RegExp(`\\b${forbiddenColumnName}\\b`),
    `PostgreSQL plus_project must not retain non-Java column ${forbiddenColumnName}.`,
  );
}
for (const [indexName, columnNames] of [
  ['uk_plus_project_name', 'name'],
  ['uk_plus_project_code', 'code'],
]) {
  assert.ok(
    codingServerMigration.sqlByProvider.postgresql?.includes(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON plus_project (${columnNames});`,
    ),
    `PostgreSQL plus_project must expose Java unique key ${indexName}.`,
  );
}
const postgresProjectContentMigration = findCreateTableStatement(
  codingServerMigration,
  'postgresql',
  'plus_project_content',
);
assert.ok(
  postgresProjectContentMigration,
  'PostgreSQL coding server migration must declare plus_project_content.',
);
for (const [columnName, columnDefinition] of [
  ['id', 'BIGINT PRIMARY KEY'],
  ['uuid', 'TEXT NOT NULL UNIQUE'],
  ['v', 'BIGINT NOT NULL DEFAULT 0'],
  ['user_id', 'BIGINT NULL'],
  ['parent_id', 'BIGINT NULL'],
  ['project_id', 'BIGINT NOT NULL'],
  ['project_uuid', 'TEXT NOT NULL'],
  ['config_data', 'TEXT(?: NULL)?'],
  ['content_data', 'JSONB(?: NULL)?'],
  ['metadata', 'TEXT(?: NULL)?'],
  ['content_version', 'TEXT NOT NULL'],
  ['content_hash', 'TEXT(?: NULL)?'],
]) {
  assert.match(
    postgresProjectContentMigration,
    new RegExp(`\\b${columnName} ${columnDefinition}\\b`),
    `PostgreSQL plus_project_content.${columnName} must match Java PlusProjectContent storage.`,
  );
}
for (const [indexName, columnNames] of [
  ['idx_plus_project_content_project_id', 'project_id'],
  ['idx_plus_project_content_project_uuid', 'project_uuid'],
]) {
  assert.ok(
    codingServerMigration.sqlByProvider.postgresql?.includes(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON plus_project_content (${columnNames});`,
    ),
    `PostgreSQL plus_project_content must preserve Java index ${indexName}.`,
  );
}
assert.match(
  postgresProjectMigration,
  /\btenant_id BIGINT NOT NULL DEFAULT 0\b/,
  'PostgreSQL scoped migrations must store tenant_id as Java Long-compatible bigint with default 0.',
);
assert.match(
  postgresProjectMigration,
  /\borganization_id BIGINT NOT NULL DEFAULT 0\b/,
  'PostgreSQL scoped migrations must store organization_id as Java Long-compatible bigint with default 0.',
);
assert.match(
  postgresProjectMigration,
  /\bdata_scope INTEGER NOT NULL DEFAULT 1\b/,
  'PostgreSQL scoped migrations must store PlusDataScope.PRIVATE as integer value 1 by default.',
);
assert.doesNotMatch(
  postgresProjectMigration,
  /\b(?:tenant_id|organization_id|data_scope) TEXT NOT NULL\b/,
  'PostgreSQL scoped migrations must not generate text scoped columns.',
);

console.log('provider dialect contract passed.');
