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
const codePageSurfacePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePageSurface.tsx',
);
const codePageSurfaceSource = fs.readFileSync(codePageSurfacePath, 'utf8');
const codeEditorWorkspacePanelPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);
const codeEditorWorkspacePanelSource = fs.readFileSync(codeEditorWorkspacePanelPath, 'utf8');
const universalChatPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'UniversalChat.tsx',
);
const universalChatSource = fs.readFileSync(universalChatPath, 'utf8');
const engineSelectionHookPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useCodingSessionEngineModelSelection.ts',
);
const engineSelectionHookSource = fs.readFileSync(engineSelectionHookPath, 'utf8');
const codePageSize = Buffer.byteLength(codePageSource, 'utf8');

assert.match(
  codePageSource,
  /from '\.\/CodePageSurface';/,
  'CodePage must delegate the composed workbench shell into CodePageSurface.',
);

assert.match(
  codePageSurfaceSource,
  /from '\.\/CodeWorkspaceOverlays';/,
  'CodePageSurface must own find-in-files and quick-open overlays after the workspace overlay split.',
);

assert.match(
  codePageSurfaceSource,
  /from '\.\/CodeEditorWorkspacePanel';/,
  'CodePageSurface must render the editor, diff, and sidebar-chat workspace through CodeEditorWorkspacePanel.',
);

assert.match(
  codePageSurfaceSource,
  /from '\.\/CodePageDialogs';/,
  'CodePageSurface must render modal and dialog orchestration through CodePageDialogs.',
);

assert.match(
  codePageSurfaceSource,
  /from '\.\/CodeTerminalIntegrationPanel';/,
  'CodePageSurface must render terminal integration through CodeTerminalIntegrationPanel instead of inlining the external terminal boundary.',
);

assert.match(
  codePageSource,
  /<CodePageSurface[\s\S]*overlayProps=\{overlayProps\}/s,
  'CodePage must pass workspace overlays through the shared surface component.',
);

assert.match(
  codePageSource,
  /<CodePageSurface[\s\S]*dialogProps=\{dialogProps\}/s,
  'CodePage must pass dialogs through the shared surface component.',
);

assert.match(
  codePageSource,
  /<CodePageSurface[\s\S]*workspaceProps=\{workspaceProps\}/s,
  'CodePage must pass the editor workspace panel through the shared surface component.',
);

assert.match(
  codePageSource,
  /showComposerEngineSelector:\s*!sessionId,/,
  'CodePage must hide the composer engine selector once a coding session exists so session engine and model stay immutable.',
);

assert.match(
  codePageSource,
  /<CodePageSurface[\s\S]*terminalProps=\{terminalProps\}/s,
  'CodePage must pass terminal integration through the shared surface component.',
);

assert.match(
  codePageSurfaceSource,
  /<CodeWorkspaceOverlays \{\.\.\.overlayProps\} \/>/,
  'CodePageSurface must render the extracted workspace overlays component.',
);

assert.match(
  codePageSurfaceSource,
  /<CodePageDialogs \{\.\.\.dialogProps\} \/>/,
  'CodePageSurface must render the extracted dialog component.',
);

assert.match(
  codePageSurfaceSource,
  /<CodeTerminalIntegrationPanel \{\.\.\.terminalProps\} \/>/,
  'CodePageSurface must render the extracted terminal integration component.',
);

assert.match(
  codeEditorWorkspacePanelSource,
  /showComposerEngineSelector=\{showComposerEngineSelector\}/,
  'CodeEditorWorkspacePanel must forward the code page session lock state into UniversalChat so the editor-side composer cannot mutate session engine/model.',
);

assert.match(
  universalChatSource,
  /const currentEngineSummary =\s*currentModelLabel\.trim\(\)\.toLowerCase\(\) === currentEngine\.label\.trim\(\)\.toLowerCase\(\)\s*\?\s*currentEngine\.label\s*:\s*`\$\{currentEngine\.label\} \/ \$\{currentModelLabel\}`;/s,
  'UniversalChat should collapse duplicate engine and model labels into one summary string so labels like "OpenCode / OpenCode" never render.',
);

assert.match(
  universalChatSource,
  /\{currentEngineSummary\}/,
  'UniversalChat should render the de-duplicated engine summary in both the header and composer selector.',
);

assert.match(
  universalChatSource,
  /useEffect\(\(\) => \{\s*setSelectedProvider\(\(previousProvider\) =>\s*previousProvider === resolvedSelectedEngineId\s*\?\s*previousProvider\s*:\s*resolvedSelectedEngineId,\s*\);\s*\}, \[resolvedSelectedEngineId\]\);/s,
  'UniversalChat should resynchronize its internal provider menu state whenever the externally selected engine changes so session switches cannot leave a stale provider highlighted.',
);

assert.match(
  engineSelectionHookSource,
  /if \(sessionId\) \{\s*return;\s*\}/,
  'The shared engine/model selection hook must refuse to mutate an existing coding session engine or model.',
);

assert.doesNotMatch(
  engineSelectionHookSource,
  /await updateCodingSession\(/,
  'The shared engine/model selection hook must no longer persist engine/model edits into an existing session after creation.',
);

assert.ok(
  codePageSize < 50000,
  `CodePage should stay below 50000 bytes after componentization, received ${codePageSize}.`,
);

assert.doesNotMatch(
  codePageSource,
  /top-16 right-1\/2 translate-x-1\/2 w-\[32rem\]/,
  'CodePage should not inline the find-in-files overlay after the workspace overlay split.',
);

assert.doesNotMatch(
  codePageSurfaceSource,
  /<RunConfigurationDialog[\s\S]*<RunTaskDialog/s,
  'CodePageSurface should not inline run configuration and run task dialogs after the dialog split.',
);

assert.doesNotMatch(
  `${codePageSource}\n${codePageSurfaceSource}`,
  /TerminalPage/u,
  'CodePage shell should not reference any local BirdCoder terminal page implementation after direct sdkwork-terminal integration.',
);

console.log('code page componentization contract passed.');
