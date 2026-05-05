import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const runtimeFileSystemServicePath = path.join(
  process.cwd(),
  'packages',
  'sdkwork-birdcoder-infrastructure',
  'src',
  'services',
  'impl',
  'RuntimeFileSystemService.ts',
);

const source = fs.readFileSync(runtimeFileSystemServicePath, 'utf8');

assert.match(
  source,
  /function areDirectoryChildrenEquivalent\(\s*currentChildren: readonly IFileNode\[\] \| undefined,\s*nextChildren: readonly IFileNode\[\] \| undefined,\s*\): boolean/s,
  'Runtime directory refresh should compare child lists with a linear helper instead of materializing large signature strings.',
);

assert.doesNotMatch(
  source,
  /function createDirectoryChildrenSignature\(/,
  'Runtime directory refresh must not build per-directory signature strings during polling or realtime refresh.',
);

assert.doesNotMatch(
  source,
  /\.map\(\(child\) => `\$\{child\.type\}:\$\{child\.path\}:\$\{child\.name\}`\)\s*\.join\('\|'\)/s,
  'Runtime directory refresh must avoid map().join() allocation over large directory child lists.',
);

assert.match(
  source,
  /areDirectoryChildrenEquivalent\(currentNode\.children,\s*nextChildren\)/s,
  'Browser-mounted directory polling should use the linear child-list comparator.',
);

assert.match(
  source,
  /areDirectoryChildrenEquivalent\(\s*currentNode\.children,\s*listing\.directory\.children \?\? \[\],?\s*\)/s,
  'Desktop-mounted directory polling should use the linear child-list comparator.',
);

console.log('runtime directory child comparison performance contract passed.');
