import assert from 'node:assert/strict';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/fileSelectionMutation.ts',
  import.meta.url,
);

const { resolveSelectedFileAfterMutation } = await import(`${modulePath.href}?t=${Date.now()}`);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/legacy.ts',
    mutation: {
      type: 'create-file',
      path: '/src/new-file.ts',
    },
  }),
  '/src/new-file.ts',
  'creating a file should select the new file',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/current.ts',
    mutation: {
      type: 'create-folder',
      path: '/src/features',
    },
  }),
  '/src/current.ts',
  'creating a folder should preserve the current file selection',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/current.ts',
    mutation: {
      type: 'delete-file',
      path: '/src/current.ts',
    },
  }),
  null,
  'deleting the active file should clear the candidate selection so startup recovery can pick a safe fallback',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/keep.ts',
    mutation: {
      type: 'delete-file',
      path: '/src/other.ts',
    },
  }),
  '/src/keep.ts',
  'deleting another file must not clear the current selection',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/features/nested/view.tsx',
    mutation: {
      type: 'delete-folder',
      path: '/src/features',
    },
  }),
  null,
  'deleting the folder that contains the current file should clear the candidate selection',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/srcology/view.tsx',
    mutation: {
      type: 'delete-folder',
      path: '/src',
    },
  }),
  '/srcology/view.tsx',
  'folder deletion must use path-segment boundaries and not over-match sibling prefixes',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/main.ts',
    mutation: {
      type: 'rename-node',
      oldPath: '/src/main.ts',
      newPath: '/src/app.ts',
    },
  }),
  '/src/app.ts',
  'renaming the active file should keep the same logical selection on the new path',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/features/nested/view.tsx',
    mutation: {
      type: 'rename-node',
      oldPath: '/src/features',
      newPath: '/src/modules',
    },
  }),
  '/src/modules/nested/view.tsx',
  'renaming a parent folder should rewrite the selected descendant path',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/main.tsx',
    mutation: {
      type: 'rename-node',
      oldPath: '/src/main.ts',
      newPath: '/src/app.ts',
    },
  }),
  '/src/main.tsx',
  'renaming one file must not rewrite other files that only share a prefix',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/current.ts',
    mutation: {
      type: 'refresh-files',
    },
  }),
  '/src/current.ts',
  'refreshing the tree should preserve the current selection candidate',
);

assert.equal(
  resolveSelectedFileAfterMutation({
    currentSelectedFilePath: '/src/current.ts',
    mutation: {
      type: 'mount-folder',
    },
  }),
  '/src/current.ts',
  'mounting a folder should preserve the current selection candidate',
);

console.log('file selection mutation contract passed.');
