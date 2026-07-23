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
  'const handleProjectMenuClickOutside',
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
  /const resolveTerminalWorkingDirectory = useCallback\(async \(projectId: string\) => \{[\s\S]*await resolveProjectRuntimeLocation\(projectId, \{[\s\S]*allowFolderSelection: true,[\s\S]*capability: 'terminal',/,
  'Code page terminal actions must use the injected project runtime-location resolver for the selected project terminal capability.',
);

assert.match(
  terminalActionsSource,
  /const handleTopBarTerminalVisibilityChange = useCallback\(async \(nextIsOpen: boolean\) => \{[\s\S]*if \(nextIsOpen\) \{[\s\S]*const localWorkingDirectory = currentProjectId[\s\S]*await resolveTerminalWorkingDirectory\(currentProjectId\)[\s\S]*if \(!localWorkingDirectory\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(\{\s*surface: 'embedded',\s*path: localWorkingDirectory,\s*timestamp: Date\.now\(\),\s*\}\);/,
  'Code page top bar terminal handler must create an embedded terminal request only from a resolved project runtime location.',
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
  /projectRuntimeLocationService\.resolveProjectRuntimeLocation\([\s\S]*effectiveProjectId,[\s\S]*allowFolderSelection: true,[\s\S]*capability: 'terminal',[\s\S]*resolution\.status === 'cancelled'[\s\S]*resolution\.status !== 'resolved'[\s\S]*buildDefaultTerminalCommandRequest\(\{[\s\S]*path: resolution\.location\.localWorkingDirectory/,
  'Global new-terminal actions must resolve the selected project terminal location through the central service before creating a terminal request.',
);

assert.doesNotMatch(
  appShellCreateTerminalSource,
  /resolveLocalWorkingDirectory|restoreProjectMount|openLocalFolder|mountFolder/,
  'Global new-terminal actions must not duplicate mount recovery or folder-picker behavior outside the runtime-location service.',
);

assert.match(
  appShellSource,
  /cmdOrCtrl && e\.shiftKey && e\.key === '`'[\s\S]*void handleCreateTerminal\(\);/,
  'The new-terminal keyboard shortcut must use the selected-project terminal handler.',
);

assert.match(
  appShellSource,
  /label: t\('app\.menu\.newTerminal'\),[\s\S]*onClick: \(\) => void handleCreateTerminal\(\),/,
  'The new-terminal menu action must use the selected-project terminal handler.',
);

console.log('code topbar terminal default path contract passed.');
