import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const source = fs.readFileSync(
  path.join(
    rootDir,
    'packages/sdkwork-birdcoder-code/src/components/ProjectExplorerHeader.tsx',
  ),
  'utf8',
);

assert.match(
  source,
  /className="project-explorer-scroll-region px-4 py-2 flex-1 overflow-y-auto"/,
  'Project explorer session list must render through the dedicated hover-scroll region class.',
);

assert.match(
  source,
  /\.project-explorer-scroll-region\s*\{[\s\S]*scrollbar-width:\s*none;/,
  'Project explorer scroll region must hide its scrollbar by default.',
);

assert.match(
  source,
  /\.project-explorer-scroll-region\s*\{[\s\S]*scrollbar-gutter:\s*stable;/,
  'Project explorer scroll region must reserve stable gutter space while the scrollbar is hidden.',
);

assert.match(
  source,
  /\.project-explorer-scroll-region:hover\s*\{[\s\S]*scrollbar-width:\s*thin;[\s\S]*scrollbar-color:\s*rgba\(255,\s*255,\s*255,\s*0\.18\)\s*transparent;/,
  'Project explorer scroll region must reveal a thin scrollbar on hover.',
);

assert.match(
  source,
  /\.project-explorer-scroll-region:hover::\-webkit-scrollbar\s*\{[\s\S]*width:\s*8px;[\s\S]*height:\s*8px;/,
  'Project explorer scroll region must restore the WebKit scrollbar size on hover.',
);

console.log('project explorer scrollbar contract passed.');
