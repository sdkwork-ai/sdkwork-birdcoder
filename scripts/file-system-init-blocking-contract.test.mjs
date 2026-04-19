import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileSystemSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  fileSystemSource,
  /useLayoutEffect\(/,
  'File-system project reset must not run in useLayoutEffect because it blocks paint during project switches and startup recovery.',
);

assert.match(
  fileSystemSource,
  /useEffect\(\(\) => \{\s*const nextProjectId = projectId\.trim\(\);/s,
  'File-system project reset must still clear stale selection and request state when the active project changes.',
);

console.log('file system init blocking contract passed.');
