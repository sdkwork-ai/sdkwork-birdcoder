import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ComposedSdkProjectRuntimeLocationRegistrationPort,
  type ProjectRuntimeLocationRegistrationSdkPort,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ComposedSdkProjectRuntimeLocationRegistrationPort.ts';
import type {
  DesktopRuntimeLocationBindingIdentity,
  DesktopRuntimeLocationIdentityPort,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IDesktopRuntimeLocationIdentityPort.ts';
import type { BirdCoderProjectRuntimeLocationRecord } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

const defaultIdeServicesSource = fs.readFileSync(path.join(
  process.cwd(),
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
), 'utf8');
const registrationAdapterSource = fs.readFileSync(path.join(
  process.cwd(),
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ComposedSdkProjectRuntimeLocationRegistrationPort.ts',
), 'utf8');
assert.match(
  defaultIdeServicesSource,
  /const projectRuntimeLocationRegistrationPort = hasBoundAppClient[\s\S]*?new ComposedSdkProjectRuntimeLocationRegistrationPort/s,
  'The remote registration adapter must be injected only when the composed app SDK is actually bound.',
);
assert.match(
  defaultIdeServicesSource,
  /new RuntimeProjectRuntimeLocationService\(\{[\s\S]*?registrationPort: projectRuntimeLocationRegistrationPort/s,
  'The shared IDE runtime must pass the registration adapter into the canonical runtime-location resolver.',
);
assert.doesNotMatch(
  registrationAdapterSource,
  /runtimeLocations\.preferences|requestVerification|terminalAvailable|gitAvailable|buildAvailable|fileSystemAvailable|healthStatus/u,
  'The desktop registration adapter must not self-report preferences, capabilities, verification, or health.',
);

const input = {
  absolutePath: 'E:\\work\\runtime-location-project',
  displayName: 'runtime-location-project',
  projectId: 'project-runtime-location',
};

function createIdentity(
  overrides: Partial<DesktopRuntimeLocationBindingIdentity> = {},
): DesktopRuntimeLocationBindingIdentity {
  return {
    displayName: 'runtime-location-project',
    locationKind: 'desktop_checkout',
    pathFlavor: 'windows',
    requiresRebind: false,
    rootLocator: 'desktop-root:22222222-2222-4222-8222-222222222222',
    runtimeLocationCreateGeneration: 0,
    runtimeTargetId: 'desktop-device:11111111-1111-4111-8111-111111111111',
    runtimeTargetKind: 'desktop_device',
    ...overrides,
  };
}

function createRemoteRecord(
  identity: DesktopRuntimeLocationBindingIdentity,
  overrides: Partial<BirdCoderProjectRuntimeLocationRecord> = {},
): BirdCoderProjectRuntimeLocationRecord {
  return {
    id: identity.runtimeLocationId ?? 'runtime-location-1',
    rootLocator: identity.rootLocator,
    runtimeTargetId: identity.runtimeTargetId,
    version: identity.runtimeLocationVersion ?? 'version-1',
    ...overrides,
  };
}

function createIdentityPort(initialIdentity: DesktopRuntimeLocationBindingIdentity) {
  let identity = initialIdentity;
  const clearInputs: Parameters<DesktopRuntimeLocationIdentityPort['clearRemoteRuntimeLocationBinding']>[0][] = [];
  const persistInputs: Parameters<DesktopRuntimeLocationIdentityPort['persistRemoteRuntimeLocationBinding']>[0][] = [];
  const identityPort: DesktopRuntimeLocationIdentityPort = {
    async resolveDesktopRuntimeLocationBinding() {
      return identity;
    },
    async persistRemoteRuntimeLocationBinding(persistInput) {
      persistInputs.push(persistInput);
      identity = {
        ...identity,
        requiresRebind: false,
        runtimeLocationId: persistInput.runtimeLocationId,
        runtimeLocationVersion: persistInput.runtimeLocationVersion,
      };
    },
    async clearRemoteRuntimeLocationBinding(clearInput) {
      clearInputs.push(clearInput);
      const {
        runtimeLocationId: _runtimeLocationId,
        runtimeLocationVersion: _runtimeLocationVersion,
        ...identityWithoutRemoteBinding
      } = identity;
      identity = {
        ...identityWithoutRemoteBinding,
        requiresRebind: false,
        runtimeLocationCreateGeneration: identity.runtimeLocationCreateGeneration + 1,
      };
    },
  };
  return {
    clearInputs,
    getIdentity: () => identity,
    identityPort,
    persistInputs,
  };
}

const initialIdentity = createIdentity();
const initialIdentityPort = createIdentityPort(initialIdentity);
const createInputs: Array<Parameters<ProjectRuntimeLocationRegistrationSdkPort['createProjectRuntimeLocation']>> = [];
const createSdkPort: ProjectRuntimeLocationRegistrationSdkPort = {
  async createProjectRuntimeLocation(...args) {
    createInputs.push(args);
    return createRemoteRecord(initialIdentity);
  },
  async getProjectRuntimeLocation() {
    throw new Error('Unexpected retrieve for an unregistered location.');
  },
  async rebindProjectRuntimeLocation() {
    throw new Error('Unexpected rebind for an unregistered location.');
  },
};
const createAdapter = new ComposedSdkProjectRuntimeLocationRegistrationPort({
  identityPort: initialIdentityPort.identityPort,
  sdkPort: createSdkPort,
});
assert.deepEqual(
  await createAdapter.inspectLocalDesktopRuntimeLocation(input),
  { remoteSynchronization: 'pending' },
);
assert.deepEqual(
  await createAdapter.synchronizeLocalDesktopRuntimeLocation(input),
  { remoteSynchronization: 'registered', runtimeLocationId: 'runtime-location-1' },
);
assert.equal(createInputs.length, 1);
const [createProjectId, createRequest] = createInputs[0]!;
assert.equal(createProjectId, input.projectId);
assert.deepEqual(
  Object.keys(createRequest).sort(),
  [
    'absolutePath',
    'displayName',
    'idempotencyKey',
    'locationKind',
    'pathFlavor',
    'rootLocator',
    'runtimeTargetId',
    'runtimeTargetKind',
  ],
  'Create must send only trusted identity, write-only path material, and a standard idempotency key.',
);
assert.equal(createRequest.absolutePath, input.absolutePath);
assert.equal(createRequest.idempotencyKey.includes(input.absolutePath), false);
assert.equal('terminalAvailable' in createRequest, false);
assert.equal('gitRepositoryUrl' in createRequest, false);
assert.equal('healthStatus' in createRequest, false);
assert.equal('capability' in createRequest, false);
assert.equal(initialIdentityPort.persistInputs.length, 1);
assert.deepEqual(initialIdentityPort.persistInputs[0], {
  absolutePath: input.absolutePath,
  projectId: input.projectId,
  rootLocator: initialIdentity.rootLocator,
  runtimeLocationId: 'runtime-location-1',
  runtimeLocationVersion: 'version-1',
});

const cachedIdentity = createIdentity({
  runtimeLocationId: 'runtime-location-cached',
  runtimeLocationVersion: 'version-cached',
});
const cachedIdentityPort = createIdentityPort(cachedIdentity);
let cachedCreateCalls = 0;
let cachedRetrieveCalls = 0;
let cachedNow = 1_000;
const cachedAdapter = new ComposedSdkProjectRuntimeLocationRegistrationPort({
  identityPort: cachedIdentityPort.identityPort,
  now: () => cachedNow,
  sdkPort: {
    async createProjectRuntimeLocation() {
      cachedCreateCalls += 1;
      throw new Error('Cached binding must not create a duplicate runtime location.');
    },
    async getProjectRuntimeLocation() {
      cachedRetrieveCalls += 1;
      return createRemoteRecord(cachedIdentity);
    },
    async rebindProjectRuntimeLocation() {
      throw new Error('Cached binding must not rebind without a changed path.');
    },
  },
});
assert.deepEqual(
  await cachedAdapter.inspectLocalDesktopRuntimeLocation(input),
  { remoteSynchronization: 'registered', runtimeLocationId: 'runtime-location-cached' },
);
assert.deepEqual(
  await cachedAdapter.synchronizeLocalDesktopRuntimeLocation(input),
  { remoteSynchronization: 'registered', runtimeLocationId: 'runtime-location-cached' },
);
assert.equal(cachedCreateCalls, 0);
assert.equal(cachedRetrieveCalls, 1, 'A cached binding is validated without another create call.');
await cachedAdapter.synchronizeLocalDesktopRuntimeLocation(input);
assert.equal(
  cachedRetrieveCalls,
  1,
  'A recently validated cached binding must not issue an extra remote round trip.',
);
cachedNow += 5 * 60 * 1_000;
await cachedAdapter.synchronizeLocalDesktopRuntimeLocation(input);
assert.equal(
  cachedRetrieveCalls,
  2,
  'A cached binding is revalidated after its bounded five-minute validation interval.',
);

const retryIdentity = createIdentity();
const retryIdentityPort = createIdentityPort(retryIdentity);
const retryCreateKeys: string[] = [];
let retryCreateAttempts = 0;
const retryAdapter = new ComposedSdkProjectRuntimeLocationRegistrationPort({
  identityPort: retryIdentityPort.identityPort,
  sdkPort: {
    async createProjectRuntimeLocation(_projectId, request) {
      retryCreateAttempts += 1;
      retryCreateKeys.push(request.idempotencyKey);
      if (retryCreateAttempts === 1) {
        throw new Error('Transient create transport failure');
      }
      return createRemoteRecord(retryIdentity, { id: 'runtime-location-retry' });
    },
    async getProjectRuntimeLocation() {
      throw new Error('A failed initial create has no cached remote record to retrieve.');
    },
    async rebindProjectRuntimeLocation() {
      throw new Error('A failed initial create must not rebind.');
    },
  },
});
await assert.rejects(
  retryAdapter.synchronizeLocalDesktopRuntimeLocation(input),
  /Transient create transport failure/u,
);
assert.equal(retryIdentityPort.getIdentity().runtimeLocationCreateGeneration, 0);
await retryAdapter.synchronizeLocalDesktopRuntimeLocation(input);
assert.equal(retryCreateKeys.length, 2);
assert.equal(
  retryCreateKeys[0],
  retryCreateKeys[1],
  'Ordinary retry after a transient create failure must retain its durable idempotency generation.',
);

const rebindIdentity = createIdentity({
  requiresRebind: true,
  runtimeLocationId: 'runtime-location-rebind',
  runtimeLocationVersion: 'version-before-rebind',
});
const rebindIdentityPort = createIdentityPort(rebindIdentity);
const rebindInputs: Array<Parameters<ProjectRuntimeLocationRegistrationSdkPort['rebindProjectRuntimeLocation']>> = [];
const rebindAdapter = new ComposedSdkProjectRuntimeLocationRegistrationPort({
  identityPort: rebindIdentityPort.identityPort,
  sdkPort: {
    async createProjectRuntimeLocation() {
      throw new Error('Changed paths with a cached remote ID must rebind.');
    },
    async getProjectRuntimeLocation() {
      throw new Error('The semantic SDK rebind method owns retrieve-after-command.');
    },
    async rebindProjectRuntimeLocation(...args) {
      rebindInputs.push(args);
      return createRemoteRecord(rebindIdentity, { version: 'version-after-rebind' });
    },
  },
});
await rebindAdapter.synchronizeLocalDesktopRuntimeLocation(input);
assert.equal(rebindInputs.length, 1);
assert.equal(rebindInputs[0]![0], input.projectId);
assert.equal(rebindInputs[0]![1], 'runtime-location-rebind');
assert.equal(rebindInputs[0]![2].idempotencyKey.includes(input.absolutePath), false);
assert.equal(rebindIdentityPort.persistInputs[0]?.runtimeLocationVersion, 'version-after-rebind');

const staleIdentity = createIdentity({
  runtimeLocationId: 'runtime-location-stale',
  runtimeLocationVersion: 'version-stale',
});
const staleIdentityPort = createIdentityPort(staleIdentity);
let staleCreateCalls = 0;
let staleCreateIdempotencyKey = '';
const staleAdapter = new ComposedSdkProjectRuntimeLocationRegistrationPort({
  identityPort: staleIdentityPort.identityPort,
  sdkPort: {
    async createProjectRuntimeLocation(_projectId, request) {
      staleCreateCalls += 1;
      staleCreateIdempotencyKey = request.idempotencyKey;
      return createRemoteRecord(staleIdentity, { id: 'runtime-location-recreated' });
    },
    async getProjectRuntimeLocation() {
      throw { httpStatus: 404 };
    },
    async rebindProjectRuntimeLocation() {
      throw new Error('A deleted remote record must recreate after clearing the stale local ID.');
    },
  },
});
assert.deepEqual(
  await staleAdapter.synchronizeLocalDesktopRuntimeLocation(input),
  { remoteSynchronization: 'registered', runtimeLocationId: 'runtime-location-recreated' },
);
assert.equal(staleIdentityPort.clearInputs.length, 1);
assert.equal(staleCreateCalls, 1);
assert.equal(staleIdentityPort.getIdentity().runtimeLocationId, 'runtime-location-recreated');
assert.equal(staleIdentityPort.getIdentity().runtimeLocationCreateGeneration, 1);
assert.notEqual(
  staleCreateIdempotencyKey,
  createRequest.idempotencyKey,
  'A confirmed stale remote record must rotate the persisted create generation and create key.',
);
assert.equal(
  staleCreateIdempotencyKey.includes(input.absolutePath),
  false,
  'The recovery generation key must remain path-free.',
);

const unavailableIdentity = createIdentity({
  runtimeLocationId: 'runtime-location-unavailable',
  runtimeLocationVersion: 'version-unavailable',
});
const unavailableIdentityPort = createIdentityPort(unavailableIdentity);
const unavailableAdapter = new ComposedSdkProjectRuntimeLocationRegistrationPort({
  identityPort: unavailableIdentityPort.identityPort,
  sdkPort: {
    async createProjectRuntimeLocation() {
      throw new Error('Network failure must not force a create.');
    },
    async getProjectRuntimeLocation() {
      throw new Error('Network unavailable');
    },
    async rebindProjectRuntimeLocation() {
      throw new Error('Network failure must not force a rebind.');
    },
  },
});
await assert.rejects(
  unavailableAdapter.synchronizeLocalDesktopRuntimeLocation(input),
  /Network unavailable/u,
);
assert.equal(
  unavailableIdentityPort.clearInputs.length,
  0,
  'Transient network failures retain the local binding for later retry.',
);

console.log('composed SDK project runtime location registration contract passed.');
