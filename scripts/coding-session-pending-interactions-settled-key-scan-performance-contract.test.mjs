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
  assert.ok(endCandidates.length > 0, `${functionName} must have a readable body.`);
  return source.slice(start, Math.min(...endCandidates));
}

assert.match(
  source,
  /interface PendingInteractionSettledKeys \{/,
  'Combined pending interaction derivation must expose one settled-key payload for approvals and user questions.',
);

assert.match(
  source,
  /function deriveSettledPendingInteractionKeys\(/,
  'Combined pending interaction derivation must derive approval and user-question settled keys in one event scan.',
);

const combinedSettledSource = readFunctionBody('deriveSettledPendingInteractionKeys');
assert.match(
  combinedSettledSource,
  /for \(const event of events\)/,
  'Combined settled-key derivation must scan the event list once.',
);
assert.match(
  combinedSettledSource,
  /const args = readEventToolArguments\(event\);/,
  'Combined settled-key derivation must parse event tool arguments once per event.',
);
assert.doesNotMatch(
  combinedSettledSource,
  /deriveSettledUserQuestionKeys\(/,
  'Combined settled-key derivation must not delegate to the standalone user-question scan.',
);
assert.doesNotMatch(
  combinedSettledSource,
  /deriveSettledApprovalKeys\(/,
  'Combined settled-key derivation must not delegate to the standalone approval scan.',
);

const sharedIndexSource = readFunctionBody('buildPendingInteractionDerivationIndex');
assert.match(
  sharedIndexSource,
  /const settledKeys = deriveSettledPendingInteractionKeys\(projection\.events\);/,
  'The shared pending interaction index must reuse the one-pass settled-key derivation.',
);
assert.doesNotMatch(
  sharedIndexSource,
  /deriveSettledApprovalKeys\(projection\.events\)/,
  'The shared pending interaction index must not separately scan approval settled keys.',
);
assert.doesNotMatch(
  sharedIndexSource,
  /deriveSettledUserQuestionKeys\(projection\.events\)/,
  'The shared pending interaction index must not separately scan user-question settled keys.',
);

console.log('coding session pending interactions settled-key scan performance contract passed.');
