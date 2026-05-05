import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const useFileSystemSource = fs.readFileSync(
  path.join(rootDir(), 'packages/sdkwork-birdcoder-commons/src/hooks/useFileSystem.ts'),
  'utf8',
);

function rootDir() {
  return process.cwd();
}

function readFunctionBody(functionName) {
  const start = useFileSystemSource.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `${functionName} must exist.`);
  const nextFunction = useFileSystemSource.indexOf('\nfunction ', start + 1);
  assert.notEqual(nextFunction, -1, `${functionName} must be followed by another function.`);
  return useFileSystemSource.slice(start, nextFunction);
}

const resolverSource = readFunctionBody('resolveLoadedRootDirectoryPaths');

assert.doesNotMatch(
  resolverSource,
  /\.sort\(/,
  'Loaded root directory resolution must not sort every loaded path on realtime fallback refresh.',
);

assert.doesNotMatch(
  resolverSource,
  /\[\.\.\.loadedDirectoryPaths\]/,
  'Loaded root directory resolution must not copy the full loaded-directory set before filtering roots.',
);

assert.match(
  resolverSource,
  /for \(const candidatePath of loadedDirectoryPaths\)/,
  'Loaded root directory resolution should use a single pass over the maintained loaded-directory index.',
);

console.log('file system loaded root path performance contract passed.');
