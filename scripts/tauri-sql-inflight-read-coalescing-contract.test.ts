import assert from 'node:assert/strict';
import { executeStoredSqlPlan } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/runtime.ts';
import type { BirdCoderSqlPlan } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlPlans.ts';

const originalWindow = Reflect.get(globalThis, 'window');
const releaseInvokeTasks: Array<() => void> = [];
let invokedSqlPlanCount = 0;

Reflect.set(globalThis, 'window', {
  __TAURI_INTERNALS__: {
    async invoke(command: string, args?: { plan?: BirdCoderSqlPlan }) {
      assert.equal(
        command,
        'local_sql_execute_plan',
        'This contract only exercises SQL plan execution through the Tauri bridge.',
      );
      assert.ok(args?.plan, 'SQL plan execution must forward the plan payload.');
      invokedSqlPlanCount += 1;
      await new Promise<void>((resolve) => {
        releaseInvokeTasks.push(resolve);
      });
      return {
        affectedRowCount: 0,
        rows: [{ id: 'read-result' }],
      };
    },
  },
});

try {
  const readPlan = {
    intent: 'read',
    meta: {
      codingSessionIds: ['session-1'],
      excludeDeleted: true,
      kind: 'coding-session-messages-by-session-ids',
      orderBy: [
        { column: 'created_at', direction: 'asc' },
        { column: 'id', direction: 'asc' },
      ],
      tableName: 'coding_session_messages',
    },
    providerId: 'sqlite',
    statements: [
      {
        params: ['0', 'session-1'],
        sql:
          'SELECT * FROM coding_session_messages ' +
          'WHERE is_deleted = ?1 AND coding_session_id IN (?2) ' +
          'ORDER BY created_at ASC, id ASC;',
      },
    ],
    transactional: false,
  } satisfies BirdCoderSqlPlan;

  const firstRead = executeStoredSqlPlan(readPlan);
  const duplicateRead = executeStoredSqlPlan(readPlan);
  await Promise.resolve();

  assert.equal(
    invokedSqlPlanCount,
    1,
    'Concurrent identical read-only SQL plans must share the same in-flight Tauri IPC task.',
  );
  assert.equal(
    releaseInvokeTasks.length,
    1,
    'Concurrent identical read-only SQL plans must not enqueue duplicate bridge invocations.',
  );

  releaseInvokeTasks[0]!();
  const [firstResult, duplicateResult] = await Promise.all([firstRead, duplicateRead]);
  assert.deepEqual(
    duplicateResult,
    firstResult,
    'A coalesced read-only SQL plan must resolve with the same normalized bridge result.',
  );

  const nextRead = executeStoredSqlPlan(readPlan);
  await Promise.resolve();
  assert.equal(
    invokedSqlPlanCount,
    2,
    'Read-only SQL coalescing must clear after settlement and must not become a stale result cache.',
  );
  releaseInvokeTasks[1]!();
  await nextRead;
} finally {
  if (typeof originalWindow === 'undefined') {
    Reflect.deleteProperty(globalThis, 'window');
  } else {
    Reflect.set(globalThis, 'window', originalWindow);
  }
}

console.log('tauri sql inflight read coalescing contract passed.');
