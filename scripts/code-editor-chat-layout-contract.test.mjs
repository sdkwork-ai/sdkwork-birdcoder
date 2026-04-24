import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const preferencesModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts',
  import.meta.url,
);
const layoutModulePath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/codeEditorChatLayout.ts',
  import.meta.url,
);

const preferencesSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'workbench',
  'preferences.ts',
);
const preferencesHookSource = readSource(
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'hooks',
  'useWorkbenchPreferences.ts',
);
const codePageSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePage.tsx',
);
const codePageSurfaceSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodePageSurface.tsx',
);
const codeEditorChatLayoutSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'codeEditorChatLayout.ts',
);
const codeEditorChatHookSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'useCodeEditorChatLayout.ts',
);
const editorWorkspacePanelSource = readSource(
  'packages',
  'sdkwork-birdcoder-code',
  'src',
  'pages',
  'CodeEditorWorkspacePanel.tsx',
);
const universalChatSource = readSource(
  'packages',
  'sdkwork-birdcoder-ui',
  'src',
  'components',
  'UniversalChat.tsx',
);

assert.match(
  preferencesSource,
  /codeEditorChatWidth: number;/,
  'Workbench preferences must define a persisted code editor chat width field.',
);

assert.match(
  preferencesSource,
  /codeEditorChatWidth\?: number \| null;/,
  'Workbench preferences input must accept an optional code editor chat width override.',
);

assert.match(
  preferencesSource,
  /export const DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 520;/,
  'Workbench preferences must raise the default editor-mode chat width by 30 percent.',
);

