import assert from 'node:assert/strict';
import fs from 'node:fs';

const codeEditorPath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/CodeEditor.tsx',
  import.meta.url,
);
const diffEditorPath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/DiffEditor.tsx',
  import.meta.url,
);
const overflowWidgetsPath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/monacoOverflowWidgets.ts',
  import.meta.url,
);

const codeEditorSource = fs.readFileSync(codeEditorPath, 'utf8');
const diffEditorSource = fs.readFileSync(diffEditorPath, 'utf8');

assert.equal(
  fs.existsSync(overflowWidgetsPath),
  true,
  'Monaco editors must share a dedicated overflow widgets host so context menus can escape clipped code workspace containers.',
);

const overflowWidgetsSource = fs.readFileSync(overflowWidgetsPath, 'utf8');

assert.equal(
  overflowWidgetsSource.includes('MONACO_OVERFLOW_WIDGETS_HOST_ID'),
  true,
  'The Monaco overflow widgets helper must define a stable host id.',
);
assert.equal(
  overflowWidgetsSource.includes('2147483647'),
  true,
  'The Monaco overflow widgets helper must elevate context menus to the highest z-index tier.',
);
assert.equal(
  codeEditorSource.includes('resolveMonacoOverflowWidgetsDomNode'),
  true,
  'CodeEditor must route Monaco overflow widgets through the shared high-z-index host.',
);
assert.equal(
  codeEditorSource.includes('fixedOverflowWidgets: true'),
  true,
  'CodeEditor must enable fixed overflow widgets so the editor context menu is not clipped by overflow-hidden containers.',
);
assert.equal(
  codeEditorSource.includes('overflowWidgetsDomNode: overflowWidgetsDomNode'),
  true,
  'CodeEditor must pass the shared overflow widgets DOM node into Monaco.',
);
assert.equal(
  diffEditorSource.includes('resolveMonacoOverflowWidgetsDomNode'),
  true,
  'DiffEditor must route Monaco overflow widgets through the shared high-z-index host.',
);
assert.equal(
  diffEditorSource.includes('fixedOverflowWidgets: true'),
  true,
  'DiffEditor must enable fixed overflow widgets so the diff context menu is not clipped by overflow-hidden containers.',
);
assert.equal(
  diffEditorSource.includes('overflowWidgetsDomNode: overflowWidgetsDomNode'),
  true,
  'DiffEditor must pass the shared overflow widgets DOM node into Monaco.',
);

console.log('monaco context menu layer contract passed.');
