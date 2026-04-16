import assert from 'node:assert/strict';
import fs from 'node:fs';

const editorRecoveryModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/editorRecovery.ts',
  import.meta.url,
);
const fileSystemHookPath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts',
  import.meta.url,
);

const {
  buildEditorSelectionStorageKey,
  findFirstFile,
  resolveStartupSelectedFile,
} = await import(`${editorRecoveryModulePath.href}?t=${Date.now()}`);

const fileTree = [
  {
    name: 'src',
    type: 'directory',
    path: 'src',
    children: [
      {
        name: 'main.ts',
        type: 'file',
        path: 'src/main.ts',
      },
      {
        name: 'nested',
        type: 'directory',
        path: 'src/nested',
        children: [
          {
            name: 'page.tsx',
            type: 'file',
            path: 'src/nested/page.tsx',
          },
        ],
      },
    ],
  },
  {
    name: 'README.md',
    type: 'file',
    path: 'README.md',
  },
];

assert.equal(buildEditorSelectionStorageKey('project-alpha'), 'selected-file.project-alpha.v1');
assert.equal(buildEditorSelectionStorageKey(''), 'selected-file.global.v1');
assert.equal(buildEditorSelectionStorageKey(undefined), 'selected-file.global.v1');
assert.equal(buildEditorSelectionStorageKey(null), 'selected-file.global.v1');

assert.equal(findFirstFile(fileTree), 'src/main.ts');
assert.equal(
  resolveStartupSelectedFile({
    files: fileTree,
    persistedSelectedFilePath: 'src/nested/page.tsx',
  }),
  'src/nested/page.tsx',
);
assert.equal(
  resolveStartupSelectedFile({
    files: fileTree,
    persistedSelectedFilePath: 'missing/file.ts',
  }),
  'src/main.ts',
);
assert.equal(
  resolveStartupSelectedFile({
    files: [],
    persistedSelectedFilePath: 'src/main.ts',
  }),
  null,
);

const fileSystemHookSource = fs.readFileSync(fileSystemHookPath, 'utf8');
assert.equal(
  fileSystemHookSource.includes('resolveStartupSelectedFile'),
  true,
  'useFileSystem should resolve the initial selection through the shared editor recovery helper',
);
assert.equal(
  fileSystemHookSource.includes('getStoredJson'),
  true,
  'useFileSystem should read the persisted file selection from local storage',
);
assert.equal(
  fileSystemHookSource.includes('setStoredJson'),
  true,
  'useFileSystem should persist the selected file back to local storage',
);

console.log('editor startup recovery contract passed.');
