import assert from 'node:assert/strict';

type SqlPlanMeta =
  | {
      id?: string;
      kind:
        | 'table-clear'
        | 'table-count'
        | 'table-delete'
        | 'table-find-by-id'
        | 'table-list'
        | 'table-upsert';
      rows?: Record<string, unknown>[];
      tableName: string;
    }
  | undefined;

interface SqlPlan {
  meta?: SqlPlanMeta;
}

const bootstrapModulePath = new URL(
  '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapShellUserState.ts',
  import.meta.url,
);
const preferencesModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts',
  import.meta.url,
);
const runConfigsModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts',
  import.meta.url,
);

const tables = new Map<string, Record<string, unknown>[]>([
  ['workbench_preferences', []],
  ['run_configurations', []],
]);
const rawStore = new Map<string, string>();
const userHomeConfigFiles = new Map<string, string>();
const invokedCommands: string[] = [];
const tableLocalStoreKeys: string[] = [];
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function buildRawStoreKey(scope: string, key: string): string {
  return `${scope}:${key}`;
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

function cloneRows(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => ({ ...row }));
}

function executeSqlPlan(plan: SqlPlan): { affectedRowCount: number; rows?: Record<string, unknown>[] } {
  const meta = plan.meta;
  assert.ok(meta, 'Tauri bootstrap SQL contract expects table repository plans with metadata.');

  const rows = readTable(meta.tableName);
  switch (meta.kind) {
    case 'table-list':
      return {
        affectedRowCount: 0,
        rows: cloneRows(rows.filter((row) => row.is_deleted !== '1' && row.is_deleted !== true)),
      };
    case 'table-count':
      return {
        affectedRowCount: 0,
        rows: [
          {
            total: rows.filter((row) => row.is_deleted !== '1' && row.is_deleted !== true).length,
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
              row.is_deleted !== '1' &&
              row.is_deleted !== true,
          ),
        ),
      };
    case 'table-upsert': {
      let affectedRowCount = 0;
      for (const row of meta.rows ?? []) {
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

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    __TAURI_INTERNALS__: {
      async invoke(command: string, args?: { key?: string; plan?: SqlPlan; scope?: string; value?: string }) {
        invokedCommands.push(command);
        if (command === 'local_sql_execute_plan') {
          assert.ok(args?.plan, 'local_sql_execute_plan must receive a SQL plan.');
          return executeSqlPlan(args.plan);
        }

        const key = args?.key ?? '';
        const scope = args?.scope ?? '';
        if (key.startsWith('table.sqlite.')) {
          tableLocalStoreKeys.push(key);
          throw new Error(
            `local store key '${key}' is reserved for direct authority tables and is not readable via kv_store`,
          );
        }

        if (command === 'local_store_get') {
          return rawStore.get(buildRawStoreKey(scope, key)) ?? null;
        }
        if (command === 'local_store_set') {
          rawStore.set(buildRawStoreKey(scope, key), String(args?.value ?? ''));
          return undefined;
        }
        if (command === 'local_store_delete') {
          rawStore.delete(buildRawStoreKey(scope, key));
          return undefined;
        }
        if (command === 'local_store_list') {
          return [];
        }
        if (command === 'user_home_config_read') {
          const relativePath = String((args as { relativePath?: string } | undefined)?.relativePath ?? '');
          return userHomeConfigFiles.get(relativePath) ?? null;
        }
        if (command === 'user_home_config_write') {
          const relativePath = String((args as { relativePath?: string } | undefined)?.relativePath ?? '');
          const content = String((args as { content?: string } | undefined)?.content ?? '');
          userHomeConfigFiles.set(relativePath, content);
          return undefined;
        }

        throw new Error(`Unexpected Tauri command ${command}`);
      },
    },
  },
});

try {
  const bootstrapModule = await import(`${bootstrapModulePath.href}?t=${Date.now()}`);
  const preferencesModule = await import(`${preferencesModulePath.href}?t=${Date.now()}`);
  const runConfigsModule = await import(`${runConfigsModulePath.href}?t=${Date.now()}`);

  await bootstrapModule.bootstrapShellUserState();

  const preferences = await preferencesModule.readWorkbenchPreferences();
  assert.equal(preferences.codeEngineId, 'codex');
  assert.equal(
    readTable('workbench_preferences').length,
    1,
    'Tauri startup bootstrap must persist workbench preferences through the direct SQL table.',
  );

  await bootstrapModule.bootstrapProjectWorkbenchState('project-alpha');
  const runConfigurations = await runConfigsModule.listStoredRunConfigurations('project-alpha');
  assert.equal(runConfigurations.length, 3);
  assert.equal(
    readTable('run_configurations').length,
    3,
    'Tauri project bootstrap must persist run configurations through the direct SQL table.',
  );

  assert.equal(
    tableLocalStoreKeys.length,
    0,
    'Tauri startup bootstrap must not read table.sqlite.* keys through local_store_get.',
  );
  assert.ok(
    invokedCommands.includes('local_sql_execute_plan'),
    'Tauri startup bootstrap must use the SQL bridge for table-backed workbench state.',
  );
  assert.ok(
    userHomeConfigFiles.has('.sdkwork/birdcoder/code-engine-models.json'),
    'Tauri startup bootstrap must persist code-engine model settings into the canonical OS home config path.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('shell user bootstrap tauri sql contract passed.');
