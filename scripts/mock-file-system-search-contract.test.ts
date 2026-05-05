import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const fileSearchFacadePath = path.join(
  workspaceRoot,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'fileSearch.ts',
);
const runtimeFileSystemServicePath = path.join(
  workspaceRoot,
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'impl',
  'RuntimeFileSystemService.ts',
);

const fileSearchFacadeSource = fs.readFileSync(fileSearchFacadePath, 'utf8');
const runtimeFileSystemServiceSource = fs.readFileSync(runtimeFileSystemServicePath, 'utf8');

assert.match(
  fileSearchFacadeSource,
  /export\s+\{\s*searchProjectFiles\s*\}\s+from\s+'@sdkwork\/birdcoder-types';/u,
  'file search facade must re-export the canonical types-layer implementation instead of hosting a page-local mock search path.',
);

assert.doesNotMatch(
  fileSearchFacadeSource,
  /\bmock\b/iu,
  'file search facade must not reference mock search behavior.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /import\s*\{[\s\S]*searchProjectFiles,/u,
  'runtime file system service must import the canonical search implementation.',
);

assert.match(
  runtimeFileSystemServiceSource,
  /from\s+'@sdkwork\/birdcoder-types';/u,
  'runtime file system service must source file search behavior from the shared canonical package.',
);

assert.doesNotMatch(
  runtimeFileSystemServiceSource,
  /\bmock\b/iu,
  'runtime file system search integration must not fall back to mock execution paths.',
);

console.log('mock file system search contract passed.');
