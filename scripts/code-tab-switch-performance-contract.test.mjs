import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codePageSurfaceSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-code',
    'src',
    'pages',
    'CodePageSurface.tsx',
  ),
  'utf8',
);
const workspacePanelSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-code',
    'src',
    'pages',
    'CodeEditorWorkspacePanel.tsx',
  ),
  'utf8',
);
const workspacePanelTypesSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-code',
    'src',
    'pages',
    'codeEditorWorkspacePanel.types.ts',
  ),
  'utf8',
);

assert.match(
  workspacePanelTypesSource,
  /isActive: boolean;/,
  'CodeEditorWorkspacePanel must accept an activity flag so the editor workspace can stay mounted while inactive mode updates are skipped.',
);

assert.match(
  codePageSurfaceSource,
  /<CodeEditorWorkspacePanel \{\.\.\.workspaceProps\} isActive=\{activeTab === 'editor'\} \/>/,
  'CodePageSurface must keep the editor workspace mounted and drive visibility through an explicit activity prop instead of re-mounting it on every mode switch.',
);

assert.match(
  codePageSurfaceSource,
  /<CodePageMainChatPanel chatProps=\{mainChatProps\} isActive=\{activeTab === 'ai'\} \/>/,
  'CodePageSurface must keep the AI chat mounted behind an activity-aware wrapper so mode switches do not re-mount the full chat tree.',
);

assert.doesNotMatch(
  codePageSurfaceSource,
  /activeTab === 'ai' \?[\s\S]*<UniversalChat \{\.\.\.mainChatProps\} \/>[\s\S]*<CodeEditorWorkspacePanel \{\.\.\.workspaceProps\} \/>/s,
  'CodePageSurface must not rely on a ternary branch that re-mounts the AI chat and editor workspace when users switch modes.',
);

console.log('code tab switch performance contract passed.');
