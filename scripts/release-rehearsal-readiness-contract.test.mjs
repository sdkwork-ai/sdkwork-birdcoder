import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const appConfig = JSON.parse(read('sdkwork.app.config.json'));
const ciWorkflow = read('.github/workflows/ci.yml');
const governanceReport = read('scripts/governance-regression-report.mjs');

assert.equal(
  packageJson.scripts['release:fixture:ready'],
  'node scripts/release/write-readiness-fixture.mjs',
  'Root package.json must expose release:fixture:ready for synthetic readiness evidence.',
);
assert.equal(
  packageJson.scripts['release:candidate:dry-run'],
  'node scripts/release/candidate-dry-run.mjs',
  'Root package.json must expose release:candidate:dry-run for commercial rehearsal.',
);
assert.equal(
  packageJson.scripts['release:plan'],
  'node scripts/release/local-release-command.mjs plan',
  'Root package.json must expose release:plan for governed release planning.',
);

assert.match(
  ciWorkflow,
  /pnpm release:fixture:ready[\s\S]*pnpm release:candidate:dry-run/u,
  'CI must run release readiness fixture and candidate dry-run in order.',
);
assert.match(
  ciWorkflow,
  /release-candidate-dry-run-evidence/u,
  'CI must upload release candidate dry-run evidence artifact.',
);

const operatorReadme = read('docs/guides/operator/README.md');
const governedReleaseRunbook = read('docs/guides/operator/first-governed-release.md');

assert.match(
  operatorReadme,
  /HTTP OpenAPI 161 operations[\s\S]*route catalog 162/u,
  'Operator README must record HTTP OpenAPI 161-operation completeness and 162-entry route catalog truth.',
);
assert.match(
  operatorReadme,
  /surface-manifest-parity|Four surfaces gated/u,
  'Operator README must reference four-surface manifest parity.',
);
assert.match(
  governedReleaseRunbook,
  /apps\/sdkwork-birdcoder-\{pc,h5,flutter-mobile\}/u,
  'Governed release runbook must reference all surface manifests.',
);

assert.match(
  governanceReport,
  /release-readiness-fixture/u,
  'Governance regression report must track release readiness fixture gate.',
);
assert.match(
  governanceReport,
  /release-candidate-dry-run/u,
  'Governance regression report must track release candidate dry-run gate.',
);

assert.match(
  String(appConfig.metadata?.releaseEvidenceStatus ?? ''),
  /release-rehearsal|contract-gates-green/u,
  'App manifest must record contract-gate or release-rehearsal readiness.',
);

console.log('release rehearsal readiness contract passed.');
