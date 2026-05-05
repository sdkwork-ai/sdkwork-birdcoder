import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectionHookPath = path.join(
  process.cwd(),
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useCodingSessionProjection.ts',
);

const source = fs.readFileSync(projectionHookPath, 'utf8');

function readFunctionBody(functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} must exist.`);
  const nextExport = source.indexOf('\nexport function ', start + 1);
  assert.notEqual(nextExport, -1, `${functionName} must be followed by an exported function.`);
  return source.slice(start, nextExport);
}

function readExportedFunctionBody(functionName) {
  const start = source.indexOf(`export function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} must exist.`);
  const nextExport = source.indexOf('\nexport function ', start + 1);
  assert.notEqual(nextExport, -1, `${functionName} must be followed by another exported function.`);
  return source.slice(start, nextExport);
}

const deriveApprovalsSource = readExportedFunctionBody('deriveCodingSessionPendingApprovals');

assert.match(
  source,
  /function buildPendingApprovalDerivationIndex\(/,
  'Pending approval derivation must build one reusable event/artifact index per projection refresh.',
);

assert.match(
  source,
  /function resolvePendingApprovalEvent\(/,
  'Pending approval derivation must resolve approval events through indexed identity lookups.',
);

assert.match(
  source,
  /function resolvePendingApprovalArtifactIds\(/,
  'Pending approval derivation must resolve related artifacts through indexed turn and operation lookups.',
);

assert.match(
  deriveApprovalsSource,
  /const pendingApprovalIndex = buildPendingApprovalDerivationIndex\(projection\);/,
  'deriveCodingSessionPendingApprovals must build the pending approval index once before iterating checkpoints.',
);

assert.doesNotMatch(
  deriveApprovalsSource,
  /eventsByLatest\.find\(/,
  'deriveCodingSessionPendingApprovals must not rescan all events for every approval checkpoint.',
);

assert.doesNotMatch(
  deriveApprovalsSource,
  /projection\.artifacts\s*\.find\(/,
  'deriveCodingSessionPendingApprovals must not rescan all artifacts to derive the operation id for every approval checkpoint.',
);

assert.doesNotMatch(
  deriveApprovalsSource,
  /projection\.artifacts\s*\.filter\(/,
  'deriveCodingSessionPendingApprovals must not rescan all artifacts to derive artifact ids for every approval checkpoint.',
);

const artifactResolverSource = readFunctionBody('resolvePendingApprovalArtifactIds');
assert.match(
  artifactResolverSource,
  /artifactIdsByTurnId/,
  'Approval artifact lookup must use a precomputed turn-id index.',
);
assert.match(
  artifactResolverSource,
  /artifactIdsByOperationId/,
  'Approval artifact lookup must use a precomputed operation-id index.',
);

console.log('coding session pending approval index performance contract passed.');
