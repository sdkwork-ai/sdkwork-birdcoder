import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url);
const codeEditorPath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/CodeEditor.tsx',
  import.meta.url,
);
const diffEditorPath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/DiffEditor.tsx',
  import.meta.url,
);
const codeEditorSurfacePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodeEditorSurface.tsx',
  import.meta.url,
);
const codeEditorWorkspacePanelPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodeEditorWorkspacePanel.tsx',
  import.meta.url,
);
const codeTerminalPanelPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/CodeTerminalIntegrationPanel.tsx',
  import.meta.url,
);
const studioPagePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx',
  import.meta.url,
);
const studioCodeWorkspacePanelPath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/StudioCodeWorkspacePanel.tsx',
  import.meta.url,
);
const studioPreviewPanelPath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/preview/StudioPreviewPanel.tsx',
  import.meta.url,
);
const studioSimulatorPanelPath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/simulator/StudioSimulatorPanel.tsx',
  import.meta.url,
);
const studioTerminalPanelPath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/StudioTerminalIntegrationPanel.tsx',
  import.meta.url,
);
const studioWorkspaceOverlaysPath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/StudioWorkspaceOverlays.tsx',
  import.meta.url,
);
const studioStageHeaderPath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/preview/StudioStageHeader.tsx',
  import.meta.url,
);
const monacoRuntimePath = new URL(
  '../packages/sdkwork-birdcoder-ui/src/components/monacoRuntime.ts',
  import.meta.url,
);
const resizeHandlePath = new URL(
  '../packages/sdkwork-birdcoder-ui-shell/src/components/ResizeHandle.tsx',
  import.meta.url,
);

const appSource = fs.readFileSync(appPath, 'utf8');
const codeEditorSource = fs.readFileSync(codeEditorPath, 'utf8');
const diffEditorSource = fs.readFileSync(diffEditorPath, 'utf8');
const codeEditorSurfaceSource = fs.readFileSync(codeEditorSurfacePath, 'utf8');
const codeEditorWorkspacePanelSource = fs.readFileSync(codeEditorWorkspacePanelPath, 'utf8');
const codeTerminalPanelSource = fs.readFileSync(codeTerminalPanelPath, 'utf8');
const studioPageSource = fs.readFileSync(studioPagePath, 'utf8');
const studioCodeWorkspacePanelSource = fs.readFileSync(studioCodeWorkspacePanelPath, 'utf8');
const studioPreviewPanelSource = fs.readFileSync(studioPreviewPanelPath, 'utf8');
const studioSimulatorPanelSource = fs.readFileSync(studioSimulatorPanelPath, 'utf8');
const studioTerminalPanelSource = fs.readFileSync(studioTerminalPanelPath, 'utf8');
const studioWorkspaceOverlaysSource = fs.readFileSync(studioWorkspaceOverlaysPath, 'utf8');
const studioStageHeaderSource = fs.readFileSync(studioStageHeaderPath, 'utf8');
const monacoRuntimeSource = fs.readFileSync(monacoRuntimePath, 'utf8');
const resizeHandleSource = fs.readFileSync(resizeHandlePath, 'utf8');

assert.doesNotMatch(
  appSource,
  /window\.dispatchEvent\(new Event\('resize'\)\)/,
  'Desktop maximize and restore must not synthesize extra window resize events because the real webview resize already happens natively and duplicate resize dispatches stall the main thread during window IPC interactions.',
);

assert.doesNotMatch(
  appSource,
  /await desktopWindow\.toggleMaximize\(\);/,
  'Maximize handling must not block the UI thread on toggleMaximize completion before front-end layout recovery starts.',
);

