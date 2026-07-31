import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const specPath = path.join(root, 'specs/codex-desktop-parity.spec.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const errors = [];

const requiredProviderItemTypes = [
  'userMessage',
  'hookPrompt',
  'agentMessage',
  'plan',
  'reasoning',
  'commandExecution',
  'fileChange',
  'mcpToolCall',
  'dynamicToolCall',
  'collabAgentToolCall',
  'subAgentActivity',
  'webSearch',
  'imageView',
  'sleep',
  'imageGeneration',
  'enteredReviewMode',
  'exitedReviewMode',
  'contextCompaction',
];

const requiredSyntheticItemTypes = [
  'todo-list',
  'planImplementation',
  'error',
  'automaticApprovalReview',
  'autoReviewInterruptionWarning',
  'remoteTaskCreated',
  'personalityChanged',
  'forkedFromConversation',
  'modelChanged',
  'modelRerouted',
  'userInputResponse',
  'mcpServerElicitation',
  'permissionRequest',
  'worktreeInit',
  'steeringUserMessage',
  'steered',
];

const requiredBlockedSyntheticItemTypes = [
  'automaticApprovalReview',
  'userInputResponse',
  'mcpServerElicitation',
  'permissionRequest',
];

const requiredCapabilityIds = Array.from(
  { length: 15 },
  (_, index) => `CDP-${String(index + 1).padStart(3, '0')}`,
);

const requiredReferenceArtifacts = [
  {
    path: 'app/resources/app.asar',
    sha256: '23a8f5d1645247bd942304dc586c44b8ce63c2e3fc408198f815657731070db5',
    sizeBytes: 209375503,
  },
  {
    path: 'AppxManifest.xml',
    sha256: 'dca0d6940c2da5249569ce0bc241078aebbe1d79d3277f14d3b8c7afbe819f97',
    sizeBytes: 3759,
  },
  {
    path: 'app/resources/app.asar::package.json',
    sha256: 'fb2f8c6862f5bbe220a157795177b2ffdcb29cb9ba96d39346f9b807f28393dc',
    sizeBytes: 5536,
  },
  {
    path: 'app/resources/codex.exe',
    sha256: '39e9e041ea33ac34aad9578adfe660c5c7a6dc8f82620b77623960f9352a6ef3',
    sizeBytes: 353628464,
  },
  {
    path: 'app/resources/owl-electron-app.json',
    runtimeArchiveSha256: '67a92588efe976b08220a9c1a2436f03178aa5eb64d43ed29dac034b0a47477a',
  },
  {
    path: 'app/resources/cua_node/manifest.json',
    sha256: 'e8f2e647ccf0f5627ee2f9beda1f7ab5daac9dd716470132e167bb0c414e63e0',
    sizeBytes: 538,
  },
  {
    path: 'app/resources/plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json',
    sha256: '7066eec3cfc42e9990b471509ab3c1c7d1eaedcec550491e71a1d3962151acca',
    sizeBytes: 2193,
  },
  {
    path: 'app/resources/app.asar::webview/assets/automations-page-CNlcT7yo.js',
    sha256: '3bdf115c9fc72298d04510177a343ba8c6b3436a3f77f71abe5baf6c443affe7',
    sizeBytes: 84851,
  },
  {
    path: 'app/resources/app.asar::webview/assets/browser-Be3Y5Oyc.js',
    sha256: 'dd35124bd1dc1d64f9206b5a5946175f2795ca88c7c9237c03b390bf11020839',
    sizeBytes: 651835,
  },
  {
    path: 'app/resources/app.asar::webview/assets/browser-use-settings-52aGrZMW.js',
    sha256: 'c3b75cff167c750a2e22f531996fdb3e3ca7db593ec0a209903d5307c12d63e8',
    sizeBytes: 92415,
  },
  {
    path: 'app/resources/app.asar::webview/assets/remote-connections-settings-DwcGEEux.js',
    sha256: '30780436d7f6f0238b709a2fb85503a9ed4ea453dd6a83846412f82e7bcab2b7',
    sizeBytes: 158510,
  },
  {
    path: 'app/resources/app.asar::webview/assets/remote-conversation-page-DebkGSyJ.js',
    sha256: 'f3028786d1acead0b2622b97f8499b10044e639fa59fd79f5b560881d3e2658b',
    sizeBytes: 66842,
  },
];

function resolvePath(relativePath) {
  return path.resolve(root, relativePath);
}

function sha256File(relativePath) {
  return createHash('sha256')
    .update(fs.readFileSync(resolvePath(relativePath)))
    .digest('hex');
}

function validateExactInventory(label, actualValues, requiredValues) {
  const actual = new Set(actualValues);
  const required = new Set(requiredValues);

  if (actual.size !== actualValues.length) {
    errors.push(`${label} contains duplicate entries`);
  }
  for (const value of required) {
    if (!actual.has(value)) {
      errors.push(`${label} is missing ${value}`);
    }
  }
  for (const value of actual) {
    if (!required.has(value)) {
      errors.push(`${label} contains unexpected entry ${value}`);
    }
  }
}

assert.equal(spec.schemaVersion, 1);
assert.equal(spec.kind, 'sdkwork.codex-desktop-parity');
assert.equal(spec.goalStatus, 'active');
assert.deepEqual(spec.terminology, {
  canonicalContinuationResource: 'Session',
  canonicalProviderIdentityField: 'providerSessionId',
  providerProtocolResource: 'thread',
  providerBoundary:
    'Codex thread fields are accepted only by the Codex provider adapter or exact raw protocol fixtures and are converted to Session before entering BirdCoder.',
  forbiddenBirdCoderDomainResource: 'Thread',
});
assert.equal(spec.completionPolicy.prohibitSingleFeatureCompletion, true);
assert.equal(spec.completionPolicy.requireRealProviderE2E, true);
assert.equal(spec.completionPolicy.requireDesktopAndNarrowVisualRegression, true);
assert.equal(spec.completionPolicy.requirePerPresentationFixtureEvidence, true);

assert.equal(spec.reference.build, '26.721.11231.0');
assert.equal(spec.reference.rendererPackageVersion, '26.721.81911');
assert.deepEqual(spec.reference.providerRuntime, {
  version: '0.146.0-alpha.3.1',
  executablePath: 'app/resources/codex.exe',
  executableSha256: '39e9e041ea33ac34aad9578adfe660c5c7a6dc8f82620b77623960f9352a6ef3',
});
assert.deepEqual(spec.reference.browserRuntime, {
  nodeVersion: '24.14.0',
  cuaManifestPath: 'app/resources/cua_node/manifest.json',
  cuaManifestSha256: 'e8f2e647ccf0f5627ee2f9beda1f7ab5daac9dd716470132e167bb0c414e63e0',
  pluginVersion: '26.721.81911',
  pluginManifestPath:
    'app/resources/plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json',
  pluginManifestSha256: '7066eec3cfc42e9990b471509ab3c1c7d1eaedcec550491e71a1d3962151acca',
});
assert.deepEqual(spec.reference.protocolSource, {
  commit: 'a05bcda3dbd68729caa2f11027b7f43974fda298',
  threadItemSchemaPath:
    'external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts',
  threadItemSchemaSha256: '57190566ac2ec5a64a595ecfb80fb8fe6900f29136d77944097e7b6a6f3acd38',
});
assert.deepEqual(spec.reference.installationVerification, {
  status: 'verified',
  verifiedAt: '2026-07-31',
  packageFullName: 'OpenAI.Codex_26.721.11231.0_x64__2p2nqsd0c76g0',
  packageVersion: '26.721.11231.0',
  artifactPath: 'app/resources/app.asar',
  artifactSha256: '23a8f5d1645247bd942304dc586c44b8ce63c2e3fc408198f815657731070db5',
  artifactSizeBytes: 209375503,
});

validateExactInventory(
  'reference artifact paths',
  spec.reference.artifacts.map((artifact) => artifact.path),
  requiredReferenceArtifacts.map((artifact) => artifact.path),
);
const referenceArtifactsByPath = new Map(
  spec.reference.artifacts.map((artifact) => [artifact.path, artifact]),
);
for (const expectedArtifact of requiredReferenceArtifacts) {
  assert.deepEqual(
    referenceArtifactsByPath.get(expectedArtifact.path),
    expectedArtifact,
    `reference artifact drift: ${expectedArtifact.path}`,
  );
}
for (const artifact of spec.reference.artifacts) {
  const digest = artifact.sha256 ?? artifact.runtimeArchiveSha256;
  assert.match(digest, /^[a-f0-9]{64}$/u);
}
assert.equal(
  referenceArtifactsByPath.get(spec.reference.providerRuntime.executablePath)?.sha256,
  spec.reference.providerRuntime.executableSha256,
);
assert.equal(
  referenceArtifactsByPath.get(spec.reference.browserRuntime.cuaManifestPath)?.sha256,
  spec.reference.browserRuntime.cuaManifestSha256,
);
assert.equal(
  referenceArtifactsByPath.get(spec.reference.browserRuntime.pluginManifestPath)?.sha256,
  spec.reference.browserRuntime.pluginManifestSha256,
);
assert.equal(
  spec.reference.installationVerification.packageVersion,
  spec.reference.build,
);
const installedArchive = referenceArtifactsByPath.get(
  spec.reference.installationVerification.artifactPath,
);
assert.equal(installedArchive?.sha256, spec.reference.installationVerification.artifactSha256);
assert.equal(installedArchive?.sizeBytes, spec.reference.installationVerification.artifactSizeBytes);
assert.equal(
  sha256File(spec.reference.protocolSource.threadItemSchemaPath),
  spec.reference.protocolSource.threadItemSchemaSha256,
);

const desktopRendererEvidence = spec.presentationEvidence.desktopRenderer;
assert.equal(desktopRendererEvidence.archiveEntryRawLineCount, 9558);
assert.deepEqual(desktopRendererEvidence.visibilityPredicate, {
  symbol: 'Jqn',
  start: 186424,
  end: 186489,
  coordinateSystem: 'formatter-output',
  rawLine: 772,
  entryByteOffset: 3348317,
  archiveByteOffset: 27457094,
});
assert.deepEqual(desktopRendererEvidence.rawArchiveEvidence, {
  composerStop: { rawLine: 8804, entryByteOffset: 9544717 },
  composerSend: { rawLine: 8804, entryByteOffset: 9544942 },
  approvalAllowOnce: { rawLine: 8817, entryByteOffset: 10126264 },
  approvalDeny: { rawLine: 8817, entryByteOffset: 10126520 },
  approvalAlwaysAllow: { rawLine: 8817, entryByteOffset: 10127683 },
  toggleSidebar: { rawLine: 920, entryByteOffset: 4044424 },
});

const presentation = spec.presentationEvidence;
assert.equal(presentation.rawProviderUnion.name, 'ThreadItem');
assert.equal(
  presentation.rawProviderUnion.expectedVariantCount,
  requiredProviderItemTypes.length,
);
assert.match(presentation.rawProviderUnion.boundary, /canonical Session output/u);
assert.equal(presentation.desktopRenderer.referenceBuild, spec.reference.build);
assert.equal(presentation.desktopRenderer.archiveEntry, 'webview/assets/app-initial-CHAIly1j.js');
assert.equal(presentation.desktopRenderer.visibilityPredicate.symbol, 'Jqn');
assert.ok(
  presentation.desktopRenderer.itemMappingLines.start
    < presentation.desktopRenderer.itemMappingLines.end,
);
assert.ok(
  presentation.desktopRenderer.visibilityPredicate.start
    < presentation.desktopRenderer.visibilityPredicate.end,
);
assert.deepEqual(presentation.visibilityCatalog, ['visible', 'conditional', 'hidden']);

const fixtureContract = presentation.fixtureContract;
assert.equal(fixtureContract.requireIndependentlyAuthoredInput, true);
assert.equal(fixtureContract.requireRawProviderShape, true);
assert.equal(fixtureContract.requireCanonicalSessionOutput, true);
assert.equal(fixtureContract.requireDesktopVisibilityAssertion, true);
if (!fs.existsSync(resolvePath(fixtureContract.path))) {
  errors.push(`missing presentation fixture contract: ${fixtureContract.path}`);
}
if (!fs.existsSync(resolvePath(fixtureContract.syntheticPath))) {
  errors.push(`missing synthetic presentation fixture contract: ${fixtureContract.syntheticPath}`);
}
if (!['partial', 'complete'].includes(fixtureContract.syntheticCoverageStatus)) {
  errors.push(`unsupported synthetic fixture coverage: ${fixtureContract.syntheticCoverageStatus}`);
}
const providerFixtureSource = fs.existsSync(resolvePath(fixtureContract.path))
  ? fs.readFileSync(resolvePath(fixtureContract.path), 'utf8')
  : '';
const syntheticFixtureSource = fs.existsSync(resolvePath(fixtureContract.syntheticPath))
  ? fs.readFileSync(resolvePath(fixtureContract.syntheticPath), 'utf8')
  : '';

const providerItems = presentation.providerItems ?? [];
const providerItemTypes = providerItems.map((item) => item.rawType);
validateExactInventory(
  'raw provider item evidence',
  providerItemTypes,
  requiredProviderItemTypes,
);

const protocolSourcePath = resolvePath(presentation.rawProviderUnion.sourcePath);
if (!fs.existsSync(protocolSourcePath)) {
  errors.push(`missing raw provider union authority: ${presentation.rawProviderUnion.sourcePath}`);
} else {
  const protocolSource = fs.readFileSync(protocolSourcePath, 'utf8');
  const protocolItemTypes = [
    ...protocolSource.matchAll(/\{\s*"type":\s*"([^"]+)"/gu),
  ].map((match) => match[1]);
  validateExactInventory(
    'generated raw provider union',
    protocolItemTypes,
    requiredProviderItemTypes,
  );
}

const providerVisibility = new Map([
  ['userMessage', 'conditional'],
  ['hookPrompt', 'conditional'],
  ['agentMessage', 'visible'],
  ['plan', 'visible'],
  ['reasoning', 'conditional'],
  ['commandExecution', 'visible'],
  ['fileChange', 'conditional'],
  ['mcpToolCall', 'visible'],
  ['dynamicToolCall', 'conditional'],
  ['collabAgentToolCall', 'conditional'],
  ['subAgentActivity', 'conditional'],
  ['webSearch', 'visible'],
  ['imageView', 'visible'],
  ['sleep', 'hidden'],
  ['imageGeneration', 'visible'],
  ['enteredReviewMode', 'hidden'],
  ['exitedReviewMode', 'hidden'],
  ['contextCompaction', 'visible'],
]);
const fixtureKeys = new Set();
for (const item of providerItems) {
  const expectedVisibility = providerVisibility.get(item.rawType);
  if (item.desktopVisibility !== expectedVisibility) {
    errors.push(
      `[${item.rawType}] expected ${expectedVisibility} visibility, received ${item.desktopVisibility}`,
    );
  }
  if (typeof item.visibilityRule !== 'string' || item.visibilityRule.trim().length === 0) {
    errors.push(`[${item.rawType}] missing desktop visibility rule`);
  }
  if (item.desktopVisibility === 'hidden' && item.canonicalPresentation !== null) {
    errors.push(`[${item.rawType}] hidden item must not declare a canonical presentation row`);
  }
  if (
    item.canonicalPresentation != null
    && /\bthread\b/iu.test(item.canonicalPresentation)
  ) {
    errors.push(`[${item.rawType}] canonical presentation must use Session terminology`);
  }
  if (typeof item.fixtureKey !== 'string' || item.fixtureKey.length === 0) {
    errors.push(`[${item.rawType}] missing independently authored fixture key`);
  } else if (fixtureKeys.has(item.fixtureKey)) {
    errors.push(`[${item.rawType}] duplicate fixture key: ${item.fixtureKey}`);
  } else {
    fixtureKeys.add(item.fixtureKey);
    if (!providerFixtureSource.includes(item.fixtureKey)) {
      errors.push(`[${item.rawType}] fixture key is not asserted by ${fixtureContract.path}`);
    }
  }
}

const providerItemsByType = new Map(providerItems.map((item) => [item.rawType, item]));
assert.match(providerItemsByType.get('hookPrompt').visibilityRule, /non-empty trimmed text/u);
assert.equal(providerItemsByType.get('imageView').aggregation, 'consecutive');
assert.equal(providerItemsByType.get('contextCompaction').desktopVisibility, 'visible');
for (const hiddenType of ['sleep', 'enteredReviewMode', 'exitedReviewMode']) {
  assert.equal(providerItemsByType.get(hiddenType).desktopVisibility, 'hidden');
}

const syntheticItems = presentation.syntheticItems ?? [];
validateExactInventory(
  'desktop synthetic item evidence',
  syntheticItems.map((item) => item.desktopType),
  requiredSyntheticItemTypes,
);
const conditionalSyntheticTypes = new Set([
  'todo-list',
  'error',
  'automaticApprovalReview',
  'steeringUserMessage',
]);
const blockedSyntheticTypes = new Set(requiredBlockedSyntheticItemTypes);
for (const item of syntheticItems) {
  const expectedVisibility = conditionalSyntheticTypes.has(item.desktopType)
    ? 'conditional'
    : 'visible';
  const expectedStatus = blockedSyntheticTypes.has(item.desktopType)
    ? 'blocked-contract'
    : 'fixture-covered';
  if (item.desktopVisibility !== expectedVisibility) {
    errors.push(
      `[${item.desktopType}] expected ${expectedVisibility} synthetic visibility, received ${item.desktopVisibility}`,
    );
  }
  if (typeof item.visibilityRule !== 'string' || item.visibilityRule.trim().length === 0) {
    errors.push(`[${item.desktopType}] missing synthetic visibility rule`);
  }
  if (
    typeof item.canonicalPresentation !== 'string'
    || item.canonicalPresentation.trim().length === 0
    || /\bthread\b/iu.test(item.canonicalPresentation)
  ) {
    errors.push(`[${item.desktopType}] synthetic presentation must use canonical Session semantics`);
  }
  if (item.status !== expectedStatus) {
    errors.push(
      `[${item.desktopType}] expected ${expectedStatus} synthetic evidence status, received ${item.status}`,
    );
  }
  if (expectedStatus === 'blocked-contract') {
    if (item.blockerId !== 'CDB-001') {
      errors.push(`[${item.desktopType}] blocked synthetic evidence must reference CDB-001`);
    }
  } else if (item.blockerId != null) {
    errors.push(`[${item.desktopType}] fixture-covered synthetic evidence must not declare a blocker`);
  }
  if (typeof item.fixtureKey !== 'string' || item.fixtureKey.length === 0) {
    errors.push(`[${item.desktopType}] missing independently authored fixture key`);
  } else if (fixtureKeys.has(item.fixtureKey)) {
    errors.push(`[${item.desktopType}] duplicate fixture key: ${item.fixtureKey}`);
  } else {
    fixtureKeys.add(item.fixtureKey);
    if (!syntheticFixtureSource.includes(item.fixtureKey)) {
      errors.push(
        `[${item.desktopType}] fixture key is not asserted by ${fixtureContract.syntheticPath}`,
      );
    }
  }
}

const declaredBlockedSyntheticTypes = syntheticItems
  .filter((item) => item.status === 'blocked-contract')
  .map((item) => item.desktopType);
validateExactInventory(
  'blocked synthetic owner-contract evidence',
  declaredBlockedSyntheticTypes,
  requiredBlockedSyntheticItemTypes,
);
if (
  declaredBlockedSyntheticTypes.length > 0
  && fixtureContract.syntheticCoverageStatus !== 'partial'
) {
  errors.push('synthetic fixture coverage must remain partial while owner-contract gaps remain');
}

const statuses = new Set(spec.statusCatalog);
const capabilityIds = new Set();
const blockerIds = new Set(spec.blockers.map((blocker) => blocker.id));
for (const item of syntheticItems) {
  if (item.status === 'blocked-contract' && !blockerIds.has(item.blockerId)) {
    errors.push(`[${item.desktopType}] missing declared synthetic blocker: ${item.blockerId}`);
  }
}
for (const capability of spec.capabilities) {
  if (capabilityIds.has(capability.id)) {
    errors.push(`duplicate capability id: ${capability.id}`);
  }
  capabilityIds.add(capability.id);
  if (!statuses.has(capability.status)) {
    errors.push(`[${capability.id}] unsupported status: ${capability.status}`);
  }
  if (capability.status === 'blocked-contract' && !blockerIds.has(capability.blockerId)) {
    errors.push(`[${capability.id}] missing declared blocker: ${capability.blockerId}`);
  }
  for (const relativePath of capability.evidence?.paths ?? []) {
    if (!fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${capability.id}] missing evidence path: ${relativePath}`);
    }
  }
}

validateExactInventory(
  'parity capability ids',
  [...capabilityIds],
  requiredCapabilityIds,
);

const blockedFeatureCapabilities = [
  {
    id: 'CDP-012',
    area: 'automation',
    title: 'Session-bound Automations create, schedule, run-now, pause, resume, history, notification, cancellation, and recovery',
    blockerId: 'CDB-002',
    paths: [
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/WorkModeSidebar.tsx',
      '../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/dto.rs',
      '../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/types/create-agent-task-request.ts',
    ],
    referenceArtifacts: [
      'app/resources/app.asar::webview/assets/automations-page-CNlcT7yo.js',
    ],
  },
  {
    id: 'CDP-013',
    area: 'browser-session',
    title: 'Session-scoped embedded Browser navigation, history, site approval, capture, stop, and isolation',
    blockerId: 'CDB-003',
    paths: [
      'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/BrowserPreviewSurface.tsx',
    ],
    referenceArtifacts: [
      'app/resources/app.asar::webview/assets/browser-Be3Y5Oyc.js',
      'app/resources/app.asar::webview/assets/browser-use-settings-52aGrZMW.js',
      'app/resources/cua_node/manifest.json',
    ],
  },
  {
    id: 'CDP-014',
    area: 'remote-session',
    title: 'Remote Connections, authorized devices, SSH hosts, and canonical Session continuation over remote execution',
    blockerId: 'CDB-004',
    paths: [
      'apps/sdkwork-birdcoder-pc/src/bootstrap/routes.ts',
    ],
    referenceArtifacts: [
      'app/resources/app.asar::webview/assets/remote-connections-settings-DwcGEEux.js',
      'app/resources/app.asar::webview/assets/remote-conversation-page-DebkGSyJ.js',
    ],
  },
];
for (const expectedCapability of blockedFeatureCapabilities) {
  const capability = spec.capabilities.find(
    (candidate) => candidate.id === expectedCapability.id,
  );
  assert.equal(capability?.area, expectedCapability.area);
  assert.equal(capability?.title, expectedCapability.title);
  assert.equal(capability?.status, 'blocked-contract');
  assert.equal(capability?.blockerId, expectedCapability.blockerId);
  validateExactInventory(
    `${expectedCapability.id} evidence paths`,
    capability?.evidence?.paths ?? [],
    expectedCapability.paths,
  );
  validateExactInventory(
    `${expectedCapability.id} reference artifacts`,
    capability?.evidence?.referenceArtifacts ?? [],
    expectedCapability.referenceArtifacts,
  );
  for (const referenceArtifact of expectedCapability.referenceArtifacts) {
    if (!referenceArtifactsByPath.has(referenceArtifact)) {
      errors.push(`[${expectedCapability.id}] undeclared reference artifact: ${referenceArtifact}`);
    }
  }
}

const realProviderCapability = spec.capabilities.find(
  (capability) => capability.id === 'CDP-010',
);
assert.equal(realProviderCapability?.status, 'pending');
validateExactInventory(
  'real provider E2E evidence paths',
  realProviderCapability?.evidence?.paths ?? [],
  [
    'apps/sdkwork-birdcoder-pc/playwright.codex-provider-live.config.ts',
    'apps/sdkwork-birdcoder-pc/tests/e2e-live/codex-provider-live.spec.ts',
    'apps/sdkwork-birdcoder-pc/tests/e2e-live/codexProviderLiveHarness.ts',
    'scripts/run-codex-provider-live-e2e.mjs',
    'scripts/codex-provider-live-e2e-contract.test.mjs',
  ],
);
validateExactInventory(
  'real provider E2E commands',
  realProviderCapability?.evidence?.commands ?? [],
  [
    'node scripts/codex-provider-live-e2e-contract.test.mjs',
    'node scripts/run-codex-provider-live-e2e.mjs --preflight-only',
    'node scripts/run-codex-provider-live-e2e.mjs',
  ],
);
assert.equal(
  realProviderCapability?.evidence?.pendingReason,
  'Credentialed live provider E2E is pending because the local Codex provider host is not authenticated.',
);
assert.deepEqual(realProviderCapability?.evidence?.preflight, {
  command: 'node scripts/run-codex-provider-live-e2e.mjs --preflight-only',
  status: 'failed-closed',
  providerHost: 'local',
  reason: 'The local Codex provider host is not authenticated.',
  credentialedCasesRun: 0,
  checkedAt: '2026-07-31',
});
assert.deepEqual(
  realProviderCapability?.evidence?.contractBlockerIds,
  ['CDB-001', 'CDB-005', 'CDB-006'],
);
assert.equal(
  realProviderCapability?.evidence?.runtimeBlockerReason,
  'Agents currently buffers provider output until Turn completion, cancellation does not route a canonical Turn to the provider request handle, and Interaction resolution does not continue the Codex app-server request.',
);
assert.equal(spec.verification.realProviderE2E, 'pending');

const requiredBlockerContracts = [
  {
    id: 'CDB-001',
    kind: 'public-contract-and-security-review',
    owner: 'sdkwork-agents',
    capabilityIds: ['CDP-007', 'CDP-008'],
    observedProviderRequestMethods: [
      'item/commandExecution/requestApproval',
      'item/fileChange/requestApproval',
      'item/tool/requestUserInput',
      'mcpServer/elicitation/request',
      'item/permissions/requestApproval',
    ],
    observedAgentsInteractionKinds: ['approval', 'user_question'],
    requiredContractExtensions: [
      'typed provider request kind and opaque request correlation identity',
      'typed approval decision and grant scope',
      'command execution policy amendment',
      'network policy amendment',
      'permission profile and strictAutoReview',
      'questions array with stable IDs, headers, other and secret flags, options, and multiple answers',
      'question ID to answer mapping and autoResolutionMs',
      'MCP elicitation form and URL modes, requested schema, action, structured content, and metadata',
    ],
    prohibitedWorkarounds: [
      'BirdCoder-local DTO fork',
      'raw HTTP',
      'manual generated SDK edit',
      'mapping scoped approval choices to a boolean without preserving semantics',
    ],
  },
  {
    id: 'CDB-002',
    kind: 'owner-openapi-and-generated-sdk-drift',
    owner: 'sdkwork-agents',
    capabilityIds: ['CDP-012'],
    requiredContractExtensions: [
      'align the App OpenAPI CreateAgentTaskRequest with the server-owned CreateTaskRequestDto',
      'preserve canonical sessionId, scheduleKind, timezone, cron and one-time schedule fields',
      'expose run-now, pause, resume, run-history list, notification policy, cancellation, and recovery operations',
      'regenerate every affected Agents SDK family from the owner OpenAPI',
    ],
    prohibitedWorkarounds: [
      'BirdCoder-local task DTO fork',
      'raw HTTP or manual authorization headers',
      'manual generated SDK edit',
      'enabling the Automation navigation item before owner SDK conformance tests pass',
    ],
  },
  {
    id: 'CDB-003',
    kind: 'desktop-browser-host-and-security-contract',
    owner: 'sdkwork-kernel and sdkwork-agents',
    capabilityIds: ['CDP-013'],
    requiredContractExtensions: [
      'Kernel desktop Browser host and lifecycle SPI',
      'Agents canonical Session to Browser Session binding',
      'site permission and always-ask decisions',
      'navigation history, capture, stop, recovery, and Session isolation events',
      'generated SDK and real desktop E2E surfaces',
    ],
    prohibitedWorkarounds: [
      'treating a sandbox iframe as provider Browser parity',
      'exposing browser profile or credential storage to BirdCoder UI',
      'BirdCoder-local provider Browser DTO fork',
      'claiming Browser parity from mock-only tests',
    ],
  },
  {
    id: 'CDB-004',
    kind: 'remote-host-device-authorization-and-session-contract',
    owner: 'sdkwork-kernel and sdkwork-agents',
    capabilityIds: ['CDP-014'],
    requiredContractExtensions: [
      'Kernel remote-host and SSH lifecycle SPI',
      'Agents authorized-device and host contracts',
      'canonical Session mapping for remote continuation and code changes',
      'revoke-access, keep-awake, apply, revert, recovery, and audit semantics',
      'generated SDK and real remote desktop E2E surfaces',
    ],
    prohibitedWorkarounds: [
      'storing SSH credentials or device secrets in BirdCoder UI state',
      'exposing Codex thread identity outside the provider adapter',
      'raw SSH or HTTP integration from React components',
      'claiming remote Session continuation parity without authorization and recovery tests',
    ],
  },
  {
    id: 'CDB-005',
    kind: 'real-time-provider-execution-control-contract',
    owner: 'sdkwork-agents and sdkwork-kernel',
    capabilityIds: ['CDP-004', 'CDP-005', 'CDP-006'],
    observedRuntimeFacts: [
      'HTTP handlers await service.execute_turn before turn_execution_http_response serializes collected deltas and completion into one Body::from SSE body',
      'RuntimeFacadeTurnExecutor calls execute_code_engine_turn_with_stream, whose default sink is DiscardingModelStreamSink',
      'Each Turn bootstraps a local CodeEngineSlot and the active Codex TypeScript SDK path spawns codex exec --experimental-json rather than retaining an app-server connection',
      'AgentTurnRecord persists no model request id or transport execution handle',
      'cancel_turn marks the repository record cancelled and writes audit events without invoking Kernel cancellation',
      'approve_interaction and answer_interaction persist resolution and audit without continuing a provider server request',
      'Kernel exposes incremental streaming and request-scoped cancellation primitives that are not wired to a persistent Agents execution registry',
    ],
    requiredContractExtensions: [
      'Agents begin, stream, and finalize Turn phases backed by an incremental HTTP response body',
      'server-owned long-lived runtime registry that survives HTTP request boundaries',
      'persistent execution handle mapping canonical Session and Turn identities to modelRequestId, providerSessionId, providerTurnId, and transport lease',
      'Kernel long-lived Codex app-server JSON-RPC transport with server-request continuation',
      'provider cancellation and execution timeout routed from canonical Session and Turn identities before terminal persistence',
      'provider-confirmed Interaction resolution before canonical terminal persistence',
      'credentialed real-provider E2E for first delta, cancellation, approval, question, restart, and recovery',
    ],
    prohibitedWorkarounds: [
      'presenting completion-time SSE replay as live streaming',
      'presenting database-only cancellation as provider interruption',
      'persisting Interaction resolution without provider continuation',
      'BirdCoder direct provider transport or raw HTTP workaround',
    ],
  },
  {
    id: 'CDB-006',
    kind: 'kernel-codex-protocol-baseline-drift',
    owner: 'sdkwork-kernel',
    capabilityIds: ['CDP-015'],
    protocolBaseline: {
      referenceCommit: 'a05bcda3dbd68729caa2f11027b7f43974fda298',
      kernelVendoredCommit: 'ad2012d645b7146d31bb03f98e2bd9371635d11a',
      referenceCommonSha256: 'aef036e55042ba2fa2e310e02595da2af4553d28653217bebda3abbf8ac0cf78',
      kernelCommonSha256: '96e3ecd3ee909b5c5b6bdd4c0609d5a20e980accb5820e3f1becfbb797a45a37',
      referenceToolRequestUserInputParamsSha256: 'e3d55305c4fd4b40084335b8d0278ae910fa8d3f9be64de61d6171648957d41f',
      kernelToolRequestUserInputParamsSha256: 'f650142eb1dba090483314853e9d4caea200e4fb71d6b2df947f6ec0e2adf657',
      confirmedSchemaDrift: 'Kernel ToolRequestUserInputParams omits autoResolutionMs from the pinned reference schema.',
    },
    serverRequestMethods: [
      'item/commandExecution/requestApproval',
      'item/fileChange/requestApproval',
      'item/tool/requestUserInput',
      'mcpServer/elicitation/request',
      'item/permissions/requestApproval',
      'item/tool/call',
      'account/chatgptAuthTokens/refresh',
      'attestation/generate',
    ],
    requiredContractExtensions: [
      'align Kernel vendored Codex to the pinned desktop protocol baseline or provide a versioned compatibility adapter with equivalent schema tests',
      'generate and lock the complete current v2 ServerRequest request and response union',
      'typed dispatch and response continuation for all eight pinned ServerRequest methods',
      'canonical Interaction routing for user-mediated requests and secure Kernel host ports for dynamic tools, token refresh, and attestation',
      'provider thread and turn identities confined to the adapter and mapped to canonical Session execution handles',
      'contract and credentialed real-provider E2E for every user-mediated and host-mediated request class',
    ],
    prohibitedWorkarounds: [
      'manual edits to generated Codex protocol schemas',
      'dropping unknown server requests or fields while claiming compatibility',
      'treating the exec-only SDK stream as app-server ServerRequest parity',
      'passing auth tokens or attestation payloads through BirdCoder UI or Agents persistence',
      'claiming protocol compatibility from version strings without schema and behavior evidence',
    ],
  },
];
validateExactInventory(
  'contract blocker ids',
  spec.blockers.map((blocker) => blocker.id),
  requiredBlockerContracts.map((blocker) => blocker.id),
);
for (const requiredBlocker of requiredBlockerContracts) {
  const blocker = spec.blockers.find((candidate) => candidate.id === requiredBlocker.id);
  assert.equal(blocker?.kind, requiredBlocker.kind);
  assert.equal(blocker?.owner, requiredBlocker.owner);
  assert.equal(blocker?.status, 'pending-human-review');
  assert.equal(blocker?.humanReviewRequired, true);
  validateExactInventory(
    `${requiredBlocker.id} required contract extensions`,
    blocker?.requiredContractExtensions ?? [],
    requiredBlocker.requiredContractExtensions,
  );
  validateExactInventory(
    `${requiredBlocker.id} prohibited workarounds`,
    blocker?.prohibitedWorkarounds ?? [],
    requiredBlocker.prohibitedWorkarounds,
  );
  for (const evidenceInventoryKey of [
    'observedRuntimeFacts',
    'observedProviderRequestMethods',
    'observedAgentsInteractionKinds',
    'serverRequestMethods',
  ]) {
    if (requiredBlocker[evidenceInventoryKey]) {
      validateExactInventory(
        `${requiredBlocker.id} ${evidenceInventoryKey}`,
        blocker?.evidence?.[evidenceInventoryKey] ?? [],
        requiredBlocker[evidenceInventoryKey],
      );
    }
  }
  if (requiredBlocker.protocolBaseline) {
    assert.deepEqual(blocker?.evidence?.protocolBaseline, requiredBlocker.protocolBaseline);
  }
  validateExactInventory(
    `${requiredBlocker.id} capability references`,
    spec.capabilities
      .filter((capability) => capability.blockerId === requiredBlocker.id)
      .map((capability) => capability.id),
    requiredBlocker.capabilityIds,
  );
}

for (const capabilityId of ['CDP-004', 'CDP-005', 'CDP-006']) {
  const capability = spec.capabilities.find((candidate) => candidate.id === capabilityId);
  assert.equal(capability?.status, 'blocked-contract');
  assert.equal(capability?.blockerId, 'CDB-005');
}

const serverRequestCapability = spec.capabilities.find(
  (candidate) => candidate.id === 'CDP-015',
);
assert.equal(serverRequestCapability?.status, 'blocked-contract');
assert.equal(serverRequestCapability?.blockerId, 'CDB-006');
assert.deepEqual(serverRequestCapability?.evidence?.relatedBlockerIds, ['CDB-001', 'CDB-005']);

const protocolDrift = spec.blockers.find((candidate) => candidate.id === 'CDB-006')?.evidence
  ?.protocolBaseline;
assert.equal(
  sha256File('external/codex/codex-rs/app-server-protocol/src/protocol/common.rs'),
  protocolDrift?.referenceCommonSha256,
);
assert.equal(
  sha256File('../sdkwork-kernel/external/codex/codex-rs/app-server-protocol/src/protocol/common.rs'),
  protocolDrift?.kernelCommonSha256,
);
assert.equal(
  sha256File('external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts'),
  protocolDrift?.referenceToolRequestUserInputParamsSha256,
);
assert.equal(
  sha256File('../sdkwork-kernel/external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts'),
  protocolDrift?.kernelToolRequestUserInputParamsSha256,
);

for (const blocker of spec.blockers) {
  if (blocker.humanReviewRequired !== true) {
    errors.push(`[${blocker.id}] public contract or security blocker requires human review`);
  }
  if (!Array.isArray(blocker.prohibitedWorkarounds) || blocker.prohibitedWorkarounds.length === 0) {
    errors.push(`[${blocker.id}] prohibited workarounds must be explicit`);
  }
  for (const relativePath of blocker.evidence?.paths ?? []) {
    if (!fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${blocker.id}] missing blocker evidence path: ${relativePath}`);
    }
  }
}

