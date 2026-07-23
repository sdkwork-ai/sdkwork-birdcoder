import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codeSurfacePropsSource = fs.readFileSync(
  path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageSurfaceProps.ts'),
  'utf8',
);
const codePageSource = fs.readFileSync(
  path.join(rootDir, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx'),
  'utf8',
);

const tokenMatch = codeSurfacePropsSource.match(
  /const pendingInteractionRefreshToken = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]+\]\);/s,
);

assert.ok(
  tokenMatch,
  'Code surface props must derive the Agents Interaction refresh through an isolated memoized token.',
);

const tokenSource = tokenMatch[0];

assert.doesNotMatch(
  tokenSource,
  /selectedAgentSessionItems/,
  'Agents Interaction refresh must not depend on the full Session Item array or streamed content changes.',
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
    `Agents Interaction refresh must include ${fieldName} so session lifecycle transitions refresh pending controls.`,
  );
}

assert.match(
  tokenSource,
  /isChatBusy \? 'busy' : 'idle'/,
  'Agents Interaction refresh should include coarse busy/idle transitions without reacting to every streamed token.',
);

assert.match(
  codePageSource,
  /selectedSessionRuntimeStatus: selectedAgentSession\?\.runtimeStatus,/,
  'CodePage must pass the canonical Agents Session runtime status into interaction refresh.',
);

assert.match(
  codePageSource,
  /selectedSessionTranscriptUpdatedAt: selectedAgentSession\?\.transcriptUpdatedAt,/,
  'CodePage must pass the canonical Agents Session Item activity timestamp into interaction refresh.',
);

console.log('agent session interaction refresh performance contract passed.');
