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
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  const nextExport = source.indexOf('\nexport ', start + 1);
  const endCandidates = [nextFunction, nextExport].filter((index) => index !== -1);
  assert.ok(endCandidates.length > 0, `${functionName} must have a readable function body.`);
  return source.slice(start, Math.min(...endCandidates));
}

function readExportedFunctionBody(functionName) {
  const start = source.indexOf(`export async function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} must exist.`);
  const nextExport = source.indexOf('\nexport ', start + 1);
  assert.notEqual(nextExport, -1, `${functionName} must be followed by another export.`);
  return source.slice(start, nextExport);
}

assert.match(
  source,
  /interface PendingInteractionDerivationIndex \{/,
  'Combined pending interaction derivation must expose one shared projection index.',
);

assert.match(
  source,
  /function buildPendingInteractionDerivationIndex\(/,
  'Combined pending interaction derivation must build a shared index once per projection refresh.',
);

assert.match(
  source,
  /function deriveCodingSessionPendingApprovalsFromIndex\(/,
  'Approval derivation must have an indexed path for combined pending interaction refreshes.',
);

assert.match(
  source,
  /function deriveCodingSessionPendingUserQuestionsFromIndex\(/,
  'User-question derivation must have an indexed path for combined pending interaction refreshes.',
);

const sharedIndexSource = readFunctionBody('buildPendingInteractionDerivationIndex');
assert.match(
  sharedIndexSource,
  /const eventsByChronology = \[\.\.\.projection\.events\]\s*\.sort\(compareCodingSessionEventChronology\);/s,
  'The shared pending interaction index should sort coding-session events once.',
);
assert.match(
  sharedIndexSource,
  /buildPendingApprovalDerivationIndex\(projection,\s*eventsByChronology\)/s,
  'The shared pending interaction index must feed the sorted event list into approval indexing.',
);

const loadSource = readExportedFunctionBody('loadCodingSessionPendingInteractionState');
assert.match(
  loadSource,
  /const pendingInteractionIndex = buildPendingInteractionDerivationIndex\(projection\);/,
  'Combined pending interaction loading must build the shared derivation index once.',
);
assert.match(
  loadSource,
  /approvals: deriveCodingSessionPendingApprovalsFromIndex\(projection,\s*pendingInteractionIndex\),/,
  'Combined pending interaction loading must derive approvals from the shared index.',
);
assert.match(
  loadSource,
  /questions: deriveCodingSessionPendingUserQuestionsFromIndex\(pendingInteractionIndex\),/,
  'Combined pending interaction loading must derive user questions from the shared index.',
);
assert.doesNotMatch(
  loadSource,
  /deriveCodingSessionPendingApprovals\(projection\)/,
  'Combined pending interaction loading must not invoke the standalone approval derivation because it rebuilds indexes.',
);
assert.doesNotMatch(
  loadSource,
  /deriveCodingSessionPendingUserQuestions\(projection\)/,
  'Combined pending interaction loading must not invoke the standalone user-question derivation because it resorts events.',
);

const indexedQuestionSource = readFunctionBody('deriveCodingSessionPendingUserQuestionsFromIndex');
assert.doesNotMatch(
  indexedQuestionSource,
  /\.sort\(compareCodingSessionEventChronology\)/,
  'Indexed user-question derivation must reuse the shared chronological event list instead of sorting events again.',
);
assert.match(
  indexedQuestionSource,
  /for \(const event of index\.eventsByChronology\)/,
  'Indexed user-question derivation must iterate the shared chronological event list.',
);

console.log('coding session pending interactions shared index performance contract passed.');
