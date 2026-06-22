import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);
const typesServerApiPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/server-api.ts',
  import.meta.url,
);
const appRuntimeWriteServiceInterfacePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IAppRuntimeWriteService.ts',
  import.meta.url,
);
const apiBackedAppRuntimeWriteServicePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeWriteService.ts',
  import.meta.url,
);
const defaultIdeServicesSharedPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
  import.meta.url,
);
const retiredCoreRuntimeServicePaths = [
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/ICoreReadService.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/ICoreWriteService.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCoreReadService.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedCoreWriteService.ts',
    import.meta.url,
  ),
];
const retiredCoreRuntimeServicePatterns = [
  /\bICore(?:Read|Write)Service\b/u,
  /\bApiBackedCore(?:Read|Write)Service\b/u,
  /\bcore(?:Read|Write)Service\b/u,
  /\bCore(?:Read|Write)Service\b/u,
];
const appRuntimeServiceSourcePaths = [
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesShared.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/lazyDefaultIdeServices.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/ideServices.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/IDEContext.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/IDEContext.tsx',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/ServiceContext.tsx',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellRuntimeImpl.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellUserState.ts',
    import.meta.url,
  ),
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
    import.meta.url,
  ),
];
const appRuntimeReadServiceInterfacePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IAppRuntimeReadService.ts',
  import.meta.url,
);
const apiBackedAppRuntimeReadServicePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts',
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
const appRuntimeReadServiceInterfaceSource = readFileSync(appRuntimeReadServiceInterfacePath, 'utf8');
const appRuntimeWriteServiceInterfaceSource = readFileSync(appRuntimeWriteServiceInterfacePath, 'utf8');
const apiBackedAppRuntimeReadServiceSource = readFileSync(apiBackedAppRuntimeReadServicePath, 'utf8');
const apiBackedAppRuntimeWriteServiceSource = readFileSync(apiBackedAppRuntimeWriteServicePath, 'utf8');
const defaultIdeServicesSharedSource = readFileSync(defaultIdeServicesSharedPath, 'utf8');

for (const retiredPath of retiredCoreRuntimeServicePaths) {
  assert.equal(
    existsSync(retiredPath),
    false,
    `${retiredPath.pathname} must be removed; app runtime SDK services must not keep retired core service file names.`,
  );
}

assert.match(
  defaultIdeServicesSharedSource,
  /appRuntimeReadService:\s*IAppRuntimeReadService/u,
  'default IDE services must expose the app runtime read service through appRuntimeReadService.',
);
assert.match(
  defaultIdeServicesSharedSource,
  /appRuntimeWriteService:\s*IAppRuntimeWriteService/u,
  'default IDE services must expose the app runtime write service through appRuntimeWriteService.',
);

for (const sourcePath of appRuntimeServiceSourcePaths) {
  const source = readFileSync(sourcePath, 'utf8');
  for (const pattern of retiredCoreRuntimeServicePatterns) {
    assert.doesNotMatch(
      source,
      pattern,
      `${sourcePath.pathname} must use app runtime service naming instead of retired core runtime service naming.`,
    );
  }
}

assert.match(
  appRuntimeReadServiceInterfaceSource,
  /export interface IAppRuntimeReadService/u,
  'app runtime read interface must use the canonical app runtime service name.',
);
assert.match(
  apiBackedAppRuntimeReadServiceSource,
  /export class ApiBackedAppRuntimeReadService implements IAppRuntimeReadService/u,
  'app runtime read implementation must use the canonical app runtime service name.',
);

assert.doesNotMatch(
  typesServerApiSource,
  /BirdCoderCore(Read|Write)ApiClient|createBirdCoderGeneratedCore(Read|Write)ApiClient|BIRDCODER_SHARED_CORE_FACADE/u,
  'types/server-api.ts must not export the retired generated app runtime facade or governance lists.',
);
assert.match(
  sdkClientsSource,
  /client\.intelligence\.codingSessions\.checkpoints\.approval\.create/u,
  'app SDK wrapper must route approval decisions through nested intelligence coding session checkpoints.',
);
assert.match(
  sdkClientsSource,
  /client\.intelligence\.codingSessions\.messages\.update/u,
  'app SDK wrapper must route coding session message edits through nested intelligence coding session messages.',
);
assert.match(
  sdkClientsSource,
  /client\.intelligence\.codingSessions\.messages\.delete/u,
  'app SDK wrapper must route coding session message deletes through nested intelligence coding session messages.',
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
  'app SDK wrapper must not depend on the retired generated app runtime facade.',
);
assert.match(
  appRuntimeWriteServiceInterfaceSource,
  /deleteCodingSessionMessage\(\s*codingSessionId:\s*string,\s*messageId:\s*string,\s*\):\s*Promise<\s*BirdCoderDeleteCodingSessionMessageResult\s*>/s,
  'IAppRuntimeWriteService must expose deleteCodingSessionMessage so DI consumers keep transcript mutation capability.',
);
assert.match(
  appRuntimeWriteServiceInterfaceSource,
  /editCodingSessionMessage\(\s*codingSessionId:\s*string,\s*messageId:\s*string,\s*request:\s*BirdCoderEditCodingSessionMessageRequest,\s*\):\s*Promise<\s*BirdCoderEditCodingSessionMessageResult\s*>/s,
  'IAppRuntimeWriteService must expose editCodingSessionMessage so DI consumers keep transcript mutation capability.',
);
assert.match(
  apiBackedAppRuntimeWriteServiceSource,
  /async\s+deleteCodingSessionMessage\(\s*codingSessionId:[\s\S]*?return\s+this\.client\.deleteCodingSessionMessage\(codingSessionId,\s*messageId\);/s,
  'ApiBackedAppRuntimeWriteService must delegate deleteCodingSessionMessage through the injected app runtime SDK client.',
);
assert.match(
  apiBackedAppRuntimeWriteServiceSource,
  /async\s+editCodingSessionMessage\(\s*codingSessionId:[\s\S]*?return\s+this\.client\.editCodingSessionMessage\(codingSessionId,\s*messageId,\s*request\);/s,
  'ApiBackedAppRuntimeWriteService must delegate editCodingSessionMessage through the injected app runtime SDK client.',
);

console.log('app runtime SDK facade governance contract passed.');
