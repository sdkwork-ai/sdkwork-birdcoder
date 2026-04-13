import assert from 'node:assert/strict';

import {
  BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY,
  resolveBirdCoderPostgresqlLiveSmokeConfig,
  runBirdCoderPostgresqlLiveSmoke,
  type BirdCoderPostgresqlOpenConnectionFactory,
} from './postgresql-live-smoke.ts';

const emptyConfig = resolveBirdCoderPostgresqlLiveSmokeConfig({});
assert.deepEqual(emptyConfig, {});

const blockedByMissingDsn = await runBirdCoderPostgresqlLiveSmoke({
  env: {},
});
assert.equal(blockedByMissingDsn.status, 'blocked');
assert.equal(blockedByMissingDsn.reasonCode, 'missing_postgresql_dsn');
assert.deepEqual(blockedByMissingDsn.dsnEnvStatus, {
  BIRDCODER_POSTGRESQL_DSN: 'missing',
  BIRDCODER_DATABASE_URL: 'missing',
  DATABASE_URL: 'missing',
  PGURL: 'missing',
});
assert.equal(
  blockedByMissingDsn.dsnExample,
  'postgresql://<user>:<password>@<host>:5432/<database>',
);
assert.equal(
  blockedByMissingDsn.dsnPowerShellSetExample,
  "$env:BIRDCODER_POSTGRESQL_DSN='postgresql://<user>:<password>@<host>:5432/<database>'",
);
assert.equal(
  blockedByMissingDsn.dsnCmdSetExample,
  "set BIRDCODER_POSTGRESQL_DSN=postgresql://<user>:<password>@<host>:5432/<database>",
);
assert.deepEqual(blockedByMissingDsn.dsnEnvPriority, [...BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY]);
assert.equal(blockedByMissingDsn.rerunCommand, 'pnpm.cmd run release:smoke:postgresql-live');
assert.deepEqual(blockedByMissingDsn.resolutionSteps, [
  'Set one of BIRDCODER_POSTGRESQL_DSN -> BIRDCODER_DATABASE_URL -> DATABASE_URL -> PGURL.',
  'Run pnpm.cmd run release:smoke:postgresql-live.',
]);
assert.match(
  blockedByMissingDsn.resolutionHint ?? '',
  /BIRDCODER_POSTGRESQL_DSN/,
);

const blockedByMissingDriver = await runBirdCoderPostgresqlLiveSmoke({
  env: {
    BIRDCODER_POSTGRESQL_DSN: 'postgresql://birdcoder:secret@127.0.0.1:5432/birdcoder',
  },
  loadOpenConnectionFactory: async () => null,
});
assert.equal(blockedByMissingDriver.status, 'blocked');
assert.equal(blockedByMissingDriver.reasonCode, 'missing_postgresql_driver');
assert.equal(blockedByMissingDriver.dsnSource, 'BIRDCODER_POSTGRESQL_DSN');
assert.deepEqual(blockedByMissingDriver.dsnEnvStatus, {
  BIRDCODER_POSTGRESQL_DSN: 'configured',
  BIRDCODER_DATABASE_URL: 'missing',
  DATABASE_URL: 'missing',
  PGURL: 'missing',
});
assert.equal(blockedByMissingDriver.dsnExample, undefined);
assert.equal(blockedByMissingDriver.dsnPowerShellSetExample, undefined);
assert.equal(blockedByMissingDriver.dsnCmdSetExample, undefined);
assert.deepEqual(blockedByMissingDriver.dsnEnvPriority, [...BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY]);
assert.equal(blockedByMissingDriver.rerunCommand, 'pnpm.cmd run release:smoke:postgresql-live');
assert.deepEqual(blockedByMissingDriver.resolutionSteps, [
  "Install the runtime 'pg' PostgreSQL driver in this environment.",
  'Run pnpm.cmd run release:smoke:postgresql-live.',
]);
assert.match(
  blockedByMissingDriver.resolutionHint ?? '',
  /\bpg\b/i,
);

const connectionRefusedError = new Error('connect ECONNREFUSED 127.0.0.1:55432');
const failedByConnectionRefusal = await runBirdCoderPostgresqlLiveSmoke({
  env: {
    BIRDCODER_POSTGRESQL_DSN: 'postgresql://birdcoder:secret@127.0.0.1:55432/birdcoder',
  },
  openConnectionFactory: async () => {
    throw connectionRefusedError;
  },
});
assert.equal(failedByConnectionRefusal.status, 'failed');
assert.equal(failedByConnectionRefusal.reasonCode, 'postgresql_live_smoke_failed');
assert.equal(failedByConnectionRefusal.dsnSource, 'BIRDCODER_POSTGRESQL_DSN');
assert.equal(failedByConnectionRefusal.message, 'connect ECONNREFUSED 127.0.0.1:55432');
assert.deepEqual(failedByConnectionRefusal.checks, []);

type ReleaseRow = {
  created_at: string;
  id: string;
  is_deleted: boolean;
  manifest_json: Record<string, unknown>;
  release_kind: string;
  release_version: string;
  rollout_stage: string;
  status: string;
  updated_at: string;
  version: number;
};

