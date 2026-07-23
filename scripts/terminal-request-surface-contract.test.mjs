import assert from 'node:assert/strict';
import fs from 'node:fs';

import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const runtimeSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runtime.ts');
const requestsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/requests.ts');
const runConfigsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runConfigs.ts');
const codeWorkbenchCommandsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts');
const terminalActionsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageTerminalActions.ts');
const studioBindingsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/useStudioWorkbenchEventBindings.ts');
const fileExplorerSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx');
const appSource = readBirdcoderAppShellSource();

assert.match(
  requestsSource,
  /export type TerminalCommandSurface = 'project' \| 'embedded';/,
  'Terminal requests must distinguish project and embedded destinations.',
);
assert.match(
  requestsSource,
  /export interface TerminalCommandRequest \{[\s\S]*surface: TerminalCommandSurface;[\s\S]*timestamp: number;[\s\S]*\}/,
  'Every terminal request must carry an explicit surface and timestamp.',
);
assert.match(
  requestsSource,
  /surface: overrides\.surface \?\? 'project'/,
  'Default terminal requests must target the selected-project terminal.',
);
assert.match(
  runtimeSource,
  /export \{[\s\S]*buildDefaultTerminalCommandRequest,[\s\S]*emitOpenTerminalRequest,[\s\S]*type TerminalCommandRequest,[\s\S]*type TerminalCommandSurface,[\s\S]*\} from '\.\/requests\.ts';/,
  'The terminal runtime must re-export one canonical request contract.',
);
assert.match(
  appSource,
  /const isProjectTerminalRequest = \(request: TerminalCommandRequest\): boolean =>\s*request\.surface === 'project';/,
  'The application shell must accept only project terminal requests.',
);
assert.match(
  codeWorkbenchCommandsSource,
  /if \(request\.surface !== 'embedded'\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(request\);[\s\S]*setIsTerminalOpen\(true\);/,
  'The Code workbench must accept only embedded terminal requests.',
);
assert.match(
  studioBindingsSource,
  /if \(request\.surface !== 'embedded'\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(request\);[\s\S]*setIsTerminalOpen\(true\);/,
  'The Studio workbench must accept only embedded terminal requests.',
);
assert.match(runConfigsSource, /surface: 'embedded'/);

assert.match(
  terminalActionsSource,
  /resolveProjectRuntimeLocation\(projectId, \{[\s\S]*capability: 'terminal'/,
  'Terminal launch must resolve a device-local runtime location.',
);
assert.match(
  terminalActionsSource,
  /emitOpenTerminalRequest\(\{[\s\S]*surface: 'project'[\s\S]*path: localWorkingDirectory/,
  'Project terminal launch must use the resolved local directory.',
);
assert.doesNotMatch(
  requestsSource,
  /'workspace'/,
  'The terminal request contract must not reintroduce the retired Workspace domain term.',
);
assert.match(
  terminalActionsSource,
  /const handleCopySessionId = useCallback\(async \(agentSessionId: string\) => \{[\s\S]*const normalizedAgentSessionId = agentSessionId\.trim\(\);[\s\S]*copyTextToClipboard\(normalizedAgentSessionId\)/,
  'Session ID copy must use the canonical Agents Session id already loaded in memory.',
);
assert.doesNotMatch(
  terminalActionsSource,
  /appRuntimeReadService|CodingSession|codingSession/,
  'Terminal actions must not depend on a retired BirdCoder session authority.',
);

assert.match(
  fileExplorerSource,
  /const resolveProjectMountTarget = \(mountedPath\?: string\) => \{[\s\S]*projectId: normalizedProjectId,[\s\S]*mountedPath/,
  'File explorer terminal actions must preserve project and mounted-path identity.',
);
assert.doesNotMatch(
  fileExplorerSource,
  /emitOpenTerminalRequest|projectBasePath|targetPath/,
  'File explorer must not construct terminal requests or expose host paths directly.',
);

console.log('terminal request surface contract passed.');
