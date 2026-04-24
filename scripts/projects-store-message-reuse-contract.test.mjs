import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const projectsStoreSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'stores',
    'projectsStore.ts',
  ),
  'utf8',
);

assert.doesNotMatch(
  projectsStoreSource,
  /function cloneProjectMessages\(/,
  'projectsStore should not deep-clone full transcript arrays while reconciling project inventory snapshots.',
);

assert.match(
  projectsStoreSource,
  /:\s*\(?codingSession\.messages as BirdCoderChatMessage\[\]\)?;/,
  'projectsStore should adopt already-cloned incoming transcript arrays instead of deep-cloning them again.',
);

console.log('projects store message reuse contract passed.');
