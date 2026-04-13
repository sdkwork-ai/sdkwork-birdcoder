import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  resolveBirdCoderCodingServerOpenApiSnapshotPath,
  writeBirdCoderCodingServerOpenApiSnapshot,
} from './coding-server-openapi-export.ts';

const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-openapi-export-'));

try {
  const resolvedDefaultPath = resolveBirdCoderCodingServerOpenApiSnapshotPath({
    rootDir: workspaceDir,
  });
  assert.equal(
    resolvedDefaultPath.replaceAll('\\', '/'),
    path.join(workspaceDir, 'artifacts', 'openapi', 'coding-server-v1.json').replaceAll('\\', '/'),
  );

  const explicitOutputPath = path.join(workspaceDir, 'generated', 'coding-server-openapi.json');
  const result = writeBirdCoderCodingServerOpenApiSnapshot({
    distributionId: 'global',
    outputPath: explicitOutputPath,
    rootDir: workspaceDir,
  });

  assert.equal(result.outputPath.replaceAll('\\', '/'), explicitOutputPath.replaceAll('\\', '/'));
  assert.equal(fs.existsSync(explicitOutputPath), true);

  const writtenDocument = JSON.parse(fs.readFileSync(explicitOutputPath, 'utf8'));
  assert.equal(writtenDocument.openapi, '3.1.0');
  assert.equal(writtenDocument.info.version, 'v1');
  assert.equal(
    writtenDocument.paths['/api/core/v1/coding-sessions/:id/events']?.get?.operationId,
    'core.listCodingSessionEvents',
  );
  assert.equal(
    writtenDocument.paths['/api/admin/v1/releases']?.get?.operationId,
    'admin.listReleases',
  );
  assert.match(fs.readFileSync(explicitOutputPath, 'utf8'), /\n$/);
} finally {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
}

console.log('coding server openapi export contract passed.');
