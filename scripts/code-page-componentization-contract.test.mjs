import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codePagePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);

const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const codePageSize = Buffer.byteLength(codePageSource, 'utf8');

assert.match(
  codePageSource,
  /from '\.\/CodeWorkspaceOverlays';/,
  'CodePage must move find-in-files and quick-open overlays into CodeWorkspaceOverlays.',
);

assert.match(
  codePageSource,
  /from '\.\/CodeEditorWorkspacePanel';/,
  'CodePage must move the editor, diff, and sidebar-chat workspace into CodeEditorWorkspacePanel.',
);

assert.match(
  codePageSource,
  /from '\.\/CodePageDialogs';/,
  'CodePage must move modal and dialog orchestration into CodePageDialogs.',
);

assert.match(
  codePageSource,
  /from '\.\/CodeTerminalIntegrationPanel';/,
  'CodePage must render terminal integration through CodeTerminalIntegrationPanel instead of inlining the external terminal boundary.',
);

assert.ok(
  codePageSize < 46000,
  `CodePage should stay below 46000 bytes after componentization, received ${codePageSize}.`,
);

assert.doesNotMatch(
  codePageSource,
  /top-16 right-1\/2 translate-x-1\/2 w-\[32rem\]/,
  'CodePage should not inline the find-in-files overlay after the workspace overlay split.',
);

assert.doesNotMatch(
  codePageSource,
  /<RunConfigurationDialog[\s\S]*<RunTaskDialog/s,
  'CodePage should not inline run configuration and run task dialogs after the dialog split.',
);

assert.doesNotMatch(
  codePageSource,
  /const TerminalPage = lazy\(/,
  'CodePage should not lazy-load the terminal boundary directly after the integration panel split.',
);

console.log('code page componentization contract passed.');
