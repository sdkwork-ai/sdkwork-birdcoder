import assert from 'node:assert/strict';

import {
  getBirdCoderCodeEngineCapabilities,
  getBirdCoderCodeEngineDescriptor,
  getWorkbenchCodeEngineKernel,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
  listWorkbenchCodeEngineDescriptors,
  listWorkbenchModelCatalogEntries,
} from '../packages/sdkwork-birdcoder-codeengine/src/index.ts';
import {
  getBirdCoderCodingServerEngineCapabilities,
  getBirdCoderCodingServerEngineDescriptor,
  listBirdCoderCodingServerEngines,
  listBirdCoderCodingServerModels,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const sharedDescriptors = listWorkbenchCodeEngineDescriptors();
const sharedModels = listWorkbenchModelCatalogEntries();

assert.deepEqual(
  listBirdCoderCodeEngineDescriptors(),
  sharedDescriptors,
  'codeengine descriptors must be sourced from the shared workbench kernel truth',
);

assert.deepEqual(
  listBirdCoderCodeEngineModels(),
  sharedModels,
  'codeengine model catalog must be sourced from the shared workbench kernel truth',
);

assert.deepEqual(
  listBirdCoderCodingServerEngines(),
  listBirdCoderCodeEngineDescriptors(),
  'coding-server engine descriptors must delegate to codeengine catalog truth',
);

assert.deepEqual(
  listBirdCoderCodingServerModels(),
  listBirdCoderCodeEngineModels(),
  'coding-server model catalog must delegate to codeengine catalog truth',
);

for (const descriptor of sharedDescriptors) {
  assert.deepEqual(
    getBirdCoderCodeEngineDescriptor(descriptor.engineKey),
    descriptor,
    `${descriptor.engineKey} descriptor must round-trip through codeengine without fallback assembly`,
  );
  assert.deepEqual(
    getBirdCoderCodeEngineCapabilities(descriptor.engineKey),
    getWorkbenchCodeEngineKernel(descriptor.engineKey).descriptor.capabilityMatrix,
    `${descriptor.engineKey} capabilities must round-trip through codeengine from shared kernel truth`,
  );
  assert.deepEqual(
    getBirdCoderCodingServerEngineDescriptor(descriptor.engineKey),
    descriptor,
    `${descriptor.engineKey} descriptor must round-trip through coding-server via codeengine catalog truth`,
  );
  assert.deepEqual(
    getBirdCoderCodingServerEngineCapabilities(descriptor.engineKey),
    getWorkbenchCodeEngineKernel(descriptor.engineKey).descriptor.capabilityMatrix,
    `${descriptor.engineKey} capabilities must round-trip through coding-server via codeengine catalog truth`,
  );
}

assert.equal(
  getBirdCoderCodeEngineDescriptor('missing-engine'),
  null,
  'codeengine must keep unknown engine descriptors explicit instead of silently falling back',
);

assert.equal(
  getBirdCoderCodeEngineCapabilities('missing-engine'),
  null,
  'codeengine must keep unknown engine capabilities explicit instead of silently falling back',
);

assert.equal(
  getBirdCoderCodingServerEngineDescriptor('missing-engine'),
  null,
  'coding-server must keep unknown engine descriptors explicit instead of silently falling back',
);

assert.equal(
  getBirdCoderCodingServerEngineCapabilities('missing-engine'),
  null,
  'coding-server must keep unknown engine capabilities explicit instead of silently falling back',
);

console.log('coding server engine truth contract passed.');
