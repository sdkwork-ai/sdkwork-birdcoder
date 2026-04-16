import assert from 'node:assert/strict';

const restoreModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/fileChangeRestore.ts',
  import.meta.url,
);
const codePagePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx',
  import.meta.url,
);
const studioPagePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx',
  import.meta.url,
);
const universalChatPath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx',
  import.meta.url,
);

const restoreModule = await import(`${restoreModulePath.href}?t=${Date.now()}`);
const codePageSource = await import('node:fs/promises').then((fs) => fs.readFile(codePagePath, 'utf8'));
const studioPageSource = await import('node:fs/promises').then((fs) => fs.readFile(studioPagePath, 'utf8'));
const universalChatSource = await import('node:fs/promises').then((fs) => fs.readFile(universalChatPath, 'utf8'));

const {
  buildFileChangeRestorePlan,
  hasRestorableFileChanges,
} = restoreModule;

const safeRestorePlan = buildFileChangeRestorePlan([
  {
    path: 'src/App.tsx',
    additions: 2,
    deletions: 1,
    content: 'next',
    originalContent: 'previous',
  },
]);

assert.equal(hasRestorableFileChanges(safeRestorePlan.fileChanges), true);
assert.deepEqual(safeRestorePlan.operations, [
  {
    content: 'previous',
    path: 'src/App.tsx',
    type: 'write',
  },
]);

const unsafeRestorePlan = buildFileChangeRestorePlan([
  {
    path: 'src/generated.ts',
    additions: 10,
    deletions: 0,
    content: 'created file',
  },
]);

assert.equal(hasRestorableFileChanges(unsafeRestorePlan.fileChanges), false);
assert.deepEqual(
  unsafeRestorePlan.operations,
  [],
  'restore planning must refuse to emit destructive delete operations when the original file content is unknown.',
);

assert.match(
  codePageSource,
  /buildFileChangeRestorePlan\(/,
  'CodePage must use the shared restore planner instead of ad hoc file deletion logic.',
);

assert.doesNotMatch(
  codePageSource,
  /await deleteFile\(change\.path\)/,
  'CodePage restore must not delete files based only on missing originalContent.',
);

assert.match(
  studioPageSource,
  /buildFileChangeRestorePlan\(/,
  'StudioPage must use the shared restore planner so restore behavior matches CodePage.',
);

assert.match(
  universalChatSource,
  /hasRestorableFileChanges\(/,
  'UniversalChat must hide the Restore action when file changes are not safely restorable.',
);

console.log('file change restore contract passed.');