const visualCapability = spec.capabilities.find((capability) => capability.id === 'CDP-009');
assert.equal(visualCapability?.status, 'aligned-and-verified');
validateExactInventory(
  'visual parity evidence paths',
  visualCapability?.evidence?.paths ?? [],
  [
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatPendingInteractions.tsx',
    'apps/sdkwork-birdcoder-pc/tests/e2e/codex-desktop-visual-parity.spec.ts',
    'apps/sdkwork-birdcoder-pc/tests/e2e/codex-desktop-visual-parity.spec.ts-snapshots/codex-session-desktop-1440x900-chromium-win32.png',
    'apps/sdkwork-birdcoder-pc/tests/e2e/codex-desktop-visual-parity.spec.ts-snapshots/codex-session-narrow-900x800-chromium-win32.png',
    'scripts/run-pc-playwright-e2e.mjs',
    'scripts/run-pc-playwright-e2e.test.mjs',
    'scripts/pc-e2e-standard-contract.test.mjs',
  ],
);
validateExactInventory(
  'visual parity commands',
  visualCapability?.evidence?.commands ?? [],
  [
    'node scripts/run-pc-playwright-e2e.test.mjs',
    'node scripts/pc-e2e-standard-contract.test.mjs',
    'node scripts/run-pc-playwright-e2e.mjs tests/e2e/codex-desktop-visual-parity.spec.ts --project=chromium',
  ],
);
assert.deepEqual(visualCapability?.evidence?.browserFailurePolicy, {
  consoleErrors: 'zero',
  failedRequests: 'zero',
});
const visualCases = visualCapability?.evidence?.cases ?? [];
validateExactInventory(
  'Codex visual regression cases',
  visualCases.map((visualCase) => visualCase.id),
  ['desktop-1440x900', 'narrow-900x800'],
);
const expectedVisualViewports = new Map([
  ['desktop-1440x900', { width: 1440, height: 900 }],
  ['narrow-900x800', { width: 900, height: 800 }],
]);
const referenceArchive = spec.reference.artifacts.find(
  (artifact) => artifact.path === 'app/resources/app.asar',
);
for (const visualCase of visualCases) {
  if (!fs.existsSync(resolvePath(visualCase.snapshotPath))) {
    errors.push(`[${visualCase.id}] missing visual snapshot: ${visualCase.snapshotPath}`);
    continue;
  }
  if (visualCase.snapshotSha256 !== sha256File(visualCase.snapshotPath)) {
    errors.push(`[${visualCase.id}] visual snapshot hash does not match its evidence file`);
  }
  if (visualCase.referenceBuild !== spec.reference.build) {
    errors.push(`[${visualCase.id}] visual reference build does not match the pinned desktop build`);
  }
  if (visualCase.referenceArtifactSha256 !== referenceArchive?.sha256) {
    errors.push(`[${visualCase.id}] visual reference hash does not match the pinned desktop archive`);
  }
  if (visualCase.platform !== 'win32' || visualCase.browserProject !== 'chromium') {
    errors.push(`[${visualCase.id}] visual baseline must use the governed Windows Chromium profile`);
  }
  if (visualCase.status !== 'passed') {
    errors.push(`[${visualCase.id}] visual regression is not passed`);
  }
  if (
    JSON.stringify(visualCase.viewport)
    !== JSON.stringify(expectedVisualViewports.get(visualCase.id))
  ) {
    errors.push(`[${visualCase.id}] visual viewport does not match the governed case`);
  }
}
if (visualCapability?.status === 'aligned-and-verified') {
  if (
    spec.verification.desktopVisualRegression !== 'passed'
    || spec.verification.narrowVisualRegression !== 'passed'
  ) {
    errors.push('CDP-009 cannot be aligned before desktop and narrow visual regression pass');
  }
}

