import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  codePageSource,
  /const handleTopBarTerminalVisibilityChange = useCallback\(\(nextIsOpen: boolean\) => \{[\s\S]*if \(nextIsOpen\) \{[\s\S]*const normalizedProjectPath = currentProject\?\.path\?\.trim\(\) \?\? '';/,
  'Code page must define a dedicated top bar terminal toggle handler that resolves the currently selected project path before opening the embedded terminal.',
);

assert.match(
  codePageSource,
  /setTerminalRequest\(\{\s*path: normalizedProjectPath \|\| undefined,\s*timestamp: Date\.now\(\),\s*\}\);/,
  'Code page top bar terminal handler must create a fresh terminal request whose default path is the currently selected project path.',
);

assert.match(
  codePageSource,
  /setIsTerminalOpen\(nextIsOpen\);/,
  'Code page top bar terminal handler must still control the terminal panel visibility after issuing the default-path request.',
);

assert.match(
  codePageSource,
  /onSetIsTerminalOpen: handleTopBarTerminalVisibilityChange,/,
  'Code page must wire the top bar terminal button through the dedicated default-path terminal handler.',
);

console.log('code topbar terminal default path contract passed.');
