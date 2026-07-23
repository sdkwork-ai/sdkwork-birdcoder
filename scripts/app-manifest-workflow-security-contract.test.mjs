import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const manifest = readJson('sdkwork.app.config.json');
const workflow = readJson('sdkwork.workflow.json');

assert.equal(workflow.security?.sbomRequired, true, 'Release workflow must require SBOM evidence.');
assert.equal(workflow.security?.signingRequired, true, 'Release workflow must require signing evidence.');
assert.equal(workflow.security?.artifactAttestations, true, 'Release workflow must require artifact attestations.');

assert.equal(
  manifest.metadata?.releaseEvidence?.status,
  'blocked',
  'Security policy declarations are not a substitute for signed production artifact evidence.',
);
assert.equal(
  manifest.metadata?.releaseEvidence?.blockers?.includes(
    'signed-production-artifact-evidence-missing',
  ),
  true,
  'The pre-launch manifest must identify missing signed artifact evidence.',
);

const security = manifest.security ?? {};
assert.equal(
  security.checksumRequired,
  true,
  'Root manifest must require checksum verification for commercial release readiness.',
);
assert.equal(
  security.sbomRequired,
  true,
  'Root manifest must require SBOM evidence for commercial release readiness.',
);
assert.equal(
  security.signatureRequired,
  true,
  'Root manifest must require signing evidence for commercial release readiness.',
);

assert.equal(
  fs.existsSync(path.join(rootDir, 'SECURITY.md')),
  true,
  'Repository must publish SECURITY.md before commercial release readiness.',
);

console.log('app manifest workflow security contract passed.');
