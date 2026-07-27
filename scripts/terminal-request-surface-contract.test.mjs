import assert from 'node:assert/strict';
import fs from 'node:fs';

import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const runtimeSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runtime.ts');
const requestsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/requests.ts');
const runConfigsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runConfigs.ts');
const terminalLaunchSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/sdkworkTerminalLaunch.ts');
const terminalSessionsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/sessions.ts');
const tauriTerminalRuntimeSource = read('../crates/sdkwork-birdcoder-tauri-host/src/host/terminal_runtime.rs');
const codeWorkbenchCommandsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts');
const terminalActionsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageTerminalActions.ts');
const studioBindingsSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/useStudioWorkbenchEventBindings.ts');
const fileExplorerSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/FileExplorer.tsx');
const projectRuntimeLocationServiceSource = read('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeProjectRuntimeLocationService.ts');
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
  /resolveProjectRuntimeLocation\(project, \{[\s\S]*allowFolderSelection,[\s\S]*capability: 'terminal'/,
  'Terminal launch must resolve a device-local runtime location from the project input.',
);
assert.match(
  terminalActionsSource,
  /emitOpenTerminalRequest\(\{[\s\S]*surface: 'project'[\s\S]*path: localWorkingDirectory/,
  'Project terminal launch must use the resolved local directory.',
);
assert.match(
  terminalActionsSource,
  /resolveBirdcoderWorkbenchHostMode\(\) === 'web'[\s\S]*emitOpenTerminalRequest\(\{\s*surface: 'project',[\s\S]*timestamp: Date\.now\(\),\s*\}\);/,
  'Browser project terminal launch must switch to the project terminal without invoking local folder resolution.',
);
assert.match(
  terminalActionsSource,
  /resolveTerminalWorkingDirectory\(target, false\)/,
  'Tauri project terminal launch must pass the normalized project target without allowing folder selection.',
);
assert.doesNotMatch(
  terminalActionsSource,
  /resolveTerminalWorkingDirectory\([^)]*, true\)/,
  'Terminal actions must never implicitly open a folder picker after a project has been selected.',
);
assert.match(
  appSource,
  /const handleOpenProjectTerminal = async \(target: ProjectDeviceMountTarget\) => \{[\s\S]*resolveBirdcoderWorkbenchHostMode\(\) === 'web'[\s\S]*emitOpenTerminalRequest\(\{\s*surface: 'project',[\s\S]*timestamp: Date\.now\(\),\s*\}\);[\s\S]*allowFolderSelection: false,[\s\S]*path: resolution\.location\.localWorkingDirectory/,
  'File-explorer project terminal actions must use the remote project target in Browser and the recorded absolute path in Tauri.',
);
const shellProjectTerminalHandler = appSource.match(
  /const handleOpenProjectTerminal = async[\s\S]*?const handleRevealProjectInFileManager/,
)?.[0] ?? '';
assert.doesNotMatch(
  shellProjectTerminalHandler,
  /allowFolderSelection: true/,
  'File-explorer project terminal actions must never open an implicit folder picker.',
);
assert.match(
  appSource,
  /projectRuntimeLocationService\.revealProjectInFileManager\(target\)/,
  'File-manager project actions must use the canonical project runtime-location service.',
);
assert.match(
  projectRuntimeLocationServiceSource,
  /async revealProjectInFileManager\([\s\S]*?resolveProjectLocalWorkingDirectory\(target, \{[\s\S]*?allowFolderSelection: false,[\s\S]*?capability: 'file_system'/,
  'Project reveal must recover a persisted local path without opening a folder picker.',
);
assert.doesNotMatch(
  requestsSource,
  /'workspace'/,
  'The terminal request contract must not reintroduce the retired Workspace domain term.',
);
assert.doesNotMatch(
  terminalLaunchSource,
  /workspaceId|workspace_id/,
  'BirdCoder terminal launch plans must carry the canonical Agents projectId and must not author a second Workspace identifier.',
);
assert.match(
  terminalLaunchSource,
  /projectId: metadata\.projectId \?\? null/,
  'BirdCoder terminal launch metadata must forward the canonical Agents projectId.',
);
assert.match(
  terminalSessionsSource,
  /projectId: readSessionTag\(record\.tags, 'project:'\)/,
  'Terminal inventory must recover Agents projectId from the explicit project tag, not from terminal multiplexing scope.',
);
assert.match(
  tauriTerminalRuntimeSource,
  /const LOCAL_TERMINAL_MULTIPLEXING_SCOPE: &str = "workspace-local";/,
  'The Tauri host must keep the dependency protocol scope fixed and explicitly separate from Agents Project identity.',
);
assert.match(
  tauriTerminalRuntimeSource,
  /project_id: session_tag_value\(&session\.tags, "project"\)\.unwrap_or_default\(\)/,
  'The Tauri terminal inventory must recover project identity only from the canonical project tag.',
);
assert.match(
  terminalActionsSource,
  /const handleCopyProviderSessionId = useCallback\(async \([\s\S]*const location = resolveSessionActionLocation\(agentSessionId, projectId\);[\s\S]*const providerSessionId = location\?\.agentSession\.providerSessionId\?\.trim\(\) \?\? '';[\s\S]*copyTextToClipboard\(providerSessionId\)/,
  'Provider Session ID copy must locate the canonical Agents Session and copy its persisted providerSessionId.',
);
assert.doesNotMatch(
  terminalActionsSource,
  /copyTextToClipboard\(agentSessionId\)/,
  'Provider Session ID copy must not copy the SDKWork Agents Session id.',
);
assert.doesNotMatch(
  terminalActionsSource,
  /appRuntimeReadService|CodingSession|codingSession/,
  'Terminal actions must not depend on a retired BirdCoder session authority.',
);

assert.match(
  fileExplorerSource,
  /const resolveProjectMountTarget = \(mountedPath\?: string\) => \{[\s\S]*resolveProjectDeviceMountTarget\(\{ projectId, mountedPath \}\)/,
  'File explorer actions must normalize project and mounted-path identity through the shared target entrypoint.',
);
assert.doesNotMatch(
  fileExplorerSource,
  /emitOpenTerminalRequest|projectBasePath|targetPath/,
  'File explorer must not construct terminal requests or expose host paths directly.',
);

console.log('terminal request surface contract passed.');
