import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createEnvelope as createTransportEnvelope,
  createListEnvelope as createTransportListEnvelope,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts';
import { createBirdCoderInProcessAppRuntimeTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts';

const traceIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const originalDateNow = Date.now;
Date.now = () => 1779761360000;

try {
  const traceIds = [
    createTransportEnvelope({ id: 'first' }).traceId,
    createTransportEnvelope({ id: 'second' }).traceId,
    createTransportListEnvelope([{ id: 'third' }]).traceId,
    createTransportListEnvelope([{ id: 'fourth' }]).traceId,
  ];
  const appRuntimeTransport = createBirdCoderInProcessAppRuntimeTransport({
    projectService: {} as never,
  });
  const appRuntimeDescriptorEnvelope = await appRuntimeTransport.request<{
    traceId: string;
  }>({
    method: 'GET',
    path: '/app/v3/api/system/descriptor',
  });
  const appRuntimeRoutesEnvelope = await appRuntimeTransport.request<{
    traceId: string;
  }>({
    method: 'GET',
    path: '/app/v3/api/system/routes',
  });
  traceIds.push(
    appRuntimeDescriptorEnvelope.traceId,
    appRuntimeRoutesEnvelope.traceId,
  );

  assert.equal(
    new Set(traceIds).size,
    traceIds.length,
    'transport envelopes must produce unique traceId values even when multiple responses are created in the same millisecond.',
  );
  for (const traceId of traceIds) {
    assert.match(
      traceId,
      traceIdPattern,
      'transport envelope traceId must use a standard UUID v4 shape for per-request correlation.',
    );
  }

  const serverEntrypointSource = fs.readFileSync(
    new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    serverEntrypointSource,
    /function buildTraceId\([^)]*\)[\s\S]*?Date\.now\(\)\.toString\(36\)/u,
    'server API envelope traceId generation must not use timestamp-derived IDs.',
  );
} finally {
  Date.now = originalDateNow;
}

console.log('api envelope traceId contract passed.');
