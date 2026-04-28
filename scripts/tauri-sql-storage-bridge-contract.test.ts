import assert from 'node:assert/strict';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderConsoleRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts';
import { createBirdCoderCodingSessionRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/codingSessionRepository.ts';
import { ProviderBackedProjectService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts';

type SqlPlanMeta =
  | {
      id?: string;
      kind:
        | 'coding-session-list-by-project-ids'
        | 'coding-session-message-metadata-by-session-ids'
        | 'coding-session-messages-by-session-ids'
        | 'table-clear'
        | 'table-count'
        | 'table-delete'
        | 'table-find-by-id'
        | 'table-list'
        | 'table-upsert';
      codingSessionIds?: string[];
      nativeMessageIdSegment?: string;
      projectIds?: string[];
      rows?: Record<string, unknown>[];
      tableName: string;
    }
  | undefined;

interface SqlPlan {
  meta?: SqlPlanMeta;
}

const projectId = '101777127745715000';
const workspaceId = '101777102602741000';
const codingSessionId = '101777208078558000';
const timestamp = '2026-04-27T09:13:49.055Z';

const tables = new Map<string, Record<string, unknown>[]>([
  [
    'plus_project',
    [
      {
        id: projectId,
        uuid: `project-${projectId}`,
        created_at: '2026-04-25T14:35:45.216Z',
        updated_at: '2026-04-25T14:35:45.216Z',
        v: '0',
        tenant_id: '0',
        organization_id: '0',
        data_scope: '1',
        parent_id: '0',
        parent_uuid: '0',
        parent_metadata: '{}',
        user_id: '100000000000000001',
        name: `claw-studio [${projectId}]`,
        title: 'claw-studio',
        cover_image: '{}',
        author: '100000000000000001',
        file_id: null,
        code: `project-${projectId}`,
        type: '1',
        site_path: null,
        domain_prefix: null,
        description: null,
        status: '2',
        conversation_id: null,
        workspace_id: workspaceId,
        workspace_uuid: `workspace-${workspaceId}`,
        leader_id: '100000000000000001',
        start_time: null,
        end_time: null,
        budget_amount: null,
        is_deleted: '0',
        is_template: '0',
      },
    ],
  ],
  ['plus_project_content', []],
  ['workbench_preferences', []],
  ['run_configurations', []],
  ['coding_sessions', []],
  ['coding_session_messages', []],
]);

const invokedCommands: string[] = [];
const userHomeConfigFiles = new Map<string, string>();

function cloneRows(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => ({ ...row }));
}

function readTable(tableName: string): Record<string, unknown>[] {
  const rows = tables.get(tableName);
  if (rows) {
    return rows;
  }

  const nextRows: Record<string, unknown>[] = [];
  tables.set(tableName, nextRows);
  return nextRows;
}

function isDeletedRow(row: Record<string, unknown>): boolean {
  return row.is_deleted === true || row.is_deleted === 1 || row.is_deleted === '1';
}

function cloneLiveRows(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return cloneRows(rows.filter((row) => !isDeletedRow(row)));
}

function executeSqlPlan(plan: SqlPlan): { affectedRowCount: number; rows?: Record<string, unknown>[] } {
  const meta = plan.meta;
  assert.ok(meta, 'Tauri SQL bridge contract expects table repository plans with metadata.');

  const rows = readTable(meta.tableName);
  switch (meta.kind) {
    case 'table-list':
      return {
        affectedRowCount: 0,
        rows: cloneLiveRows(rows),
      };
    case 'coding-session-list-by-project-ids': {
      const projectIds = new Set(meta.projectIds ?? []);
      return {
        affectedRowCount: 0,
        rows: cloneLiveRows(rows).filter((row) => projectIds.has(String(row.project_id))),
      };
    }
    case 'coding-session-messages-by-session-ids': {
      const codingSessionIds = new Set(meta.codingSessionIds ?? []);
      return {
        affectedRowCount: 0,
        rows: cloneLiveRows(rows).filter((row) =>
          codingSessionIds.has(String(row.coding_session_id)),
        ),
      };
    }
    case 'coding-session-message-metadata-by-session-ids': {
      const codingSessionIds = new Set(meta.codingSessionIds ?? []);
      const metadataByCodingSessionId = new Map<string, Record<string, unknown>>();
      for (const row of cloneLiveRows(rows)) {
        const codingSessionId = String(row.coding_session_id ?? '');
        if (!codingSessionIds.has(codingSessionId)) {
          continue;
        }

        const currentMetadata = metadataByCodingSessionId.get(codingSessionId) ?? {
          coding_session_id: codingSessionId,
          latest_transcript_updated_at: null,
          message_count: 0,
          native_transcript_updated_at: null,
        };
        const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
        currentMetadata.message_count = Number(currentMetadata.message_count ?? 0) + 1;
        if (
          createdAt &&
          (
            !currentMetadata.latest_transcript_updated_at ||
            Date.parse(createdAt) > Date.parse(String(currentMetadata.latest_transcript_updated_at))
          )
        ) {
          currentMetadata.latest_transcript_updated_at = createdAt;
        }
        if (
          createdAt &&
          String(row.id ?? '').includes(meta.nativeMessageIdSegment ?? ':native-message:') &&
          (
            !currentMetadata.native_transcript_updated_at ||
            Date.parse(createdAt) > Date.parse(String(currentMetadata.native_transcript_updated_at))
          )
        ) {
          currentMetadata.native_transcript_updated_at = createdAt;
        }
        metadataByCodingSessionId.set(codingSessionId, currentMetadata);
      }
      return {
        affectedRowCount: 0,
        rows: [...metadataByCodingSessionId.values()],
      };
    }
    case 'table-count':
      return {
        affectedRowCount: 0,
        rows: [
          {
            total: rows.filter((row) => !isDeletedRow(row)).length,
          },
        ],
      };
    case 'table-find-by-id':
      return {
        affectedRowCount: 0,
        rows: cloneRows(
          rows.filter(
            (row) =>
              String(row.id) === String(meta.id) &&
              !isDeletedRow(row),
          ),
        ),
      };
    case 'table-upsert': {
      let affectedRowCount = 0;
      for (const row of meta.rows ?? []) {
        if (meta.tableName === 'coding_sessions' && row.entry_surface == null) {
          throw new Error('NOT NULL constraint failed: coding_sessions.entry_surface');
        }
        const currentIndex = rows.findIndex((candidate) => String(candidate.id) === String(row.id));
        if (currentIndex >= 0) {
          rows[currentIndex] = { ...rows[currentIndex], ...row };
        } else {
          rows.push({ ...row });
        }
        affectedRowCount += 1;
      }
      return { affectedRowCount };
    }
    case 'table-delete': {
      const nextRows = rows.filter((row) => String(row.id) !== String(meta.id));
      tables.set(meta.tableName, nextRows);
      return { affectedRowCount: rows.length - nextRows.length };
    }
    case 'table-clear': {
      const affectedRowCount = rows.length;
      tables.set(meta.tableName, []);
      return { affectedRowCount };
    }
    default:
      throw new Error(`Unhandled SQL plan kind ${(meta as { kind: string }).kind}`);
  }
}

const originalWindow = Reflect.get(globalThis, 'window');
Reflect.set(globalThis, 'window', {
  __TAURI_INTERNALS__: {
    async invoke(
      command: string,
      args?: { content?: string; key?: string; plan?: SqlPlan; relativePath?: string },
    ) {
      invokedCommands.push(command);
      if (command === 'local_sql_execute_plan') {
        assert.ok(args?.plan, 'local_sql_execute_plan must receive a SQL plan.');
        return executeSqlPlan(args.plan);
      }

      if (args?.key?.startsWith('table.sqlite.')) {
        throw new Error(
          `local store key '${args.key}' is reserved for direct authority tables`,
        );
      }

      if (command === 'local_store_get') {
        return null;
      }
      if (command === 'local_store_list') {
        return [];
      }
      if (command === 'local_store_set' || command === 'local_store_delete') {
        return undefined;
      }
      if (command === 'user_home_config_read') {
        return args?.relativePath
          ? userHomeConfigFiles.get(args.relativePath) ?? null
          : null;
      }
      if (command === 'user_home_config_write') {
        if (args?.relativePath) {
          userHomeConfigFiles.set(args.relativePath, args.content ?? '');
        }
        return undefined;
      }
      throw new Error(`Unexpected Tauri command ${command}`);
    },
  },
});

try {
  const storageProvider = createBirdCoderStorageProvider('sqlite');
  const repositories = createBirdCoderConsoleRepositories({
    providerId: storageProvider.providerId,
    storage: storageProvider,
  });
  const codingSessionRepositories = createBirdCoderCodingSessionRepositories({
    providerId: storageProvider.providerId,
    storage: storageProvider,
  });
  const service = new ProviderBackedProjectService({
    codingSessionRepositories,
    projectContentRepository: repositories.projectContents,
    repository: repositories.projects,
  });

  const codingSession: BirdCoderCodingSession = {
    id: codingSessionId,
    workspaceId,
    projectId,
    title: 'Codex Session',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5-codex',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastTurnAt: timestamp,
    transcriptUpdatedAt: timestamp,
    displayTime: 'Just now',
    pinned: false,
    archived: false,
    unread: false,
    messages: [],
  };

  await service.upsertCodingSession(projectId, codingSession);

  const persistedSession = readTable('coding_sessions').find(
    (row) => String(row.id) === codingSessionId,
  );
  assert.ok(
    persistedSession,
    'Tauri SQL-backed provider mirror must persist the coding session into the direct coding_sessions table.',
  );
  assert.equal(String(persistedSession.project_id), projectId);
  assert.equal(String(persistedSession.workspace_id), workspaceId);
  assert.equal(
    persistedSession.entry_surface,
    'code',
    'Coding session mirrors must persist the default entry_surface instead of explicitly writing NULL into the direct SQLite authority table.',
  );
  assert.ok(
    invokedCommands.includes('local_sql_execute_plan'),
    'Tauri table repositories must use the desktop SQL bridge.',
  );
  assert.equal(
    invokedCommands.some((command) => command === 'local_store_set'),
    false,
    'Tauri table repositories must not try to write table.sqlite.* rows through local_store_set.',
  );

  const preferencesModule = await import(
    `../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts?t=${Date.now()}`
  );
  await preferencesModule.writeWorkbenchPreferences({
    codeEngineId: 'gemini',
    codeModelId: 'gemini-1.5-pro',
    terminalProfileId: 'powershell',
    defaultWorkingDirectory: 'D:/workspace',
  });
  const preferences = await preferencesModule.readWorkbenchPreferences();
  assert.equal(
    preferences.codeEngineId,
    'gemini',
    'Default workbench preference repositories must use the Tauri SQL bridge instead of table.sqlite.* local_store keys.',
  );
  assert.equal(
    readTable('workbench_preferences')[0]?.code_engine_id,
    'gemini',
    'Default workbench preference repositories must persist into the direct workbench_preferences table.',
  );
  assert.equal(
    invokedCommands.includes('user_home_config_write'),
    true,
    'Workbench code-engine model settings must also persist to the standard ~/.sdkwork/birdcoder home config file bridge.',
  );
  assert.equal(
    userHomeConfigFiles.has('.sdkwork/birdcoder/code-engine-models.json'),
    true,
    'Workbench code-engine model settings must use ~/.sdkwork/birdcoder/code-engine-models.json as the canonical local file.',
  );

  const runConfigsModule = await import(
    `../packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts?t=${Date.now()}`
  );
  await runConfigsModule.saveStoredRunConfigurations(projectId, [
    {
      id: 'lint',
      name: 'Lint',
      command: 'pnpm lint',
      profileId: 'powershell',
      group: 'custom',
      cwdMode: 'project',
      customCwd: '',
    },
  ]);
  const runConfigurations = await runConfigsModule.listStoredRunConfigurations(projectId);
  assert.equal(
    runConfigurations[0]?.id,
    'lint',
    'Default run configuration repositories must use the Tauri SQL bridge instead of table.sqlite.* local_store keys.',
  );
  assert.equal(
    readTable('run_configurations')[0]?.config_key,
    'lint',
    'Default run configuration repositories must persist into the direct run_configurations table.',
  );
} finally {
  Reflect.set(globalThis, 'window', originalWindow);
}

const webLikeRawWrites: Array<{ key: string; scope: string; value: string }> = [];
const webLikeRepositories = createBirdCoderConsoleRepositories({
  providerId: 'sqlite',
  storage: {
    async readRawValue() {
      return null;
    },
    async removeRawValue() {},
    async setRawValue(scope: string, key: string, value: string) {
      webLikeRawWrites.push({ key, scope, value });
    },
  },
});
await webLikeRepositories.projects.save({
  id: 'web-like-project',
  workspaceId: 'web-like-workspace',
  name: 'Web Like Project',
  status: 'active',
  createdAt: timestamp,
  updatedAt: timestamp,
});

assert.equal(
  webLikeRawWrites[0]?.scope,
  'workspace',
  'Non-Tauri browser-like storage must keep using the workspace local-store scope.',
);
assert.equal(
  webLikeRawWrites[0]?.key,
  'table.sqlite.projects.v1',
  'Non-Tauri browser-like storage must keep using local-store table snapshots because it has no desktop SQL bridge.',
);

console.log('tauri sql storage bridge contract passed.');
