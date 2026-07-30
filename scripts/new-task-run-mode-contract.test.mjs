import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const readText = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const codePageSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
);
const runModeSelectorSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/NewTaskRunModeSelector.tsx',
);
const chatSelectionSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useWorkbenchChatSelection.ts',
);
const sessionCreationSource = readText(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/agentSessionCreation.ts',
);

assert.match(
  runModeSelectorSource,
  /selectExecutionTarget\('LOCAL'\)[\s\S]*selectExecutionTarget\('CLOUD'\)/,
  'The new-task header must offer both local and cloud run modes.',
);
assert.match(
  runModeSelectorSource,
  /role="menuitemradio"/,
  'Run-mode choices must expose single-selection menu semantics.',
);
assert.match(
  runModeSelectorSource,
  /disabled=\{!localExecutionAvailable\}[\s\S]*disabled=\{!cloudExecutionAvailable\}/,
  'Unavailable execution targets must fail closed in the selector.',
);
assert.match(
  codePageSource,
  /CLOUD_SANDBOX_EXECUTION_CAPABILITY_PROVEN = false/,
  'Cloud execution must remain unavailable until an Agents placement capability is proven.',
);
assert.match(
  runModeSelectorSource,
  /disabled=\{!localExecutionAvailable\}/,
  'Local mode must be unavailable when the app has no desktop runtime.',
);
assert.match(
  codePageSource,
  /requestedExecutionTarget:[\s\S]*currentAgentSessionId \? undefined : newTaskExecutionTarget/,
  'The selected local or cloud mode must reach implicit first-turn Session creation.',
);
assert.match(
  codePageSource,
  /prepareNewAgentSessionInProject[\s\S]*selectProjectWithoutAgentSession\(projectId\)/,
  'New task actions must open an uncommitted draft so run mode can be chosen before Session creation.',
);
assert.match(
  chatSelectionSource,
  /executionTarget:[\s\S]*options\?\.executionTarget \?\? resolveDefaultAgentSessionExecutionTarget\(\)/,
  'Execution target selection must remain independent from the client host mode.',
);
assert.match(
  sessionCreationSource,
  /request\.executionTarget \?\? ''/,
  'Local and cloud Session requests must use distinct in-flight creation keys.',
);

console.log('new task run mode contract passed.');