assert.match(
  appSource,
  /void desktopWindow[\s\S]*\.toggleMaximize\(\)[\s\S]*\.then\(\(\) => \{/,
  'Maximize handling must kick off the native toggle asynchronously and reconcile frame state after the command returns.',
);

assert.doesNotMatch(
  codeEditorSource,
  /automaticLayout:\s*true/,
  'Code editor must not rely on Monaco automaticLayout because nested automatic observers stall maximize and restore in split-pane layouts.',
);

assert.match(
  diffEditorSource,
  /automaticLayout:\s*false/,
  'Diff editor must disable Monaco automaticLayout and use the shared controlled layout path.',
);

assert.match(
  codeEditorSource,
  /observeBirdCoderMonacoLayout/,
  'Code editor must use the shared controlled Monaco layout observer for responsive resize behavior.',
);

assert.match(
  diffEditorSource,
  /observeBirdCoderMonacoLayout/,
  'Diff editor must use the shared controlled Monaco layout observer for responsive resize behavior.',
);

assert.match(
  monacoRuntimeSource,
  /new ResizeObserver/,
  'Shared Monaco layout runtime must observe container size changes directly.',
);

assert.match(
  monacoRuntimeSource,
  /requestAnimationFrame/,
  'Shared Monaco layout runtime must batch layout work onto animation frames during resize bursts.',
);

assert.match(
  resizeHandleSource,
  /requestAnimationFrame/,
  'Resize handles must batch drag deltas on animation frames so split-pane resizing does not saturate React updates during host resize bursts.',
);

assert.match(
  codeEditorSurfaceSource,
  /export const CodeEditorSurface = memo/,
  'Code editor surface must be memoized so window resize does not rerender Monaco wrappers when only sibling pane width changes.',
);

assert.match(
  codeEditorWorkspacePanelSource,
  /const CodeEditorWorkspaceChatPanel = memo/,
  'Code workspace chat shell must be memoized so split-pane width changes do not rerender the chat runtime when transcript data is unchanged.',
);

assert.match(
  codeTerminalPanelSource,
  /export const CodeTerminalIntegrationPanel = memo/,
  'Code terminal integration panel must be memoized so unrelated layout state changes do not rerender the terminal host.',
);
assert.match(
  codeTerminalPanelSource,
  /from ['"]@sdkwork\/birdcoder-ui-shell['"][\s\S]*ResizeHandle/u,
  'Code terminal integration panel must import the shared resize handle directly after removing the extra terminal frame wrapper.',
);

assert.match(
  codeTerminalPanelSource,
  /<>\s*\{isOpen \? <ResizeHandle direction="vertical" onResize=\{onResize\} \/> : null\}\s*<div[\s\S]*<DesktopTerminalApp/s,
  'Code terminal integration panel must inline the lightweight resize frame and render DesktopTerminalApp directly inside it.',
);

assert.doesNotMatch(
  codeTerminalPanelSource,
  /TerminalIntegrationFrame/u,
  'Code terminal integration panel should not depend on a BirdCoder-owned terminal frame component.',
);

assert.match(
  studioPageSource,
  /const memoizedDevicePreviewProps = useMemo/,
  'Studio page must memoize device preview props so sidebar width changes do not rerender preview and simulator surfaces unnecessarily.',
);

assert.match(
  studioPreviewPanelSource,
  /export const StudioPreviewPanel = memo/,
  'Studio preview panel must be memoized so sidebar resizing does not rerender the embedded preview surface.',
);

assert.match(
  studioSimulatorPanelSource,
  /export const StudioSimulatorPanel = memo/,
  'Studio simulator panel must be memoized so sidebar resizing does not rerender the simulator surface.',
);

assert.match(
  studioCodeWorkspacePanelSource,
  /export const StudioCodeWorkspacePanel = memo/,
  'Studio code workspace panel must be memoized so sidebar resizing does not rerender the editor shell when file data is unchanged.',
);

assert.match(
  studioTerminalPanelSource,
  /export const StudioTerminalIntegrationPanel = memo/,
  'Studio terminal integration panel must be memoized so unrelated layout state changes do not rerender the terminal host.',
);
assert.match(
  studioTerminalPanelSource,
  /from ['"]@sdkwork\/birdcoder-ui-shell['"][\s\S]*ResizeHandle/u,
  'Studio terminal integration panel must import the shared resize handle directly after removing the extra terminal frame wrapper.',
);

assert.match(
  studioTerminalPanelSource,
  /<>\s*\{isOpen \? <ResizeHandle direction="vertical" onResize=\{onResize\} \/> : null\}\s*<div[\s\S]*<DesktopTerminalApp/s,
  'Studio terminal integration panel must inline the lightweight resize frame and render DesktopTerminalApp directly inside it.',
);

assert.doesNotMatch(
  studioTerminalPanelSource,
  /TerminalIntegrationFrame/u,
  'Studio terminal integration panel should not depend on a BirdCoder-owned terminal frame component.',
);

assert.match(
  studioWorkspaceOverlaysSource,
  /export const StudioWorkspaceOverlays = memo/,
  'Studio workspace overlays must be memoized so sidebar resizing does not rerender find and quick-open overlays when their state is unchanged.',
);

assert.match(
  studioStageHeaderSource,
  /export const StudioStageHeader = memo/,
  'Studio stage header must be memoized so sidebar resizing does not rerender the preview control strip when preview state is unchanged.',
);

console.log('desktop resize responsiveness contract passed.');
