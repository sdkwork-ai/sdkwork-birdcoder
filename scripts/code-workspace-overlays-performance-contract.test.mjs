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
  /const quickOpenResults = useMemo\(\s*\(\) => {\s*if \(!isQuickOpenVisible\) {\s*return \[\];/s,
  'CodeWorkspaceOverlays must skip quick-open result collection while the overlay is hidden to avoid unnecessary file tree traversal on the main thread.',
);

console.log('code workspace overlays performance contract passed.');
