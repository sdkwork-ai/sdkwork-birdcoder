import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const projectionHookSource = readText(
  'packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts',
);
const codePendingInteractionsSource = readText(
  'packages/sdkwork-birdcoder-code/src/pages/useCodePendingInteractions.ts',
);
const studioPageSource = readText('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx');

assert.match(
  projectionHookSource,
  /export interface BirdCoderCodingSessionPendingInteractions \{[\s\S]*approvals: BirdCoderCodingSessionPendingApproval\[\];[\s\S]*questions: BirdCoderCodingSessionPendingUserQuestion\[\];[\s\S]*\}/,
  'Coding session projection must define a combined pending interaction payload for approvals and user questions.',
);

assert.match(
  projectionHookSource,
  /export interface BirdCoderCodingSessionPendingInteractionState\s*extends BirdCoderCodingSessionPendingInteractions \{[\s\S]*isLoading: boolean;[\s\S]*\}/,
  'Coding session projection must define a combined pending interaction hook state.',
);

assert.match(
  projectionHookSource,
  /export async function loadCodingSessionPendingInteractionState\([\s\S]*const projection = await loadCodingSessionProjection\(coreReadService, codingSessionId\);[\s\S]*approvals: deriveCodingSessionPendingApprovals\(projection\),[\s\S]*questions: deriveCodingSessionPendingUserQuestions\(projection\),/,
  'Combined pending interaction loader must load the session projection once and derive both approvals and questions from it.',
);

assert.match(
  projectionHookSource,
  /export function useCodingSessionPendingInteractionState\(\s*codingSessionId\?: string \| null,\s*refreshToken\?: string \| number \| null,/s,
  'Combined pending interaction hook must accept the same refresh-token standard as projection hooks.',
);

assert.match(
  projectionHookSource,
  /const refreshPendingInteractions = useCallback\([\s\S]*loadCodingSessionPendingInteractionState\(\s*coreReadService,\s*codingSessionId,\s*\)[\s\S]*useEffect\(\(\) => \{\s*void refreshPendingInteractions\(\);\s*\}, \[refreshPendingInteractions, refreshToken\]\);/s,
  'Combined pending interaction hook must refresh both interaction types through one projection read when the refresh token changes.',
);

assert.match(
  projectionHookSource,
  /submitApprovalDecision[\s\S]*await refreshPendingInteractions\(\);[\s\S]*submitUserQuestionAnswer[\s\S]*await refreshPendingInteractions\(\);/s,
  'Combined pending interaction submissions must refresh the unified pending state after either approval or question actions.',
);

assert.match(
  codePendingInteractionsSource,
  /useCodingSessionPendingInteractionState\(sessionId, refreshToken\)/,
  'Code pending interactions must use the combined projection hook.',
);

assert.doesNotMatch(
  codePendingInteractionsSource,
  /useCodingSessionApprovalState|useCodingSessionUserQuestionState/,
  'Code pending interactions must not issue separate approval and user-question projection reads.',
);

assert.match(
  studioPageSource,
  /useCodingSessionPendingInteractionState\(sessionId \|\| null, pendingInteractionRefreshToken\)/,
  'StudioPage must use the combined pending interaction projection hook.',
);

assert.doesNotMatch(
  studioPageSource,
  /useCodingSessionApprovalState|useCodingSessionUserQuestionState/,
  'StudioPage must not issue separate approval and user-question projection reads.',
);

console.log('coding session pending interactions batch projection contract passed.');
