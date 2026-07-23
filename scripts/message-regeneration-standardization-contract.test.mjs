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
  /export async function regenerateWorkbenchAgentSessionFromLastUserItem\(/,
  'Workbench Agents integration must expose a shared regenerateWorkbenchAgentSessionFromLastUserItem helper so regenerate behavior is standardized across surfaces.',
);

assert.match(
  agentSessionCreationSource,
  /regenerateTurnContext: WorkbenchAgentSessionTurnContext;/,
  'Regenerate helper must keep regenerateTurnContext typed as the canonical WorkbenchAgentSessionTurnContext instead of erasing it to unknown.',
);

assert.match(
  agentSessionCreationSource,
  /context\?: WorkbenchAgentSessionTurnContext,/,
  'Workbench regenerate and turn-submission boundaries must share the same canonical WorkbenchAgentSessionTurnContext type.',
);

assert.match(
  `${codePageSource}\n${studioPageSource}`,
  /regenerateWorkbenchAgentSessionFromLastUserItem\(/,
  'CodePage and StudioPage must reuse the shared regenerateWorkbenchAgentSessionFromLastUserItem helper instead of maintaining divergent local regenerate flows.',
);

assert.doesNotMatch(
  `${codePageSource}\n${studioPageSource}`,
  /lastUserMsgIndex|userMessages = agentSession\.messages\.filter|lastUserItemIndex|userItems = agentSession\.items\.filter/,
  'CodePage and StudioPage must not inline last-user-item lookup logic once regenerateWorkbenchAgentSessionFromLastUserItem owns that behavior.',
);

console.log('agent session item regeneration standardization contract passed.');
