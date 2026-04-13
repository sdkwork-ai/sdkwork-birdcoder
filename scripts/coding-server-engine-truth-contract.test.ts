import assert from 'node:assert/strict';

import {
  getWorkbenchCodeEngineKernel,
  listWorkbenchCodeEngineDescriptors,
  listWorkbenchModelCatalogEntries,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';
import {
  getBirdCoderCodingServerEngineCapabilities,
  getBirdCoderCodingServerEngineDescriptor,
  listBirdCoderCodingServerEngines,
  listBirdCoderCodingServerModels,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const sharedDescriptors = listWorkbenchCodeEngineDescriptors();
const sharedModels = listWorkbenchModelCatalogEntries();

assert.deepEqual(
  listBirdCoderCodingServerEngines(),
  sharedDescriptors,
  'coding-server engine descriptors must be sourced from the shared workbench kernel truth',
);

assert.deepEqual(
  listBirdCoderCodingServerModels(),
  sharedModels,
  'coding-server model catalog must be sourced from the shared workbench kernel truth',
);

for (const descriptor of sharedDescriptors) {
  assert.deepEqual(
    getBirdCoderCodingServerEngineDescriptor(descriptor.engineKey),
    descriptor,
    `${descriptor.engineKey} descriptor must round-trip through coding-server without local reassembly`,
  );
  assert.deepEqual(
    getBirdCoderCodingServerEngineCapabilities(descriptor.engineKey),
    getWorkbenchCodeEngineKernel(descriptor.engineKey).descriptor.capabilityMatrix,
    `${descriptor.engineKey} capabilities must round-trip through coding-server from shared kernel truth`,
  );
}

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
