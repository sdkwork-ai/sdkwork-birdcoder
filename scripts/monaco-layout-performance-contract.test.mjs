import assert from 'node:assert/strict';
import fs from 'node:fs';

const codeEditorSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/CodeEditor.tsx', import.meta.url),
  'utf8',
);
const diffEditorSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/DiffEditor.tsx', import.meta.url),
  'utf8',
);
const monacoRuntimeSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/monacoRuntime.ts', import.meta.url),
  'utf8',
);

assert.match(
  codeEditorSource,
  /configureBirdCoderMonacoTypeScriptDefaults/,
  'CodeEditor must reuse shared Monaco TypeScript configuration instead of reconfiguring Monaco inline on every mount.',
);

assert.match(
  diffEditorSource,
  /configureBirdCoderMonacoTypeScriptDefaults/,
  'DiffEditor must reuse shared Monaco TypeScript configuration instead of reconfiguring Monaco inline on every mount.',
);

assert.match(
  codeEditorSource,
  /globalEventBus\.on\('editorCommand'/,
  'CodeEditor must subscribe to editor commands directly without dynamic import churn.',
);

assert.match(
  diffEditorSource,
  /globalEventBus\.on\('editorCommand'/,
  'DiffEditor must subscribe to editor commands directly without dynamic import churn.',
);

assert.match(
  monacoRuntimeSource,
  /const configuredMonacoApis = new WeakSet<object>\(\);/,
  'Shared Monaco runtime must cache per-Monaco global configuration so repeated editor mounts do not redo expensive language setup.',
);

console.log('monaco layout performance contract passed.');
