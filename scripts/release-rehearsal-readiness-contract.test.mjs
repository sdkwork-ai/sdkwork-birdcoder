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
  'pnpm exec sdkwork-app release:plan',
  'Root package.json must expose governed release planning through the shared sdkwork-app facade.',
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
  /Route and OpenAPI counts prove catalog alignment only/u,
  'Operator README must distinguish catalog alignment from runtime execution evidence.',
);
assert.match(
  operatorReadme,
  /Agents runtime bindings and PC device mounts/u,
  'Operator README must link the canonical runtime-binding and device-mount guide.',
);
assert.doesNotMatch(
  operatorReadme,
  /HTTP OpenAPI \d+ operations/u,
  'Operator README must not make a historical OpenAPI count a release-readiness claim.',
);
assert.match(
  governedReleaseRunbook,
  /Rust gateway, PC web artifact, and Tauri desktop/u,
  'Governed release runbook must identify the current Rust and PC evidence scope.',
);
assert.match(governedReleaseRunbook, /H5 and Flutter are outside this release evidence/u);

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

assert.equal(
  appConfig.metadata?.releaseEvidence?.status,
  'blocked',
  'A rehearsal must not promote the pre-launch manifest to release-ready.',
);
assert.deepEqual(
  appConfig.metadata?.releaseEvidence?.blockers,
  [
    'signed-production-artifact-evidence-missing',
  ],
  'The manifest must retain concrete production-release blockers after synthetic rehearsal.',
);

console.log('release rehearsal readiness contract passed.');
