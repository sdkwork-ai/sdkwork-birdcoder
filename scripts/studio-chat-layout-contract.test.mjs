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
  'StudioChatSidebar.tsx',
);

const studioPageSource = fs.readFileSync(studioPagePath, 'utf8');

assert.match(
  studioPageSource,
  /<div className="flex-1 min-h-0">\s*<UniversalChat/s,
  'StudioChatSidebar sidebar chat must be wrapped in a flex-1 min-h-0 container so the chat body fits below the header.',
);

console.log('studio chat layout contract passed.');
