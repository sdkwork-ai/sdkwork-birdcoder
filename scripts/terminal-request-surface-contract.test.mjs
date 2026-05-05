import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/terminal/runtime.ts', import.meta.url),
  'utf8',
);
const runConfigsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts', import.meta.url),
  'utf8',
);
const appSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx', import.meta.url),
  'utf8',
);
const codeWorkbenchCommandsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/useCodeWorkbenchCommands.ts', import.meta.url),
  'utf8',
);
const codePageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const codingSessionTerminalSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/codingSessionTerminal.ts', import.meta.url),
  'utf8',
);
const codePageTerminalActionsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/useCodePageTerminalActions.ts', import.meta.url),
  'utf8',
);
const projectExplorerTypesSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorer.types.ts', import.meta.url),
  'utf8',
);
const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);
const sessionContextMenuSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorerSessionContextMenu.tsx', import.meta.url),
  'utf8',
);
const sessionInventorySource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts', import.meta.url),
  'utf8',
);
const nativeSessionAuthoritySource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/workbench/nativeSessionAuthority.ts', import.meta.url),
  'utf8',
);
const studioWorkbenchBindingsSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/useStudioWorkbenchEventBindings.ts', import.meta.url),
  'utf8',
);
const fileExplorerSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-ui/src/components/FileExplorer.tsx', import.meta.url),
  'utf8',
);

assert.match(
  runtimeSource,
  /export type TerminalCommandSurface = 'workspace' \| 'embedded';/,
  'Terminal command requests must declare an explicit workspace-vs-embedded destination surface.',
);

assert.match(
  runtimeSource,
  /export interface TerminalCommandRequest \{[\s\S]*surface: TerminalCommandSurface;[\s\S]*timestamp: number;[\s\S]*\}/,
  'Every terminal command request must carry a required surface field.',
);

assert.match(
  runtimeSource,
  /surface: overrides\.surface \?\? 'workspace'/,
  'Default terminal requests must target the full Terminal workspace.',
);

const emitOpenTerminalRequestMatch = runtimeSource.match(
  /export function emitOpenTerminalRequest\([\s\S]*?\n\}/,
);
assert.ok(
  emitOpenTerminalRequestMatch,
  'Terminal runtime must expose emitOpenTerminalRequest.',
);
assert.doesNotMatch(
  emitOpenTerminalRequestMatch[0],
  /emitOpenTerminalVisibility|openTerminal/,
  'Terminal command requests must not emit generic openTerminal visibility events that embedded panels also consume.',
);

assert.match(
  appSource,
  /const isWorkspaceTerminalRequest = \(request: TerminalCommandRequest\): boolean =>\s*request\.surface === 'workspace';/,
  'App shell must keep a single predicate for workspace terminal requests.',
);

