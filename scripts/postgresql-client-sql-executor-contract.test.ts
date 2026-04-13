import assert from 'node:assert/strict';

import { getBirdCoderEntityDefinition } from '../packages/sdkwork-birdcoder-types/src/index.ts';
import { createBirdCoderTableSqlPlanner } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlPlans.ts';
import { createBirdCoderPostgresqlClientSqlExecutor } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/sqlBackendExecutors.ts';

const queryHistory: Array<{
  connectionId: string;
  params: readonly unknown[];
  sql: string;
}> = [];

function createConnection(connectionId: string) {
  return {
    async close() {
      queryHistory.push({
        connectionId,
        params: [],
        sql: '-- close --',
      });
    },
    async query(sql: string, params: readonly unknown[] = []) {
      queryHistory.push({
        connectionId,
        params,
        sql,
      });

      if (sql.startsWith('SELECT COUNT(*)')) {
        return {
          rowCount: 1,
          rows: [{ total: 1 }],
        };
      }

      if (sql.startsWith('SELECT * FROM release_records')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'release-postgres-1',
              created_at: '2026-04-10T17:00:00.000Z',
              updated_at: '2026-04-10T17:00:00.000Z',
              version: 0,
              is_deleted: false,
              release_version: '0.5.0-postgres',
              release_kind: 'formal',
              rollout_stage: 'canary',
              manifest_json: { channel: 'beta' },
              status: 'ready',
            },
          ],
        };
      }

      return {
        rowCount: 1,
        rows: [],
      };
    },
  };
}

let connectionCount = 0;

const sqlExecutor = createBirdCoderPostgresqlClientSqlExecutor({
  openConnection: async () => createConnection(`connection-${++connectionCount}`),
});

const planner = createBirdCoderTableSqlPlanner({
  binding: {
    entityName: 'release_record',
    preferredProvider: 'postgresql',
    storageKey: 'release-records.v1',
    storageMode: 'table',
    storageScope: 'governance',
  },
  definition: getBirdCoderEntityDefinition('release_record'),
  providerId: 'postgresql',
});

const countResult = await sqlExecutor.execute(planner.buildCountPlan());
assert.equal(countResult.rows?.[0]?.total, 1);

const listResult = await sqlExecutor.execute(planner.buildListPlan());
assert.equal(listResult.rows?.[0]?.id, 'release-postgres-1');

const transaction = await sqlExecutor.fork();
await transaction.execute(
  planner.buildUpsertPlan([
    {
      id: 'release-postgres-2',
      created_at: '2026-04-10T17:00:02.000Z',
      updated_at: '2026-04-10T17:00:02.000Z',
      version: 0,
      is_deleted: false,
      release_version: '0.5.1-postgres',
      release_kind: 'hotfix',
      rollout_stage: 'general-availability',
      manifest_json: {
        channel: 'stable',
      },
      status: 'ready',
    },
  ]),
);
await transaction.commit();

assert.equal(
  queryHistory.some((entry) => entry.sql.includes('WHERE is_deleted = $1')),
  true,
  'postgresql executor should preserve provider placeholders',
);
assert.equal(
  queryHistory.some((entry) => entry.sql === 'BEGIN'),
  true,
  'postgresql transaction executor should begin a transaction on fork',
);
assert.equal(
  queryHistory.some((entry) => entry.sql === 'COMMIT'),
  true,
  'postgresql transaction executor should commit the forked transaction',
);

console.log('postgresql client sql executor contract passed.');
