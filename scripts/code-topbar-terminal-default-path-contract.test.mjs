import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePageSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const terminalActionsSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodePageTerminalActions.ts', import.meta.url),
  'utf8',
);
const appShellSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/src/application/app/birdcoderAppContent.tsx', import.meta.url),
  'utf8',
);
const appShellCreateTerminalStart = appShellSource.indexOf('const handleCreateTerminal = useCallback');
const appShellCreateTerminalEnd = appShellSource.indexOf(
  'const handleWorkspaceProjectPopoverClickOutside',
  appShellCreateTerminalStart,
);
const appShellCreateTerminalSource = appShellSource.slice(
  appShellCreateTerminalStart,
  appShellCreateTerminalEnd,
);

assert.ok(
  appShellCreateTerminalStart >= 0 && appShellCreateTerminalEnd > appShellCreateTerminalStart,
  'The application shell must keep a dedicated selected-project new-terminal action.',
);

assert.match(
  terminalActionsSource,
  /const resolveTerminalWorkingDirectory = useCallback\(async \([\s\S]*project: CodePageTerminalProjectLike,[\s\S]*allowFolderSelection: boolean,[\s\S]*await resolveProjectRuntimeLocation\(project, \{[\s\S]*allowFolderSelection,[\s\S]*capability: 'terminal',/,
  'Code page terminal actions must pass the project object and an explicit folder-selection policy to the injected runtime-location resolver.',
);

assert.match(
  terminalActionsSource,
  /const handleTopBarTerminalVisibilityChange = useCallback\(async \(nextIsOpen: boolean\) => \{[\s\S]*resolveBirdcoderWorkbenchHostMode\(\) === 'web'[\s\S]*setTerminalRequest\(\{\s*surface: 'embedded',\s*timestamp: Date\.now\(\),\s*\}\);[\s\S]*resolveTerminalWorkingDirectory\([\s\S]*currentProject,[\s\S]*false,[\s\S]*\)[\s\S]*setTerminalRequest\(\{\s*surface: 'embedded',\s*path: localWorkingDirectory,/,
  'Code page top bar terminal handler must use the remote project target in Browser and the recorded absolute path in Tauri without folder selection.',
);

const projectContextTerminalStart = terminalActionsSource.indexOf(
  'const handleOpenInTerminal = useCallback',
);
const projectContextTerminalEnd = terminalActionsSource.indexOf(
  'const handleOpenAgentSessionInTerminal = useCallback',
  projectContextTerminalStart,
);
const projectContextTerminalSource = terminalActionsSource.slice(
  projectContextTerminalStart,
  projectContextTerminalEnd,
);

assert.ok(
  projectContextTerminalStart >= 0 && projectContextTerminalEnd > projectContextTerminalStart,
  'Code page must keep a dedicated project-context terminal action.',
);
assert.match(
  projectContextTerminalSource,
  /resolveBirdcoderWorkbenchHostMode\(\) === 'web'[\s\S]*emitOpenTerminalRequest\(\{\s*surface: 'project',[\s\S]*timestamp: Date\.now\(\),\s*\}\);/,
  'Browser project terminal actions must route directly to the project terminal view without resolving a local folder.',
);
assert.match(
  projectContextTerminalSource,
  /resolveTerminalWorkingDirectory\(target, false\)/,
  'Desktop project terminal actions must resolve the selected project object without allowing a folder picker.',
);
assert.doesNotMatch(
  projectContextTerminalSource,
  /resolveTerminalWorkingDirectory\(target, true\)/,
  'Project context terminal actions must never enable folder selection.',
);

assert.doesNotMatch(
  terminalActionsSource,
  /resolveLocalWorkingDirectory|restoreProjectMount|openLocalFolder|mountFolder/,
  'Page-level terminal actions must not reimplement runtime-location recovery or native folder binding.',
);

assert.match(
  terminalActionsSource,
  /getProjectRuntimeLocationFailureMessage\([\s\S]*'A local desktop folder must be mounted before opening a terminal\.'/,
  'Terminal actions must use the structured resolver outcome so picker cancellation remains a no-op and failures stay user-safe.',
);

assert.doesNotMatch(
  codePageSource,
  /currentProject\?\.path/,
  'Code page terminal actions must not read a local directory from generic remote project metadata.',
);

assert.match(
  terminalActionsSource,
  /setIsTerminalOpen\(nextIsOpen\);/,
  'Code page top bar terminal handler must still control the terminal panel visibility after issuing the default-path request.',
);

assert.match(
  codePageSource,
  /onSetIsTerminalOpen: handleTopBarTerminalVisibilityChange,/,
  'Code page must wire the top bar terminal button through the dedicated default-path terminal handler.',
);

assert.match(
  appShellCreateTerminalSource,
  /resolveBirdcoderWorkbenchHostMode\(\) === 'web'[\s\S]*emitOpenTerminalRequest\(\{\s*surface: 'project',[\s\S]*timestamp: Date\.now\(\),\s*\}\);[\s\S]*projectRuntimeLocationService\.resolveProjectRuntimeLocation\([\s\S]*\{ projectId: effectiveProjectId \},[\s\S]*allowFolderSelection: false,[\s\S]*capability: 'terminal',[\s\S]*buildDefaultTerminalCommandRequest\(\{[\s\S]*path: resolution\.location\.localWorkingDirectory/,
  'Global new-terminal actions must use the remote project target in Browser and the recorded absolute path in Tauri without folder selection.',
);

assert.doesNotMatch(
  appShellCreateTerminalSource,
  /allowFolderSelection: true/,
  'Global new-terminal actions must never open an implicit folder picker.',
);

assert.doesNotMatch(
  appShellCreateTerminalSource,
  /resolveLocalWorkingDirectory|restoreProjectMount|openLocalFolder|mountFolder/,
  'Global new-terminal actions must not duplicate mount recovery or folder-picker behavior outside the runtime-location service.',
);

assert.match(
  appShellSource,
  /cmdOrCtrl && e\.shiftKey && e\.code === 'Backquote'[\s\S]*void handleCreateTerminal\(\);/,
  'The new-terminal keyboard shortcut must use the selected-project terminal handler.',
);

assert.match(
  appShellSource,
  /label: t\('app\.menu\.newTerminal'\),[\s\S]*onClick: \(\) => void handleCreateTerminal\(\),/,
  'The new-terminal menu action must use the selected-project terminal handler.',
);

console.log('code topbar terminal default path contract passed.');
