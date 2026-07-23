import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY,
  BIRDCODER_POSTGRESQL_REPOSITORY_TEST_ARGS,
  resolveBirdCoderPostgresqlDsnEnvStatus,
  resolveBirdCoderPostgresqlLiveSmokeConfig,
  runBirdCoderPostgresqlLiveSmoke,
  type BirdCoderPostgresqlCommandRunner,
} from './postgresql-live-smoke.ts';

const rootDir = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
const runnerSource = fs.readFileSync(
  path.join(rootDir, 'scripts', 'run-postgresql-live-smoke.ts'),
  'utf8',
);

assert.equal(
  packageJson.scripts['release:smoke:postgresql-live'],
  'node --experimental-strip-types scripts/run-postgresql-live-smoke.ts',
);
assert.match(runnerSource, /pathToFileURL\(process\.argv\[1\]\)\.href/u);
assert.doesNotMatch(
  `${packageJson.scripts['release:smoke:postgresql-live']}\n${runnerSource}`,
  /coding-sessions|ops_release_record|appConsoleRepository|dataKernel/u,
);
assert.deepEqual(BIRDCODER_POSTGRESQL_REPOSITORY_TEST_ARGS, [
  'test',
  '-p',
  'sdkwork-birdcoder-workspace-repository-sqlx',
  '--tests',
  '--',
  '--ignored',
  '--nocapture',
]);

assert.deepEqual(resolveBirdCoderPostgresqlLiveSmokeConfig({}), {});
assert.deepEqual(resolveBirdCoderPostgresqlLiveSmokeConfig({
  BIRDCODER_POSTGRESQL_DSN: ' postgres://fallback.example/birdcoder ',
  SDKWORK_BIRDCODER_POSTGRES_TEST_URL: ' postgres://canonical.example/birdcoder ',
}), {
  dsn: 'postgres://canonical.example/birdcoder',
  dsnSource: 'SDKWORK_BIRDCODER_POSTGRES_TEST_URL',
});
assert.deepEqual(resolveBirdCoderPostgresqlDsnEnvStatus({
  SDKWORK_BIRDCODER_POSTGRES_TEST_URL: ' ',
}), {
  SDKWORK_BIRDCODER_POSTGRES_TEST_URL: 'empty',
  BIRDCODER_POSTGRESQL_DSN: 'missing',
  BIRDCODER_DATABASE_URL: 'missing',
  DATABASE_URL: 'missing',
  PGURL: 'missing',
});

const blocked = await runBirdCoderPostgresqlLiveSmoke({ env: {} });
assert.equal(blocked.status, 'blocked');
assert.equal(blocked.reasonCode, 'missing_postgresql_test_dsn');
assert.deepEqual(blocked.dsnEnvPriority, [...BIRDCODER_POSTGRESQL_DSN_ENV_PRIORITY]);
assert.match(blocked.dsnPowerShellSetExample ?? '', /SDKWORK_BIRDCODER_POSTGRES_TEST_URL/u);
assert.match(blocked.dsnCmdSetExample ?? '', /SDKWORK_BIRDCODER_POSTGRES_TEST_URL/u);

const invocations: Array<{
  args: readonly string[];
  command: string;
  dsn?: string;
}> = [];
const passingRunner: BirdCoderPostgresqlCommandRunner = async (command, args, options) => {
  invocations.push({
    args,
    command,
    dsn: options.env.SDKWORK_BIRDCODER_POSTGRES_TEST_URL,
  });
  return 0;
};
const passed = await runBirdCoderPostgresqlLiveSmoke({
  cwd: rootDir,
  env: { BIRDCODER_DATABASE_URL: 'postgres://example.test/birdcoder' },
  runCommand: passingRunner,
});
assert.equal(passed.status, 'passed');
assert.deepEqual(passed.checks, ['workspace-repository-postgresql-driver-parity']);
assert.deepEqual(invocations, [{
  args: BIRDCODER_POSTGRESQL_REPOSITORY_TEST_ARGS,
  command: 'cargo',
  dsn: 'postgres://example.test/birdcoder',
}]);

const failed = await runBirdCoderPostgresqlLiveSmoke({
  env: { SDKWORK_BIRDCODER_POSTGRES_TEST_URL: 'postgres://example.test/birdcoder' },
  runCommand: async () => 17,
});
assert.equal(failed.status, 'failed');
assert.equal(failed.reasonCode, 'postgresql_repository_parity_failed');
assert.match(failed.message, /code 17/u);

console.log('postgresql live smoke contract passed.');
