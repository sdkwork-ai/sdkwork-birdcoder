import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const fileExplorerSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-ui',
    'src',
    'components',
    'FileExplorer.tsx',
  ),
  'utf8',
);

assert.match(
  fileExplorerSource,
  /function resolveSingleRootDirectoryPath\(files: readonly FileNode\[\]\)/,
  'FileExplorer must derive a single project-root directory candidate so mounted projects can auto-expand their root once.',
);

assert.match(
  fileExplorerSource,
  /const singleRootDirectoryPath = useMemo\(\(\) => resolveSingleRootDirectoryPath\(files\), \[files\]\);/,
  'FileExplorer must memoize the current single-root directory path from the file tree.',
);

assert.match(
  fileExplorerSource,
  /useEffect\(\(\) => \{\s*if \(!singleRootDirectoryPath\) \{\s*return;\s*\}\s*setExpandedFolders\(\(previousState\) => \{\s*if \(typeof previousState\[singleRootDirectoryPath\] === 'boolean'\) \{\s*return previousState;\s*\}\s*return \{\s*\.\.\.previousState,\s*\[singleRootDirectoryPath\]: true,\s*\};\s*\}\);\s*\}, \[singleRootDirectoryPath\]\);/s,
  'FileExplorer must auto-expand the current project root once, while preserving explicit user collapse state for already-known roots.',
);

const scopeResetEffectIndex = fileExplorerSource.indexOf(
  "useEffect(() => {\n    setExpandedFolders({});",
);
const rootExpansionEffectIndex = fileExplorerSource.indexOf(
  "useEffect(() => {\n    if (!singleRootDirectoryPath) {",
);

assert.notEqual(
  scopeResetEffectIndex,
  -1,
  'FileExplorer must reset expanded folder state when the file explorer scope changes.',
);

assert.notEqual(
  rootExpansionEffectIndex,
  -1,
  'FileExplorer must declare a dedicated root auto-expansion effect.',
);

assert.equal(
  scopeResetEffectIndex < rootExpansionEffectIndex,
  true,
  'FileExplorer must reset scope state before registering the root auto-expansion effect, otherwise the scope reset immediately wipes the root expansion on editor-mode entry.',
);

console.log('file explorer root expansion contract passed.');
