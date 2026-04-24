import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const sidebarSource = read('packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx');

assert.ok(
  fs.existsSync(
    path.join(
      rootDir,
      'packages/sdkwork-birdcoder-code/src/components/ProjectExplorerHeader.tsx',
    ),
  ),
  'ProjectExplorer must define a dedicated header component for the header, search, and inventory action controls.',
);

assert.match(
  sidebarSource,
  /from '\.\/ProjectExplorerHeader';/,
  'Sidebar must import ProjectExplorerHeader so the top inventory chrome no longer lives inline inside the container implementation.',
);

assert.match(
  sidebarSource,
  /<ProjectExplorerHeader[\s\S]*\/>/,
  'Sidebar must render the extracted ProjectExplorerHeader component for the top inventory controls.',
);

console.log('project explorer header componentization contract passed.');
