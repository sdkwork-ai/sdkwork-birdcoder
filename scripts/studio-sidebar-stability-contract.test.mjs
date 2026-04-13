import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const studioPagePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);

const studioPageSource = fs.readFileSync(studioPagePath, 'utf8');

assert.match(
  studioPageSource,
  /const handleToggleSidebar = useCallback\(\(\) => \{\s*setIsSidebarVisible\(prev => !prev\);\s*\}, \[\]\);/s,
  'StudioPage must keep toggleSidebar as a stable callback to avoid listener churn.',
);

assert.match(
  studioPageSource,
  /const unsubscribe = globalEventBus\.on\('toggleSidebar', handleToggleSidebar\);/,
  'StudioPage must subscribe to toggleSidebar with a direct unsubscribe handle.',
);

assert.doesNotMatch(
  studioPageSource,
  /const requestId = \+\+studioEvidenceRequestIdRef\.current;/,
  'StudioPage should not retain the removed Studio evidence request-id guard after the evidence panel integration is deleted.',
);

assert.doesNotMatch(
  studioPageSource,
  /setIsStudioEvidenceLoading\(/,
  'StudioPage should not retain removed Studio evidence loading state updates after the evidence panel integration is deleted.',
);

console.log('studio sidebar stability contract passed.');
