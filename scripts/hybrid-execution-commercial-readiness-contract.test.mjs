import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const readText = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const readiness = readJson('specs/hybrid-execution-commercial-readiness.spec.json');
const birdcoderRequirement = readText(
  'docs/product/requirements/REQ-2026-0006-hybrid-local-cloud-agent-execution.md',
);
const birdcoderReview = readText(
  'docs/engineering/reviews/REVIEW-20260730-hybrid-execution-commercial-gate.md',
);
const agentsRequirement = readText(
  '../sdkwork-agents/docs/product/requirements/REQ-2026-0730-hybrid-agent-execution-orchestration.md',
);
const kernelRequirement = readText(
  '../sdkwork-kernel/docs/product/requirements/REQ-2026-0002-distributed-execution-placement-control-plane.md',
);
const sandboxPool = readJson('../sdkwork-sandbox/specs/sandbox-runtime-pool.contract.json');
const kernelDistributedRuntime = readText(
  '../sdkwork-kernel/docs/product/prd/PRD-05-distributed-agent-runtime.md',
);
const agentsAppOpenApi = readText(
  '../sdkwork-agents/crates/sdkwork-intelligence-agents-service/specs/openapi/agents-app-api.openapi.yaml',
);
const agentsTurnRuntime = readText(
  '../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/turn_runtime.rs',
);
const codePage = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
);
const runModeSelector = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/NewTaskRunModeSelector.tsx',
);
const projectsHook = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useProjects.ts',
);

assert.equal(readiness.status, 'blocked');
assert.match(birdcoderRequirement, /^Status: blocked$/mu);
assert.match(birdcoderReview, /^Outcome: No-Go$/mu);
assert.match(agentsRequirement, /^\s*- Status: blocked$/mu);
assert.match(kernelRequirement, /^status: blocked$/mu);
assert.deepEqual(readiness.vocabulary.executionPreference.values, ['LOCAL', 'CLOUD']);
assert.equal(readiness.vocabulary.executionPreference.automaticOrArbitraryValueAllowed, false);
assert.equal(readiness.vocabulary.executionPreference.isResolvedPlacement, false);
assert.deepEqual(
  readiness.vocabulary.resolvedExecutionTarget.values,
  ['client_local', 'managed_sandbox'],
);
assert.equal(readiness.vocabulary.resolvedExecutionTarget.serverOwned, true);
assert.equal(readiness.vocabulary.resolvedExecutionTarget.clientMaySet, false);
assert.deepEqual(readiness.vocabulary.runtimeRole.values, [
  'gateway',
  'coordinator',
  'worker',
]);
assert.deepEqual(readiness.vocabulary.fallbackPolicy.values, ['none', 'before_start_only']);
assert.equal(readiness.vocabulary.fallbackPolicy.afterSideEffectFallbackAllowed, false);
assert.equal(readiness.vocabulary.dataResidency.localExecutionAloneImpliesDeviceOnlyResidency, false);
assert.equal(readiness.vocabulary.dataResidency.allDataLocalClaimRequiresDeviceLocalAgentsAuthority, true);
assert.equal(readiness.vocabulary.dataResidency.implicitCrossResidencyReplicationAllowed, false);
assert.equal(readiness.vocabulary.placementLease.leaseCredentialNeverLeavesKernel, true);
assert.equal(readiness.vocabulary.placementLease.agentsPersistsLeaseCredential, false);
assert.equal(readiness.candidateAgentsPlacementPort.responseFields.includes('leaseToken'), false);
assert.equal(readiness.candidateAgentsPlacementPort.responseFields.includes('leaseId'), true);
assert.equal(readiness.vocabulary.clientRuntimeTarget.isExecutionTarget, false);
assert.equal(readiness.vocabulary.deploymentProfile.isPerSessionChoice, false);
assert.equal(readiness.vocabulary.coordinationMode.isExecutionTarget, false);
assert.equal(readiness.vocabulary.runtimeBinding.clientMayCreatePlacementBinding, false);
assert.equal(
  readiness.vocabulary.runtimeBinding.clientMayWriteRuntimeLocationHostOrTransport,
  false,
);
assert.equal(
  readiness.vocabulary.runtimeBinding.currentLocalPreLaunchTransition
    .birdcoderCreatesCombinedRuntimeBinding,
  true,
);
assert.equal(
  readiness.vocabulary.runtimeBinding.currentLocalPreLaunchTransition
    .mayBeUsedAsCloudPlacementEvidence,
  false,
);
assert.equal(readiness.capabilityNegotiation.authority, 'sdkwork-agents');
assert.equal(readiness.capabilityNegotiation.deploymentProfileInferenceAllowed, false);
assert.equal(readiness.capabilityNegotiation.clientRuntimeInferenceAllowed, false);
assert.equal(
  readiness.capabilityNegotiation.buildTimeBooleanAcceptedAsCommercialEvidence,
  false,
);
assert.deepEqual(readiness.dependencyDirection, [
  'sdkwork-birdcoder -> sdkwork-agents -> sdkwork-kernel -> sdkwork-sandbox',
  'sdkwork-birdcoder -/-> sdkwork-kernel',
  'sdkwork-birdcoder -/-> sdkwork-sandbox',
  'sdkwork-agents -/-> sdkwork-sandbox',
  'sdkwork-sandbox -/-> sdkwork-kernel',
  'sdkwork-sandbox -/-> sdkwork-agents',
]);

