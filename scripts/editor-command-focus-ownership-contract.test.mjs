import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const codeEditorSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/CodeEditor.tsx'),
  'utf8',
);
const diffEditorSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/DiffEditor.tsx'),
  'utf8',
);
const focusSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/editorCommandFocus.ts'),
  'utf8',
);

assert.match(focusSource, /let activeEditorCommandTarget: object \| null = null;/);
assert.match(codeEditorSource, /onFocusCapture=\{\(\) => claimEditorCommandTarget\(editorCommandTargetRef\.current\)\}/);
assert.match(diffEditorSource, /onFocusCapture=\{\(\) => claimEditorCommandTarget\(editorCommandTargetRef\.current\)\}/);
assert.match(codeEditorSource, /ownsEditorCommandTarget\(editorCommandTargetRef\.current\)/);
assert.match(diffEditorSource, /ownsEditorCommandTarget\(editorCommandTargetRef\.current\)/);
assert.match(codeEditorSource, /releaseEditorCommandTarget\(editorCommandTargetRef\.current\)/);
assert.match(diffEditorSource, /releaseEditorCommandTarget\(editorCommandTargetRef\.current\)/);
assert.match(diffEditorSource, /candidate\.onDidFocusEditorText\(\(\) => \{[\s\S]*focusedDiffEditorRef\.current = candidate;/);
assert.match(diffEditorSource, /const editor = focusedDiffEditorRef\.current \?\? editorRef\.current\.getModifiedEditor\(\);/);

console.log('editor command focus ownership contract passed.');
