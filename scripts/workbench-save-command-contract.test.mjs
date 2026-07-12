import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const fileSystemSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/hooks/useFileSystem.ts',
);
const codePageSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
);
const codeCommandsSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts',
);
const studioPageSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx',
);
const studioCommandsSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/useStudioWorkbenchEventBindings.ts',
);

assert.match(
  fileSystemSource,
  /const flushPendingAutosave = useCallback/u,
  'File-system state must expose a real pending-autosave flush operation.',
);
assert.match(
  fileSystemSource,
  /throw error;/u,
  'File-system save failures must reach the explicit save command instead of being silently swallowed.',
);
assert.match(
  codePageSource,
  /flushPendingAutosave,/u,
  'Code page must inject the file-system flush operation into workbench commands.',
);
assert.match(
  studioPageSource,
  /flushPendingAutosave,/u,
  'Studio page must inject the file-system flush operation into workbench commands.',
);
assert.match(
  codeCommandsSource,
  /flushPendingAutosaveRef\.current\(\)/u,
  'Code save commands must await the real file-system flush.',
);
assert.match(
  studioCommandsSource,
  /flushPendingAutosaveRef\.current\(\)/u,
  'Studio save commands must await the real file-system flush.',
);
assert.doesNotMatch(
  codeCommandsSource,
  /const handleSaveActiveFile = \(\) => \{\s*addToast/u,
  'Code save commands must not report success without persisting content.',
);
assert.doesNotMatch(
  studioCommandsSource,
  /const handleSaveAllFiles = \(\) => \{\s*addToast/u,
  'Studio save commands must not report success without persisting content.',
);

console.log('workbench save command contract passed.');
