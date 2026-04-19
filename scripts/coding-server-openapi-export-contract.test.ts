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
  assert.equal(writtenDocument.servers[0]?.url, '/');
  assert.equal(writtenDocument['x-sdkwork-api-gateway']?.routeCatalogPath, '/api/core/v1/routes');
  assert.equal(writtenDocument['x-sdkwork-api-gateway']?.routeCount, 57);
  assert.deepEqual(writtenDocument['x-sdkwork-api-gateway']?.routesBySurface, {
    core: 19,
    app: 31,
    admin: 7,
  });
  assert.equal(
    writtenDocument.paths['/api/core/v1/routes']?.get?.operationId,
    'core.listRoutes',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/native-sessions']?.get?.operationId,
    'core.listNativeSessions',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/native-sessions/{id}']?.get?.operationId,
    'core.getNativeSession',
  );
  assert.equal(
    writtenDocument.paths['/api/core/v1/coding-sessions/{id}/events']?.get?.operationId,
    'core.listCodingSessionEvents',
  );
  assert.equal(
    writtenDocument.paths['/api/admin/v1/releases']?.get?.operationId,
    'admin.listReleases',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/projects/{projectId}/publish']?.post?.operationId,
    'app.publishProject',
  );
  assert.equal(
    writtenDocument.paths['/api/app/v1/workspaces/{workspaceId}/realtime']?.get?.operationId,
    'app.subscribeWorkspaceRealtime',
  );
  assert.match(fs.readFileSync(explicitOutputPath, 'utf8'), /\n$/);
} finally {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
}

console.log('coding server openapi export contract passed.');
