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

assert.match(
  terminalActionsSource,
  /const handleTopBarTerminalVisibilityChange = useCallback\(async \(nextIsOpen: boolean\) => \{[\s\S]*if \(nextIsOpen\) \{[\s\S]*const localWorkingDirectory = currentProjectId[\s\S]*await resolveLocalWorkingDirectory\(currentProjectId\)/,
  'Code page terminal actions must resolve the selected project local working directory through the device-private file-system service before opening the embedded terminal.',
);

assert.match(
  terminalActionsSource,
  /if \(!localWorkingDirectory\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(\{\s*surface: 'embedded',\s*path: localWorkingDirectory,\s*timestamp: Date\.now\(\),\s*\}\);/,
  'Code page top bar terminal handler must reject an unavailable device mount and create a terminal request only from the resolved device-local working directory.',
);

assert.doesNotMatch(
  codePageSource,
  /currentProject\?\.path/,
  'Code page terminal actions must not read a local directory from remote project metadata.',
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

console.log('code topbar terminal default path contract passed.');
