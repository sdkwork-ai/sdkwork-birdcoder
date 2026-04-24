import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const sidebarSource = read('packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx');

for (const fileName of [
  'ProjectExplorerRootContextMenu.tsx',
  'ProjectExplorerSessionContextMenu.tsx',
  'ProjectExplorerProjectContextMenu.tsx',
]) {
  assert.ok(
    fs.existsSync(
      path.join(
        rootDir,
        'packages/sdkwork-birdcoder-code/src/components',
        fileName,
      ),
    ),
    `ProjectExplorer must define ${fileName} so sidebar context menu content no longer lives inline inside the container implementation.`,
  );
}

assert.match(
  sidebarSource,
  /from '\.\/ProjectExplorerRootContextMenu';/,
  'Sidebar must import ProjectExplorerRootContextMenu instead of inlining the root menu content.',
);

assert.match(
  sidebarSource,
  /from '\.\/ProjectExplorerSessionContextMenu';/,
  'Sidebar must import ProjectExplorerSessionContextMenu instead of inlining the session menu content.',
);

assert.match(
  sidebarSource,
  /from '\.\/ProjectExplorerProjectContextMenu';/,
  'Sidebar must import ProjectExplorerProjectContextMenu instead of inlining the project menu content.',
);

console.log('project explorer menu componentization contract passed.');
