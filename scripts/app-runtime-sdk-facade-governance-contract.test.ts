import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sdkClientsModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);
const typesServerApiPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/server-api.ts',
  import.meta.url,
);
const coreWriteServiceInterfacePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ICoreWriteService.ts',
  import.meta.url,
);
const apiBackedCoreWriteServicePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreWriteService.ts',
  import.meta.url,
);

const { createBirdCoderAppSdkApiClient } = await import(
  `${sdkClientsModulePath.href}?t=${Date.now()}`
);

const client = createBirdCoderAppSdkApiClient({
  transport: {
    async request() {
      throw new Error('not needed');
    },
  },
});

for (const methodName of [
  'getDescriptor',
  'getRuntime',
  'getHealth',
  'getModelConfig',
  'listRoutes',
  'listEngines',
  'listNativeSessionProviders',
  'listCodingSessions',
  'listNativeSessions',
  'getNativeSession',
  'getOperation',
  'getCodingSession',
  'listCodingSessionEvents',
  'listCodingSessionArtifacts',
  'listCodingSessionCheckpoints',
  'createCodingSession',
  'forkCodingSession',
  'updateCodingSession',
  'deleteCodingSession',
  'editCodingSessionMessage',
  'deleteCodingSessionMessage',
  'createCodingSessionTurn',
  'submitApprovalDecision',
  'submitUserQuestionAnswer',
  'syncModelConfig',
] as const) {
  assert.equal(
    typeof client[methodName],
    'function',
    `app SDK wrapper must expose promoted runtime method ${methodName}.`,
  );
}

const sdkClientsSource = readFileSync(sdkClientsModulePath, 'utf8');
const typesServerApiSource = readFileSync(typesServerApiPath, 'utf8');
const coreWriteServiceInterfaceSource = readFileSync(coreWriteServiceInterfacePath, 'utf8');
const apiBackedCoreWriteServiceSource = readFileSync(apiBackedCoreWriteServicePath, 'utf8');

assert.doesNotMatch(
  typesServerApiSource,
  /BirdCoderCore(Read|Write)ApiClient|createBirdCoderGeneratedCore(Read|Write)ApiClient|BIRDCODER_SHARED_CORE_FACADE/u,
  'types/server-api.ts must not export the retired generated core facade or governance lists.',
);
assert.match(
  sdkClientsSource,
  /client\.intelligence\.codingSessions\.turns\.create/u,
  'app SDK wrapper must route coding runtime turn creation through the generated app SDK intelligence namespace.',
);
assert.match(
  sdkClientsSource,
  /client\.runtime\.modelConfig\.sync/u,
  'app SDK wrapper must route runtime model config sync through the generated app SDK runtime namespace.',
);
assert.doesNotMatch(
  sdkClientsSource,
  /createBirdCoderGeneratedCore(Read|Write)ApiClient|BIRDCODER_SHARED_CORE_FACADE/u,
  'app SDK wrapper must not depend on the retired generated core facade.',
);
assert.match(
  coreWriteServiceInterfaceSource,
  /deleteCodingSessionMessage\(\s*codingSessionId:\s*string,\s*messageId:\s*string,\s*\):\s*Promise<\s*BirdCoderDeleteCodingSessionMessageResult\s*>/s,
  'ICoreWriteService must expose deleteCodingSessionMessage so DI consumers keep transcript mutation capability.',
);
assert.match(
  coreWriteServiceInterfaceSource,
  /editCodingSessionMessage\(\s*codingSessionId:\s*string,\s*messageId:\s*string,\s*request:\s*BirdCoderEditCodingSessionMessageRequest,\s*\):\s*Promise<\s*BirdCoderEditCodingSessionMessageResult\s*>/s,
  'ICoreWriteService must expose editCodingSessionMessage so DI consumers keep transcript mutation capability.',
);
assert.match(
  apiBackedCoreWriteServiceSource,
  /async\s+deleteCodingSessionMessage\(\s*codingSessionId:[\s\S]*?return\s+this\.client\.deleteCodingSessionMessage\(codingSessionId,\s*messageId\);/s,
  'ApiBackedCoreWriteService must delegate deleteCodingSessionMessage through the injected app runtime SDK client.',
);
assert.match(
  apiBackedCoreWriteServiceSource,
  /async\s+editCodingSessionMessage\(\s*codingSessionId:[\s\S]*?return\s+this\.client\.editCodingSessionMessage\(codingSessionId,\s*messageId,\s*request\);/s,
  'ApiBackedCoreWriteService must delegate editCodingSessionMessage through the injected app runtime SDK client.',
);

console.log('app runtime SDK facade governance contract passed.');