for (const authorityPath of readiness.authorityEvidence) {
  assert.equal(
    fs.existsSync(path.resolve(root, authorityPath)),
    true,
    `Hybrid execution authority is missing: ${authorityPath}`,
  );
}

const releaseGates = new Map(
  readiness.releaseGates.map((gate) => [gate.id, gate.status]),
);
assert.equal(releaseGates.get('HXE-001'), 'done');
assert.equal(releaseGates.get('HXE-002'), 'done');
for (const gateId of ['HXE-003', 'HXE-004', 'HXE-005', 'HXE-006']) {
  assert.match(
    releaseGates.get(gateId) ?? '',
    /^blocked-/,
    `${gateId} must remain blocked until its protected authority is approved and proven.`,
  );
}

assert.deepEqual(
  readiness.humanReview.requiredDecisions.map((decision) => decision.id),
  [
    'HXR-001',
    'HXR-002',
    'HXR-003',
    'HXR-004',
    'HXR-005',
    'HXR-006',
    'HXR-007',
    'HXR-008',
    'HXR-009',
  ],
);
for (const decision of readiness.humanReview.requiredDecisions) {
  assert.equal(decision.status, 'pending-human-review');
  assert.ok(decision.owner.length > 0);
  assert.ok(decision.decision.length > 0);
}

assert.equal(
  readiness.humanReview.entryReview,
  'docs/engineering/reviews/REVIEW-20260730-hybrid-execution-commercial-gate.md',
);
const reviewDecisionSection = birdcoderReview.match(
  /## Decisions Requiring Explicit Approval(?<body>[\s\S]*?)## Required Owner Review Chain/u,
);
assert.ok(reviewDecisionSection?.groups?.body, 'The human-review decision table is missing.');
const documentedReviewDecisionIds = [
  ...reviewDecisionSection.groups.body.matchAll(/^\| (HXR-\d{3}) \|/gmu),
].map((match) => match[1]);
assert.deepEqual(
  documentedReviewDecisionIds,
  readiness.humanReview.requiredDecisions.map((decision) => decision.id),
  'The human-review decision ids must exactly match the machine authority.',
);
for (const decision of readiness.humanReview.requiredDecisions) {
  const decisionRow = `| ${decision.id} | ${decision.decision} | ${decision.owner} | ${decision.status} |`;
  assert.ok(
    reviewDecisionSection.groups.body.includes(decisionRow),
    `The human-review decision row has drifted from the machine authority: ${decision.id}`,
  );
}

assert.equal(sandboxPool.status, 'draft');
assert.equal(sandboxPool.implementationAuthorized, false);
assert.equal(sandboxPool['x-sdkwork-no-runtime-implementation'], true);
assert.match(kernelDistributedRuntime, /^Status: draft$/mu);

assert.doesNotMatch(
  agentsAppOpenApi,
  /^\s+executionPreference:/mu,
  'The readiness gate must be revised when the reviewed Agents executionPreference API lands.',
);
assert.doesNotMatch(
  agentsTurnRuntime,
  /runtime_location_id/,
  'The readiness gate must be revised when turn execution consumes a resolved placement.',
);

assert.doesNotMatch(runModeSelector, /NewTaskHostMode/);
assert.match(runModeSelector, /NewTaskExecutionTarget = 'LOCAL' \| 'CLOUD'/);
assert.match(codePage, /CLOUD_SANDBOX_EXECUTION_CAPABILITY_PROVEN = false/);
assert.match(
  projectsHook,
  /options\.executionTarget === 'CLOUD'[\s\S]*AgentSessionExecutionTargetUnavailableError/,
);
assert.match(
  projectsHook,
  /resolveProjectRuntimeLocationExecutionId[\s\S]*runtimeLocationId[\s\S]*createRuntimeBinding\([\s\S]*runtimeLocationId/,
);

console.log('hybrid execution commercial readiness contract passed (status: blocked)');
