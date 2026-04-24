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
      'packages/sdkwork-birdcoder-code/src/components/ProjectExplorerSessionRow.tsx',
    ),
  ),
  'ProjectExplorer must define a dedicated session-row component instead of keeping session row rendering embedded in Sidebar.',
);

assert.ok(
  fs.existsSync(
    path.join(
      rootDir,
      'packages/sdkwork-birdcoder-code/src/components/ProjectExplorerProjectSection.tsx',
    ),
  ),
  'ProjectExplorer must define a dedicated project-section component instead of keeping project section rendering embedded in Sidebar.',
);

assert.match(
  sidebarSource,
  /from '\.\/ProjectExplorerSessionRow';/,
  'Sidebar must import ProjectExplorerSessionRow so the left inventory leaf row logic lives behind the ProjectExplorer component family.',
);

assert.match(
  sidebarSource,
  /from '\.\/ProjectExplorerProjectSection';/,
  'Sidebar must import ProjectExplorerProjectSection so the project grouping surface lives behind the ProjectExplorer component family.',
);

console.log('project explorer leaf componentization contract passed.');
