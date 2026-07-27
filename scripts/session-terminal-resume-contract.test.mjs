import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const sessionMenuSource = read(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerSessionContextMenu.tsx',
);
const sidebarSource = read(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx',
);
const terminalActionsSource = read(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageTerminalActions.ts',
);
const codePageSource = read(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
);
const appMainBodySource = read(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppMainBody.tsx',
);

assert.match(
  sessionMenuSource,
  /onOpenInTerminal\?\.\(sessionId, projectId\);[\s\S]*t\('code\.openInTerminal'\)/u,
  'Session context menus must expose Open in Terminal for the selected session.',
);
assert.match(
  sidebarSource,
  /onOpenInTerminal=\{onOpenAgentSessionInTerminal\}/u,
  'The sidebar must forward the session terminal action into the context menu.',
);
assert.match(
  terminalActionsSource,
  /resolveAgentSessionTerminalResume\(location\.agentSession\)/u,
  'Session terminal actions must resolve commands through the provider adapter.',
);
assert.doesNotMatch(
  terminalActionsSource,
  /sessionNativeIdUnavailable|missing-provider-session-id/u,
  'Persisted provider Session identity must not be modeled as a transient readiness state.',
);
assert.match(
  terminalActionsSource,
  /emitOpenTerminalRequest\(\{[\s\S]*agentSessionId: location\.agentSession\.id,[\s\S]*command: resumeResolution\.command,[\s\S]*projectId: target\.projectId,[\s\S]*runtimeLocationId: location\.agentSession\.runtimeLocationId,[\s\S]*surface: 'project'/u,
  'Session terminal requests must carry the command and exact Agents runtime target.',
);
assert.match(
  codePageSource,
  /onOpenAgentSessionInTerminal: handleOpenAgentSessionInTerminal/u,
  'The Code page must wire the provider-aware session terminal action to Project Explorer.',
);
assert.match(
  appMainBodySource,
  /terminalRequest\?\.projectId\?\.trim\(\) \|\| projectId[\s\S]*terminalRequest\?\.runtimeLocationId\?\.trim\(\) \|\| runtimeLocationId/u,
  'The terminal surface must prefer the request target over the previously selected project.',
);

console.log('session terminal resume contract passed.');
