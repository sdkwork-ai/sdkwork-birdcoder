import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const codePageSurfaceSource = read('packages/sdkwork-birdcoder-code/src/pages/CodePageSurface.tsx');

assert.ok(
  fs.existsSync(
    path.join(
      rootDir,
      'packages/sdkwork-birdcoder-code/src/components/ProjectExplorer.tsx',
    ),
  ),
  'Code surface must define a dedicated ProjectExplorer component for the left project/session inventory shell.',
);

assert.match(
  codePageSurfaceSource,
  /from '\.\.\/components\/ProjectExplorer';/,
  'CodePageSurface must depend on ProjectExplorer instead of wiring the left inventory surface directly against Sidebar.',
);

assert.match(
  codePageSurfaceSource,
  /import \{ ProjectExplorer, type ProjectExplorerProps \} from '\.\.\/components\/ProjectExplorer';/,
  'CodePageSurface must depend on the explicit ProjectExplorer prop contract instead of inferring the left-pane boundary from implementation details.',
);

assert.match(
  codePageSurfaceSource,
  /projectExplorerProps: ProjectExplorerProps;/,
  'CodePageSurface must accept left-pane composition through the explicit ProjectExplorer prop contract so the code workbench surface depends on the domain component instead of the generic sidebar implementation.',
);

assert.match(
  codePageSurfaceSource,
  /<ProjectExplorer \{\.\.\.projectExplorerProps\} \/>/,
  'CodePageSurface must render the left workbench inventory through the ProjectExplorer component.',
);

console.log('code project explorer componentization contract passed.');
