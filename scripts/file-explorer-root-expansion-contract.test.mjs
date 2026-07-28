import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const fileExplorerSource = fs.readFileSync(
  path.join(
    rootDir,
    'apps',
    
    'sdkwork-birdcoder-pc',
    
    'packages',
    
    'sdkwork-birdcoder-pc-ui',
    'src',
    'components',
    'FileExplorer.tsx',
  ),
  'utf8',
).replaceAll('\r\n', '\n');

assert.match(
  fileExplorerSource,
  /projectRootPath\?: string;/,
  'FileExplorer must accept the canonical host-neutral project root explicitly.',
);

assert.match(
  fileExplorerSource,
  /const rootCreationParentPath = useMemo\(\(\) => projectRootPath\.trim\(\), \[projectRootPath\]\);\s*const fileExplorerScopeIdentity = `\$\{scopeKey\}\\u0000\$\{rootCreationParentPath\}`;\s*const singleRootDirectoryPath = rootCreationParentPath;/s,
  'FileExplorer must use the explicit virtual root for creation and expansion.',
);

assert.doesNotMatch(
  fileExplorerSource,
  /files\[0\][\s\S]{0,120}\.path|resolveProjectFileTreeRootPath\(files\)/,
  'FileExplorer must not infer the project root from the first rendered file-tree node.',
);

assert.match(
  fileExplorerSource,
  /useEffect\(\(\) => \{\s*if \(!singleRootDirectoryPath\) \{\s*return;\s*\}\s*setExpandedFolders\(\(previousState\) => \{\s*if \(typeof previousState\[singleRootDirectoryPath\] === 'boolean'\) \{\s*return previousState;\s*\}\s*return \{\s*\.\.\.previousState,\s*\[singleRootDirectoryPath\]: true,\s*\};\s*\}\);\s*\}, \[singleRootDirectoryPath\]\);/s,
  'FileExplorer must auto-expand the current project root once, while preserving explicit user collapse state for already-known roots.',
);

const scopeResetEffectMatch = /useEffect\(\(\) => \{\s*mutationGenerationRef\.current \+= 1;\s*setExpandedFolders\(\{\}\);[\s\S]*?\}, \[closeFloatingMenus, fileExplorerScopeIdentity\]\);/.exec(
  fileExplorerSource,
);
const rootExpansionEffectMatch = /useEffect\(\(\) => \{\s*if \(!singleRootDirectoryPath\) \{[\s\S]*?\}, \[singleRootDirectoryPath\]\);/.exec(
  fileExplorerSource,
);

assert.ok(
  scopeResetEffectMatch,
  'FileExplorer must reset expanded folder state when the project or mounted root scope changes.',
);

assert.ok(
  rootExpansionEffectMatch,
  'FileExplorer must declare a dedicated root auto-expansion effect.',
);

assert.equal(
  scopeResetEffectMatch.index < rootExpansionEffectMatch.index,
  true,
  'FileExplorer must reset scope state before registering the root auto-expansion effect, otherwise the scope reset immediately wipes the root expansion on editor-mode entry.',
);

console.log('file explorer root expansion contract passed.');
