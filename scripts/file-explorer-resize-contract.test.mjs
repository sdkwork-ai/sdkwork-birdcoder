import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const fileExplorerSource = read('packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx');
const codeEditorWorkspacePanelSource = read('packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx');
const codeEditorWorkspacePanelTypesSource = read('packages/sdkwork-birdcoder-code/src/pages/codeEditorWorkspacePanel.types.ts');
const codePageSource = read('packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx');
const codePageSurfacePropsSource = read('packages/sdkwork-birdcoder-code/src/pages/useCodePageSurfaceProps.ts');
const studioCodeWorkspacePanelSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioCodeWorkspacePanel.tsx');
const studioPageSource = read('packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx');

assert.match(
  fileExplorerSource,
  /width\?: number;/,
  'FileExplorer must accept an optional width so editor workspaces can control explorer sizing instead of hard-coding a fixed width.',
);

assert.match(
  fileExplorerSource,
  /style=\{\{ width \}\}/,
  'FileExplorer must apply its width through inline style so workspace resize handles can control the explorer column width.',
);

assert.doesNotMatch(
  fileExplorerSource,
  /className="w-64 flex flex-col h-full bg-\[#0e0e11\] border-r border-white\/5 shrink-0"/,
  'FileExplorer must not hard-code a fixed 16rem width once explorer resizing is supported.',
);

assert.match(
  codeEditorWorkspacePanelTypesSource,
  /explorerWidth: number;/,
  'CodeEditorWorkspacePanel props must include the explorer width.',
);

assert.match(
  codeEditorWorkspacePanelTypesSource,
  /onExplorerResize: \(delta: number\) => void;/,
  'CodeEditorWorkspacePanel props must include a dedicated explorer resize callback.',
);

assert.match(
  codeEditorWorkspacePanelSource,
  /<FileExplorer[\s\S]*width=\{explorerWidth\}/s,
  'CodeEditorWorkspacePanel must pass its explorer width into FileExplorer.',
);

assert.match(
  codeEditorWorkspacePanelSource,
  /<ResizeHandle direction="horizontal" onResize=\{onExplorerResize\} \/>/s,
  'CodeEditorWorkspacePanel must expose a horizontal resize handle on the right edge of FileExplorer.',
);

assert.match(
  codePageSurfacePropsSource,
  /explorerWidth: editorExplorerWidth,/,
  'Code code-surface prop assembly must pass the current editor explorer width into the editor workspace panel.',
);

assert.match(
  codePageSurfacePropsSource,
  /onExplorerResize,/,
  'Code code-surface prop assembly must forward an explorer resize callback into the editor workspace panel bundle.',
);

assert.match(
  codePageSource,
  /onExplorerResize: handleEditorExplorerResize,/,
  'CodePage must route editor explorer resizing through a stable resize handler before delegating to the shared code-surface prop assembly.',
);

assert.match(
  studioCodeWorkspacePanelSource,
  /<FileExplorer[\s\S]*width=\{explorerWidth\}/s,
  'StudioCodeWorkspacePanel must pass its explorer width into FileExplorer.',
);

assert.match(
  studioCodeWorkspacePanelSource,
  /<ResizeHandle direction="horizontal" onResize=\{onExplorerResize\} \/>/s,
  'StudioCodeWorkspacePanel must expose a horizontal resize handle on the right edge of FileExplorer.',
);

assert.match(
  studioPageSource,
  /explorerWidth=\{codeExplorerWidth\}/,
  'StudioPage must provide the current code explorer width to StudioCodeWorkspacePanel.',
);

assert.match(
  studioPageSource,
  /onExplorerResize=\{handleStudioCodeExplorerResize\}/,
  'StudioPage must provide a dedicated explorer resize handler to StudioCodeWorkspacePanel.',
);

console.log('file explorer resize contract passed.');
