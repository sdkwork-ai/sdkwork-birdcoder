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
const codeSurfacePropsSource = readText(
  'packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts',
);
const codePageSource = readText('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx');
const studioPageSource = readText('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx');

assert.match(
  projectionHookSource,
  /export function useCodingSessionApprovalState\(\s*codingSessionId\?: string \| null,\s*refreshToken\?: string \| number \| null,/s,
  'Approval projection hook must accept a refresh token so same-session runtime transitions refresh pending approval state.',
);

assert.match(
  projectionHookSource,
  /export function useCodingSessionUserQuestionState\(\s*codingSessionId\?: string \| null,\s*refreshToken\?: string \| number \| null,/s,
  'User-question projection hook must accept a refresh token so same-session runtime transitions refresh pending question state.',
);

assert.match(
  projectionHookSource,
  /useEffect\(\(\) => \{\s*void refreshApprovals\(\);\s*\}, \[refreshApprovals, refreshToken\]\);/s,
  'Approval hook must refresh when the external refresh token changes.',
);

assert.match(
  projectionHookSource,
  /useEffect\(\(\) => \{\s*void refreshQuestions\(\);\s*\}, \[refreshQuestions, refreshToken\]\);/s,
  'User-question hook must refresh when the external refresh token changes.',
);

assert.match(
  codePendingInteractionsSource,
  /refreshToken\?: string \| number \| null[\s\S]*useCodingSessionPendingInteractionState\(sessionId, refreshToken\)/,
  'Code pending interaction hook must pass the surface refresh token into the combined projection hook.',
);

assert.match(
  codeSurfacePropsSource,
  /const pendingInteractionRefreshToken = useMemo\([\s\S]*selectedCodingSessionMessages[\s\S]*isChatBusy[\s\S]*useCodePendingInteractions\(\{[\s\S]*refreshToken: pendingInteractionRefreshToken,/,
  'Code surface props must derive a pending interaction refresh token from transcript and busy state without growing CodePage.',
);

assert.doesNotMatch(
  codePageSource,
  /pendingInteractionRefreshToken|selectedSessionActivityToken/,
  'CodePage must not own pending interaction reactivity plumbing.',
);

assert.match(
  studioPageSource,
  /const pendingInteractionRefreshToken = useMemo\([\s\S]*selectedSession\?\.runtimeStatus[\s\S]*selectedSession\?\.updatedAt[\s\S]*useCodingSessionPendingInteractionState\(sessionId \|\| null, pendingInteractionRefreshToken\)/,
  'StudioPage must refresh pending interactions when the selected session runtime or timestamps change.',
);

console.log('coding session pending interactions reactivity contract passed.');
