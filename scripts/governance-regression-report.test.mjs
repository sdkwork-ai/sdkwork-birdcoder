import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  GOVERNANCE_REGRESSION_CHECKS,
  RELEASE_GOVERNANCE_CHECK_IDS,
  RELEASE_GOVERNANCE_CHECKS,
  buildGovernanceRegressionCommandEnv,
  resolveGovernanceRegressionCommandInvocation,
  runGovernanceRegressionReport,
  validateGovernanceRegressionCheckTopology,
} from './governance-regression-report.mjs';

assert.equal(GOVERNANCE_REGRESSION_CHECKS, RELEASE_GOVERNANCE_CHECKS);
assert.deepEqual(
  RELEASE_GOVERNANCE_CHECK_IDS,
  [
    'domain-ownership',
    'persistence-ownership',
    'app-api-surface',
    'sdk-owner-boundary',
    'app-sdk-composition',
    'agents-owner-boundary',
    'technical-debt',
    'release-docs-api-sdk',
    'step-loop-prompt-governance',
    'release-readiness-fixture',
    'release-candidate-dry-run',
    'release-closure',
  ],
);
assert.deepEqual(validateGovernanceRegressionCheckTopology(), []);
for (const check of RELEASE_GOVERNANCE_CHECKS) {
  assert.doesNotMatch(
    `${check.id} ${check.label} ${check.command}`,
    /engine|provider-sdk|coding-server|coding-session-projection|kernel-bridge/iu,
  );
}

assert.deepEqual(
  resolveGovernanceRegressionCommandInvocation('node check.mjs', { platform: 'win32' }),
  { command: 'cmd.exe', args: ['/d', '/s', '/c', 'node check.mjs'] },
);
assert.deepEqual(
  resolveGovernanceRegressionCommandInvocation('node check.mjs', {
    env: { SHELL: '/bin/bash' },
    platform: 'linux',
  }),
  { command: '/bin/bash', args: ['-lc', 'node check.mjs'] },
);

const commandEnv = buildGovernanceRegressionCommandEnv({
  env: { PATH: '/usr/bin' },
  execPath: '/opt/node/bin/node',
  platform: 'linux',
});
assert.equal(commandEnv.NODE, '/opt/node/bin/node');
assert.equal(commandEnv.npm_node_execpath, '/opt/node/bin/node');
assert.equal(commandEnv.PATH, '/opt/node/bin:/usr/bin');

const duplicateTopology = validateGovernanceRegressionCheckTopology({
  checks: [
    RELEASE_GOVERNANCE_CHECKS[0],
    { ...RELEASE_GOVERNANCE_CHECKS[0] },
  ],
});
assert.equal(duplicateTopology.length, 1);
assert.match(duplicateTopology[0].messages.join('\n'), /duplicate check id/u);

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-governance-report-'));
try {
  fs.writeFileSync(
    path.join(fixtureRoot, 'package.json'),
    `${JSON.stringify({ scripts: {} }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'scripts', 'pass.mjs'), '');
  fs.writeFileSync(path.join(fixtureRoot, 'scripts', 'block.mjs'), '');
  const checks = [
    { id: 'pass', label: 'Pass', scriptPath: 'scripts/pass.mjs', command: 'node scripts/pass.mjs' },
    { id: 'block', label: 'Block', scriptPath: 'scripts/block.mjs', command: 'node scripts/block.mjs' },
  ];
  const outputPath = path.join(fixtureRoot, 'artifacts', 'governance.json');
  const report = await runGovernanceRegressionReport({
    checks,
    rootDir: fixtureRoot,
    outputPath,
    now: () => new Date('2026-07-23T00:00:00.000Z'),
    async runner(check) {
      return check.id === 'block'
        ? { status: 'blocked', exitCode: 1, stderr: 'environment unavailable' }
        : { status: 'passed', exitCode: 0, stdout: 'passed' };
    },
  });

  assert.equal(report.status, 'blocked');
  assert.deepEqual(report.summary.passedCheckIds, ['pass']);
  assert.deepEqual(report.summary.blockedCheckIds, ['block']);
  assert.deepEqual(report.summary.failedCheckIds, []);
  assert.equal(report.generatedAt, '2026-07-23T00:00:00.000Z');
  assert.equal(fs.existsSync(outputPath), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), report);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('governance regression report contract passed.');
