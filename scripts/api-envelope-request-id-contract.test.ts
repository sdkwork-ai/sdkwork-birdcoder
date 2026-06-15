import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createEnvelope as createTransportEnvelope,
  createListEnvelope as createTransportListEnvelope,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts';
import { createBirdCoderInProcessAppRuntimeTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts';

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const originalDateNow = Date.now;
Date.now = () => 1779761360000;

try {
  const requestIds = [
    createTransportEnvelope({ id: 'first' }).requestId,
    createTransportEnvelope({ id: 'second' }).requestId,
    createTransportListEnvelope([{ id: 'third' }]).requestId,
    createTransportListEnvelope([{ id: 'fourth' }]).requestId,
  ];
  const appRuntimeTransport = createBirdCoderInProcessAppRuntimeTransport({
    projectService: {} as never,
  });
  const appRuntimeDescriptorEnvelope = await appRuntimeTransport.request<{
    requestId: string;
  }>({
    method: 'GET',
    path: '/app/v3/api/system/descriptor',
  });
  const appRuntimeRoutesEnvelope = await appRuntimeTransport.request<{
    requestId: string;
  }>({
    method: 'GET',
    path: '/app/v3/api/system/routes',
  });
  requestIds.push(
    appRuntimeDescriptorEnvelope.requestId,
    appRuntimeRoutesEnvelope.requestId,
  );

  assert.equal(
    new Set(requestIds).size,
    requestIds.length,
    'transport envelopes must produce unique requestId values even when multiple responses are created in the same millisecond.',
  );
  for (const requestId of requestIds) {
    assert.match(
      requestId,
      requestIdPattern,
      'transport envelope requestId must use a standard UUID v4 shape for per-request correlation.',
    );
  }

  const serverEntrypointSource = fs.readFileSync(
    new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    serverEntrypointSource,
    /function buildRequestId\([^)]*\)[\s\S]*?Date\.now\(\)\.toString\(36\)/u,
    'server API envelope requestId generation must not use timestamp-derived IDs.',
  );
} finally {
  Date.now = originalDateNow;
}

console.log('api envelope request id contract passed.');
