import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readText(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const workspacePanelSource = readText(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);

const surfacePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeEditorSurface.tsx',
);

assert.ok(
  fs.existsSync(surfacePath),
  'Code editor/diff behavior must live in a dedicated CodeEditorSurface component.',
);

assert.match(
  workspacePanelSource,
  /from '\.\/CodeEditorSurface';/,
  'CodeEditorWorkspacePanel must render editor and diff behavior through CodeEditorSurface.',
);

assert.doesNotMatch(
  workspacePanelSource,
  /from '@sdkwork\/birdcoder-ui\/editors';/,
  'CodeEditorWorkspacePanel must not import CodeEditor or DiffEditor directly after the editor surface split.',
);

assert.doesNotMatch(
  workspacePanelSource,
  /FolderPlus|FileCode2|\bX\b/,
  'CodeEditorWorkspacePanel must not own editor empty-state or diff-close icon details after the editor surface split.',
);

assert.ok(
  Buffer.byteLength(workspacePanelSource, 'utf8') < 7000,
  `CodeEditorWorkspacePanel should stay below 7000 bytes after the editor surface split, received ${Buffer.byteLength(workspacePanelSource, 'utf8')}.`,
);

const surfaceSource = readText(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeEditorSurface.tsx',
);

assert.match(
  surfaceSource,
  /from '@sdkwork\/birdcoder-ui\/editors';/,
  'CodeEditorSurface must own the CodeEditor and DiffEditor imports.',
);

assert.match(
  surfaceSource,
  /onAcceptDiff/,
  'CodeEditorSurface must own diff acceptance behavior.',
);

assert.match(
  surfaceSource,
  /onRejectDiff/,
  'CodeEditorSurface must own diff rejection behavior.',
);

assert.match(
  surfaceSource,
  /onCreateRootFile/,
  'CodeEditorSurface must own the empty-project CTA behavior.',
);

assert.match(
  surfaceSource,
  /app\.projectIsEmpty|app\.noFileSelected/,
  'CodeEditorSurface must own the editor empty-state translation surface.',
);

console.log('code editor surface boundary contract passed.');
