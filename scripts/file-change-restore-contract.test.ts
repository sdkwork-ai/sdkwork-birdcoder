import assert from 'node:assert/strict';
import {
  MAX_AGENT_SESSION_FILE_CHANGES,
  MAX_FILE_CHANGE_TEXT_CHARACTERS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/file-change.ts';

const restoreModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/fileChangeRestore.ts',
  import.meta.url,
);
const codePagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodePage.tsx',
  import.meta.url,
);
const studioPagePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioPage.tsx',
  import.meta.url,
);
const universalChatPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
  import.meta.url,
);
const turnFileChangesCardPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/activity/TurnFileChangesCard.tsx',
  import.meta.url,
);
const diffViewerPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/FileChangeDiffViewer.tsx',
  import.meta.url,
);

const restoreModule = await import(`${restoreModulePath.href}?t=${Date.now()}`);
const diffViewerModule = await import(`${diffViewerPath.href}?t=${Date.now()}`);
const codePageSource = await import('node:fs/promises').then((fs) => fs.readFile(codePagePath, 'utf8'));
const studioPageSource = await import('node:fs/promises').then((fs) => fs.readFile(studioPagePath, 'utf8'));
const universalChatSource = await import('node:fs/promises').then((fs) => fs.readFile(universalChatPath, 'utf8'));
const turnFileChangesCardSource = await import('node:fs/promises').then(
  (fs) => fs.readFile(turnFileChangesCardPath, 'utf8'),
);

const {
  buildFileChangeRestorePlan,
  hasRestorableFileChanges,
  reverseUnifiedFileChangeDiff,
} = restoreModule;
const { readBoundedUnifiedDiffLines } = diffViewerModule;

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

const reversePatchDiff = [
  '--- a/src/provider.ts',
  '+++ b/src/provider.ts',
  '@@ -1,2 +1,2 @@',
  '-export const provider = "before";',
  '+export const provider = "after";',
  ' export const stable = true;',
].join('\n');
const reversePatchPlan = buildFileChangeRestorePlan([{
  path: 'src/provider.ts',
  additions: 1,
  deletions: 1,
  diff: reversePatchDiff,
}]);
assert.equal(reversePatchPlan.restorable, true);
assert.deepEqual(reversePatchPlan.operations, [{
  diff: reversePatchDiff,
  path: 'src/provider.ts',
  type: 'reverse-patch',
}]);
assert.equal(
  reverseUnifiedFileChangeDiff(
    'export const provider = "after";\nexport const stable = true;\n',
    reversePatchDiff,
  ),
  'export const provider = "before";\nexport const stable = true;\n',
);
assert.equal(
  reverseUnifiedFileChangeDiff('content no longer matches\n', reversePatchDiff),
  null,
  'reverse patch restore must reject stale file content instead of overwriting it.',
);

const oversizedFileChangeText = 'x'.repeat(MAX_FILE_CHANGE_TEXT_CHARACTERS + 1);
assert.deepEqual(
  buildFileChangeRestorePlan([{
    path: 'src/oversized.ts',
    additions: 0,
    deletions: 0,
    originalContent: oversizedFileChangeText,
  }]),
  { fileChanges: [], operations: [], restorable: false },
  'Restore planning must reject oversized snapshots before cloning or parsing them.',
);
assert.equal(
  reverseUnifiedFileChangeDiff(oversizedFileChangeText, reversePatchDiff),
  null,
  'Reverse patch restore must not normalize and split an oversized current file in memory.',
);
assert.equal(
  buildFileChangeRestorePlan(Array.from(
    { length: MAX_AGENT_SESSION_FILE_CHANGES + 1 },
    (_, index) => ({
      path: `src/file-${index}.ts`,
      additions: 0,
      deletions: 0,
      originalContent: '',
    }),
  )).restorable,
  false,
  'Restore planning must reject unbounded file-change collections.',
);

const denseDiffPreview = readBoundedUnifiedDiffLines(
  Array.from({ length: 20_001 }, () => '+').join('\n'),
);
assert.equal(denseDiffPreview.lines.length, 20_000);
assert.equal(denseDiffPreview.truncated, true);
assert.deepEqual(
  readBoundedUnifiedDiffLines(oversizedFileChangeText),
  { lines: [], truncated: true },
  'The full diff view must refuse oversized text before allocating per-line React elements.',
);

assert.match(
  codePageSource,
  /restoreWorkbenchAgentSessionItemFiles\(/,
  'CodePage must delegate checkpoint restore to the shared workbench service.',
);

assert.doesNotMatch(
  codePageSource,
  /await deleteFile\(change\.path\)/,
  'CodePage restore must not delete files based only on missing originalContent.',
);

assert.match(
  studioPageSource,
  /restoreWorkbenchAgentSessionItemFiles\(/,
  'StudioPage must delegate checkpoint restore to the shared workbench service.',
);

assert.match(codePageSource, /loadFileContent,/);
assert.match(studioPageSource, /loadFileContent,/);

assert.match(
  turnFileChangesCardSource,
  /hasRestorableFileChanges\(/,
  'The turn file summary must hide Restore when file changes are not safely restorable.',
);
assert.match(
  universalChatSource,
  /resolveTurnFileChangesMessagePresentations\(/,
  'UniversalChat must delegate turn-level file summary ownership to the shared presentation resolver.',
);

console.log('file change restore contract passed.');
