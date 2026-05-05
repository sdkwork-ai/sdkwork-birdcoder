import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codeSurfacePropsSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts'),
  'utf8',
);
const codePageSource = fs.readFileSync(
  path.join(rootDir, 'packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx'),
  'utf8',
);

const tokenMatch = codeSurfacePropsSource.match(
  /const pendingInteractionRefreshToken = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]+\]\);/s,
);

assert.ok(
  tokenMatch,
  'Code surface props must derive pending interaction refresh through an isolated memoized token.',
);

const tokenSource = tokenMatch[0];

assert.doesNotMatch(
  tokenSource,
  /selectedCodingSessionMessages/,
  'Pending interaction projection refresh must not depend on the full selected message array or streaming message content changes.',
);

for (const fieldName of [
  'selectedSessionRuntimeStatus',
  'selectedSessionUpdatedAt',
  'selectedSessionLastTurnAt',
  'selectedSessionTranscriptUpdatedAt',
]) {
  assert.match(
    tokenSource,
    new RegExp(fieldName),
    `Pending interaction refresh token must include ${fieldName} so session-level runtime transitions still refresh pending cards.`,
  );
}

assert.match(
  tokenSource,
  /isChatBusy \? 'busy' : 'idle'/,
  'Pending interaction refresh token should include coarse busy/idle transitions without reacting to every streamed token.',
);

assert.match(
  codePageSource,
  /selectedSessionRuntimeStatus: selectedCodingSession\?\.runtimeStatus,/,
  'CodePage must pass selected session runtime status into the pending interaction refresh token path.',
);

assert.match(
  codePageSource,
  /selectedSessionTranscriptUpdatedAt: selectedCodingSession\?\.transcriptUpdatedAt,/,
  'CodePage must pass selected session transcript timestamp into the pending interaction refresh token path.',
);

console.log('coding session pending interaction refresh token performance contract passed.');
