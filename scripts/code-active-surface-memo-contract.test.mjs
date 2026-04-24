import assert from 'node:assert/strict';
import fs from 'node:fs';

const codePageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const codePageSurfaceSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePageSurface.tsx', import.meta.url),
  'utf8',
);
const workspacePanelSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx', import.meta.url),
  'utf8',
);
const workspacePanelEqualitySource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/codeEditorWorkspacePanelEquality.ts', import.meta.url),
  'utf8',
);

assert.match(
  codePageSource,
  /const mainChatProps = useMemo\(\(\) => \(\{/,
  'CodePage must memoize the main chat prop bag so unrelated workbench state updates do not force the active AI panel to rebuild its full chat surface.',
);

assert.match(
  codePageSurfaceSource,
  /if \(!left\.isActive && !right\.isActive\) \{\s*return true;\s*\}\s*return left\.chatProps === right\.chatProps;/s,
  'CodePageMainChatPanel must reuse the mounted AI chat surface when the activity flag is unchanged and the memoized chat prop bag has not changed.',
);

assert.match(
  workspacePanelSource,
  /from '\.\/codeEditorWorkspacePanelEquality';/,
  'CodeEditorWorkspacePanel must source its active render-input equality helper from a dedicated module instead of always re-rendering while active.',
);

assert.match(
  workspacePanelEqualitySource,
  /export function areCodeEditorWorkspacePanelRenderInputsEqual\(/,
  'The editor workspace panel equality helper module must define the explicit render-input equality function.',
);

assert.match(
  workspacePanelSource,
  /if \(!left\.isActive && !right\.isActive\) \{\s*return true;\s*\}\s*return areCodeEditorWorkspacePanelRenderInputsEqual\(left, right\);/s,
  'CodeEditorWorkspacePanel must skip active rerenders when its render-driving inputs are unchanged.',
);

assert.doesNotMatch(
  workspacePanelSource,
  /if \(!left\.isActive && !right\.isActive\) \{\s*return true;\s*\}\s*return false;/s,
  'CodeEditorWorkspacePanel must not unconditionally re-render while active.',
);

console.log('code active surface memo contract passed.');