assert.match(
  preferencesSource,
  /export function normalizeWorkbenchCodeEditorChatWidth\(/,
  'Workbench preferences must normalize persisted code editor chat width values.',
);

assert.match(
  preferencesSource,
  /codeEditorChatWidth: normalizeWorkbenchCodeEditorChatWidth\(value\?\.codeEditorChatWidth\),/,
  'Workbench preferences normalization must persist the normalized code editor chat width.',
);

assert.match(
  preferencesHookSource,
  /left\.codeEditorChatWidth === right\.codeEditorChatWidth/,
  'Workbench preference equality must track the persisted code editor chat width.',
);

assert.match(
  codePageSource,
  /from '\.\/useCodeEditorChatLayout';/,
  'CodePage must move editor-mode chat width state into a dedicated layout hook.',
);

assert.match(
  codeEditorChatLayoutSource,
  /export const CODE_EDITOR_FILE_EXPLORER_WIDTH = 256;/,
  'Editor-mode chat layout must account for the fixed file explorer width.',
);

assert.match(
  codeEditorChatLayoutSource,
  /export const CODE_EDITOR_MIN_SURFACE_WIDTH = 360;/,
  'Editor-mode chat layout must reserve room for the editor surface before expanding the chat column.',
);

assert.match(
  codeEditorChatLayoutSource,
  /export function resolveCodeEditorResponsiveChatWidth\(/,
  'Editor-mode chat layout must define a reusable responsive width resolver.',
);

assert.match(
  codeEditorChatLayoutSource,
  /workspaceWidth\s*-\s*CODE_EDITOR_FILE_EXPLORER_WIDTH\s*-\s*CODE_EDITOR_RESIZE_HANDLE_WIDTH\s*-\s*CODE_EDITOR_MIN_SURFACE_WIDTH\s*-\s*CODE_EDITOR_RESPONSIVE_GUTTER/s,
  'Editor-mode chat layout must clamp chat width against the measured workspace width.',
);

assert.match(
  codeEditorChatLayoutSource,
  /return Math\.min\(normalizedRequestedWidth, Math\.min\(MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH, availableChatWidth\)\);/,
  'Editor-mode chat layout must shrink the chat column before it can exceed the workspace width.',
);

assert.match(
  codeEditorChatHookSource,
  /const requestedChatWidthRef = useRef\(\s*normalizeWorkbenchCodeEditorChatWidth\(initialChatWidth\),\s*\);/s,
  'Editor-mode chat layout hook must initialize its requested width from persisted preferences.',
);

assert.match(
  codeEditorChatHookSource,
  /const workspaceWidthRef = useRef\(0\);/,
  'Editor-mode chat layout hook must track the measured editor workspace width.',
);

assert.match(
  codeEditorChatHookSource,
  /const \[effectiveEditorChatWidth, setEffectiveEditorChatWidth\] = useState\(\(\) =>\s*resolveCodeEditorResponsiveChatWidth\(requestedChatWidthRef\.current, 0\),\s*\);/s,
  'Editor-mode chat layout hook must derive a responsive initial width from the persisted requested width.',
);

assert.match(
  codeEditorChatHookSource,
  /let resizeAnimationFrame = 0;/,
  'Editor-mode chat layout hook must coalesce resize measurements so maximize and restore transitions do not spam React state updates.',
);

assert.match(
  codeEditorChatHookSource,
  /window\.requestAnimationFrame\(\(\) => \{\s*resizeAnimationFrame = 0;\s*syncMeasuredEditorWorkspaceWidth\(\);/s,
  'Editor-mode chat layout hook must schedule workspace width synchronization through requestAnimationFrame.',
);

assert.match(
  codeEditorChatHookSource,
  /if \(workspaceWidthRef\.current === nextWidth\) \{\s*return;\s*\}\s*workspaceWidthRef\.current = nextWidth;\s*syncEffectiveEditorChatWidth\(requestedChatWidthRef\.current, nextWidth\);/s,
  'Editor-mode chat layout hook must skip redundant width work when the measured width has not changed.',
);

assert.match(
  codeEditorChatHookSource,
  /window\.cancelAnimationFrame\(resizeAnimationFrame\);/,
  'Editor-mode chat layout hook must cancel any pending resize frame during cleanup.',
);

assert.match(
  codeEditorChatHookSource,
  /const syncEffectiveEditorChatWidth = useCallback\(\s*\(requestedChatWidth: number, workspaceWidth: number\) => \{\s*setEffectiveEditorChatWidth\(\(previousState\) => \{/s,
  'Editor-mode chat layout hook must centralize effective width derivation behind a synchronized update helper.',
);

assert.match(
  codeEditorChatHookSource,
  /const handleEditorChatResize = useCallback\(\(delta: number\) => \{\s*const nextRequestedChatWidth = normalizeWorkbenchCodeEditorChatWidth\(\s*requestedChatWidthRef\.current - delta,\s*\);/s,
  'Editor-mode chat layout hook must own the editor-mode chat resize behavior.',
);

assert.match(
  codeEditorChatHookSource,
  /codeEditorChatWidth: nextChatWidth,/,
  'Editor-mode chat layout hook must persist width changes back into workbench preferences.',
);

assert.match(
  codePageSource,
  /const \{\s*editorWorkspaceHostRef,\s*effectiveEditorChatWidth,\s*handleEditorChatResize,\s*\} = useCodeEditorChatLayout\(\{/s,
  'CodePage must consume the dedicated editor-mode chat layout hook.',
);

assert.match(
  codePageSurfaceSource,
  /<div ref=\{editorWorkspaceHostRef\} className="flex-1 min-h-0 flex flex-col overflow-hidden">/,
  'CodePageSurface must attach a measured host container around the editor workspace.',
);

assert.match(
  codePageSource,
  /chatWidth: effectiveEditorChatWidth,/,
  'CodePage must pass the responsive editor-mode chat width into the workspace panel.',
);

assert.match(
  codePageSource,
  /onChatResize: handleEditorChatResize,/,
  'CodePage must route editor-mode chat resizing through the responsive resize handler.',
);

assert.match(
  editorWorkspacePanelSource,
  /<div className="flex-1 flex h-full min-w-0 overflow-hidden">/,
  'CodeEditorWorkspacePanel must allow the editor workspace to shrink without horizontal overflow.',
);

assert.match(
  editorWorkspacePanelSource,
  /<div className="flex min-w-0 max-w-full flex-col shrink-0 overflow-hidden bg-\[#0e0e11\]" style=\{\{ width: chatWidth \}\}>/,
  'CodeEditorWorkspacePanel must clamp the sidebar chat container within the available workspace width.',
);

assert.match(
  universalChatSource,
  /<div className=\{`flex flex-1 h-full w-full min-w-0 overflow-hidden flex-col bg-\[#0e0e11\] relative \$\{className\}`\}>/,
  'UniversalChat must allow sidebar-mode chat content to shrink without forcing horizontal overflow.',
);

console.log('code editor chat layout contract passed.');
