import assert from 'node:assert/strict';
import fs from 'node:fs';

const fileExplorerSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);
const workspacePanelSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx', import.meta.url),
  'utf8',
);

assert.match(
  fileExplorerSource,
  /isActive\?: boolean;/,
  'FileExplorer must accept an optional activity flag so hidden editor workspaces can suspend event listeners without losing local tree state.',
);

assert.match(
  fileExplorerSource,
  /isActive = true/,
  'FileExplorer must default the activity flag to true so standalone explorer surfaces keep their existing behavior.',
);

assert.match(
  fileExplorerSource,
  /if \(!isActive\) \{\s*return;\s*\}/s,
  'FileExplorer must guard hidden-state effects instead of keeping global or viewport listeners active while the editor surface is hidden.',
);

assert.match(
  workspacePanelSource,
  /<FileExplorer[\s\S]*isActive=\{isActive\}/s,
  'CodeEditorWorkspacePanel must forward its activity flag into FileExplorer so hidden editor tabs stop background explorer listeners.',
);

console.log('file explorer inactive gating performance contract passed.');
