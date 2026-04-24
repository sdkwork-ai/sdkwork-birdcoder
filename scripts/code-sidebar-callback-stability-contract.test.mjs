import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codePageSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-code',
    'src',
    'pages',
    'CodePage.tsx',
  ),
  'utf8',
);

assert.match(
  codePageSource,
  /const handleRenameSession = useCallback\(/,
  'CodePage must stabilize rename-session callbacks because Sidebar memoization depends on callback identity to avoid rerendering the full project/session tree.',
);

assert.match(
  codePageSource,
  /const handleDeleteSession = useCallback\(/,
  'CodePage must stabilize delete-session callbacks because Sidebar memoization depends on callback identity to avoid rerendering the full project/session tree.',
);

assert.match(
  codePageSource,
  /const handleRenameProject = useCallback\(/,
  'CodePage must stabilize rename-project callbacks because Sidebar memoization depends on callback identity to avoid rerendering the full project/session tree.',
);

assert.match(
  codePageSource,
  /const handleDeleteProject = useCallback\(/,
  'CodePage must stabilize delete-project callbacks because Sidebar memoization depends on callback identity to avoid rerendering the full project/session tree.',
);

console.log('code sidebar callback stability contract passed.');