const queryHistory: string[] = [];
const persistedReleases = new Map<string, ReleaseRow>();

const openConnectionFactory: BirdCoderPostgresqlOpenConnectionFactory = async () => {
  const pendingReleases = new Map<string, ReleaseRow>();
  let transactional = false;

  function listVisibleReleases(): ReleaseRow[] {
    const rows = [...persistedReleases.values()].map((row) => structuredClone(row));
    if (!transactional) {
      return rows;
    }

    for (const row of pendingReleases.values()) {
      rows.push(structuredClone(row));
    }
    return rows;
  }

  return {
    async close() {
      queryHistory.push('-- close --');
    },
    async query(sql: string, params: readonly unknown[] = []) {
      queryHistory.push(sql);

      if (sql === 'BEGIN') {
        transactional = true;
        return { rowCount: 0, rows: [] };
      }

      if (sql === 'ROLLBACK') {
        pendingReleases.clear();
        transactional = false;
        return { rowCount: 0, rows: [] };
      }

      if (sql === 'COMMIT') {
        for (const [id, row] of pendingReleases.entries()) {
          persistedReleases.set(id, structuredClone(row));
        }
        pendingReleases.clear();
        transactional = false;
        return { rowCount: 0, rows: [] };
      }

      if (sql.startsWith('INSERT INTO release_records')) {
        const row: ReleaseRow = {
          id: String(params[0]),
          created_at: String(params[1]),
          updated_at: String(params[2]),
          version: Number(params[3]),
          is_deleted: Boolean(params[4]),
          release_version: String(params[5]),
          release_kind: String(params[6]),
          rollout_stage: String(params[7]),
          manifest_json: (params[8] as Record<string, unknown>) ?? {},
          status: String(params[9]),
        };

        if (transactional) {
          pendingReleases.set(row.id, row);
        } else {
          persistedReleases.set(row.id, row);
        }

        return {
          rowCount: 1,
          rows: [],
        };
      }

      if (sql.startsWith('SELECT COUNT(*)')) {
        return {
          rowCount: 1,
          rows: [
            {
              total: listVisibleReleases().filter((row) => row.is_deleted === false).length,
            },
          ],
        };
      }

      if (sql.startsWith('SELECT * FROM release_records')) {
        const rows = listVisibleReleases().filter((row) => row.is_deleted === false);
        if (sql.includes('WHERE id = $1')) {
          return {
            rowCount: rows.some((row) => row.id === params[0]) ? 1 : 0,
            rows: rows.filter((row) => row.id === params[0]),
          };
        }

        return {
          rowCount: rows.length,
          rows,
        };
      }

      return {
        rowCount: 0,
        rows: [],
      };
    },
  };
};

const passedReport = await runBirdCoderPostgresqlLiveSmoke({
  env: {
    BIRDCODER_POSTGRESQL_DSN: 'postgresql://birdcoder:secret@127.0.0.1:5432/birdcoder',
  },
  openConnectionFactory,
});
assert.equal(passedReport.status, 'passed');
assert.deepEqual(passedReport.checks, [
  'migrations',
  'preflight-clean',
  'transaction-write-visible',
  'transaction-isolation',
  'rollback-clean',
]);
assert.equal(passedReport.rerunCommand, undefined);
assert.equal(passedReport.resolutionSteps, undefined);
assert.equal(passedReport.resolutionHint, undefined);
assert.equal(passedReport.dsnEnvStatus, undefined);
assert.equal(passedReport.dsnExample, undefined);
assert.equal(passedReport.dsnPowerShellSetExample, undefined);
assert.equal(passedReport.dsnCmdSetExample, undefined);

const blockedByEmptyDsn = await runBirdCoderPostgresqlLiveSmoke({
  env: {
    BIRDCODER_POSTGRESQL_DSN: '   ',
  },
});
assert.equal(blockedByEmptyDsn.status, 'blocked');
assert.equal(blockedByEmptyDsn.reasonCode, 'missing_postgresql_dsn');
assert.deepEqual(blockedByEmptyDsn.dsnEnvStatus, {
  BIRDCODER_POSTGRESQL_DSN: 'empty',
  BIRDCODER_DATABASE_URL: 'missing',
  DATABASE_URL: 'missing',
  PGURL: 'missing',
});
assert.equal(
  blockedByEmptyDsn.dsnExample,
  'postgresql://<user>:<password>@<host>:5432/<database>',
);
assert.equal(
  blockedByEmptyDsn.dsnPowerShellSetExample,
  "$env:BIRDCODER_POSTGRESQL_DSN='postgresql://<user>:<password>@<host>:5432/<database>'",
);
assert.equal(
  blockedByEmptyDsn.dsnCmdSetExample,
  "set BIRDCODER_POSTGRESQL_DSN=postgresql://<user>:<password>@<host>:5432/<database>",
);
assert.equal(
  queryHistory.includes('BEGIN') && queryHistory.includes('ROLLBACK'),
  true,
  'postgresql live smoke should exercise transactional fork and rollback behavior.',
);
assert.equal(
  queryHistory.some((sql) => sql.startsWith('INSERT INTO release_records')),
  true,
  'postgresql live smoke should exercise representative release repository writes.',
);

console.log('postgresql live smoke contract passed.');
