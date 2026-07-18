import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const codePagePath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodePage.tsx',
);

const codePageSource = fs.readFileSync(codePagePath, 'utf8');
const codePageSurfacePath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodePageSurface.tsx',
);
const codePageSurfaceSource = fs.readFileSync(codePageSurfacePath, 'utf8');
const codeEditorWorkspacePanelPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);
const codeEditorWorkspacePanelSource = fs.readFileSync(codeEditorWorkspacePanelPath, 'utf8');
const universalChatPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'UniversalChat.tsx',
);
const universalChatSource = fs.readFileSync(universalChatPath, 'utf8');
const sharedComposerFooterSource = fs.readFileSync(path.join(
  rootDir,
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-ui',
  'src',
  'components',
  'chat',
  'composer',
  'SharedComposerFooter.tsx',
), 'utf8');
const engineSelectionHookPath = path.join(
  rootDir,
  'apps',
    'sdkwork-birdcoder-pc',
    'packages',
  
  'sdkwork-birdcoder-pc-workbench',
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
  /showComposerEngineSelector:\s*true,/,
  'CodePage must expose per-turn composer model selection for both new and existing coding sessions.',
);

assert.match(
  codePageSource,
  /<CodePageSurface[\s\S]*terminalProps=\{terminalProps\}/s,
  'CodePage must pass terminal integration through the shared surface component.',
);

assert.match(
  codePageSurfaceSource,
  /<DeferredCodeWorkspaceOverlays \{\.\.\.overlayProps\} \/>/,
  'CodePageSurface must render the deferred workspace overlays component.',
);

assert.match(
  codePageSurfaceSource,
  /<DeferredCodePageDialogs \{\.\.\.dialogProps\} \/>/,
  'CodePageSurface must render the deferred dialog component.',
);

assert.match(
  codePageSurfaceSource,
  /<DeferredCodeTerminalIntegrationPanel \{\.\.\.terminalProps\} \/>/,
  'CodePageSurface must render the deferred terminal integration component.',
);

assert.match(
  codeEditorWorkspacePanelSource,
  /showComposerEngineSelector=\{showComposerEngineSelector\}/,
  'CodeEditorWorkspacePanel must forward composer model-picker visibility into UniversalChat.',
);

assert.match(
  universalChatSource,
  /const currentEngineSummary =\s*currentModelLabel\.trim\(\)\.toLowerCase\(\) === currentEngine\.label\.trim\(\)\.toLowerCase\(\)\s*\?\s*currentEngine\.label\s*:\s*`\$\{currentEngine\.label\} \/ \$\{currentModelLabel\}`;/s,
  'UniversalChat should collapse duplicate engine and model labels into one summary string so labels like "OpenCode / OpenCode" never render.',
);

assert.match(
  universalChatSource,
  /\{currentEngineSummary\}/,
  'UniversalChat should render the de-duplicated engine summary in its engine header.',
);

assert.match(
  sharedComposerFooterSource,
  /import \{ createFallbackModel, ModelPicker \} from '@sdkwork\/models-pc-picker';/,
  'The shared composer footer must consume the SDKWork model picker instead of maintaining a local vendor menu.',
);

assert.match(
  universalChatSource,
  /const currentModelPickerId = buildWorkbenchModelPickerId\(\s*resolvedSelectedEngineId,\s*currentModelId,\s*\);/s,
  'UniversalChat must derive the picker selection from the externally synchronized engine and model.',
);

assert.match(
  universalChatSource,
  /<UniversalChatComposerFooter[\s\S]*onSelectModel=\{handleComposerModelSelect\}[\s\S]*selectedModelPickerId=\{currentModelPickerId\}/s,
  'UniversalChat must route shared composer footer selections through its engine/model selection adapter.',
);

assert.doesNotMatch(
  universalChatSource,
  /<ModelPicker/u,
  'UniversalChat must not inline model picker presentation after composer footer componentization.',
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
