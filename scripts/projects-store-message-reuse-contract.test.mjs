import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const useProjectsSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'hooks',
    'useProjects.ts',
  ),
  'utf8',
);

assert.doesNotMatch(
  useProjectsSource,
  /function cloneProjectMessages\(/,
  'useProjects should not deep-clone full transcript arrays while reconciling project inventory snapshots.',
);

assert.match(
  useProjectsSource,
  /: codingSession\.messages as BirdCoderChatMessage\[\];/,
  'useProjects should adopt already-cloned incoming transcript arrays instead of deep-cloning them again.',
);

console.log('projects store message reuse contract passed.');