assert.match(
  appSource,
  /const handleTerminalRequest = \(req: TerminalCommandRequest\) => \{[\s\S]*if \(!isWorkspaceTerminalRequest\(req\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(req\);[\s\S]*focusTerminalSurface\(\{ forceWorkspace: true \}\);[\s\S]*\};/,
  'App shell must ignore embedded terminal requests and only focus Terminal for workspace requests.',
);

assert.match(
  codeWorkbenchCommandsSource,
  /const handleTerminalRequest = \(request: TerminalCommandRequest\) => \{[\s\S]*if \(request\.surface !== 'embedded'\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(request\);[\s\S]*setIsTerminalOpen\(true\);[\s\S]*\};/,
  'Code workbench must only open the embedded terminal for embedded terminal requests.',
);

assert.match(
  studioWorkbenchBindingsSource,
  /const handleTerminalRequest = \(request: TerminalCommandRequest\) => \{[\s\S]*if \(request\.surface !== 'embedded'\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setTerminalRequest\(request\);[\s\S]*setIsTerminalOpen\(true\);[\s\S]*\};/,
  'Studio workbench must only open the embedded terminal for embedded terminal requests.',
);

assert.match(
  runConfigsSource,
  /surface: 'embedded'/,
  'Run configurations must target embedded terminals so run/debug workflows stay in their workbench.',
);

assert.match(
  codeWorkbenchCommandsSource,
  /emitOpenTerminalRequest\(\{[\s\S]*surface: 'embedded'[\s\S]*command: 'npm start'[\s\S]*\}\);/,
  'Code fallback run-without-debugging must target the embedded terminal.',
);

assert.match(
  codePageTerminalActionsSource,
  /emitOpenTerminalRequest\(\{[\s\S]*surface: 'workspace'[\s\S]*path: target\.projectPath[\s\S]*\}\);/,
  'Project context-menu terminal launches must target the full Terminal workspace.',
);

assert.match(
  projectExplorerTypesSource,
  /onOpenCodingSessionInTerminal\?: \(id: string, nativeSessionId\?: string\) => void;/,
  'Project explorer props must expose a session-specific open-in-terminal action with the loaded nativeSessionId instead of overloading project terminal actions.',
);

assert.match(
  sessionContextMenuSource,
  /onOpenInTerminal\?: \(id: string, nativeSessionId\?: string\) => void;/,
  'Session context menu must accept an open-in-terminal callback with the loaded nativeSessionId.',
);
assert.match(
  sessionContextMenuSource,
  /onOpenInTerminal\?\.\(sessionId, session\?\.nativeSessionId\?\.trim\(\)\);[\s\S]*onClose\(\);[\s\S]*\{t\('code\.openInTerminal'\)\}/,
  'Session context menu must render and invoke an open-in-terminal menu item with the target session nativeSessionId.',
);

assert.match(
  sidebarSource,
  /left\.onOpenCodingSessionInTerminal === right\.onOpenCodingSessionInTerminal/,
  'Sidebar memo equality must include the session terminal action callback.',
);
assert.match(
  sidebarSource,
  /onOpenInTerminal=\{onOpenCodingSessionInTerminal\}/,
  'Sidebar must pass the session terminal action into ProjectExplorerSessionContextMenu.',
);

assert.match(
  codingSessionTerminalSource,
  /getWorkbenchCodeEngineKernel\(input\.codingSession\.engineId\)\.terminalProfileId/,
  'Session terminal launch plans must derive the terminal profile from the selected session code engine.',
);
assert.match(
  codingSessionTerminalSource,
  /Pick<BirdCoderCodingSession,\s*'engineId' \| 'nativeSessionId'>/,
  'Session terminal launch plans must accept only the engine id and provider-native session id needed for engine resume.',
);
assert.match(
  codingSessionTerminalSource,
  /buildWorkbenchCodeEngineTerminalResumeCommand\(\{[\s\S]*engineId: input\.codingSession\.engineId,[\s\S]*nativeSessionId: input\.codingSession\.nativeSessionId,[\s\S]*\}\)/m,
  'Session terminal launch plans must build the engine-specific resume command from the selected provider-native session id.',
);
assert.doesNotMatch(
  codingSessionTerminalSource,
  /sessionId: input\.codingSession\.id/,
  'Session terminal launch plans must not use the BirdCoder coding session id as the engine resume id.',
);
assert.match(
  codePageTerminalActionsSource,
  /Pick<BirdCoderCodingSession,\s*'id' \| 'engineId' \| 'title' \| 'nativeSessionId'>/,
  'Session terminal actions must resolve sessions with nativeSessionId available for terminal resume.',
);
assert.match(
  codingSessionTerminalSource,
  /request: \{[\s\S]*surface: 'workspace'[\s\S]*path: input\.projectPath[\s\S]*command: resumeCommand[\s\S]*profileId: terminalProfile\.id[\s\S]*timestamp: input\.timestamp \?\? Date\.now\(\)[\s\S]*\}/m,
  'Session terminal launch plans must target the full Terminal workspace with the resolved engine terminal profile, project path, and resume command.',
);
assert.match(
  codePageTerminalActionsSource,
  /resolveCodingSessionNativeSessionId:\s*\(\s*codingSessionId: string,\s*\) => Promise<string \| null> \| string \| null;/m,
  'Session terminal actions must accept the shared authoritative native-session-id resolver.',
);
assert.match(
  codePageTerminalActionsSource,
  /const handleOpenCodingSessionInTerminal = useCallback\(async \(\s*codingSessionId: string,\s*nativeSessionIdFromList\?: string \| null,\s*\) => \{[\s\S]*resolveSession\(codingSessionId\)[\s\S]*resolveProjectActionTarget\(resolvedSessionLocation\?\.project\)[\s\S]*nativeSessionIdFromList\?\.trim\(\) \|\|[\s\S]*await resolveCodingSessionNativeSessionId\(codingSessionId\)[\s\S]*buildCodingSessionTerminalLaunchPlan\(\{[\s\S]*codingSession: \{ \.\.\.codingSession, nativeSessionId \},[\s\S]*projectPath: target\.projectPath[\s\S]*emitOpenTerminalRequest\(launchPlan\.request\);/m,
  'Session context-menu terminal actions must use the loaded session-list native id before falling back to authoritative resolution.',
);
assert.match(
  codePageTerminalActionsSource,
  /const nativeSessionId = normalizeCodingSessionNativeSessionId\(\s*[\s\S]*nativeSessionIdFromList\?\.trim\(\) \|\|[\s\S]*\(await resolveCodingSessionNativeSessionId\(codingSessionId\)\)\?\.trim\(\) \|\|[\s\S]*null,[\s\S]*codingSession\.engineId,[\s\S]*\);/m,
  'Session context-menu terminal actions must read nativeSessionId directly from the loaded session item and normalize legacy prefixes before terminal resume.',
);
assert.match(
  codePageSource,
  /const resolveCodingSessionNativeSessionId = useCallback\(async \(codingSessionId: string\) => \{[\s\S]*resolveSession\(codingSessionId\)\?\.codingSession\.nativeSessionId\?\.trim\(\)[\s\S]*coreReadService\.getCodingSession\(codingSessionId\)[\s\S]*session\.nativeSessionId\?\.trim\(\)/m,
  'CodePage must resolve native session ids from local state first and coreReadService second, matching the message-list authority path.',
);
assert.match(
  codePageTerminalActionsSource,
  /const handleCopySessionId = useCallback\(async \(\s*codingSessionId: string,\s*nativeSessionIdFromList\?: string \| null,\s*\) => \{[\s\S]*resolveSession\(codingSessionId\)[\s\S]*normalizeCodingSessionNativeSessionId\([\s\S]*nativeSessionIdFromList\?\.trim\(\) \|\|[\s\S]*await resolveCodingSessionNativeSessionId\(codingSessionId\)[\s\S]*copyTextToClipboard\(nativeSessionId\);/m,
  'Session ID copy must copy the normalized raw provider-native session id through the shared clipboard boundary before falling back to authority.',
);
assert.doesNotMatch(
  codePageTerminalActionsSource,
  /const handleCopySessionId = useCallback\(\(codingSessionId: string\) => \{[\s\S]*(?:navigator\.clipboard\.writeText|copyTextToClipboard)\(codingSessionId\);/m,
  'Session ID copy must not write the BirdCoder coding session id to the clipboard.',
);
assert.match(
  projectExplorerTypesSource,
  /onOpenCodingSessionInTerminal\?: \(id: string, nativeSessionId\?: string\) => void;/,
  'Project explorer session actions must pass the loaded session-list nativeSessionId to terminal resume.',
);
assert.match(
  projectExplorerTypesSource,
  /onCopyCodingSessionSessionId\?: \(id: string, nativeSessionId\?: string\) => void;/,
  'Project explorer session actions must pass the loaded session-list nativeSessionId to copy session ID.',
);
assert.match(
  sessionContextMenuSource,
  /onOpenInTerminal\?: \(id: string, nativeSessionId\?: string\) => void;/,
  'Session context menu terminal action must accept the loaded nativeSessionId from its session item.',
);
assert.match(
  sessionContextMenuSource,
  /onCopySessionId\?: \(id: string, nativeSessionId\?: string\) => void;/,
  'Session context menu copy action must accept the loaded nativeSessionId from its session item.',
);
assert.match(
  sessionContextMenuSource,
  /onOpenInTerminal\?\.\(sessionId, session\?\.nativeSessionId\?\.trim\(\)\);/,
  'Session context menu must pass session.nativeSessionId from the loaded session item to terminal resume.',
);
assert.match(
  sessionContextMenuSource,
  /onCopySessionId\?\.\(sessionId, session\?\.nativeSessionId\?\.trim\(\)\);/,
  'Session context menu must pass session.nativeSessionId from the loaded session item to copy session ID.',
);
assert.match(
  codePageSource,
  /const \{[\s\S]*handleCopySessionId,[\s\S]*handleOpenCodingSessionInTerminal,[\s\S]*handleOpenInTerminal,[\s\S]*\} = useCodePageTerminalActions\(\{[\s\S]*resolveCodingSessionNativeSessionId,[\s\S]*resolveProjectActionTarget,[\s\S]*resolveProjectById,[\s\S]*resolveSession,[\s\S]*t,[\s\S]*\}\)/m,
  'CodePage must delegate terminal actions to the dedicated terminal action hook to preserve componentization boundaries.',
);
assert.match(
  sessionInventorySource,
  /function toProjectBackedCodingSessionInventoryRecord\([\s\S]*nativeSessionId: normalizeInventoryNativeSessionId\([\s\S]*codingSession\.nativeSessionId,[\s\S]*codingSession\.engineId,[\s\S]*\),[\s\S]*kind: 'coding'/m,
  'Project-backed session inventory records must preserve nativeSessionId from each loaded session item as a normalized raw provider id.',
);
assert.match(
  nativeSessionAuthoritySource,
  /function toStoredNativeSessionSummary\([\s\S]*normalizeBirdCoderCodeEngineNativeSessionId\(summary\.nativeSessionId \?\? summary\.id, summary\.engineId\)[\s\S]*kind: 'coding',[\s\S]*nativeSessionId,/m,
  'Authority-backed native session inventory records must preserve nativeSessionId in each list item as a normalized raw provider id.',
);

const fileExplorerTerminalRequestBlocks = [
  ...fileExplorerSource.matchAll(/emitOpenTerminalRequest\(\{[\s\S]*?\}\);/g),
].map((match) => match[0]);
const directoryTerminalRequestBlocks = fileExplorerTerminalRequestBlocks.filter(
  (block) => block.includes('projectBasePath') || block.includes('targetPath'),
);

assert.equal(
  directoryTerminalRequestBlocks.length,
  2,
  'File explorer should expose exactly root and directory open-in-terminal launch requests.',
);
assert.ok(
  directoryTerminalRequestBlocks.every((block) => block.includes("surface: 'workspace'")),
  'File explorer root and directory terminal launches must target the full Terminal workspace.',
);

console.log('terminal request surface contract passed.');
