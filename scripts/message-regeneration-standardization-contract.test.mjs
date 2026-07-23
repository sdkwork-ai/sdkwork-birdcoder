import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const agentSessionCreationSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-workbench',
  'src',
  'workbench',
  'agentSessionCreation.ts',
);
const codePageSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const studioPageSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);

assert.match(
  agentSessionCreationSource,
  /export async function regenerateWorkbenchAgentSessionFromLastUserMessage\(/,
  'Workbench messaging must expose a shared regenerateWorkbenchAgentSessionFromLastUserMessage helper so regenerate behavior is standardized across surfaces.',
);

assert.match(
  agentSessionCreationSource,
  /regenerateMessageContext: AgentSessionTurnIdeContext;/,
  'Regenerate helper must keep regenerateMessageContext typed as the canonical AgentSessionTurnIdeContext instead of erasing it to unknown.',
);

assert.match(
  agentSessionCreationSource,
  /context\?: AgentSessionTurnIdeContext,/,
  'Workbench regenerate/send message boundaries must share the same canonical AgentSessionTurnIdeContext type.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /regenerateWorkbenchAgentSessionFromLastUserMessage\(/,
  'CodePage and StudioPage must reuse the shared regenerateWorkbenchAgentSessionFromLastUserMessage helper instead of maintaining divergent local regenerate flows.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /lastUserMsgIndex|userMessages = agentSession\.messages\.filter/,
  'CodePage and StudioPage must not inline last-user-message lookup logic once regenerateWorkbenchAgentSessionFromLastUserMessage owns that behavior.',
);

console.log('message regeneration standardization contract passed.');
