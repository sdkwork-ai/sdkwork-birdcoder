import assert from 'node:assert/strict';

const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
  import.meta.url,
);
const generatedClientModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts',
  import.meta.url,
);

const {
  BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS,
  BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS,
  createBirdCoderGeneratedCoreReadApiClient,
  createBirdCoderGeneratedCoreWriteApiClient,
  isBirdCoderSharedCoreFacadeExcludedOperationId,
  isBirdCoderSharedCoreFacadeOperationId,
} = await import(`${typesEntryModulePath.href}?t=${Date.now()}`);
const { BIRDCODER_FINALIZED_CODING_SERVER_CLIENT_OPERATIONS } = await import(
  `${generatedClientModulePath.href}?t=${Date.now()}`
);

const excludedOperationIds = [] as const;

const includedOperationIds = [
  'core.getDescriptor',
  'core.getRuntime',
  'core.getHealth',
  'core.listRoutes',
  'core.listEngines',
  'core.listNativeSessionProviders',
  'core.listCodingSessions',
  'core.listNativeSessions',
  'core.getNativeSession',
  'core.getEngineCapabilities',
  'core.listModels',
  'core.getOperation',
  'core.createCodingSession',
  'core.forkCodingSession',
  'core.updateCodingSession',
  'core.deleteCodingSession',
  'core.deleteCodingSessionMessage',
  'core.createCodingSessionTurn',
  'core.submitApprovalDecision',
  'core.getCodingSession',
  'core.listCodingSessionEvents',
  'core.listCodingSessionArtifacts',
  'core.listCodingSessionCheckpoints',
] as const;

assert.deepEqual(
  BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS,
  excludedOperationIds,
  'shared core facade must explicitly track blocked or not-yet-promoted core operations.',
);
assert.deepEqual(
  BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS,
  includedOperationIds,
  'shared core facade must explicitly track only promoted high-level operations.',
);

for (const operationId of excludedOperationIds) {
  assert.ok(
    operationId in BIRDCODER_FINALIZED_CODING_SERVER_CLIENT_OPERATIONS,
    `generated client must still expose ${operationId} at the low-level operation catalog.`,
  );
  assert.equal(
    isBirdCoderSharedCoreFacadeExcludedOperationId(operationId),
    true,
    `${operationId} must remain explicitly blocked from the shared high-level core facade.`,
  );
  assert.equal(
    isBirdCoderSharedCoreFacadeOperationId(operationId),
    false,
    `${operationId} must not be treated as a promoted shared high-level core facade operation.`,
  );
}

for (const operationId of includedOperationIds) {
  assert.equal(
    isBirdCoderSharedCoreFacadeOperationId(operationId),
    true,
    `${operationId} must stay promoted in the shared high-level core facade.`,
  );
  assert.equal(
    isBirdCoderSharedCoreFacadeExcludedOperationId(operationId),
    false,
    `${operationId} must not be classified as blocked once promoted into the shared high-level core facade.`,
  );
}

const client = createBirdCoderGeneratedCoreReadApiClient({
  transport: {
    async request() {
      throw new Error('not needed');
    },
  },
});
const writeClient = createBirdCoderGeneratedCoreWriteApiClient({
  transport: {
    async request() {
      throw new Error('not needed');
    },
  },
});

assert.equal(typeof client.getDescriptor, 'function');
assert.equal(typeof client.getRuntime, 'function');
assert.equal(typeof client.getHealth, 'function');
assert.equal(typeof client.listRoutes, 'function');
assert.equal(typeof client.listEngines, 'function');
assert.equal(typeof client.listNativeSessionProviders, 'function');
assert.equal(typeof client.listCodingSessions, 'function');
assert.equal(typeof client.listNativeSessions, 'function');
assert.equal(typeof client.getNativeSession, 'function');
assert.equal(typeof client.getOperation, 'function');
assert.equal(typeof client.getCodingSession, 'function');
assert.equal(typeof client.listCodingSessionEvents, 'function');
assert.equal(typeof client.listCodingSessionArtifacts, 'function');
assert.equal(typeof client.listCodingSessionCheckpoints, 'function');
assert.equal(typeof writeClient.createCodingSession, 'function');
assert.equal(typeof writeClient.forkCodingSession, 'function');
assert.equal(typeof writeClient.updateCodingSession, 'function');
assert.equal(typeof writeClient.deleteCodingSession, 'function');
assert.equal(typeof writeClient.deleteCodingSessionMessage, 'function');
assert.equal(typeof writeClient.createCodingSessionTurn, 'function');
assert.equal(typeof writeClient.submitApprovalDecision, 'function');
assert.equal(
  'createCodingSession' in client,
  false,
  'shared core read facade must stay read-only after createCodingSession is promoted into the typed shared core write facade.',
);
assert.equal(
  'createCodingSessionTurn' in writeClient,
  true,
  'shared core write facade must publish createCodingSessionTurn once the typed facade is executable.',
);
assert.equal(
  'createCodingSessionTurn' in client,
  false,
  'shared core read facade must stay read-only after createCodingSessionTurn is promoted into the typed shared core write facade.',
);
assert.equal(
  'submitApprovalDecision' in writeClient,
  true,
  'shared core write facade must publish submitApprovalDecision once the route is real and typed.',
);
assert.equal(
  'submitApprovalDecision' in client,
  false,
  'shared core read facade must stay read-only after submitApprovalDecision is promoted into the typed shared core write facade.',
);
assert.equal(
  'forkCodingSession' in client,
  false,
  'shared core read facade must stay read-only after forkCodingSession is promoted into the typed shared core write facade.',
);
assert.equal(
  'updateCodingSession' in client,
  false,
  'shared core read facade must stay read-only after updateCodingSession is promoted into the typed shared core write facade.',
);
assert.equal(
  'deleteCodingSession' in client,
  false,
  'shared core read facade must stay read-only after deleteCodingSession is promoted into the typed shared core write facade.',
);
assert.equal(
  'deleteCodingSessionMessage' in client,
  false,
  'shared core read facade must stay read-only after deleteCodingSessionMessage is promoted into the typed shared core write facade.',
);
assert.equal(
  'listRoutes' in client,
  true,
  'shared core high-level facade must publish listRoutes once the unified route catalog is part of the real server surface.',
);
assert.equal(
  'getEngineCapabilities' in client,
  true,
  'shared core high-level facade must publish getEngineCapabilities once the route is real and typed.',
);
assert.equal(
  'listModels' in client,
  true,
  'shared core high-level facade must publish listModels once the route is real and typed.',
);

console.log('shared core facade governance contract passed.');
