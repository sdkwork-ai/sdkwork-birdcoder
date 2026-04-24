import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileSystemSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);

assert.match(
  fileSystemSource,
  /function areOrderedStringArraysEqual\(/,
  'useFileSystem must define a stable ordered-array equality helper so identical open-file state does not re-trigger React updates.',
);

assert.match(
  fileSystemSource,
  /if \(filesRef\.current !== nextFiles\) \{\s*filesRef\.current = nextFiles;\s*setFiles\(nextFiles\);\s*\} else \{\s*filesRef\.current = nextFiles;\s*\}/s,
  'useFileSystem must avoid calling setFiles when the file tree reference is unchanged because repeated refresh and reconcile passes otherwise force avoidable rerenders.',
);

assert.match(
  fileSystemSource,
  /const didOpenFilePathsChange = !areOrderedStringArraysEqual\(/,
  'useFileSystem must compare open-file state by value before committing React state so repeated sync passes with the same tabs do not trigger redundant rerenders.',
);

assert.match(
  fileSystemSource,
  /if \(didOpenFilePathsChange\) \{\s*setOpenFiles\(normalizedState\.openFilePaths\);\s*\}/s,
  'useFileSystem must only commit open-file state when the ordered file list actually changes.',
);

assert.match(
  fileSystemSource,
  /if \(didSelectedFileChange\) \{\s*setSelectedFile\(normalizedState\.selectedFilePath\);\s*\}/s,
  'useFileSystem must only commit selected-file state when the selected path actually changes.',
);

console.log('file system state commit performance contract passed.');
