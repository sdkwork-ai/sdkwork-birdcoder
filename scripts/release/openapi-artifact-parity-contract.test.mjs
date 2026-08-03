import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

const AUTHORITY_REL = 'sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json';

const ARTIFACT_RELS = [
  'artifacts/release/server/openapi/birdcoder-app-api.openapi.json',
  'artifacts/release/server/windows/x64/openapi/birdcoder-app-api.openapi.json',
  'deployments/server-windows/x64/openapi/birdcoder-app-api.openapi.json',
];

const authority = fs.readFileSync(path.join(rootDir, AUTHORITY_REL), 'utf8');
const authorityDoc = JSON.parse(authority);
const authorityOperationIds = Object.values(authorityDoc.paths ?? {}).flatMap((pathItem) =>
  Object.values(pathItem).filter((operation) => operation?.operationId).map((operation) => operation.operationId),
);

for (const artifactRel of ARTIFACT_RELS) {
  const artifactPath = path.join(rootDir, artifactRel);
  assert.ok(fs.existsSync(artifactPath), `Release artifact must exist: ${artifactRel}`);
  const artifactDoc = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const artifactOperationIds = Object.values(artifactDoc.paths ?? {}).flatMap((pathItem) =>
    Object.values(pathItem).filter((operation) => operation?.operationId).map((operation) => operation.operationId),
  );
  assert.deepEqual(
    [...artifactOperationIds].sort(),
    [...authorityOperationIds].sort(),
    `${artifactRel} must expose exactly the authoritative operation set`,
  );
}
