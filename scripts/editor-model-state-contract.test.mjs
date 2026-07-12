import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const codeEditorSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/CodeEditor.tsx',
);
const modelPathSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/editorModelPath.ts',
);
const codeEditorSurfaceSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/CodeEditorSurface.tsx',
);
const studioEditorSurfaceSource = read(
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/StudioCodeWorkspacePanel.tsx',
);

assert.match(
  modelPathSource,
  /birdcoder:\/\/editor\/\$\{encodeURIComponent\(normalizedSurface\)\}\/\$\{encodeURIComponent\(normalizedProjectId\)\}\/\$\{encodeURIComponent\(normalizedFilePath\)\}/,
  'Editor model URIs must be isolated by surface, project, and file path.',
);
assert.match(
  codeEditorSource,
  /path=\{path\}[\s\S]*saveViewState=\{Boolean\(path\)\}/,
  'CodeEditor must use Monaco path-backed models and preserve per-file view state.',
);
assert.match(
  codeEditorSource,
  /retainedModelPaths\?\: readonly string\[\]/,
  'CodeEditor must receive the set of open model paths so closed-file models can be disposed.',
);
assert.match(
  codeEditorSource,
  /getModel\(monaco\.Uri\.parse\(ownedPath\)\)\?\.dispose\(\)/,
  'CodeEditor must dispose models that are no longer retained by an open editor tab.',
);
assert.match(
  codeEditorSurfaceSource,
  /buildBirdCoderEditorModelPath\('code', currentProjectId, selectedFile\)/,
  'The Code surface must scope Monaco models to the active project.',
);
assert.match(
  studioEditorSurfaceSource,
  /buildBirdCoderEditorModelPath\('studio', currentProjectId, selectedFile\)/,
  'The Studio surface must scope Monaco models independently from the Code surface.',
);
assert.doesNotMatch(
  studioEditorSurfaceSource,
  /<ContentWorkbench\s+key=\{selectedFile\}/,
  'Studio must switch Monaco path-backed models without remounting the entire workbench.',
);

console.log('editor model state contract passed.');
