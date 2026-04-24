import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const codingSessionCreationSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'codingSessionCreation.ts',
);
const codePageSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const studioPageSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);

assert.match(
  codingSessionCreationSource,
  /export async function regenerateWorkbenchCodingSessionFromLastUserMessage\(/,
  'Workbench messaging must expose a shared regenerateWorkbenchCodingSessionFromLastUserMessage helper so regenerate behavior is standardized across surfaces.',
);

assert.match(
  codingSessionCreationSource,
  /regenerateMessageContext: BirdCoderCodingSessionTurnIdeContext;/,
  'Regenerate helper must keep regenerateMessageContext typed as the canonical BirdCoderCodingSessionTurnIdeContext instead of erasing it to unknown.',
);

assert.match(
  codingSessionCreationSource,
  /context\?: BirdCoderCodingSessionTurnIdeContext,/,
  'Workbench regenerate/send message boundaries must share the same canonical BirdCoderCodingSessionTurnIdeContext type.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /regenerateWorkbenchCodingSessionFromLastUserMessage\(/,
  'CodePage and StudioPage must reuse the shared regenerateWorkbenchCodingSessionFromLastUserMessage helper instead of maintaining divergent local regenerate flows.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /lastUserMsgIndex|userMessages = codingSession\.messages\.filter/,
  'CodePage and StudioPage must not inline last-user-message lookup logic once regenerateWorkbenchCodingSessionFromLastUserMessage owns that behavior.',
);

console.log('message regeneration standardization contract passed.');
