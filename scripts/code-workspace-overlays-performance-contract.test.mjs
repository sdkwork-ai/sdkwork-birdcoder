import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codeWorkspaceOverlaysPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeWorkspaceOverlays.tsx',
);

const codeWorkspaceOverlaysSource = fs.readFileSync(codeWorkspaceOverlaysPath, 'utf8');

assert.match(
  codeWorkspaceOverlaysSource,
  /useEffect\(\(\) => {\s*if \(!isQuickOpenVisible\) {\s*setQuickOpenQuery\(''\);/s,
  'CodeWorkspaceOverlays must clear the quick-open query when the overlay closes so hidden overlays do not retain stale search work.',
);

assert.match(
  codeWorkspaceOverlaysSource,
  /const \[quickOpenResults, setQuickOpenResults\] = useState<CodeWorkspaceSearchResult\[\]>\(\[\]\);/,
  'CodeWorkspaceOverlays must keep quick-open results in state so file tree traversal runs outside the render path.',
);

assert.match(
  codeWorkspaceOverlaysSource,
  /useEffect\(\(\) => \{[\s\S]*const quickOpenSearchTask = createCodeQuickOpenSearchTask\(/,
  'CodeWorkspaceOverlays must start cancellable quick-open search work from an effect after React commits the query input.',
);

assert.doesNotMatch(
  codeWorkspaceOverlaysSource,
  /const quickOpenResults = useMemo\(\(\) => \{[\s\S]*collectCodeQuickOpenResults\(/,
  'CodeWorkspaceOverlays must not recursively collect quick-open results inside useMemo during render.',
);

console.log('code workspace overlays performance contract passed.');
