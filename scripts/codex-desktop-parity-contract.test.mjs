import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { sha256File as sha256ResolvedFile } from "./sdkwork-utils-digest.mjs";

const root = path.resolve(import.meta.dirname, "..");
const specPath = path.join(root, "specs/codex-desktop-parity.spec.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const errors = [];

const requiredProviderItemTypes = [
  "userMessage",
  "hookPrompt",
  "agentMessage",
  "plan",
  "reasoning",
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "subAgentActivity",
  "webSearch",
  "imageView",
  "sleep",
  "imageGeneration",
  "enteredReviewMode",
  "exitedReviewMode",
  "contextCompaction",
];

const requiredSyntheticItemTypes = [
  "todo-list",
  "planImplementation",
  "error",
  "automaticApprovalReview",
  "autoReviewInterruptionWarning",
  "remoteTaskCreated",
  "personalityChanged",
  "forkedFromConversation",
  "modelChanged",
  "modelRerouted",
  "userInputResponse",
  "mcpServerElicitation",
  "permissionRequest",
  "worktreeInit",
  "steeringUserMessage",
  "steered",
];

const requiredBlockedSyntheticItemTypes = [
  "automaticApprovalReview",
  "userInputResponse",
  "mcpServerElicitation",
  "permissionRequest",
];

const requiredCapabilityIds = Array.from(
  { length: 16 },
  (_, index) => `CDP-${String(index + 1).padStart(3, "0")}`,
);

const requiredReferenceArtifactPaths = [
  "app/resources/app.asar",
  "AppxManifest.xml",
  "app/resources/app.asar::package.json",
  "app/resources/app.asar::.vite/build/main-C1YkadXg.js",
  "app/resources/app.asar::.vite/build/src-CLstCQVF.js",
  "app/resources/codex.exe",
  "app/resources/owl-electron-app.json",
  "app/resources/cua_node/manifest.json",
  "app/resources/plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json",
  "app/resources/plugins/openai-bundled/plugins/browser/skills/control-in-app-browser/SKILL.md",
  "app/resources/plugins/openai-bundled/plugins/browser/docs/api.json",
  "app/resources/plugins/openai-bundled/plugins/browser/scripts/browser-client.mjs",
  "app/resources/app.asar::webview/assets/automations-page-22dsgVr1.js",
  "app/resources/app.asar::webview/assets/app-initial-cpPdPura.js",
  "app/resources/app.asar::webview/assets/app-initial-D7RtMALq.css",
  "app/resources/app.asar::webview/assets/app-CVDUBv1W.css",
  "app/resources/app.asar::webview/assets/browser-CVV9l2Fo.js",
  "app/resources/app.asar::webview/assets/browser-sidebar-hidden-background-webview-host-Dupcquxn.js",
  "app/resources/app.asar::webview/assets/browser-sidebar-hidden-browser-use-webview-host-B3sa6LzG.js",
  "app/resources/app.asar::webview/assets/browser-use-settings-DdtMx6KN.js",
  "app/resources/app.asar::webview/assets/thread-browser-panel-tabs-DQqWTshl.js",
  "app/resources/app.asar::webview/assets/remote-connections-settings-BzFUQtdl.js",
  "app/resources/app.asar::webview/assets/remote-conversation-page-D988P5nY.js",
];

function resolvePath(relativePath) {
  return path.resolve(root, relativePath);
}

function sha256File(relativePath) {
  return sha256ResolvedFile(resolvePath(relativePath));
}

function validateSourceSemanticAssertions(
  blockerId,
  assertions,
  evidencePaths,
) {
  for (const assertion of assertions) {
    assert.ok(
      evidencePaths.includes(assertion.path),
      `${blockerId} semantic source is missing from evidence.paths: ${assertion.path}`,
    );
    const source = fs
      .readFileSync(resolvePath(assertion.path), "utf8")
      .replace(/\r\n?/g, "\n");
    const startIndex = source.indexOf(assertion.scope.startMarker);
    assert.notEqual(
      startIndex,
      -1,
      `${blockerId} semantic scope start drifted: ${assertion.label}`,
    );
    const endIndex = source.indexOf(
      assertion.scope.endMarker,
      startIndex + assertion.scope.startMarker.length,
    );
    assert.notEqual(
      endIndex,
      -1,
      `${blockerId} semantic scope end drifted: ${assertion.label}`,
    );
    const scope = source.slice(startIndex, endIndex);

    let orderedOffset = 0;
    for (const expected of assertion.orderedContains ?? []) {
      const expectedIndex = scope.indexOf(expected, orderedOffset);
      assert.notEqual(
        expectedIndex,
        -1,
        `${blockerId} semantic source drifted: ${assertion.label} must contain ${expected}`,
      );
      orderedOffset = expectedIndex + expected.length;
    }
    for (const expected of assertion.contains ?? []) {
      assert.ok(
        scope.includes(expected),
        `${blockerId} semantic source drifted: ${assertion.label} must contain ${expected}`,
      );
    }
    for (const forbidden of assertion.notContains ?? []) {
      assert.ok(
        !scope.includes(forbidden),
        `${blockerId} semantic source drifted: ${assertion.label} must not contain ${forbidden}`,
      );
    }
  }
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
assert.equal(spec.kind, "sdkwork.codex-desktop-parity");
assert.equal(spec.goalStatus, "active");
assert.deepEqual(spec.terminology, {
  canonicalContinuationResource: "Session",
  canonicalProviderIdentityField: "providerSessionId",
  providerProtocolResource: "thread",
  providerBoundary:
    "Codex thread fields are accepted only by the Codex provider adapter or exact raw protocol fixtures and are converted to Session before entering BirdCoder.",
  forbiddenBirdCoderDomainResource: "Thread",
});
assert.equal(spec.completionPolicy.prohibitSingleFeatureCompletion, true);
assert.equal(spec.completionPolicy.requireRealProviderE2E, true);
assert.equal(
  spec.completionPolicy.requireDesktopAndNarrowVisualRegression,
  true,
);
assert.equal(spec.completionPolicy.requirePerPresentationFixtureEvidence, true);

assert.equal(spec.reference.build, "26.727.6591.0");
assert.equal(spec.reference.rendererPackageVersion, "26.727.51351");
assert.equal(spec.reference.packageBuildNumber, "6119");
assert.deepEqual(spec.reference.providerHost, {
  version: "0.146.0-alpha.9.2",
  executablePath: "app/resources/codex.exe",
  executableSha256:
    "ecd7a3eaff5e42723dbba03b5c91514b3986b5db5cbca8f34619620b5356f31f",
});
assert.deepEqual(spec.reference.browserRuntime, {
  nodeVersion: "24.14.0",
  cuaManifestPath: "app/resources/cua_node/manifest.json",
  cuaManifestSha256:
    "bd6604bc1a1360dac2226fe49bb85a76edf1774d639f5c934238f8d17e904f14",
  pluginVersion: "26.727.51351",
  runtimeArchiveVersion: "0.0.6/20260723162306-088049353ddc",
  pluginManifestPath:
    "app/resources/plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json",
  pluginManifestSha256:
    "a74d09c7cddc2148633ec880867264357781ea1896e9de9ed5555faed7518a4f",
});
assert.deepEqual(spec.reference.protocolSource, {
  commit: "a05bcda3dbd68729caa2f11027b7f43974fda298",
  threadItemSchemaPath:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts",
  threadItemSchemaSha256:
    "57190566ac2ec5a64a595ecfb80fb8fe6900f29136d77944097e7b6a6f3acd38",
});
assert.deepEqual(spec.reference.installationVerification, {
  status: "verified",
  verifiedAt: "2026-08-01",
  packageFullName: "OpenAI.Codex_26.727.6591.0_x64__2p2nqsd0c76g0",
  packageVersion: "26.727.6591.0",
  artifactPath: "app/resources/app.asar",
  artifactSha256:
    "670a43ea0dcf6d2583f77272354cf076d1a2d5d9949873c4923c9534d86ea298",
  artifactSizeBytes: 221851751,
});
assert.equal(
  spec.reference.runtimeArchiveSha256,
  "fae9088c09bd2bb4cedbdb44e749fe5313dbc19d20f677fa6a7b25b3aec27d1f",
);

validateExactInventory(
  "reference artifact paths",
  spec.reference.artifacts.map((artifact) => artifact.path),
  requiredReferenceArtifactPaths,
);
const referenceArtifactsByPath = new Map(
  spec.reference.artifacts.map((artifact) => [artifact.path, artifact]),
);
for (const artifact of spec.reference.artifacts) {
  const digest = artifact.sha256 ?? artifact.runtimeArchiveSha256;
  assert.match(digest, /^[a-f0-9]{64}$/u);
}
assert.equal(
  referenceArtifactsByPath.get(spec.reference.providerHost.executablePath)
    ?.sha256,
  spec.reference.providerHost.executableSha256,
);
assert.equal(
  referenceArtifactsByPath.get(spec.reference.browserRuntime.cuaManifestPath)
    ?.sha256,
  spec.reference.browserRuntime.cuaManifestSha256,
);
assert.equal(
  referenceArtifactsByPath.get(spec.reference.browserRuntime.pluginManifestPath)
    ?.sha256,
  spec.reference.browserRuntime.pluginManifestSha256,
);
assert.equal(
  spec.reference.installationVerification.packageVersion,
  spec.reference.build,
);
const installedArchive = referenceArtifactsByPath.get(
  spec.reference.installationVerification.artifactPath,
);
assert.equal(
  installedArchive?.sha256,
  spec.reference.installationVerification.artifactSha256,
);
assert.equal(
  installedArchive?.sizeBytes,
  spec.reference.installationVerification.artifactSizeBytes,
);
assert.equal(
  sha256File(spec.reference.protocolSource.threadItemSchemaPath),
  spec.reference.protocolSource.threadItemSchemaSha256,
);

const desktopRendererEvidence = spec.presentationEvidence.desktopRenderer;
assert.equal(desktopRendererEvidence.archiveEntryByteOffset, 25195948);
assert.equal(desktopRendererEvidence.archiveEntryRawLineCount, 9720);
assert.deepEqual(desktopRendererEvidence.formatter, {
  package: "prettier",
  version: "3.9.5",
  parser: "babel",
  printWidth: 256,
});
assert.deepEqual(desktopRendererEvidence.itemMappingLines, {
  symbol: "Nw",
  start: 142699,
  end: 143064,
  rawLine: 873,
  entryCodeUnitOffset: 3422179,
  entryByteOffset: 3459330,
  archiveByteOffset: 28655278,
  coordinateSystem: "formatter-output",
});
assert.deepEqual(desktopRendererEvidence.visibilityPredicate, {
  symbol: "x1n",
  start: 143107,
  end: 143133,
  coordinateSystem: "formatter-output",
  rawLine: 874,
  entryCodeUnitOffset: 3435097,
  entryByteOffset: 3472248,
  archiveByteOffset: 28668196,
});
assert.deepEqual(desktopRendererEvidence.rawArchiveEvidence, {
  composerSurface: {
    marker: "composer-surface-chrome",
    rawLine: 8475,
    entryCodeUnitOffset: 7845443,
    entryByteOffset: 7887807,
    archiveByteOffset: 33083755,
  },
  approvalSurface: {
    marker: "data-codex-approval-surface",
    rawLine: 9006,
    entryCodeUnitOffset: 10560544,
    entryByteOffset: 10603407,
    archiveByteOffset: 35799355,
  },
  userInputAutoResolution: {
    marker: "data-user-input-auto-resolution",
    rawLine: 9007,
    entryCodeUnitOffset: 10641455,
    entryByteOffset: 10684324,
    archiveByteOffset: 35880272,
  },
  composerRequestNavigation: {
    marker: "data-codex-composer-request-navigation",
    rawLine: 9007,
    entryCodeUnitOffset: 10695582,
    entryByteOffset: 10738459,
    archiveByteOffset: 35934407,
  },
});

const presentation = spec.presentationEvidence;
assert.equal(presentation.rawProviderUnion.name, "ThreadItem");
assert.equal(
  presentation.rawProviderUnion.expectedVariantCount,
  requiredProviderItemTypes.length,
);
assert.match(
  presentation.rawProviderUnion.boundary,
  /canonical Session output/u,
);
assert.equal(presentation.desktopRenderer.referenceBuild, spec.reference.build);
assert.equal(
  presentation.desktopRenderer.archiveEntry,
  "webview/assets/app-initial-cpPdPura.js",
);
assert.equal(presentation.desktopRenderer.visibilityPredicate.symbol, "x1n");
assert.ok(
  presentation.desktopRenderer.itemMappingLines.start <
    presentation.desktopRenderer.itemMappingLines.end,
);
assert.ok(
  presentation.desktopRenderer.visibilityPredicate.start <
    presentation.desktopRenderer.visibilityPredicate.end,
);
assert.deepEqual(presentation.visibilityCatalog, [
  "visible",
  "conditional",
  "hidden",
]);

const fixtureContract = presentation.fixtureContract;
assert.equal(fixtureContract.requireIndependentlyAuthoredInput, true);
assert.equal(fixtureContract.requireRawProviderShape, true);
assert.equal(fixtureContract.requireCanonicalSessionOutput, true);
assert.equal(fixtureContract.requireDesktopVisibilityAssertion, true);
if (!fs.existsSync(resolvePath(fixtureContract.path))) {
  errors.push(`missing presentation fixture contract: ${fixtureContract.path}`);
}
if (!fs.existsSync(resolvePath(fixtureContract.syntheticPath))) {
  errors.push(
    `missing synthetic presentation fixture contract: ${fixtureContract.syntheticPath}`,
  );
}
if (
  !["partial", "complete"].includes(fixtureContract.syntheticCoverageStatus)
) {
  errors.push(
    `unsupported synthetic fixture coverage: ${fixtureContract.syntheticCoverageStatus}`,
  );
}
const providerFixtureSource = fs.existsSync(resolvePath(fixtureContract.path))
  ? fs.readFileSync(resolvePath(fixtureContract.path), "utf8")
  : "";
const syntheticFixtureSource = fs.existsSync(
  resolvePath(fixtureContract.syntheticPath),
)
  ? fs.readFileSync(resolvePath(fixtureContract.syntheticPath), "utf8")
  : "";

const providerItems = presentation.providerItems ?? [];
const providerItemTypes = providerItems.map((item) => item.rawType);
validateExactInventory(
  "raw provider item evidence",
  providerItemTypes,
  requiredProviderItemTypes,
);

const protocolSourcePath = resolvePath(
  presentation.rawProviderUnion.sourcePath,
);
if (!fs.existsSync(protocolSourcePath)) {
  errors.push(
    `missing raw provider union authority: ${presentation.rawProviderUnion.sourcePath}`,
  );
} else {
  const protocolSource = fs.readFileSync(protocolSourcePath, "utf8");
  const protocolItemTypes = [
    ...protocolSource.matchAll(/\{\s*"type":\s*"([^"]+)"/gu),
  ].map((match) => match[1]);
  validateExactInventory(
    "generated raw provider union",
    protocolItemTypes,
    requiredProviderItemTypes,
  );
}

const providerVisibility = new Map([
  ["userMessage", "conditional"],
  ["hookPrompt", "conditional"],
  ["agentMessage", "visible"],
  ["plan", "visible"],
  ["reasoning", "conditional"],
  ["commandExecution", "visible"],
  ["fileChange", "conditional"],
  ["mcpToolCall", "visible"],
  ["dynamicToolCall", "conditional"],
  ["collabAgentToolCall", "conditional"],
  ["subAgentActivity", "conditional"],
  ["webSearch", "visible"],
  ["imageView", "visible"],
  ["sleep", "hidden"],
  ["imageGeneration", "visible"],
  ["enteredReviewMode", "hidden"],
  ["exitedReviewMode", "hidden"],
  ["contextCompaction", "visible"],
]);
const fixtureKeys = new Set();
for (const item of providerItems) {
  const expectedVisibility = providerVisibility.get(item.rawType);
  if (item.desktopVisibility !== expectedVisibility) {
    errors.push(
      `[${item.rawType}] expected ${expectedVisibility} visibility, received ${item.desktopVisibility}`,
    );
  }
  if (
    typeof item.visibilityRule !== "string" ||
    item.visibilityRule.trim().length === 0
  ) {
    errors.push(`[${item.rawType}] missing desktop visibility rule`);
  }
  if (
    item.desktopVisibility === "hidden" &&
    item.canonicalPresentation !== null
  ) {
    errors.push(
      `[${item.rawType}] hidden item must not declare a canonical presentation row`,
    );
  }
  if (
    item.canonicalPresentation != null &&
    /\bthread\b/iu.test(item.canonicalPresentation)
  ) {
    errors.push(
      `[${item.rawType}] canonical presentation must use Session terminology`,
    );
  }
  if (typeof item.fixtureKey !== "string" || item.fixtureKey.length === 0) {
    errors.push(`[${item.rawType}] missing independently authored fixture key`);
  } else if (fixtureKeys.has(item.fixtureKey)) {
    errors.push(`[${item.rawType}] duplicate fixture key: ${item.fixtureKey}`);
  } else {
    fixtureKeys.add(item.fixtureKey);
    if (!providerFixtureSource.includes(item.fixtureKey)) {
      errors.push(
        `[${item.rawType}] fixture key is not asserted by ${fixtureContract.path}`,
      );
    }
  }
}

const providerItemsByType = new Map(
  providerItems.map((item) => [item.rawType, item]),
);
assert.match(
  providerItemsByType.get("hookPrompt").visibilityRule,
  /non-empty trimmed text/u,
);
assert.match(
  providerItemsByType.get("agentMessage").visibilityRule,
  /Preserve phase and provider completion.*memory citation.*CDATA.*final_answer.*commentary.*turn process disclosure.*actions hidden until completion/u,
);
assert.equal(
  providerItemsByType.get("agentMessage").canonicalPresentation,
  "phase-aware assistant Markdown",
);
assert.match(
  providerItemsByType.get("fileChange").visibilityRule,
  /\.codex\/visualizations.*in-progress or completed add\/update.*failed-only.*delete-only/u,
);
assert.match(
  providerItemsByType.get("dynamicToolCall").visibilityRule,
  /Hide load_workspace_dependencies.*automation_update.*completed successfully.*automation schema/u,
);
assert.match(
  providerItemsByType.get("mcpToolCall").canonicalPresentation,
  /result, duration, app resource URI, and plugin identity/u,
);
assert.equal(providerItemsByType.get("imageView").aggregation, "consecutive");
assert.equal(
  providerItemsByType.get("contextCompaction").desktopVisibility,
  "visible",
);
for (const fixtureMarker of [
  "codex-file-change-visual-update",
  "codex-file-change-visual-delete",
  "codex-file-change-visual-failed",
  "codex-dynamic-tool-automation-invalid",
  "ui://docs/search-result",
  "inputImage",
  "inputAudio",
]) {
  assert.match(providerFixtureSource, new RegExp(fixtureMarker, "u"));
}
for (const hiddenType of ["sleep", "enteredReviewMode", "exitedReviewMode"]) {
  assert.equal(providerItemsByType.get(hiddenType).desktopVisibility, "hidden");
}

const syntheticItems = presentation.syntheticItems ?? [];
validateExactInventory(
  "desktop synthetic item evidence",
  syntheticItems.map((item) => item.desktopType),
  requiredSyntheticItemTypes,
);
const conditionalSyntheticTypes = new Set([
  "todo-list",
  "error",
  "automaticApprovalReview",
  "steeringUserMessage",
]);
const blockedSyntheticTypes = new Set(requiredBlockedSyntheticItemTypes);
for (const item of syntheticItems) {
  const expectedVisibility = conditionalSyntheticTypes.has(item.desktopType)
    ? "conditional"
    : "visible";
  const expectedStatus = blockedSyntheticTypes.has(item.desktopType)
    ? "blocked-contract"
    : "fixture-covered";
  if (item.desktopVisibility !== expectedVisibility) {
    errors.push(
      `[${item.desktopType}] expected ${expectedVisibility} synthetic visibility, received ${item.desktopVisibility}`,
    );
  }
  if (
    typeof item.visibilityRule !== "string" ||
    item.visibilityRule.trim().length === 0
  ) {
    errors.push(`[${item.desktopType}] missing synthetic visibility rule`);
  }
  if (
    typeof item.canonicalPresentation !== "string" ||
    item.canonicalPresentation.trim().length === 0 ||
    /\bthread\b/iu.test(item.canonicalPresentation)
  ) {
    errors.push(
      `[${item.desktopType}] synthetic presentation must use canonical Session semantics`,
    );
  }
  if (item.status !== expectedStatus) {
    errors.push(
      `[${item.desktopType}] expected ${expectedStatus} synthetic evidence status, received ${item.status}`,
    );
  }
  if (expectedStatus === "blocked-contract") {
    if (item.blockerId !== "CDB-001") {
      errors.push(
        `[${item.desktopType}] blocked synthetic evidence must reference CDB-001`,
      );
    }
  } else if (item.blockerId != null) {
    errors.push(
      `[${item.desktopType}] fixture-covered synthetic evidence must not declare a blocker`,
    );
  }
  if (typeof item.fixtureKey !== "string" || item.fixtureKey.length === 0) {
    errors.push(
      `[${item.desktopType}] missing independently authored fixture key`,
    );
  } else if (fixtureKeys.has(item.fixtureKey)) {
    errors.push(
      `[${item.desktopType}] duplicate fixture key: ${item.fixtureKey}`,
    );
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
  .filter((item) => item.status === "blocked-contract")
  .map((item) => item.desktopType);
validateExactInventory(
  "blocked synthetic owner-contract evidence",
  declaredBlockedSyntheticTypes,
  requiredBlockedSyntheticItemTypes,
);
if (
  declaredBlockedSyntheticTypes.length > 0 &&
  fixtureContract.syntheticCoverageStatus !== "partial"
) {
  errors.push(
    "synthetic fixture coverage must remain partial while owner-contract gaps remain",
  );
}

const statuses = new Set(spec.statusCatalog);
const capabilityIds = new Set();
const blockerIds = new Set(spec.blockers.map((blocker) => blocker.id));
for (const item of syntheticItems) {
  if (item.status === "blocked-contract" && !blockerIds.has(item.blockerId)) {
    errors.push(
      `[${item.desktopType}] missing declared synthetic blocker: ${item.blockerId}`,
    );
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
  if (
    capability.status === "blocked-contract" &&
    !blockerIds.has(capability.blockerId)
  ) {
    errors.push(
      `[${capability.id}] missing declared blocker: ${capability.blockerId}`,
    );
  }
  for (const relativePath of capability.evidence?.paths ?? []) {
    if (!fs.existsSync(resolvePath(relativePath))) {
      errors.push(`[${capability.id}] missing evidence path: ${relativePath}`);
    }
  }
}

validateExactInventory(
  "parity capability ids",
  [...capabilityIds],
  requiredCapabilityIds,
);

const blockedFeatureCapabilities = [
  {
    id: "CDP-012",
    area: "automation",
    title:
      "Session-bound Automations create, schedule, run-now, pause, resume, history, notification, cancellation, and recovery",
    blockerId: "CDB-002",
    paths: [
      "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/WorkModeSidebar.tsx",
      "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/dto.rs",
      "../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/types/create-agent-task-request.ts",
    ],
    referenceArtifacts: [
      "app/resources/app.asar::webview/assets/automations-page-22dsgVr1.js",
    ],
  },
  {
    id: "CDP-013",
    area: "browser-session",
    title:
      "Session-scoped embedded Browser navigation, history, site approval, capture, stop, and isolation",
    blockerId: "CDB-003",
    paths: [
      "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/BrowserPreviewSurface.tsx",
      "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/settings/integrationPreferences.ts",
      "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/BrowserSettings.tsx",
      "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/integration-settings/BrowserWebsitePermissions.tsx",
      "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings/src/components/integration-settings/browserSettingsUtils.ts",
      "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/src-tauri/src/lib.rs",
    ],
    referenceArtifacts: [
      "app/resources/app.asar::webview/assets/app-initial-cpPdPura.js",
      "app/resources/app.asar::webview/assets/browser-CVV9l2Fo.js",
      "app/resources/app.asar::webview/assets/browser-sidebar-hidden-background-webview-host-Dupcquxn.js",
      "app/resources/app.asar::webview/assets/browser-sidebar-hidden-browser-use-webview-host-B3sa6LzG.js",
      "app/resources/app.asar::webview/assets/browser-use-settings-DdtMx6KN.js",
      "app/resources/app.asar::webview/assets/thread-browser-panel-tabs-DQqWTshl.js",
      "app/resources/cua_node/manifest.json",
      "app/resources/plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json",
      "app/resources/plugins/openai-bundled/plugins/browser/skills/control-in-app-browser/SKILL.md",
      "app/resources/plugins/openai-bundled/plugins/browser/docs/api.json",
      "app/resources/plugins/openai-bundled/plugins/browser/scripts/browser-client.mjs",
    ],
  },
  {
    id: "CDP-014",
    area: "remote-session",
    title:
      "Remote Connections, authorized devices, SSH hosts, and canonical Session continuation over remote execution",
    blockerId: "CDB-004",
    paths: ["apps/sdkwork-birdcoder-pc/src/bootstrap/routes.ts"],
    referenceArtifacts: [
      "app/resources/app.asar::webview/assets/remote-connections-settings-BzFUQtdl.js",
      "app/resources/app.asar::webview/assets/remote-conversation-page-D988P5nY.js",
    ],
  },
];
for (const expectedCapability of blockedFeatureCapabilities) {
  const capability = spec.capabilities.find(
    (candidate) => candidate.id === expectedCapability.id,
  );
  assert.equal(capability?.area, expectedCapability.area);
  assert.equal(capability?.title, expectedCapability.title);
  assert.equal(capability?.status, "blocked-contract");
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
      errors.push(
        `[${expectedCapability.id}] undeclared reference artifact: ${referenceArtifact}`,
      );
    }
  }
}

const realProviderCapability = spec.capabilities.find(
  (capability) => capability.id === "CDP-010",
);
assert.equal(realProviderCapability?.status, "pending");
validateExactInventory(
  "real provider E2E evidence paths",
  realProviderCapability?.evidence?.paths ?? [],
  [
    "apps/sdkwork-birdcoder-pc/playwright.codex-provider-live.config.ts",
    "apps/sdkwork-birdcoder-pc/tests/e2e-live/codex-provider-live.spec.ts",
    "apps/sdkwork-birdcoder-pc/tests/e2e-live/codexProviderLiveHarness.ts",
    "scripts/release/probe-desktop-codex-app-server-live.mjs",
    "scripts/release/probe-desktop-codex-app-server-live.test.mjs",
    "scripts/run-codex-provider-live-e2e.mjs",
    "scripts/codex-provider-live-e2e-contract.test.mjs",
  ],
);
validateExactInventory(
  "real provider E2E commands",
  realProviderCapability?.evidence?.commands ?? [],
  [
    "node scripts/release/probe-desktop-codex-app-server-live.test.mjs",
    "node scripts/release/probe-desktop-codex-app-server-live.mjs --host-root target/release/provider-host --preflight-only",
    "node scripts/release/probe-desktop-codex-app-server-live.mjs --host-root target/release/provider-host",
    "node scripts/codex-provider-live-e2e-contract.test.mjs",
    "node scripts/run-codex-provider-live-e2e.mjs --preflight-only",
    "node scripts/run-codex-provider-live-e2e.mjs",
  ],
);
assert.equal(
  realProviderCapability?.evidence?.pendingReason,
  "Credentialed BirdCoder UI live provider E2E is pending because its required environment configuration is absent. Packaged provider-host authentication, real streaming response, and Session continuation have passed independently.",
);
assert.deepEqual(realProviderCapability?.evidence?.preflight, {
  command: "node scripts/run-codex-provider-live-e2e.mjs --preflight-only",
  status: "failed-closed",
  stage: "environment-configuration",
  providerHost: null,
  reason: "Missing required live E2E environment keys.",
  missingKeys: [
    "SDKWORK_CODEX_LIVE_E2E",
    "SDKWORK_CODEX_LIVE_WEB_URL",
    "SDKWORK_CODEX_LIVE_ACCOUNT",
    "SDKWORK_CODEX_LIVE_PASSWORD",
    "SDKWORK_CODEX_LIVE_PROJECT_NAME",
    "SDKWORK_CODEX_LIVE_SEND_SESSION_ID",
    "SDKWORK_CODEX_LIVE_CANCEL_SESSION_ID",
    "SDKWORK_CODEX_LIVE_APPROVAL_SESSION_ID",
    "SDKWORK_CODEX_LIVE_QUESTION_SESSION_ID",
    "SDKWORK_CODEX_LIVE_PROVIDER_HOST",
    "SDKWORK_CODEX_LIVE_RESTART_EXECUTABLE",
    "SDKWORK_CODEX_LIVE_RESTART_ARGUMENTS_JSON",
    "SDKWORK_CODEX_LIVE_CANCEL_PROBE_EXECUTABLE",
    "SDKWORK_CODEX_LIVE_CANCEL_PROBE_ARGUMENTS_JSON",
  ],
  credentialedCasesRun: 0,
  checkedAt: "2026-08-01",
});
assert.deepEqual(realProviderCapability?.evidence?.packagedAppServerLiveProbe, {
  command:
    "node scripts/release/probe-desktop-codex-app-server-live.mjs --host-root target/release/provider-host",
  environmentGate: "SDKWORK_CODEX_APP_SERVER_LIVE_PROBE=1",
  status: "passed",
  checkedAt: "2026-08-01",
  runtimeTargetTriple: "x86_64-pc-windows-msvc",
  codexVersion: "0.146.0",
  nodeVersion: "22.20.0",
  firstChunkCount: 27,
  resumedChunkCount: 30,
  firstKernelEventCount: 42,
  resumedKernelEventCount: 41,
  assertions: [
    "the packaged Node.js process invoked the packaged Codex app-server executable through the staged Kernel runtime module",
    "the first request started with canonical sessionId and without providerSessionId",
    "every emitted Kernel event retained the canonical sessionId",
    "the established providerSessionId was non-empty, independent from sessionId, omitted from the report, and stable across resume",
    "both Turns emitted incremental chunks and authoritative completion events",
    "the resumed Turn recovered the first Turn marker from provider context",
  ],
  continuationPersistence:
    "The probe intentionally uses a persistent provider Session because Codex ephemeral Sessions do not retain a resumable rollout.",
  scopeLimit:
    "This verifies the packaged Kernel app-server transport and real Codex continuation only; it does not satisfy the credentialed BirdCoder UI, cancellation, approval, question, restart, or recovery assertions.",
});
assert.deepEqual(realProviderCapability?.evidence?.contractBlockerIds, [
  "CDB-001",
  "CDB-005",
  "CDB-006",
]);
assert.equal(
  realProviderCapability?.evidence?.runtimeBlockerReason,
  "Agents now forwards bounded incremental Turn SSE, but it has no persistent provider execution handle or restart-safe live-event ledger; cancellation does not reach the provider request, and Interaction resolution does not continue the Codex app-server request.",
);
assert.deepEqual(realProviderCapability?.evidence?.requiredAssertions, [
  "run through the non-test BirdCoder UI and injected generated Agents SDK clients without mock or raw HTTP transport",
  "a fresh canonical Session has no provider continuation identity before its first Turn",
  "the first visible assistant delta arrives before the original SSE response body finishes",
  "the opaque provider Session identity remains stable after provider service restart and canonical Session resume",
  "cancellation returns the matching canonical Session and Turn as cancelled",
  "the cancellation probe confirms provider execution termination, the original SSE finishes, and the composer returns to ready",
  "the cancelled Turn never commits its forbidden completion marker",
  "approval submission is followed by provider continuation and the requested completion marker",
  "question submission is followed by provider continuation and the requested completion marker",
]);
assert.equal(spec.verification.realProviderE2E, "pending");

const transcriptPresentationCapability = spec.capabilities.find(
  (capability) => capability.id === "CDP-011",
);
assert.equal(transcriptPresentationCapability?.status, "partial");
validateExactInventory(
  "transcript presentation evidence paths",
  transcriptPresentationCapability?.evidence?.paths ?? [],
  [
    "specs/codex-desktop-parity.spec.json",
    "docs/providers/codex/README.md",
    "scripts/codex-desktop-reference-audit.mjs",
    "scripts/codex-desktop-parity-contract.test.mjs",
    "scripts/agent-session-item-view-contract.test.ts",
    "apps/sdkwork-birdcoder-pc/tests/e2e/codex-session-parity.spec.ts",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/ChatTranscriptMessage.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/ChatTranscriptMessage.test.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/ChatActivitySummary.interaction.test.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/InspectedImageGallery.test.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/toolCallActionPresentation.test.ts",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/presentation/turnProcessPresentation.ts",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/presentation/turnProcessPresentation.test.ts",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ReplyMessageRenderers.test.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderItemRouting.test.ts",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionCodexSyntheticItemPresentation.test.ts",
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItem.ts",
  ],
);
validateExactInventory(
  "transcript presentation evidence commands",
  transcriptPresentationCapability?.evidence?.commands ?? [],
  [
    "node scripts/codex-desktop-reference-audit.mjs",
    "node scripts/codex-desktop-parity-contract.test.mjs",
    "node scripts/run-local-tsx.mjs scripts/agent-session-item-view-contract.test.ts",
    "node scripts/run-pc-playwright-e2e.mjs tests/e2e/codex-session-parity.spec.ts --project=chromium",
    "pnpm --dir apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui exec vitest run src/components/chat/messages/ChatTranscriptMessage.test.tsx src/components/chat/messages/activity/ChatActivitySummary.interaction.test.tsx src/components/chat/messages/contentBlocks/InspectedImageGallery.test.tsx src/components/chat/messages/contentBlocks/toolCallActionPresentation.test.ts src/components/chat/messages/presentation/turnProcessPresentation.test.ts src/components/chat/messages/renderers/ReplyMessageRenderers.test.tsx --config vitest.config.ts",
    "pnpm exec vitest run apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionProviderItemRouting.test.ts apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/tests/agentSessionCodexSyntheticItemPresentation.test.ts",
  ],
);
assert.deepEqual(
  transcriptPresentationCapability?.evidence?.contractBlockerIds,
  ["CDB-001"],
);
assert.equal(
  transcriptPresentationCapability?.evidence?.partialReason,
  "All provider item types and non-blocked desktop synthetic types have canonical Session presentation fixtures; automaticApprovalReview, userInputResponse, mcpServerElicitation, and permissionRequest remain blocked until the owner Interaction contract preserves their full semantics.",
);

const kernelInteractionEvidencePaths = [
  "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-interactions.mjs",
  "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-interactions.test.mjs",
  "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-runtime.mjs",
  "../sdkwork-kernel/scripts/provider-transport-workers/generic-ts-sdk-worker-app-server.test.mjs",
  "../sdkwork-kernel/specs/AGENT_PROVIDER_INTEGRATION_SPEC.md",
];
const kernelInteractionCommands = [
  "node --test ../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-interactions.test.mjs",
  "node --test ../sdkwork-kernel/scripts/provider-transport-workers/generic-ts-sdk-worker-app-server.test.mjs",
];
for (const interactionCapability of [
  {
    id: "CDP-007",
    protocolPaths: [
      "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/CommandExecutionApprovalDecision.ts",
      "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/FileChangeApprovalDecision.ts",
      "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/PermissionsRequestApprovalResponse.ts",
    ],
  },
  {
    id: "CDP-008",
    protocolPaths: [
      "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts",
      "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputResponse.ts",
    ],
  },
]) {
  const capability = spec.capabilities.find(
    (candidate) => candidate.id === interactionCapability.id,
  );
  assert.equal(capability?.status, "blocked-contract");
  assert.equal(capability?.blockerId, "CDB-001");
  validateExactInventory(
    `${interactionCapability.id} evidence paths`,
    capability?.evidence?.paths ?? [],
    [...interactionCapability.protocolPaths, ...kernelInteractionEvidencePaths],
  );
  validateExactInventory(
    `${interactionCapability.id} evidence commands`,
    capability?.evidence?.commands ?? [],
    kernelInteractionCommands,
  );
}

const requiredBlockerContracts = [
  {
    id: "CDB-001",
    kind: "public-contract-and-security-review",
    owner: "sdkwork-agents",
    capabilityIds: ["CDP-007", "CDP-008"],
    observedContractFacts: [
      "Codex command approval preserves callback, environment, command, working-directory, parsed-action, network-context, exec-policy amendment, and network-policy amendment data, while Agents records only a generic prompt and flat options",
      "Codex command approval has six typed outcomes and file approval has four typed outcomes, while the generated Agents approval request exposes only approved: boolean plus an optional reason",
      "Codex user input carries multiple questions with stable IDs, headers, other and secret flags, nullable options, answer arrays keyed by question ID, and autoResolutionMs, while Agents exposes one prompt, flat options, one answer, one selected option, and rejected",
      "Codex MCP elicitation distinguishes form, openai/form, and URL modes and returns action, structured content, and metadata; Agents has no MCP elicitation Interaction kind or typed payload",
      "Codex permission approval preserves requested and granted filesystem and network profiles, turn or session scope, and strictAutoReview; Agents collapses the request into generic approval",
      "The Kernel Codex app-server adapter now losslessly normalizes the five canonical request families plus desktop onboarding, option-picker, context-source, and setup-step variants and compiles typed resolutions back to exact Codex wire responses, but Agents persistence, OpenAPI, generated SDKs, runtime continuation, and BirdCoder still do not carry that envelope end to end",
      "The current Agents record has providerInteractionId but no typed provider request kind or request/response payload capable of reconstructing the original Codex callback",
      "BirdCoder maps every pending user_question record to a one-element questions array and maps approved, denied, and blocked UI choices back to approved: boolean, so its richer-looking view cannot restore semantics already lost by the owner contract",
    ],
    observedProviderRequestMethods: [
      "item/commandExecution/requestApproval",
      "item/fileChange/requestApproval",
      "item/tool/requestUserInput",
      "mcpServer/elicitation/request",
      "item/permissions/requestApproval",
      "item/tool/requestOptionPicker",
      "item/tool/requestSetupCodexContextPicker",
    ],
    observedAgentsInteractionKinds: ["approval", "user_question"],
    interactionContractComparison: {
      codexCommandApproval: {
        requestFields: [
          "threadId",
          "turnId",
          "itemId",
          "startedAtMs",
          "approvalId",
          "environmentId",
          "reason",
          "networkApprovalContext",
          "command",
          "cwd",
          "commandActions",
          "proposedExecpolicyAmendment",
          "proposedNetworkPolicyAmendments",
        ],
        decisionVariants: [
          "accept",
          "acceptForSession",
          "acceptWithExecpolicyAmendment",
          "applyNetworkPolicyAmendment",
          "decline",
          "cancel",
        ],
      },
      codexFileChangeApproval: {
        requestFields: [
          "threadId",
          "turnId",
          "itemId",
          "startedAtMs",
          "reason",
          "grantRoot",
        ],
        decisionVariants: ["accept", "acceptForSession", "decline", "cancel"],
      },
      codexUserInput: {
        requestFields: [
          "threadId",
          "turnId",
          "itemId",
          "questions",
          "autoResolutionMs",
        ],
        questionFields: [
          "id",
          "header",
          "question",
          "isOther",
          "isSecret",
          "options",
        ],
        responseShape: "Record<questionId, { answers: string[] }>",
      },
      codexMcpElicitation: {
        modes: ["form", "openai/form", "url"],
        requestFields: [
          "threadId",
          "turnId",
          "serverName",
          "message",
          "requestedSchema",
          "url",
          "elicitationId",
          "_meta",
        ],
        responseFields: ["action", "content", "_meta"],
      },
      codexPermissionApproval: {
        requestFields: [
          "threadId",
          "turnId",
          "itemId",
          "environmentId",
          "startedAtMs",
          "cwd",
          "reason",
          "permissions",
        ],
        responseFields: ["permissions", "scope", "strictAutoReview"],
        scopeValues: ["turn", "session"],
      },
      kernelAdapter: {
        canonicalCategories: ["approval", "user_input", "elicitation", "setup"],
        canonicalKinds: [
          "command_execution",
          "file_change",
          "permission_profile",
          "question_set",
          "onboarding_question_set",
          "option_picker",
          "context_source_picker",
          "setup_step",
          "mcp_elicitation",
        ],
        correlationFields: [
          "sessionId",
          "providerSessionId",
          "providerTurnId",
          "providerItemId",
          "providerRequestId",
          "providerRequestIdType",
          "providerToolCallId",
          "providerToolName",
          "providerToolNamespace",
          "protocolMethod",
        ],
        providerRequestIdWireTypes: ["string", "number"],
        runtimeResponseMethod: "sdkwork/serverRequest.respond",
        coverage:
          "lossless provider-adapter normalization and response compilation only; the Agents owner contract and BirdCoder consumer path remain blocked",
      },
      currentAgents: {
        interactionKinds: ["approval", "user_question"],
        recordPayloadFields: [
          "providerInteractionId",
          "kind",
          "prompt",
          "options",
          "resolution",
        ],
        approvalRequestFields: [
          "approved",
          "reason",
          "claimToken",
          "fencingToken",
          "expectedVersion",
          "requestedAt",
        ],
        answerRequestFields: [
          "answer",
          "selectedOptionValue",
          "rejected",
          "claimToken",
          "fencingToken",
          "expectedVersion",
          "requestedAt",
        ],
      },
      birdCoderProjection: {
        approvalDecisions: ["approved", "denied", "blocked"],
        questionCardinality: "one generated question per Agents Interaction",
        lostSemantics: [
          "provider request kind and callback identity",
          "approval grant scope and cancel versus decline",
          "exec-policy and network-policy amendments",
          "permission profiles and strictAutoReview",
          "question IDs, headers, other and secret flags, answer arrays, and autoResolutionMs",
          "MCP elicitation mode, schema or URL, action, content, and metadata",
          "desktop onboarding, option-picker, context-source, and setup-step request and response payloads",
        ],
      },
    },
    generatedEvidence: {
      commandApprovalParamsSha256:
        "185d6a3190ff1b6c7051c5777241501ed158b904c108ce889d18d0d354b41403",
      commandApprovalDecisionSha256:
        "ac88e1083818b1f7220f642327a274ce0f6a5d02759e4b63e8a8073069ca555f",
      fileChangeApprovalParamsSha256:
        "7afe4fb8c0f76ca1cb6a370488b0c2d8bd9d597180ab3bd13279d0cdeb620a58",
      fileChangeApprovalDecisionSha256:
        "a5ef8676c01ecb67482e5ff7164554735a01e1ba799a49be71832eeba55353b3",
      userInputParamsSha256:
        "e3d55305c4fd4b40084335b8d0278ae910fa8d3f9be64de61d6171648957d41f",
      userInputQuestionSha256:
        "616a69a8b14407bce111a15976fa5a04a525474177f0b14f53d8e93b4c4c2135",
      userInputOptionSha256:
        "c533314ce2b35250180ebb5fac98733994c2dfcaa61780212b7fe4c9cc2d437c",
      userInputAnswerSha256:
        "a9ff61628f155b05fbf128ac9ccc0027f85f8a1f4cdd8a0fcc37215f6f537d95",
      userInputResponseSha256:
        "ded66ee234400bab77e214a4179318fef8a5187ab7f77393dae231ddfe72afe9",
      mcpElicitationParamsSha256:
        "2e2f2c6e7857aea916cbfb9f50a78e3125c14178904bad90042f5f596be79af3",
      mcpElicitationResponseSha256:
        "4f84effe0c566afcd0f93e5236b06d61be31e83a7797ee1610f6408b30af6e72",
      permissionsParamsSha256:
        "c80b30dde9911be77f398662daf05e779ad654f06121d1039ae5a05fbe422922",
      permissionsResponseSha256:
        "5c662efc16d5debe37c246e2bf9ea83a6f25631bc2a731401b7079a0d442cf93",
      agentsInteractionKindSha256:
        "4c81cd310c7c2c6514bbb4d1ba9357517ee50972244c45c579c6abe1fb9bf008",
      agentsInteractionRecordSha256:
        "4eecf05555a80769cd86d8dc869f592701320713870a606e5a7bda1e93cae27f",
      agentsApproveRequestSha256:
        "885d975fed21824f8580bc6a23c442cf701e8253023e1843f7c506998604cf80",
      agentsAnswerRequestSha256:
        "43988c3c293a2ad1afdef6625c2f5a2e487bbbf199db071ad9e913ab44d0a75a",
    },
    requiredContractExtensions: [
      "typed provider request kind and opaque request correlation identity",
      "typed approval decision and grant scope",
      "command execution policy amendment",
      "network policy amendment",
      "permission profile and strictAutoReview",
      "questions array with stable IDs, headers, other and secret flags, options, and multiple answers",
      "question ID to answer mapping and autoResolutionMs",
      "MCP elicitation form and URL modes, requested schema, action, structured content, and metadata",
      "carry the Kernel typed onboarding, option-picker, context-source, and setup-step Interaction variants through Agents owner contracts with provider correlation",
    ],
    prohibitedWorkarounds: [
      "BirdCoder-local DTO fork",
      "raw HTTP",
      "manual generated SDK edit",
      "mapping scoped approval choices to a boolean without preserving semantics",
    ],
  },
  {
    id: "CDB-002",
    kind: "owner-openapi-and-generated-sdk-drift",
    owner: "sdkwork-agents",
    capabilityIds: ["CDP-012"],
    observedContractFacts: [
      "The App OpenAPI and generated SDK now preserve canonical sessionId, complete schedule and execution policy, task status filtering, and the full AgentTaskRecord schedule and lifecycle shape",
      "The generated agents.tasks.execute method now accepts ExecuteAgentTaskRequest and returns AgentTaskRunRecord with idempotency and Run semantics aligned to the owner runtime",
      "The generated App SDK now exposes task replace, pause, resume, run list and retrieve, run retry and cancel, and run-attempt history",
      "Per-Run reconciliation exists only on the backend owner route and is not exposed through the App OpenAPI or generated App SDK required for user-visible recovery",
      "Automation notification policy remains absent from the owner App contract and generated SDK",
      "Existing App HTTP task contract tests now cover canonical Session-bound create, list, retrieve, cancel, and manual execute, but not status-filtered cursor pagination, replace, pause and resume, Run lifecycle routes, reconciliation, or notification policy",
    ],
    automationContractComparison: {
      runtimeCreateRequiredFields: [
        "sessionId",
        "title",
        "prompt",
        "scheduleKind",
        "timezone",
        "requestedAt",
      ],
      openApiCreateRequiredFields: [
        "sessionId",
        "title",
        "prompt",
        "scheduleKind",
        "timezone",
        "requestedAt",
      ],
      runtimeExecuteRequestFields: [
        "idempotencyKey",
        "expectedVersion",
        "requestedAt",
      ],
      generatedExecuteRequestType: "ExecuteAgentTaskRequest",
      runtimeExecuteResponseResource: "AgentTaskRunRecordDto",
      generatedExecuteResponseResource: "AgentTaskRunRecord",
      mountedAppTaskOperations: [
        "list",
        "create",
        "retrieve",
        "replace",
        "pause",
        "resume",
        "cancel",
        "execute",
        "runs.list",
        "runs.retrieve",
        "runs.retry",
        "runs.cancel",
        "runs.attempts.list",
      ],
      missingAppTaskOperations: ["runs.reconcile", "notificationPolicy"],
      generatedTaskRecordMissingFields: [],
      httpContractCoveredOperations: [
        "canonical Session-bound create",
        "list",
        "retrieve",
        "cancel",
        "execute manual Run",
      ],
      httpContractCoverageGaps: [
        "status-filtered cursor task list",
        "replace",
        "pause and resume",
        "Run list and retrieve",
        "Run retry and cancel",
        "Run attempt history",
        "Run reconciliation",
        "notification policy",
      ],
    },
    sourceSemanticAssertions: [
      {
        label:
          "App Automation HTTP tests cover the current canonical Session subset",
        path: "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/tests/http_axum_contracts.rs",
        scope: {
          startMarker: "async fn agent_tasks_should_work_over_http()",
          endMarker: "async fn agent_interactions_should_work_over_http()",
        },
        orderedContains: [
          '"sessionId": session_id',
          '"scheduleKind": "one_time"',
          'let list_uri = format!("/app/v3/api/ai/agents/{agent_id}/tasks")',
          'let get_uri = format!("/app/v3/api/ai/agents/{agent_id}/tasks/{task_id}")',
          'let cancel_uri = format!("/app/v3/api/ai/agents/{agent_id}/tasks/{task_id}/cancel")',
          "async fn agent_tasks_execute_should_create_manual_run_over_http()",
          '"idempotencyKey": "manual-task-run-http-1"',
          'let execute_uri = format!("/app/v3/api/ai/agents/{agent_id}/tasks/{task_id}/execute")',
          'assert_eq!(execute_response["data"]["item"]["triggerKind"], "manual")',
          'assert_eq!(execute_response["data"]["item"]["sessionId"], session_id)',
        ],
        notContains: ["/pause", "/resume", "/runs"],
      },
    ],
    generatedEvidence: {
      createRequestSha256:
        "c827f4eab5e33713d271dd9ec6885dec4a3e50c0ee7ca79bd6abc09fa5765aee",
      taskRecordSha256:
        "7dbae0b44d5dce107cf61f2894367e3706e102eab938ae33decff92c877aa06b",
      aiApiSha256:
        "5f2d0530d934d76d6762bfd9f7da27d494f821646a9b5ea19ab8c82566e508ff",
    },
    requiredContractExtensions: [
      "expose generated App SDK operations for user-visible Run reconciliation and recovery",
      "define Automation notification policy semantics and expose them through the owner App OpenAPI and generated SDK",
      "extend the canonical App HTTP task fixtures from create, list, retrieve, cancel, and manual execute to complete task and Run lifecycle coverage",
      "regenerate every affected Agents SDK family from the owner OpenAPI",
    ],
    prohibitedWorkarounds: [
      "BirdCoder-local task DTO fork",
      "raw HTTP or manual authorization headers",
      "manual generated SDK edit",
      "enabling the Automation navigation item before owner SDK conformance tests pass",
    ],
  },
  {
    id: "CDB-003",
    kind: "desktop-browser-host-and-security-contract",
    owner: "sdkwork-kernel and sdkwork-agents",
    capabilityIds: ["CDP-013"],
    requiredContractExtensions: [
      "Kernel desktop Browser host and lifecycle SPI",
      "Agents canonical Session to opaque provider Browser runtime and tab binding",
      "typed site permission resources, decisions, scopes, and action-time confirmation",
      "Session-scoped navigation, history, capture, stop, annotation, transfer, reset, recovery, and isolation events",
      "host-backed settings, profile mediation, file transfer, and browsing-data clearing without credential exposure",
      "generated SDK plus real desktop and narrow-screen E2E surfaces",
    ],
    prohibitedWorkarounds: [
      "using the DotLottie browser-CVV9l2Fo.js chunk as Browser lifecycle evidence",
      "treating a sandbox iframe as provider Browser parity",
      "treating a local allowedSites array or trusted-sites policy as the reference permission contract",
      "mapping Browser plugin codexSessionId directly to canonical sessionId",
      "exposing browser profile or credential storage to BirdCoder UI",
      "BirdCoder-local provider Browser DTO fork",
      "claiming Browser parity from mock-only tests",
    ],
  },
  {
    id: "CDB-004",
    kind: "remote-host-device-authorization-and-session-contract",
    owner: "sdkwork-kernel and sdkwork-agents",
    capabilityIds: ["CDP-014"],
    requiredContractExtensions: [
      "Kernel remote-host and SSH lifecycle SPI",
      "Agents authorized-device and host contracts",
      "canonical Session mapping for remote continuation and code changes",
      "revoke-access, keep-awake, apply, revert, recovery, and audit semantics",
      "generated SDK and real remote desktop E2E surfaces",
    ],
    prohibitedWorkarounds: [
      "storing SSH credentials or device secrets in BirdCoder UI state",
      "exposing Codex thread identity outside the provider adapter",
      "raw SSH or HTTP integration from React components",
      "claiming remote Session continuation parity without authorization and recovery tests",
    ],
  },
  {
    id: "CDB-005",
    kind: "real-time-provider-execution-control-contract",
    owner: "sdkwork-agents and sdkwork-kernel",
    capabilityIds: ["CDP-004", "CDP-005", "CDP-006"],
    observedRuntimeFacts: [
      "Streaming HTTP requests attach a bounded TurnExecutionStreamSink, wait only for the first signal, and then forward ordered chunks through Body::from_stream while execution continues",
      "RuntimeFacadeTurnExecutor forwards provider-neutral model chunks and Kernel events into the HTTP sink while retaining a bounded terminal copy for persistence",
      "Turn execution reuses a process-wide AgentsCodeEngineHost; the Codex runtime prefers one resident app-server transport while retaining explicitly governed SDK or CLI compatibility fallbacks",
      "AgentTurnRecord persists no model request id or transport execution handle",
      "Live stream items are persisted only from the terminal collected stream_events after provider execution returns, so restart-safe event replay and active execution recovery remain unavailable",
      "cancel_turn marks the repository record cancelled and writes audit events without invoking Kernel cancellation",
      "approve_interaction and answer_interaction persist resolution and audit without continuing a provider server request",
      "Kernel exposes incremental streaming and request-scoped cancellation primitives that are not wired to a persistent Agents execution registry",
    ],
    executionRegistryContract: {
      owner: "sdkwork-agents",
      canonicalKeyFields: [
        "tenantId",
        "organizationId",
        "ownerUserId",
        "agentId",
        "sessionId",
        "turnId",
      ],
      internalHandleFields: [
        "executionHandle",
        "generation",
        "modelRequestId",
        "providerSessionId",
        "providerTurnId",
        "transportLeaseId",
        "lastProviderSequence",
        "startedAt",
        "heartbeatAt",
      ],
      states: [
        "registered",
        "streaming",
        "awaiting_interaction",
        "cancelling",
        "terminal_acknowledged",
        "finalized",
        "resolution_unknown",
      ],
      registrationRule:
        "persist and fence the execution handle before the first provider byte or canonical stream event is emitted",
      streamingRule:
        "return an incremental bounded HTTP body immediately and persist ordered deltas while Kernel pushes them; never replay a completed in-memory vector as live streaming",
      disconnectRule:
        "HTTP consumer disconnect detaches that subscriber but does not erase the execution handle; bounded execution continues or is cancelled by explicit policy and remains recoverable by canonical Session and Turn",
      cancellationRule:
        "atomically fence running to cancelling, route canonical Session and Turn through the registry to Kernel turn/interrupt, wait for turn/completed interrupted, then persist cancelled and finalize the handle",
      cancellationTimeoutRule:
        "timeout or transport loss records resolution_unknown and triggers provider-history reconciliation; it must not persist cancelled without provider terminal proof",
      interactionRule:
        "register each provider request before exposing a canonical Interaction, claim and fence one response, continue the same provider request exactly once, wait for serverRequest/resolved, then persist the canonical resolution",
      responseLedgerKeyFields: ["executionHandle", "providerRequestId"],
      responseLedgerStates: [
        "pending",
        "responding",
        "response_sent",
        "provider_cleared",
        "resolution_unknown",
      ],
      recoveryRule:
        "on restart or lease loss, reconcile provider Session history, active Turn, pending requests, response ledger, and last provider sequence before resuming emission or accepting another response",
      terminalPersistenceRule:
        "canonical completed, failed, or cancelled state follows the matching provider terminal acknowledgement and closes the execution generation exactly once",
    },
    kernelExecutionContract: {
      owner: "sdkwork-kernel",
      transport:
        "long-lived Codex app-server JSON-RPC connection scoped by an opaque provider Session binding and transport lease",
      requiredOperations: [
        "start or resume provider Session",
        "start Turn with incremental notification sink",
        "continue ServerRequest response by request id",
        "interrupt Turn by provider Session and Turn identity",
        "read Session history and pending requests for reconciliation",
        "close or renew transport lease",
      ],
      terminalProof:
        "turn/completed with provider Turn identity and terminal status",
      forbiddenTransport:
        "per-Turn codex exec --experimental-json when desktop-equivalent continuation, ServerRequest, interruption, or recovery semantics are required",
    },
    sourceSemanticAssertions: [
      {
        label:
          "Turn dispatch selects the live response path for streaming requests",
        path: "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/http.rs",
        scope: {
          startMarker: "async fn execute_turn_http_response(",
          endMarker: "#[derive(Debug)]\nenum TurnHttpStreamSignal",
        },
        orderedContains: [
          "if !stream_requested {",
          "with_service(state, move |service| service.execute_turn(command)).await?;",
          "return turn_execution_http_response(",
          "streaming_turn_execution_http_response(state, ctx, command, rich_events_requested).await",
        ],
      },
      {
        label:
          "Turn SSE response forwards bounded sink output before completion",
        path: "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/http.rs",
        scope: {
          startMarker: "async fn streaming_turn_execution_http_response(",
          endMarker: "fn turn_completion_sse_chunk(",
        },
        orderedContains: [
          "mpsc::channel(TURN_STREAM_CHANNEL_CAPACITY)",
          "service.execute_turn_with_stream_sink(command, execution_sink);",
          "let first = receiver.recv().await",
          "ReceiverStream::new(receiver)",
          ".body(Body::from_stream(body_stream))",
        ],
        notContains: [".body(Body::from(body))"],
      },
      {
        label:
          "Agents runtime facade forwards provider chunks into the supplied sink",
        path: "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/turn_runtime.rs",
        scope: {
          startMarker: "impl TurnExecutor for RuntimeFacadeTurnExecutor",
          endMarker: "fn resolve_turn_model_id(",
        },
        orderedContains: [
          "fn complete_with_stream_sink(",
          "execute_runtime_facade_turn(input, true, Some(sink))",
          "shared_code_engine_host()",
          "host.slot(engine_key)",
          "if prefer_stream {",
          "execute_code_engine_turn_with_stream_sink(slot, &turn_input, &mut facade_sink)",
          "stream_deltas: output.stream_deltas",
        ],
      },
      {
        label: "Agent Turn record has no persistent provider execution handle",
        path: "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/agent_turn.rs",
        scope: {
          startMarker: "pub struct AgentTurnRecord {",
          endMarker: "impl AgentTurnRecord {",
        },
        contains: [
          "pub session_id: String",
          "pub turn_id: String",
          "pub status: AgentTurnStatus",
        ],
        notContains: [
          "execution_handle",
          "model_request_id",
          "provider_session_id",
          "provider_turn_id",
          "transport_lease_id",
          "last_provider_sequence",
        ],
      },
      {
        label: "Default facade streaming entrypoint discards the live sink",
        path: "../sdkwork-agents/crates/sdkwork-agents-runtime-facade/src/turn.rs",
        scope: {
          startMarker: "pub fn execute_code_engine_turn_with_stream(",
          endMarker:
            "/// Execute a turn and forward each provider-neutral model chunk as it arrives.",
        },
        orderedContains: [
          "let mut sink = DiscardingModelStreamSink;",
          "execute_code_engine_turn_with_stream_sink(slot, input, &mut sink)",
        ],
      },
      {
        label: "Turn cancellation persists before any provider interruption",
        path: "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/application.rs",
        scope: {
          startMarker: "pub fn cancel_turn(&self, command: CancelTurnCommand)",
          endMarker: "pub fn reconcile_stale_turns(",
        },
        orderedContains: [
          "turn.mark_cancelled(command.requested_at.clone());",
          "self.repository.update_turn_state(turn, expected_version)?;",
          "AgentAuditAction::TurnCancelled",
          "Ok(turn)",
        ],
        notContains: [
          "cancel_model",
          "turn/interrupt",
          "execution_handle",
          "provider_turn_id",
        ],
      },
      {
        label:
          "Approval resolution persists without provider request continuation",
        path: "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/application.rs",
        scope: {
          startMarker: "pub fn approve_interaction(",
          endMarker: "pub fn answer_interaction(",
        },
        orderedContains: [
          "record.resolve(",
          "self.repository.update_interaction(record.clone())?;",
          "self.emit_interaction_audit_event(",
          "Ok(record)",
        ],
        notContains: ["serverRequest", "provider_request", "continue_provider"],
      },
      {
        label:
          "Question resolution persists without provider request continuation",
        path: "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/application.rs",
        scope: {
          startMarker: "pub fn answer_interaction(",
          endMarker: "pub fn resolve_interaction(",
        },
        orderedContains: [
          "record.resolve(",
          "self.repository.update_interaction(record.clone())?;",
          "self.emit_interaction_audit_event(",
          "Ok(record)",
        ],
        notContains: ["serverRequest", "provider_request", "continue_provider"],
      },
      {
        label: "Kernel bridge exposes an incremental stream sink primitive",
        path: "../sdkwork-kernel/sdkwork-agent-api-bridge/src/bridge.rs",
        scope: {
          startMarker: "pub fn stream_model_for_session_into(",
          endMarker:
            "/// Build a model request from bridge session state without invoking a provider.",
        },
        orderedContains: [
          "prepare_model_request_for_session(session_id, model_id, override_messages)?;",
          ".stream_into(&request, provider_id.as_deref(), sink)",
        ],
      },
      {
        label: "Kernel bridge exposes request-scoped cancellation",
        path: "../sdkwork-kernel/sdkwork-agent-api-bridge/src/bridge.rs",
        scope: {
          startMarker: "pub fn cancel_model(",
          endMarker: "/// List registered model descriptors",
        },
        orderedContains: [
          "model_request_id: &str",
          ".cancel(model_request_id, model_provider_id)",
        ],
      },
      {
        label: "Codex TypeScript SDK spawns one exec process per invocation",
        path: "../sdkwork-kernel/external/codex/sdk/typescript/src/exec.ts",
        scope: {
          startMarker: "async *run(args: CodexExecArgs)",
          endMarker: "function serializeConfigOverrides(",
        },
        orderedContains: [
          'const commandArgs: string[] = ["exec", "--experimental-json"]',
          'commandArgs.push("resume", args.threadId)',
          "const child = spawn(this.executablePath, commandArgs",
        ],
        notContains: ['"app-server"'],
      },
    ],
    requiredContractExtensions: [
      "server-owned long-lived runtime registry that survives HTTP request boundaries",
      "persistent execution handle mapping canonical Session and Turn identities to modelRequestId, providerSessionId, providerTurnId, and transport lease",
      "durable ordered live-event persistence and replay cursors bound to the fenced execution generation before terminal completion",
      "Kernel long-lived Codex app-server JSON-RPC transport with server-request continuation",
      "provider cancellation and execution timeout routed from canonical Session and Turn identities before terminal persistence",
      "turn/interrupt routed with provider continuation and Turn identities and confirmed by turn/completed interrupted",
      "at-most-once provider response ledger with reconnect correlation and resolution_unknown recovery",
      "provider-confirmed Interaction resolution before canonical terminal persistence",
      "credentialed real-provider E2E for first delta, cancellation, approval, question, restart, and recovery",
    ],
    prohibitedWorkarounds: [
      "presenting completion-time SSE replay as live streaming",
      "presenting database-only cancellation as provider interruption",
      "persisting Interaction resolution without provider continuation",
      "BirdCoder direct provider transport or raw HTTP workaround",
    ],
  },
  {
    id: "CDB-006",
    kind: "kernel-codex-protocol-baseline-drift",
    owner: "sdkwork-kernel",
    capabilityIds: ["CDP-015"],
    summary:
      "Kernel now has a resident Codex app-server transport, typed continuation for the canonical and desktop setup Interaction families, and typed current-time/setup-completion host responses, but its vendored schema still drifts from the pinned desktop baseline and ordinary dynamic tools, private host requests, reconnect recovery, and the complete ServerRequest union remain unproven.",
    observedRuntimeFacts: [
      "Kernel now launches and retains a resident Codex app-server JSON-RPC transport instead of relying only on the exec SDK lane",
      "Kernel normalizes the five canonical methods, two desktop-only methods, and four setup dynamic-tool variants into canonical Session Interaction envelopes and compiles typed resolutions back to exact provider responses",
      "The adapter preserves canonical sessionId separately from providerSessionId and preserves exact string or number provider request IDs for response continuation",
      "Kernel validates currentTime/read provider Session affinity and exact request ID, then responds inside the adapter with an injected-clock whole-Unix-seconds value without creating an Agents or BirdCoder Interaction",
      "Kernel validates setup dynamic-tool arguments, returns desktop-compatible failed tool results for invalid option/onboarding/setup-step input, and auto-responds to setup completion without creating an Interaction",
      "Kernel buffers same-provider-Session events until turn/start returns the authoritative Turn id, then replays only matching events so a late prior-Turn notification cannot capture the new execution",
      "Complete parity remains blocked by vendored schema drift and missing typed host ports for ordinary dynamic tools, token refresh, attestation, reconnect recovery, Agents and BirdCoder contract propagation, and credentialed end-to-end interaction tests",
    ],
    kernelAdapterCoverage: {
      status: "partial",
      typedUserMediatedMethods: [
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
        "item/tool/requestUserInput",
        "mcpServer/elicitation/request",
        "item/permissions/requestApproval",
        "item/tool/requestOptionPicker",
        "item/tool/requestSetupCodexContextPicker",
      ],
      typedDynamicInteractionTools: [
        "request_onboarding_input",
        "request_option_picker",
        "setup_codex_context_picker",
        "setup_codex_step:role|task|context",
      ],
      canonicalSessionField: "sessionId",
      providerSessionField: "providerSessionId",
      workerResponseMethod: "sdkwork/serverRequest.respond",
      typedHostAutoResponseMethods: [
        "currentTime/read",
        "item/tool/call:setup_codex_step.complete",
      ],
      remainingProviderMethods: [
        "item/tool/call",
        "account/chatgptAuthTokens/refresh",
        "attestation/generate",
      ],
      remainingDesktopProjection: [],
    },
    protocolBaseline: {
      referenceCommit: "a05bcda3dbd68729caa2f11027b7f43974fda298",
      kernelVendoredCommit: "ee0247f95a6fe2b094ba2253d82cae2a2b4c2dff",
      referenceCommonSha256:
        "aef036e55042ba2fa2e310e02595da2af4553d28653217bebda3abbf8ac0cf78",
      kernelCommonSha256:
        "e6a007755721bd2cb8edde1a4ab393539a48619930389e073a3d43106f606139",
      referenceToolRequestUserInputParamsSha256:
        "e3d55305c4fd4b40084335b8d0278ae910fa8d3f9be64de61d6171648957d41f",
      referenceChatgptAuthTokensRefreshResponseSha256:
        "c940b1cca0998da071349e22332c95ae8d74e161418a438be4d7f580eb115b48",
      kernelToolRequestUserInputParamsSha256:
        "4e6f553987527e1717dcd523058038895cc383fed3177df26d37a4a5c4696fbd",
      confirmedSchemaDrift:
        "Kernel ToolRequestUserInputParams adds required isBlocking and deprecates autoResolutionMs, while the pinned installed reference carries autoResolutionMs without isBlocking.",
    },
    serverRequestMethods: [
      "item/commandExecution/requestApproval",
      "item/fileChange/requestApproval",
      "item/tool/requestUserInput",
      "mcpServer/elicitation/request",
      "item/permissions/requestApproval",
      "item/tool/call",
      "account/chatgptAuthTokens/refresh",
      "attestation/generate",
      "currentTime/read",
    ],
    experimentalServerRequestMethods: ["currentTime/read"],
    serverRequestParameterContracts: [
      {
        method: "item/commandExecution/requestApproval",
        requiredFields: [
          "threadId",
          "turnId",
          "itemId",
          "startedAtMs",
          "environmentId",
        ],
        optionalNullableFields: [
          "approvalId",
          "reason",
          "networkApprovalContext",
          "command",
          "cwd",
          "commandActions",
          "proposedExecpolicyAmendment",
          "proposedNetworkPolicyAmendments",
        ],
        nullableFields: ["environmentId"],
        timestampUnit: "Unix milliseconds",
      },
      {
        method: "item/fileChange/requestApproval",
        requiredFields: ["threadId", "turnId", "itemId", "startedAtMs"],
        optionalNullableFields: ["reason", "grantRoot"],
        timestampUnit: "Unix milliseconds",
      },
      {
        method: "item/tool/requestUserInput",
        requiredFields: [
          "threadId",
          "turnId",
          "itemId",
          "questions",
          "autoResolutionMs",
        ],
        nullableFields: ["autoResolutionMs"],
        questionFields: [
          "id",
          "header",
          "question",
          "isOther",
          "isSecret",
          "options",
        ],
        optionFields: ["label", "description"],
      },
      {
        method: "mcpServer/elicitation/request",
        commonRequiredFields: [
          "threadId",
          "turnId",
          "serverName",
          "mode",
          "_meta",
          "message",
        ],
        nullableFields: ["turnId", "_meta"],
        modeContracts: {
          form: ["requestedSchema"],
          "openai/form": ["requestedSchema"],
          url: ["url", "elicitationId"],
        },
      },
      {
        method: "item/permissions/requestApproval",
        requiredFields: [
          "threadId",
          "turnId",
          "itemId",
          "environmentId",
          "startedAtMs",
          "cwd",
          "reason",
          "permissions",
        ],
        nullableFields: ["environmentId", "reason"],
        permissionProfileFields: ["network", "fileSystem"],
        timestampUnit: "Unix milliseconds",
      },
      {
        method: "item/tool/call",
        requiredFields: [
          "threadId",
          "turnId",
          "callId",
          "namespace",
          "tool",
          "arguments",
        ],
        nullableFields: ["namespace"],
      },
      {
        method: "account/chatgptAuthTokens/refresh",
        requiredFields: ["reason"],
        optionalNullableFields: ["previousAccountId"],
        reasonValues: ["unauthorized"],
        securityBoundary: "Kernel host only",
      },
      {
        method: "attestation/generate",
        requiredFields: [],
        securityBoundary: "Kernel host only",
      },
      {
        method: "currentTime/read",
        requiredFields: ["threadId"],
        experimental: true,
      },
    ],
    serverRequestResponseContracts: [
      {
        method: "item/commandExecution/requestApproval",
        responseFields: ["decision"],
        decisionVariants: [
          "accept",
          "acceptForSession",
          "acceptWithExecpolicyAmendment",
          "applyNetworkPolicyAmendment",
          "decline",
          "cancel",
        ],
        declineSemantics: "deny the command and continue the Turn",
        cancelSemantics: "deny the command and interrupt the Turn",
      },
      {
        method: "item/fileChange/requestApproval",
        responseFields: ["decision"],
        decisionVariants: ["accept", "acceptForSession", "decline", "cancel"],
        declineSemantics: "deny the file change and continue the Turn",
        cancelSemantics: "deny the file change and interrupt the Turn",
      },
      {
        method: "item/tool/requestUserInput",
        responseFields: ["answers"],
        answersShape: "Record<questionId, { answers: string[] }>",
      },
      {
        method: "mcpServer/elicitation/request",
        responseFields: ["action", "content", "_meta"],
        requiredFields: ["action", "content", "_meta"],
        actionValues: ["accept", "decline", "cancel"],
        nullableFields: ["content", "_meta"],
      },
      {
        method: "item/permissions/requestApproval",
        responseFields: ["permissions", "scope", "strictAutoReview"],
        scopeValues: ["turn", "session"],
        optionalFields: ["strictAutoReview"],
        denialSemantics:
          "omit denied grants from the granted permission profile",
      },
      {
        method: "item/tool/call",
        responseFields: ["contentItems", "success"],
        contentItemTypes: ["inputText", "inputImage", "inputAudio"],
      },
      {
        method: "account/chatgptAuthTokens/refresh",
        responseFields: ["accessToken", "chatgptAccountId", "chatgptPlanType"],
        requiredFields: ["accessToken", "chatgptAccountId", "chatgptPlanType"],
        nullableFields: ["chatgptPlanType"],
        securityBoundary: "Kernel host only",
      },
      {
        method: "attestation/generate",
        responseFields: ["token"],
        securityBoundary: "Kernel host only",
      },
      {
        method: "currentTime/read",
        responseFields: ["currentTimeAt"],
        timeUnit: "whole Unix seconds",
        experimental: true,
      },
    ],
    desktopAppServerTransport: {
      archiveResource: "app/resources/app.asar",
      entryOffsetUnit: "uncompressed entry bytes",
      mainArchiveEntry: ".vite/build/main-C1YkadXg.js",
      mainArchiveEntrySizeBytes: 2468887,
      mainArchiveEntrySha256:
        "dc98f53ff4745ae3ba790395d855c8bbda4a550c1744cb90262dbcde4d970075",
      sharedArchiveEntry: ".vite/build/src-CLstCQVF.js",
      sharedArchiveEntrySizeBytes: 1466039,
      sharedArchiveEntrySha256:
        "d662544e3580a37ae09b619a3e16a2bce68656abfa23f9f1060858a7dd637851",
      mainIpcEntryByteOffsets: {
        rendererReady: 1576874,
        initializationSnapshot: 1577126,
        autoResolutionSnapshot: 1577158,
        restart: 1590396,
        clientRequest: 1592915,
        abandonClientRequest: 1594637,
        clientNotification: 1594802,
        clientResponse: 1595076,
      },
      sharedConnectionEntryByteOffsets: {
        localStdioArguments: 763414,
        initializeRequestIdDeclaration: 828457,
        reconnectConstants: 839976,
        autoResolutionSnapshot: 871433,
        initializationSnapshot: 871668,
        handleClientRequest: 891047,
        abandonClientRequest: 891204,
        handleClientNotification: 891273,
        handleClientResponse: 891572,
        failPendingClientRequestsOnClose: 905928,
        rejectInternalRequestsOnClose: 906003,
        scheduleReconnect: 910208,
        startScheduledReconnect: 912489,
        initializeResponseRoute: 921016,
        serverRequestRoute: 922561,
        rendererRequestBroadcast: 922482,
        rendererNotificationBroadcast: 926018,
      },
      localStdioLaunchArguments: [
        "-c",
        "features.code_mode_host=true",
        "app-server",
        "--analytics-default-enabled",
      ],
      handshake: {
        requestId: "__codex_initialize__",
        method: "initialize",
        timeoutMs: 30000,
        paramsFields: ["clientInfo", "capabilities"],
        capabilityFields: [
          "experimentalApi",
          "mcpServerOpenaiFormElicitation",
          "requestAttestation",
          "optOutNotificationMethods",
        ],
        conditionalCapabilityFields: ["extensions"],
        experimentalApi: true,
        preInitializationRule:
          "route only the matching initialize response and already registered internal responses; warn and do not dispatch other messages",
        timeoutRule:
          "reject the handshake after 30 seconds; remote control fails the connection and local transport requires restart",
      },
      connectionModel: {
        states: [
          "disconnected",
          "connecting",
          "connected",
          "error",
          "restarting",
        ],
        progressStates: [
          "initializing",
          "waiting-for-device",
          "confirming-connection",
        ],
        rendererReadyRule:
          "send the current connection state, then the initialization snapshot when initialized and the pending auto-resolution snapshot for every registered host",
      },
      ipcRouting: {
        rendererToMainRequest: "mcp-request",
        rendererToMainAbandon: "mcp-request-abandon",
        rendererToMainNotification: "mcp-notification",
        rendererToMainResponse: "mcp-response",
        providerToRendererRequest: "mcp-request",
        providerToRendererNotification: "mcp-notification",
        requestIdRule:
          "preserve the exact JSON-RPC request ID across renderer, main process, and provider response",
        serverRequestRule:
          "run registered internal host handlers first and otherwise broadcast the request to renderer surfaces",
        serverNotificationRule:
          "apply host-side observation and filtering before broadcasting the notification to renderer surfaces",
      },
      closePolicy: {
        clearPendingAutoResolutionRequests: true,
        failPendingClientRequests: true,
        failPendingInternalRequests: true,
        blindReplay: false,
        rule: "transport close fails the exact in-flight client and internal requests; reconnect establishes a fresh transport and must not blindly replay them",
      },
      reconnectPolicy: {
        reconnectCapableTransport: "websocket",
        stdioReconnect: false,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 20000,
        sshDeterministicJitterMs: {
          min: 0,
          max: 500,
          seed: "hostId:attempt",
        },
        networkOnlineFastPath: true,
        skipReasons: [
          "unsupported transport",
          "timer already scheduled",
          "initialization in flight",
          "disposed",
          "app quitting",
          "login required",
          "version error",
        ],
      },
      canonicalBoundary:
        "Codex provider request and notification identities stay inside the Kernel adapter; Agents and BirdCoder correlate only canonical Session, Turn, execution handle, and providerSessionId.",
    },
    desktopServerRequestProjection: {
      rendererArchiveEntry: "webview/assets/app-initial-cpPdPura.js",
      rendererArchiveResource: "resources/app.asar",
      rendererArchiveEntrySizeBytes: 14878551,
      rendererArchiveEntrySha256:
        "69fc795132856b60ba2201695ebb4ac922790a9c341630f9f4f9461bf38ff6d6",
      entryOffsetUnit: "uncompressed entry bytes",
      requestGroupingEntryByteOffset: 1877168,
      requestDispatcherEntryByteOffset: 3300508,
      canonicalInteractionMethods: [
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
        "item/tool/requestUserInput",
        "mcpServer/elicitation/request",
        "item/permissions/requestApproval",
      ],
      desktopInternalInteractionMethods: [
        {
          method: "item/tool/requestOptionPicker",
          entryByteOffsets: [1880199, 3302207],
        },
        {
          method: "item/tool/requestSetupCodexContextPicker",
          entryByteOffsets: [1880494, 3302555],
        },
      ],
      dynamicToolCall: {
        method: "item/tool/call",
        pendingInteractionToolNames: [
          "request_onboarding_input",
          "request_option_picker",
          "setup_codex_context_picker",
          "setup_codex_step",
        ],
        bundleEntryByteOffsets: {
          successEnvelopeHelper: 1844251,
          toolSchemaDeclaration: 1844343,
          optionPickerSchema: 1844672,
          onboardingQuestionSchema: 1844815,
          setupStepSchema: 1844961,
          setupResponseCompiler: 3196748,
          failureEnvelopeHelper: 2763011,
          setupStepDispatcher: 3302901,
          argumentValidationDispatcher: 3303028,
        },
        invalidArgumentResponse: {
          tools: [
            "request_option_picker",
            "request_onboarding_input",
            "setup_codex_step",
          ],
          contentItemType: "inputText",
          messageTemplate: "<tool> received invalid arguments.",
          success: false,
        },
        setupCompletionResponse: {
          step: "complete",
          payload: { completed: true },
          textEncoding: "JSON.stringify(payload)",
          success: true,
          createsInteraction: false,
        },
      },
      hostAutoResponseMethods: [
        "currentTime/read",
        "item/tool/call:setup_codex_step.complete",
      ],
      hostPrivateMethods: [
        "account/chatgptAuthTokens/refresh",
        "attestation/generate",
      ],
      ignoredLegacyServerRequestVariants: [
        "applyPatchApproval",
        "execCommandApproval",
      ],
      locallySynthesizedActionsNotProviderRequests: [
        "item/plan/requestImplementation",
      ],
      internalResponseContracts: {
        optionPicker: {
          actions: ["submit", "skip", "dismiss"],
          fields: ["action", "selectedOptions", "freeformAnswer"],
        },
        contextPicker: {
          actions: ["continue", "skip", "dismiss"],
          fields: ["action", "selectedSources"],
        },
        setupStep: {
          roleFields: ["action", "selectedRoles"],
          taskFields: ["action", "answers"],
          contextFields: ["action", "selectedSources"],
        },
        dynamicToolResponseEnvelope: {
          contentItemType: "inputText",
          textEncoding: "JSON.stringify(payload)",
          success: true,
        },
      },
      resolutionLifecycle: {
        notificationMethod: "serverRequest/resolved",
        transportStates: [
          "pending",
          "responding",
          "response_sent",
          "provider_cleared",
          "cancelled",
          "resolution_unknown",
        ],
        correlationKeys: [
          "sessionId",
          "turnId",
          "executionHandle",
          "providerSessionId",
          "providerTurnId",
          "providerItemId",
          "providerRequestId",
        ],
        responseCardinality:
          "at-most-once per providerRequestId and executionHandle",
        notificationSemantics:
          "serverRequest/resolved proves provider cleanup but does not by itself prove that this client sent a response",
        notificationWireFields: ["threadId", "requestId"],
        providerRequestIdWireType: "string | number",
        canonicalTerminalRule:
          "mark resolved only when this execution recorded response_sent before provider_cleared; otherwise preserve lifecycle-cleared or resolution-unknown semantics",
        recoveryRule:
          "reconcile the provider pending request before replay and never resend from a persisted canonical resolution alone",
        itemTerminalAuthority:
          "item/completed remains authoritative for command and file item outcomes",
        turnStreamingLifecycle: {
          preTurnBindingRule:
            "buffer ordered same-provider-Session events carrying a provider Turn id until turn/start returns the authoritative new Turn id; replay only matching events and discard late prior-Turn events",
          preTurnBufferLimit: 1024,
          notificationOrder: [
            "turn/started",
            "item/started",
            "item-specific delta notifications",
            "item/completed",
            "turn/completed",
          ],
          turnStartRule:
            "mark the canonical Turn in progress and the Session streaming; rebind the matching placeholder or synthesize the missing Turn from canonical Session settings",
          itemStartRule:
            "mark the Session streaming, correlate by provider item identity, and synthesize a missing in-progress Turn when history races live notifications",
          deltaRule:
            "apply each item-specific delta only to its correlated item identity and drain buffered text before either item or Turn completion",
          itemCompletionRule:
            "replace or merge the correlated item with the authoritative full item and preserve one canonical item identity",
          turnCompletionRule:
            "apply status, error, and duration, clear terminal input buffers for interrupted or failed Turns, restore eligible queued steering input, emit completion, and only then return the composer to ready",
          terminalStatuses: ["completed", "interrupted", "failed"],
        },
        turnCancellation: {
          requestMethod: "turn/interrupt",
          adapterWireParams: ["threadId", "turnId"],
          successResponse: "{}",
          acknowledgementMethod: "turn/completed",
          acknowledgementStatus: "interrupted",
          terminalRule:
            "do not persist canonical cancellation as terminal until the provider interruption acknowledgement arrives",
          pendingRequestSettlement: {
            commandExecutionApproval: "decline",
            fileChangeApproval: "decline",
            permissionsApproval: "empty permissions scoped to the Turn",
            userInput: "empty answers",
            optionPicker: "dismiss with no selected options or freeform answer",
            contextPicker: "dismiss with no selected sources",
            mcpElicitation: "decline",
          },
          executionCleanup:
            "clean background terminals and terminate active request-scoped Node REPL executions after issuing the provider interruption",
          descendantRule:
            "a user stop interrupts descendant executions in the background; system interruption waits for descendant cleanup; a follower forwards interruption to the owning client and falls back locally only when that owner is unavailable",
          noActiveTurnRecovery:
            "provider no-active-turn means the live execution is already terminal or its notification was missed; reconcile provider history before recording the canonical interrupted terminal state",
          composerRule:
            "while streaming, render an enabled Stop button of type button; after authoritative terminal reconciliation, render Send and apply the normal submit disabled/loading rules",
        },
      },
    },
    requiredContractExtensions: [
      "align Kernel vendored Codex to the pinned desktop protocol baseline or provide a versioned compatibility adapter with equivalent schema tests",
      "generate and lock the complete current v2 ServerRequest request and response union",
      "extend typed dispatch and response continuation from the implemented canonical and desktop setup Interaction families plus current-time/setup-completion host responses to all remaining default-exported v2 ServerRequest methods",
      "route the Kernel canonical Interaction envelope through Agents persistence, OpenAPI, generated SDKs, runtime continuation, and BirdCoder, and add secure Kernel host ports for dynamic tools, token refresh, and attestation",
      "route typed desktop onboarding, option-picker, and Codex-context setup Interactions through Agents persistence, generated SDKs, and BirdCoder",
      "durable at-most-once response correlation and ambiguous resolution recovery",
      "long-lived app-server initialize handshake, exact-ID IPC bridge, deterministic close failure, and bounded websocket reconnect state machine",
      "provider thread and turn identities confined to the adapter and mapped to canonical Session execution handles",
      "contract and credentialed real-provider E2E for every user-mediated and host-mediated request class",
    ],
    prohibitedWorkarounds: [
      "manual edits to generated Codex protocol schemas",
      "dropping unknown server requests or fields while claiming compatibility",
      "treating the exec-only SDK stream as app-server ServerRequest parity",
      "passing auth tokens or attestation payloads through BirdCoder UI or Agents persistence",
      "treating locally synthesized plan implementation as a provider ServerRequest",
      "blindly replaying in-flight provider requests after transport close",
      "claiming protocol compatibility from version strings without schema and behavior evidence",
    ],
  },
];
validateExactInventory(
  "contract blocker ids",
  spec.blockers.map((blocker) => blocker.id),
  requiredBlockerContracts.map((blocker) => blocker.id),
);
for (const requiredBlocker of requiredBlockerContracts) {
  const blocker = spec.blockers.find(
    (candidate) => candidate.id === requiredBlocker.id,
  );
  assert.equal(blocker?.kind, requiredBlocker.kind);
  assert.equal(blocker?.owner, requiredBlocker.owner);
  if (requiredBlocker.summary) {
    assert.equal(blocker?.summary, requiredBlocker.summary);
  }
  assert.equal(blocker?.status, "pending-human-review");
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
    "observedRuntimeFacts",
    "observedContractFacts",
    "observedProviderRequestMethods",
    "observedAgentsInteractionKinds",
    "serverRequestMethods",
    "experimentalServerRequestMethods",
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
    assert.deepEqual(
      blocker?.evidence?.protocolBaseline,
      requiredBlocker.protocolBaseline,
    );
  }
  if (requiredBlocker.serverRequestParameterContracts) {
    assert.deepEqual(
      blocker?.evidence?.serverRequestParameterContracts,
      requiredBlocker.serverRequestParameterContracts,
    );
  }
  if (requiredBlocker.serverRequestResponseContracts) {
    assert.deepEqual(
      blocker?.evidence?.serverRequestResponseContracts,
      requiredBlocker.serverRequestResponseContracts,
    );
  }
  if (requiredBlocker.desktopAppServerTransport) {
    assert.deepEqual(
      blocker?.evidence?.desktopAppServerTransport,
      requiredBlocker.desktopAppServerTransport,
    );
  }
  if (requiredBlocker.desktopServerRequestProjection) {
    assert.deepEqual(
      blocker?.evidence?.desktopServerRequestProjection,
      requiredBlocker.desktopServerRequestProjection,
    );
  }
  if (requiredBlocker.automationContractComparison) {
    assert.deepEqual(
      blocker?.evidence?.automationContractComparison,
      requiredBlocker.automationContractComparison,
    );
  }
  if (requiredBlocker.interactionContractComparison) {
    assert.deepEqual(
      blocker?.evidence?.interactionContractComparison,
      requiredBlocker.interactionContractComparison,
    );
  }
  if (requiredBlocker.kernelAdapterCoverage) {
    assert.deepEqual(
      blocker?.evidence?.kernelAdapterCoverage,
      requiredBlocker.kernelAdapterCoverage,
    );
  }
  if (requiredBlocker.generatedEvidence) {
    assert.deepEqual(
      blocker?.evidence?.generatedEvidence,
      requiredBlocker.generatedEvidence,
    );
  }
  if (requiredBlocker.executionRegistryContract) {
    assert.deepEqual(
      blocker?.evidence?.executionRegistryContract,
      requiredBlocker.executionRegistryContract,
    );
  }
  if (requiredBlocker.kernelExecutionContract) {
    assert.deepEqual(
      blocker?.evidence?.kernelExecutionContract,
      requiredBlocker.kernelExecutionContract,
    );
  }
  if (requiredBlocker.sourceSemanticAssertions) {
    assert.deepEqual(
      blocker?.evidence?.sourceSemanticAssertions,
      requiredBlocker.sourceSemanticAssertions,
    );
    validateSourceSemanticAssertions(
      requiredBlocker.id,
      requiredBlocker.sourceSemanticAssertions,
      blocker?.evidence?.paths ?? [],
    );
  }
  validateExactInventory(
    `${requiredBlocker.id} capability references`,
    spec.capabilities
      .filter((capability) => capability.blockerId === requiredBlocker.id)
      .map((capability) => capability.id),
    requiredBlocker.capabilityIds,
  );
}

const browserBlocker = spec.blockers.find(
  (candidate) => candidate.id === "CDB-003",
);
const browserEvidence = browserBlocker?.evidence;
const browserRendererContract = browserEvidence?.rendererContract;
assert.deepEqual(browserRendererContract?.lifecycleArtifact, {
  path: "app/resources/app.asar::webview/assets/app-initial-cpPdPura.js",
  sha256: "69fc795132856b60ba2201695ebb4ac922790a9c341630f9f4f9461bf38ff6d6",
  sizeBytes: 14878551,
});
assert.deepEqual(browserRendererContract?.negativeDotLottieEvidence, {
  path: "app/resources/app.asar::webview/assets/browser-CVV9l2Fo.js",
  sha256: "c77316df7185c71893591e34d1c612511564deefe692693ad8d51a2359a9c5e6",
  sizeBytes: 651833,
  classification:
    "DotLottie rendering dependency; it is not Browser lifecycle, command, permission, or persistence evidence.",
  dotLottieEntryByteOffsets: [26410, 32738],
  absentLifecycleMarkers: ["thread-browser-tabs-v1:", "capture-screenshot"],
});
assert.notEqual(
  browserRendererContract?.lifecycleArtifact?.path,
  browserRendererContract?.negativeDotLottieEvidence?.path,
  "DotLottie must never be accepted as the Browser lifecycle artifact",
);
assert.equal(
  browserRendererContract?.initialTabState?.entryByteOffset,
  9134147,
);
validateExactInventory(
  "CDB-003 renderer state fields",
  browserRendererContract?.initialTabState?.fields ?? [],
  [
    "annotationFlow",
    "tabType",
    "isSuspended",
    "title",
    "url",
    "faviconUrl",
    "securityState",
    "isLoading",
    "isAtDocumentBottom",
    "canGoBack",
    "canGoForward",
    "zoomPercent",
    "commentModeDisabledReason",
    "interactionMode",
    "isAudible",
    "isCapturingUserMedia",
    "annotationEditorMode",
    "isAnnotationAddModifierPressed",
    "isOriginalViewEnabled",
    "isTweaksEditorOpen",
    "comments",
  ],
);
assert.equal(browserRendererContract?.commandUnion?.entryByteOffset, 9117282);
validateExactInventory(
  "CDB-003 renderer command union",
  browserRendererContract?.commandUnion?.commands ?? [],
  [
    "open-find",
    "find-next",
    "find-previous",
    "focus-address",
    "step-zoom",
    "set-zoom-percent",
    "reset-zoom",
    "set-interaction-mode",
    "add-annotations-to-composer",
    "clear-comments",
    "discard-pending-annotations",
    "close-tab",
    "capture-screenshot",
    "go-back",
    "go-forward",
    "navigate",
    "set-design-modifier-pressed",
    "set-original-view-enabled",
    "set-find-query",
    "reload",
    "print",
    "reset",
    "refresh-cursor",
    "scroll",
    "select-comment",
    "close-find",
    "transfer-conversation",
    "stop",
  ],
);
validateExactInventory(
  "CDB-003 reference Browser persistence keys",
  browserRendererContract?.referencePersistenceKeys ?? [],
  ["persist:codex-browser-app-route:", "thread-browser-tabs-v1:"],
);
assert.match(
  browserRendererContract?.canonicalPersistenceRule ?? "",
  /canonical sessionId/u,
);
assert.doesNotMatch(
  browserRendererContract?.canonicalPersistenceRule ?? "",
  /canonical thread/iu,
);
assert.deepEqual(browserRendererContract?.hiddenHostContracts, [
  {
    kind: "adopted-background-web-contents",
    artifact:
      "app/resources/app.asar::webview/assets/browser-sidebar-hidden-background-webview-host-Dupcquxn.js",
    fields: [
      "sessionId",
      "providerBrowserTabId",
      "adoptedWebContentsId",
      "adoptionLease",
      "initialUrl",
    ],
    initialUrlFallback: "about:blank",
    isVisible: false,
    shouldBootstrapWhenHidden: true,
    shouldPaint: false,
  },
  {
    kind: "hidden-browser-use",
    artifact:
      "app/resources/app.asar::webview/assets/browser-sidebar-hidden-browser-use-webview-host-B3sa6LzG.js",
    fields: ["sessionId", "providerBrowserTabId", "initialUrl", "hostKind"],
    hostKind: "hidden-browser-use",
    initialUrlFallback: "about:blank",
    isVisible: false,
    shouldBootstrapWhenHidden: true,
    shouldPaint: false,
  },
]);
assert.deepEqual(browserRendererContract?.transferContract, {
  referenceCommand: "transfer-conversation",
  referenceFields: [
    "sourceConversationId",
    "sourceBrowserTabId",
    "targetConversationId",
    "targetBrowserTabId",
  ],
  canonicalFields: [
    "sourceSessionId",
    "sourceProviderBrowserTabId",
    "targetSessionId",
    "targetProviderBrowserTabId",
  ],
  rule: "Transfer is an atomic Session reassociation of one opaque provider tab; it preserves host state and cannot synthesize either Session identity or provider tab identity.",
});
validateExactInventory(
  "CDB-003 embedded Browser settings kinds",
  browserRendererContract?.hostBackedSettings?.embeddedSettingsKinds ?? [],
  [
    "contactInfo",
    "downloads",
    "extensions",
    "history",
    "passwordManager",
    "siteSettings",
  ],
);
validateExactInventory(
  "CDB-003 Browser browsing data types",
  browserRendererContract?.hostBackedSettings?.browsingDataTypes ?? [],
  ["cookies", "siteData", "cache", "downloads", "history", "all"],
);
assert.match(
  browserRendererContract?.hostBackedSettings?.securityRule ?? "",
  /never profile paths, cookies, passwords, tokens, or credential material/u,
);

const browserSitePermissionContract = browserEvidence?.sitePermissionContract;
assert.deepEqual(browserSitePermissionContract?.approvalModes, [
  { id: "alwaysAsk", label: "Always ask" },
  { id: "neverAsk", label: "Always allow", elevatedRiskWarning: true },
]);
validateExactInventory(
  "CDB-003 separate Browser approval settings",
  browserSitePermissionContract?.separateApprovalSettings ?? [],
  ["website", "history", "download", "upload"],
);
validateExactInventory(
  "CDB-003 Browser permission resources",
  browserSitePermissionContract?.resources ?? [],
  ["origin", "download", "upload", "fullCdp"],
);
validateExactInventory(
  "CDB-003 Browser permission values",
  browserSitePermissionContract?.values ?? [],
  ["default", "allowed", "denied"],
);
validateExactInventory(
  "CDB-003 Browser origin state fields",
  browserSitePermissionContract?.originStateFields ?? [],
  [
    "allowedOrigins",
    "deniedOrigins",
    "allowedDownloadOrigins",
    "deniedDownloadOrigins",
    "allowedUploadOrigins",
    "deniedUploadOrigins",
    "allowedFullCdpOrigins",
    "deniedFullCdpOrigins",
  ],
);
assert.deepEqual(browserSitePermissionContract?.mutationFields, [
  "action",
  "kind",
  "origin",
  "resource",
]);
assert.deepEqual(browserSitePermissionContract?.mutationValues, {
  action: ["add", "remove"],
  kind: ["allowed", "denied"],
});
validateExactInventory(
  "CDB-003 Browser host operations",
  browserSitePermissionContract?.hostOperations ?? [],
  [
    "browser-use-origin-state-read",
    "browserUsePermissions.updateOriginRules",
    "browser-use-approval-mode-write",
    "browser-use-history-approval-mode-write",
    "browser-use-file-transfer-approval-mode-write",
    "browser-use-full-cdp-access-enabled-write",
    "browser-browsing-data-clear",
  ],
);
validateExactInventory(
  "CDB-003 Browser approval resource variants",
  browserSitePermissionContract?.approvalResourceVariants ?? [],
  [
    "origin",
    "fileTransfer:download",
    "fileTransfer:upload",
    "fullCdp",
    "sensitiveData:browsing_history",
  ],
);
assert.deepEqual(browserSitePermissionContract?.canonicalScopeMapping, {
  turn: "Turn",
  conversation: "Session",
  global: "global policy",
});
assert.deepEqual(browserSitePermissionContract?.persistMapping, {
  session: "Session scope",
  always: "global policy",
});
validateExactInventory(
  "CDB-003 Browser permission decision sources",
  browserSitePermissionContract?.decisionSources ?? [],
  [
    "browser-use-persisted-state",
    "codex-network-policy",
    "guardian-origin-cache",
  ],
);
assert.match(
  browserSitePermissionContract?.actionTimeConfirmationRule ?? "",
  /at action time/u,
);

const browserPluginApiContract = browserEvidence?.pluginApiContract;
validateExactInventory(
  "CDB-003 Browser collection methods",
  browserPluginApiContract?.browserCollectionMethods ?? [],
  ["get", "getDefault", "getForUrl", "list"],
);
validateExactInventory(
  "CDB-003 Browser members",
  browserPluginApiContract?.browserMembers ?? [],
  ["browserId", "tabs", "user", "capabilities", "documentation", "nameSession"],
);
validateExactInventory(
  "CDB-003 Tabs methods",
  browserPluginApiContract?.tabsMethods ?? [],
  ["new", "get", "list", "selected", "finalize", "content"],
);
validateExactInventory(
  "CDB-003 Tab members",
  browserPluginApiContract?.tabMembers ?? [],
  [
    "id",
    "goto",
    "back",
    "forward",
    "reload",
    "close",
    "title",
    "url",
    "screenshot",
    "playwright",
    "dom_cua",
    "cua",
    "content",
    "clipboard",
    "dev",
    "capabilities",
    "markHandoff",
    "markDeliverable",
    "getJsDialog",
  ],
);
validateExactInventory(
  "CDB-003 Browser user methods",
  browserPluginApiContract?.browserUserMethods ?? [],
  ["openTabs", "claimTab", "history"],
);
validateExactInventory(
  "CDB-003 Browser tab finalization statuses",
  browserPluginApiContract?.tabFinalizationStatuses ?? [],
  ["handoff", "deliverable"],
);
validateExactInventory(
  "CDB-003 Browser user tab fields",
  browserPluginApiContract?.browserUserTabInfoFields ?? [],
  ["id", "providerTabId", "title", "url", "lastOpened", "tabGroup"],
);
assert.deepEqual(browserPluginApiContract?.iabDiscovery, {
  referenceSessionMetadataField: "codexSessionId",
  referenceBuildMetadataField: "codexAppBuildFlavor",
  canonicalRuntimeField: "providerBrowserSessionId",
  rule: "Match the exact provider Browser session and app build flavor, then bind the opaque result to canonical sessionId through an owner record; never equate codexSessionId with sessionId.",
});

const browserCanonicalSessionMapping = browserEvidence?.canonicalSessionMapping;
assert.deepEqual(browserCanonicalSessionMapping?.referenceFieldMappings, [
  {
    reference: "renderer conversationId",
    canonical: "sessionId",
    boundary: "Browser renderer adapter",
  },
  {
    reference: "Codex provider threadId",
    canonical: "providerSessionId",
    boundary: "Codex provider adapter",
  },
  {
    reference: "Browser plugin codexSessionId",
    canonical: "providerBrowserSessionId",
    boundary: "Kernel Browser host adapter",
  },
]);
assert.deepEqual(browserCanonicalSessionMapping?.ownerContractFields, [
  "sessionId",
  "turnId",
  "providerSessionId",
  "providerBrowserSessionId",
  "providerBrowserTabId",
]);
for (const field of browserCanonicalSessionMapping?.ownerContractFields ?? []) {
  assert.doesNotMatch(field, /thread|conversation|codexSession/iu);
}
assert.match(
  browserCanonicalSessionMapping?.rule ?? "",
  /only canonical continuation identity/u,
);
assert.match(
  browserCanonicalSessionMapping?.rule ?? "",
  /cannot be synthesized/u,
);

const browserCurrentGap = browserEvidence?.currentBirdCoderGap;
assert.deepEqual(browserCurrentGap?.previewAdapterFields, ["id", "render"]);
assert.deepEqual(browserCurrentGap?.previewRenderContextFields, [
  "refreshKey",
  "title",
  "url",
]);
assert.deepEqual(browserCurrentGap?.localNavigationFields, [
  "entries",
  "index",
]);
assert.equal(
  browserCurrentGap?.iframeSandbox,
  "allow-scripts allow-forms allow-popups",
);
validateExactInventory(
  "CDB-003 local Browser preference fields",
  browserCurrentGap?.localBrowserPreferenceFields ?? [],
  [
    "browserAllowedSites",
    "browserApprovalPolicy",
    "browserAskDownloadLocation",
    "browserDownloadLocation",
    "browserEnabled",
    "browserLocalLinkOpenTarget",
    "browserScreenshotPolicy",
    "browserWebLinkOpenTarget",
  ],
);
validateExactInventory(
  "CDB-003 local Browser approval policy values",
  browserCurrentGap?.localApprovalPolicyValues ?? [],
  ["always-ask", "trusted-sites", "never-ask"],
);
assert.equal(
  browserCurrentGap?.localWebsitePermissionShape,
  "one allowedSites string array with no denied state or per-resource matrix",
);
assert.equal(
  browserCurrentGap?.localDataClearScope,
  "matching localStorage and sessionStorage prefixes only",
);
validateExactInventory(
  "CDB-003 missing host capabilities",
  browserCurrentGap?.missingHostCapabilities ?? [],
  [
    "native or sidecar web contents lifecycle",
    "provider Browser runtime and tab binding",
    "authoritative loading, security, history, media, zoom, comment, and suspension state",
    "stop, capture, print, find, zoom, scroll, annotation, transfer, and reset commands",
    "hidden bootstrap and adopted web contents lease recovery",
    "resource-specific site permission decisions and action-time confirmation",
    "separate website, history, download, upload, and full CDP policies",
    "host-backed browsing-data clearing and embedded Browser settings",
    "Session isolation, transfer, restart recovery, and real desktop E2E",
  ],
);

const browserPreviewSource = fs.readFileSync(
  resolvePath(
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/BrowserPreviewSurface.tsx",
  ),
  "utf8",
);
assert.match(browserPreviewSource, /export const iframeBrowserPreviewAdapter/u);
assert.match(browserPreviewSource, /<iframe/u);
assert.match(
  browserPreviewSource,
  /sandbox="allow-scripts allow-forms allow-popups"/u,
);
for (const rawProviderField of [
  "codexSessionId",
  "threadId",
  "conversationId",
]) {
  for (const relativePath of browserEvidence?.paths ?? []) {
    const source = fs.readFileSync(resolvePath(relativePath), "utf8");
    assert.doesNotMatch(
      source,
      new RegExp(`\\b${rawProviderField}\\b`, "u"),
      `${relativePath} must not expose raw Browser/provider Session naming`,
    );
  }
}

for (const capabilityId of ["CDP-004", "CDP-005", "CDP-006"]) {
  const capability = spec.capabilities.find(
    (candidate) => candidate.id === capabilityId,
  );
  assert.equal(capability?.status, "blocked-contract");
  assert.equal(capability?.blockerId, "CDB-005");
}

const serverRequestCapability = spec.capabilities.find(
  (candidate) => candidate.id === "CDP-015",
);
assert.equal(serverRequestCapability?.status, "blocked-contract");
assert.equal(serverRequestCapability?.blockerId, "CDB-006");
assert.equal(
  serverRequestCapability?.title,
  "Pinned Codex app-server v2 ServerRequest and desktop request-projection dispatch, continuation, and host capability coverage",
);
assert.deepEqual(serverRequestCapability?.evidence?.relatedBlockerIds, [
  "CDB-001",
  "CDB-005",
]);
const serverRequestReferenceArtifacts = [
  "app/resources/app.asar::.vite/build/main-C1YkadXg.js",
  "app/resources/app.asar::.vite/build/src-CLstCQVF.js",
  "app/resources/app.asar::webview/assets/app-initial-cpPdPura.js",
];
validateExactInventory(
  "CDP-015 evidence paths",
  serverRequestCapability?.evidence?.paths ?? [],
  [
    "external/codex/codex-rs/app-server-protocol/src/protocol/common.rs",
    "external/codex/codex-rs/app-server-protocol/src/protocol/v2/current_time.rs",
    "external/codex/codex-rs/app-server-protocol/schema/typescript/ServerRequest.ts",
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ServerRequestResolvedNotification.ts",
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ChatgptAuthTokensRefreshResponse.ts",
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts",
    "../sdkwork-kernel/external/codex/codex-rs/app-server-protocol/src/protocol/common.rs",
    "../sdkwork-kernel/external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts",
    "../sdkwork-kernel/scripts/provider-transport-workers/engine-sdk-live.mjs",
    "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-live.mjs",
    "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-live.test.mjs",
    "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-runtime.mjs",
    "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-interactions.mjs",
    "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-interactions.test.mjs",
    "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-host-requests.mjs",
    "../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-host-requests.test.mjs",
    "../sdkwork-kernel/scripts/provider-transport-workers/generic-ts-sdk-worker-app-server.test.mjs",
    "../sdkwork-kernel/specs/AGENT_PROVIDER_INTEGRATION_SPEC.md",
    "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/domain.rs",
    "../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/dto.rs",
  ],
);
validateExactInventory(
  "CDP-015 evidence commands",
  serverRequestCapability?.evidence?.commands ?? [],
  [
    kernelInteractionCommands[0],
    "node --test ../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-host-requests.test.mjs",
    kernelInteractionCommands[1],
    "node --test ../sdkwork-kernel/scripts/provider-transport-workers/codex-app-server-live.test.mjs",
  ],
);
validateExactInventory(
  "CDP-015 reference artifacts",
  serverRequestCapability?.evidence?.referenceArtifacts ?? [],
  serverRequestReferenceArtifacts,
);
for (const referenceArtifact of serverRequestReferenceArtifacts) {
  if (!referenceArtifactsByPath.has(referenceArtifact)) {
    errors.push(
      `[CDP-015] undeclared reference artifact: ${referenceArtifact}`,
    );
  }
}

const protocolDrift = spec.blockers.find(
  (candidate) => candidate.id === "CDB-006",
)?.evidence?.protocolBaseline;
assert.equal(
  sha256File(
    "external/codex/codex-rs/app-server-protocol/src/protocol/common.rs",
  ),
  protocolDrift?.referenceCommonSha256,
);
assert.equal(
  sha256File(
    "../sdkwork-kernel/external/codex/codex-rs/app-server-protocol/src/protocol/common.rs",
  ),
  protocolDrift?.kernelCommonSha256,
);
assert.equal(
  sha256File(
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts",
  ),
  protocolDrift?.referenceToolRequestUserInputParamsSha256,
);
assert.equal(
  sha256File(
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ChatgptAuthTokensRefreshResponse.ts",
  ),
  protocolDrift?.referenceChatgptAuthTokensRefreshResponseSha256,
);
assert.equal(
  sha256File(
    "../sdkwork-kernel/external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts",
  ),
  protocolDrift?.kernelToolRequestUserInputParamsSha256,
);

const interactionDrift = spec.blockers.find(
  (candidate) => candidate.id === "CDB-001",
)?.evidence?.generatedEvidence;
const interactionEvidenceFiles = {
  commandApprovalParamsSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/CommandExecutionRequestApprovalParams.ts",
  commandApprovalDecisionSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/CommandExecutionApprovalDecision.ts",
  fileChangeApprovalParamsSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/FileChangeRequestApprovalParams.ts",
  fileChangeApprovalDecisionSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/FileChangeApprovalDecision.ts",
  userInputParamsSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts",
  userInputQuestionSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputQuestion.ts",
  userInputOptionSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputOption.ts",
  userInputAnswerSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputAnswer.ts",
  userInputResponseSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputResponse.ts",
  mcpElicitationParamsSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/McpServerElicitationRequestParams.ts",
  mcpElicitationResponseSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/McpServerElicitationRequestResponse.ts",
  permissionsParamsSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/PermissionsRequestApprovalParams.ts",
  permissionsResponseSha256:
    "external/codex/codex-rs/app-server-protocol/schema/typescript/v2/PermissionsRequestApprovalResponse.ts",
  agentsInteractionKindSha256:
    "../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/types/agent-interaction-kind.ts",
  agentsInteractionRecordSha256:
    "../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/types/agent-interaction-record.ts",
  agentsApproveRequestSha256:
    "../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/types/approve-agent-interaction-request.ts",
  agentsAnswerRequestSha256:
    "../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/types/answer-agent-interaction-request.ts",
};
for (const [evidenceKey, relativePath] of Object.entries(
  interactionEvidenceFiles,
)) {
  assert.equal(sha256File(relativePath), interactionDrift?.[evidenceKey]);
}

const automationDrift = spec.blockers.find(
  (candidate) => candidate.id === "CDB-002",
)?.evidence?.generatedEvidence;
assert.equal(
  sha256File(
    "../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/types/create-agent-task-request.ts",
  ),
  automationDrift?.createRequestSha256,
);
assert.equal(
  sha256File(
    "../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/types/agent-task-record.ts",
  ),
  automationDrift?.taskRecordSha256,
);
assert.equal(
  sha256File(
    "../sdkwork-agents/sdks/sdkwork-agents-app-sdk/sdkwork-agents-app-sdk-typescript/generated/server-openapi/src/api/ai.ts",
  ),
  automationDrift?.aiApiSha256,
);

for (const blocker of spec.blockers) {
  if (blocker.humanReviewRequired !== true) {
    errors.push(
      `[${blocker.id}] public contract or security blocker requires human review`,
    );
  }
  if (
    !Array.isArray(blocker.prohibitedWorkarounds) ||
    blocker.prohibitedWorkarounds.length === 0
  ) {
    errors.push(`[${blocker.id}] prohibited workarounds must be explicit`);
  }
  for (const relativePath of blocker.evidence?.paths ?? []) {
    if (!fs.existsSync(resolvePath(relativePath))) {
      errors.push(
        `[${blocker.id}] missing blocker evidence path: ${relativePath}`,
      );
    }
  }
}

const visualCapability = spec.capabilities.find(
  (capability) => capability.id === "CDP-009",
);
assert.equal(visualCapability?.status, "aligned-and-verified");
validateExactInventory(
  "visual parity evidence paths",
  visualCapability?.evidence?.paths ?? [],
  [
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerSessionRow.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatPendingInteractions.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/ChatActivitySummary.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ToolCallCard.tsx",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/toolCallActionPresentation.ts",
    "apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts",
    "apps/sdkwork-birdcoder-pc/tests/e2e/codex-desktop-visual-parity.spec.ts",
    "apps/sdkwork-birdcoder-pc/tests/e2e/codex-session-parity.spec.ts",
    "apps/sdkwork-birdcoder-pc/tests/e2e/message-presentation.spec.ts",
    "apps/sdkwork-birdcoder-pc/tests/e2e/codex-desktop-visual-parity.spec.ts-snapshots/codex-session-desktop-1440x900-chromium-win32.png",
    "apps/sdkwork-birdcoder-pc/tests/e2e/codex-desktop-visual-parity.spec.ts-snapshots/codex-session-narrow-900x800-chromium-win32.png",
    "scripts/run-pc-playwright-e2e.mjs",
    "scripts/run-pc-playwright-e2e.test.mjs",
    "scripts/pc-e2e-standard-contract.test.mjs",
  ],
);
validateExactInventory(
  "visual parity commands",
  visualCapability?.evidence?.commands ?? [],
  [
    "node scripts/run-pc-playwright-e2e.test.mjs",
    "node scripts/pc-e2e-standard-contract.test.mjs",
    "node scripts/run-pc-playwright-e2e.mjs tests/e2e/codex-desktop-visual-parity.spec.ts --project=chromium",
  ],
);
assert.deepEqual(visualCapability?.evidence?.browserFailurePolicy, {
  consoleErrors: "zero",
  failedRequests: "zero",
});
const visualCases = visualCapability?.evidence?.cases ?? [];
validateExactInventory(
  "Codex visual regression cases",
  visualCases.map((visualCase) => visualCase.id),
  ["desktop-1440x900", "narrow-900x800"],
);
const expectedVisualViewports = new Map([
  ["desktop-1440x900", { width: 1440, height: 900 }],
  ["narrow-900x800", { width: 900, height: 800 }],
]);
const referenceArchive = spec.reference.artifacts.find(
  (artifact) => artifact.path === "app/resources/app.asar",
);
for (const visualCase of visualCases) {
  if (!fs.existsSync(resolvePath(visualCase.snapshotPath))) {
    errors.push(
      `[${visualCase.id}] missing visual snapshot: ${visualCase.snapshotPath}`,
    );
    continue;
  }
  if (visualCase.snapshotSha256 !== sha256File(visualCase.snapshotPath)) {
    errors.push(
      `[${visualCase.id}] visual snapshot hash does not match its evidence file`,
    );
  }
  if (
    visualCase.platform !== "win32" ||
    visualCase.browserProject !== "chromium"
  ) {
    errors.push(
      `[${visualCase.id}] visual baseline must use the governed Windows Chromium profile`,
    );
  }
  if (visualCapability?.status === "aligned-and-verified") {
    if (visualCase.referenceBuild !== spec.reference.build) {
      errors.push(
        `[${visualCase.id}] visual reference build does not match the pinned desktop build`,
      );
    }
    if (visualCase.referenceArtifactSha256 !== referenceArchive?.sha256) {
      errors.push(
        `[${visualCase.id}] visual reference hash does not match the pinned desktop archive`,
      );
    }
    if (visualCase.status !== "passed") {
      errors.push(`[${visualCase.id}] visual regression is not passed`);
    }
  } else if (visualCase.status !== "stale-reference") {
    errors.push(
      `[${visualCase.id}] partial visual evidence must be marked stale-reference`,
    );
  }
  if (
    JSON.stringify(visualCase.viewport) !==
    JSON.stringify(expectedVisualViewports.get(visualCase.id))
  ) {
    errors.push(
      `[${visualCase.id}] visual viewport does not match the governed case`,
    );
  }
}
if (visualCapability?.status === "aligned-and-verified") {
  if (
    spec.verification.desktopVisualRegression !== "passed" ||
    spec.verification.narrowVisualRegression !== "passed"
  ) {
    errors.push(
      "CDP-009 cannot be aligned before desktop and narrow visual regression pass",
    );
  }
}

if (spec.goalStatus === "complete") {
  if (fixtureContract.syntheticCoverageStatus !== "complete") {
    errors.push(
      "goal cannot complete before synthetic presentation fixture coverage is complete",
    );
  }
  const incompleteCapability = spec.capabilities.find(
    (capability) =>
      capability.status !== spec.completionPolicy.requiredCapabilityStatus,
  );
  if (incompleteCapability) {
    errors.push(
      `goal cannot complete while ${incompleteCapability.id} is ${incompleteCapability.status}`,
    );
  }
  if (spec.completionPolicy.requireNoOpenBlockers && spec.blockers.length > 0) {
    errors.push("goal cannot complete while contract blockers remain open");
  }
  if (spec.verification.realProviderE2E !== "passed") {
    errors.push("goal cannot complete before real provider E2E passes");
  }
  if (
    spec.verification.desktopVisualRegression !== "passed" ||
    spec.verification.narrowVisualRegression !== "passed"
  ) {
    errors.push(
      "goal cannot complete before desktop and narrow visual regression pass",
    );
  }
}

assert.deepEqual(
  errors,
  [],
  `Codex desktop parity contract failed:\n${errors.map((error) => `  - ${error}`).join("\n")}`,
);

console.log("Codex desktop parity contract passed.");
console.log(`reference build: ${spec.reference.build}`);
console.log(
  `capabilities: ${spec.capabilities.length}; blockers: ${spec.blockers.length}`,
);
console.log(
  `presentation evidence: ${providerItems.length} provider items; ${syntheticItems.length} synthetic items`,
);
