import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const projectionHookSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts'),
  'utf8',
);

function countMatches(pattern) {
  return [...projectionHookSource.matchAll(pattern)].length;
}

assert.equal(
  countMatches(/const latestCodingSessionIdRef = useRef<string \| null>\(null\);/g),
  4,
  'Each coding-session projection hook must track the active codingSessionId independently from refresh tokens.',
);

assert.equal(
  countMatches(
    /if \(!codingSessionId\) \{\s*latestRefreshTokenRef\.current \+= 1;\s*latestCodingSessionIdRef\.current = null;\s*setState\(/g,
  ),
  4,
  'A null codingSessionId must invalidate in-flight refreshes so stale session data cannot be republished after session/workspace deselection.',
);

assert.equal(
  countMatches(
    /const didSwitchCodingSession = latestCodingSessionIdRef\.current !== codingSessionId;\s*latestCodingSessionIdRef\.current = codingSessionId;\s*const refreshToken = latestRefreshTokenRef\.current \+ 1;/g,
  ),
  4,
  'Each projection hook must detect session switches before starting the async load.',
);

assert.match(
  projectionHookSource,
  /didSwitchCodingSession\s*\?\s*\{\s*\.\.\.EMPTY_PROJECTION,\s*isLoading: true,\s*\}/,
  'Projection refresh must clear the previous session projection while loading a different session.',
);

assert.match(
  projectionHookSource,
  /didSwitchCodingSession\s*\?\s*\{\s*approvals: EMPTY_APPROVALS,\s*isLoading: true,\s*\}/,
  'Approval refresh must clear previous-session approvals while loading a different session.',
);

assert.match(
  projectionHookSource,
  /didSwitchCodingSession\s*\?\s*\{\s*\.\.\.EMPTY_PENDING_INTERACTIONS,\s*isLoading: true,\s*\}/,
  'Combined pending interaction refresh must clear previous-session pending interactions while loading a different session.',
);

assert.match(
  projectionHookSource,
  /didSwitchCodingSession\s*\?\s*\{\s*questions: EMPTY_USER_QUESTIONS,\s*isLoading: true,\s*\}/,
  'User-question refresh must clear previous-session questions while loading a different session.',
);

assert.match(
  projectionHookSource,
  /const visibleState =\s*codingSessionId && latestCodingSessionIdRef\.current === codingSessionId\s*\?\s*state\s*:\s*INITIAL_STATE;/,
  'Projection hook must hide stale state during the render that happens before the session-switch effect runs.',
);

assert.match(
  projectionHookSource,
  /const visibleState =\s*codingSessionId && latestCodingSessionIdRef\.current === codingSessionId\s*\?\s*state\s*:\s*INITIAL_APPROVAL_STATE;/,
  'Approval hook must hide stale approvals during the render that happens before the session-switch effect runs.',
);

assert.match(
  projectionHookSource,
  /const visibleState =\s*codingSessionId && latestCodingSessionIdRef\.current === codingSessionId\s*\?\s*state\s*:\s*INITIAL_PENDING_INTERACTION_STATE;/,
  'Pending interaction hook must hide stale interactions during the render that happens before the session-switch effect runs.',
);

assert.match(
  projectionHookSource,
  /const visibleState =\s*codingSessionId && latestCodingSessionIdRef\.current === codingSessionId\s*\?\s*state\s*:\s*INITIAL_USER_QUESTION_STATE;/,
  'User-question hook must hide stale questions during the render that happens before the session-switch effect runs.',
);

assert.equal(
  countMatches(/return \{\s*\.\.\.visibleState,/g),
  4,
  'Projection hooks must return the session-guarded visible state instead of raw stale hook state.',
);

console.log('coding session projection session switch contract passed.');
