import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildBirdCoderCodingServerOpenApiDocument,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function computeSha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const rootDir = process.cwd();
const expectedDocument = buildBirdCoderCodingServerOpenApiDocument();
const activeSnapshotPath = path.join(rootDir, 'artifacts', 'openapi', 'coding-server-v1.json');

if (!fs.existsSync(activeSnapshotPath)) {
  console.log('coding server openapi snapshot drift contract skipped: artifacts/openapi/coding-server-v1.json is missing.');
  process.exit(0);
}

assert.deepEqual(
  readJson(activeSnapshotPath),
  expectedDocument,
  'artifacts/openapi/coding-server-v1.json must stay aligned with the live OpenAPI export source.',
);

const releaseAssetsDir = path.join(rootDir, 'artifacts', 'release');
const releaseManifestPath = path.join(releaseAssetsDir, 'release-manifest.json');
if (fs.existsSync(releaseManifestPath)) {
  const manifest = readJson(releaseManifestPath);
  const evidence = manifest.codingServerOpenApiEvidence ?? null;
  assert.ok(
    evidence,
    'artifacts/release/release-manifest.json must preserve codingServerOpenApiEvidence when server release assets exist.',
  );

  const canonicalRelativePath = String(evidence.canonicalRelativePath ?? '').trim();
  const packagedSnapshotPath = path.join(releaseAssetsDir, ...canonicalRelativePath.split('/'));
  assert.ok(
    fs.existsSync(packagedSnapshotPath),
    `release manifest references a missing packaged coding-server OpenAPI sidecar: ${packagedSnapshotPath}`,
  );
  assert.deepEqual(
    readJson(packagedSnapshotPath),
    expectedDocument,
    'packaged server OpenAPI sidecar must stay aligned with the live OpenAPI export source.',
  );
  assert.equal(
    computeSha256(packagedSnapshotPath),
    String(evidence.sha256 ?? '').trim(),
    'release manifest codingServerOpenApiEvidence.sha256 must match the packaged OpenAPI sidecar.',
  );
}

console.log('coding server openapi snapshot drift contract passed.');