if (spec.goalStatus === 'complete') {
  if (fixtureContract.syntheticCoverageStatus !== 'complete') {
    errors.push('goal cannot complete before synthetic presentation fixture coverage is complete');
  }
  const incompleteCapability = spec.capabilities.find(
    (capability) => capability.status !== spec.completionPolicy.requiredCapabilityStatus,
  );
  if (incompleteCapability) {
    errors.push(`goal cannot complete while ${incompleteCapability.id} is ${incompleteCapability.status}`);
  }
  if (spec.completionPolicy.requireNoOpenBlockers && spec.blockers.length > 0) {
    errors.push('goal cannot complete while contract blockers remain open');
  }
  if (spec.verification.realProviderE2E !== 'passed') {
    errors.push('goal cannot complete before real provider E2E passes');
  }
  if (
    spec.verification.desktopVisualRegression !== 'passed'
    || spec.verification.narrowVisualRegression !== 'passed'
  ) {
    errors.push('goal cannot complete before desktop and narrow visual regression pass');
  }
}

assert.deepEqual(
  errors,
  [],
  `Codex desktop parity contract failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`,
);

console.log('Codex desktop parity contract passed.');
console.log(`reference build: ${spec.reference.build}`);
console.log(`capabilities: ${spec.capabilities.length}; blockers: ${spec.blockers.length}`);
console.log(
  `presentation evidence: ${providerItems.length} provider items; ${syntheticItems.length} synthetic items`,
);
