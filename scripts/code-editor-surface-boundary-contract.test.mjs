import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readText(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const workspacePanelSource = readText(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);

const surfacePath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-code',
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
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodeEditorSurface.tsx',
);

const fileChangeDiffViewerSource = readText(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'FileChangeDiffViewer.tsx',
);

assert.doesNotMatch(
  surfaceSource,
  /from '@sdkwork\/birdcoder-pc-ui';/,
  'CodeEditorSurface must not load the broad UI package root because it defeats editor and chat chunk boundaries.',
);

assert.match(
  surfaceSource,
  /from '@sdkwork\/birdcoder-pc-ui\/components\/ContentWorkbench';/,
  'CodeEditorSurface must load ContentWorkbench through its precise UI component subpath.',
);

assert.match(
  surfaceSource,
  /\bContentWorkbench\b[\s\S]*\bFileChangeDiffViewer\b|\bFileChangeDiffViewer\b[\s\S]*\bContentWorkbench\b/s,
  'CodeEditorSurface must own the editor and historical diff surfaces through precise shared UI component imports.',
);

assert.match(
  surfaceSource,
  /onCloseDiff/,
  'CodeEditorSurface must own the read-only transcript diff close behavior.',
);

assert.doesNotMatch(
  surfaceSource,
  /onAcceptDiff|onRejectDiff/,
  'Historical transcript diffs must not expose proposal acceptance or rejection behavior.',
);

assert.match(
  surfaceSource,
  /<FileChangeDiffViewer[\s\S]*?fileChange=\{viewingDiff\}/,
  'CodeEditorSurface must render historical transcript diffs through the shared read-only viewer.',
);

assert.match(
  fileChangeDiffViewerSource,
  /fileChange\.diff\?\.trim\(\)[\s\S]*data-chat-full-unified-diff="true"/,
  'Historical transcript diffs must preserve provider-native unified patches.',
);

assert.match(
  fileChangeDiffViewerSource,
  /<DeferredDiffEditor[\s\S]*readOnly=\{true\}/,
  'Historical content diffs must remain read-only when rendered through Monaco.',
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
