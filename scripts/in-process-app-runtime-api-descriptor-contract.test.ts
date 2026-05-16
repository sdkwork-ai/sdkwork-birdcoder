import assert from 'node:assert/strict';

import { createBirdCoderInProcessAppRuntimeTransport } from '../packages/sdkwork-birdcoder-infrastructure/src/services/appRuntimeTransport.ts';
import { createBirdCoderAppSdkApiClient } from '../packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts';

const transport = createBirdCoderInProcessAppRuntimeTransport({
  projectService: {} as never,
});
const client = createBirdCoderAppSdkApiClient({
  transport,
});

const descriptor = await client.getDescriptor();

assert.equal(
  'basePath' in descriptor.gateway,
  false,
  'in-process coding-server descriptor gateway must not expose a third top-level basePath.',
);
assert.deepEqual(descriptor.surfaces, ['app', 'backend']);
assert.deepEqual(
  descriptor.gateway.surfaces.map((surface) => surface.basePath),
  ['/app/v3/api', '/backend/v3/api'],
  'in-process coding-server descriptor must keep app/backend surface base paths as the only API bases.',
);

console.log('in-process app runtime API descriptor contract passed.');
