import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const studioChatSidebarSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioChatSidebar.tsx',
);
const studioSessionMenuRowSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioSessionMenuRow.tsx',
);
const studioPageSource = readSource(
  'apps',
  
  'sdkwork-birdcoder-pc',
  
  'packages',
  
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);
const studioPageSharedSource = readSource(
  'apps',
  'sdkwork-birdcoder-pc',
  'packages',
  'sdkwork-birdcoder-pc-studio',
  'src',
  'pages',
  'StudioPage.shared.ts',
);

assert.ok(
  studioChatSidebarSource.includes('showEngineHeader={false}'),
  'Studio chat sidebar must disable the embedded UniversalChat engine header to avoid double headers.',
);

assert.match(
  studioChatSidebarSource,
  /<DeferredUniversalChat[\s\S]*?showComposerEngineSelector\s*[\s\S]*?layout="sidebar"/s,
  'Studio chat sidebar must expose per-turn composer model selection for existing and new sessions.',
);

assert.match(
  studioChatSidebarSource,
  /const currentAgentSession = useMemo\(\s*\(\)\s*=>\s*currentProject\?\.agentSessions\.find\(/s,
  'Studio chat sidebar header must resolve the selected coding session before choosing which engine to display.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'const headerEngineSummary = currentAgentSession?.engineId?.trim()',
  ),
  'Studio chat sidebar header must branch on the persisted session engine before choosing a display summary.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'getWorkbenchAgentEngineSessionSummary(',
  ),
  'Studio chat sidebar header must use the strict session summary helper.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'const currentChatEngineId =',
  ),
  'Studio chat sidebar must derive the session-bound chat engine value locally so existing sessions do not inherit the global preference.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'const currentChatModelId = currentAgentSession',
  ),
  'Studio chat sidebar must derive the session-bound chat model value locally so existing sessions do not inherit the global preference.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'const isEngineBusyCurrentSession = isAgentSessionViewEngineBusy(currentAgentSession);',
  ),
  'Studio chat sidebar header must derive the spinning indicator from the selected session engine-busy runtime state.',
);

assert.match(
  studioChatSidebarSource,
  /const showEngineBusyCurrentSessionIndicator =\s*isEngineBusyCurrentSession && Boolean\(selectedAgentSessionId\);/s,
  'Studio chat sidebar header should collapse engine-busy rendering into one session-aware indicator flag.',
);

assert.ok(
  studioChatSidebarSource.includes('{headerEngineSummary}'),
  'Studio chat sidebar header should render the de-duplicated engine summary label.',
);

assert.ok(
  studioChatSidebarSource.includes(
    '<div className="flex min-w-0 items-center px-1 text-xs text-gray-400">',
  ),
  'Studio chat sidebar should render the agent engine as a borderless read-only label.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /rounded-lg border border-white\/10 px-3 py-1\.5 text-xs transition-colors/,
  'Studio chat sidebar should not render the agent engine using a bordered button treatment.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /setShowEngineMenu\(\(previousState\) => !previousState\)/,
  'Studio chat sidebar should not toggle an editable engine menu from the header.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /\{showEngineMenu && !disabled \?/,
  'Studio chat sidebar should not expose an engine selection popover in the header.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /<Code2 size=\{12\} className="text-white" \/>/,
  'Studio chat sidebar project title should not render a leading project icon in the header.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'className="group -ml-1.5 flex h-8 max-w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-1.5 font-medium text-gray-200 transition-colors hover:bg-white/[0.055]"',
  ),
  'Studio chat sidebar project selector button should enforce a single-row header layout.',
);

assert.ok(
  studioChatSidebarSource.includes(
    '<span className="truncate text-sm font-semibold text-gray-200 transition-colors group-hover:text-white">',
  ),
  'Studio chat sidebar project name should truncate instead of wrapping.',
);

assert.ok(
  studioChatSidebarSource.includes(
    '<div className="flex min-w-0 items-center gap-1.5 overflow-hidden">',
  ),
  'Studio chat sidebar title row should clip overflowing text instead of wrapping to a second line.',
);

assert.match(
  studioChatSidebarSource,
  /data-studio-chat-header="true"[\s\S]*?className="flex h-11 shrink-0 items-center gap-2 px-3"[\s\S]*?data-studio-session-menu-header="true"/s,
  'Studio should use compact 44px headers for both the chat surface and the project-session switcher.',
);

assert.match(
  studioChatSidebarSource,
  /className="flex h-10 shrink-0 items-center justify-between gap-2 px-3"\s*data-studio-projects-header="true"[\s\S]*?className="flex h-10 shrink-0 items-center justify-between gap-2 px-3"\s*data-studio-sessions-header="true"/s,
  'Studio project and Session panes should use flat 40px tool headers.',
);

assert.match(
  studioChatSidebarSource,
  /<WorkbenchNewSessionButton[\s\S]*?compact[\s\S]*?variant="studio"/s,
  'Studio should render the shared new-Session control in compact header mode.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /className="flex border-t border-white\/10 bg-\[#0e0e11\]\/80 backdrop-blur-sm"/,
  'Studio should not restore the old duplicated bottom command bar.',
);

assert.equal(
  (studioChatSidebarSource.match(/aria-label=\{t\('studio\.newProject'\)\}/g) ?? []).length,
  1,
  'Studio project tools must expose exactly one accessible New Project button.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /studio\.openFolder|onOpenFolder/u,
  'Studio project tools must not retain a second Open Folder creation entry.',
);

assert.match(
  studioChatSidebarSource,
  /data-studio-projects-header="true"[\s\S]*?onClick=\{\(\) => \{\s*void onCreateProject\(\);\s*\}\}[\s\S]*?<Plus size=\{13\} \/>/s,
  'The single Studio project add action must invoke the injected creation command.',
);

assert.ok(
  studioPageSharedSource.includes(
    'onRequestProjectCreation: () => Promise<string | undefined>;',
  ),
  'StudioPage must depend on a narrow asynchronous project creation command.',
);

assert.ok(
  studioPageSource.includes('const createdProjectId = await onRequestProjectCreation();'),
  'Studio interactive creation flows must wait for the shared dialog result.',
);

assert.match(
  studioPageSource,
  /const activateCreatedProjectSelection = useCallback\(\(createdProjectId: string\) => \{[\s\S]*?setMenuActiveProjectId\(createdProjectId\);[\s\S]*?setSessionId\(''\);[\s\S]*?setSelectedSessionProjectId\(createdProjectId\);/s,
  'Studio must replace the old Session selection after the shell creates and selects a project.',
);

assert.doesNotMatch(
  studioPageSource,
  /selectFolderAndImportProject|importSelectedProjectDirectory/u,
  'Studio new-project flows must not own a parallel directory import implementation.',
);

assert.match(
  studioChatSidebarSource,
  /const handleRefreshCurrentContext = \(\) => \{\s*if \(selectedAgentSessionId\) \{\s*void onRefreshAgentSessionItems\(selectedAgentSessionId\);\s*return;\s*\}\s*if \(currentProjectId\) \{\s*void onRefreshProjectSessions\(currentProjectId\);\s*\}\s*\};/s,
  'Studio chat sidebar header should expose one context-aware refresh action instead of separate project and session refresh icons.',
);

assert.ok(
  studioChatSidebarSource.includes('onClick={handleRefreshCurrentContext}'),
  'Studio chat sidebar header must wire its refresh button through the shared context-aware handler.',
);

assert.match(
  studioChatSidebarSource,
  /const headerActivityIconClassName =\s*showEngineBusyCurrentSessionIndicator\s*\?\s*'animate-spin text-emerald-400'\s*:\s*isRefreshingCurrentContext\s*\?\s*'animate-spin text-gray-300'\s*:\s*'text-gray-500';/s,
  'Studio chat sidebar header should compute one icon treatment for engine-busy and manual refresh states.',
);

assert.match(
  studioChatSidebarSource,
  /const refreshActionKey = showEngineBusyCurrentSessionIndicator\s*\?\s*'studio\.executingSession'\s*:/s,
  'Studio chat sidebar header should title the disabled engine-busy indicator as executing instead of a refresh action.',
);

assert.match(
  studioChatSidebarSource,
  /showEngineBusyCurrentSessionIndicator \? \(\s*<Loader2\s*size=\{14\}\s*className=\{headerActivityIconClassName\}\s*\/>\s*\) : \(\s*<RefreshCw\s*size=\{14\}\s*className=\{headerActivityIconClassName\}\s*\/>\s*\)/s,
  'Studio chat sidebar header should use Loader2 only for engine-busy execution and reserve RefreshCw for manual refresh.',
);

assert.match(
  studioChatSidebarSource,
  /showEngineBusyCurrentSessionIndicator \? \(\s*<span className="hidden text-xs xl:inline">\s*\{t\('studio\.executingSession'\)\}\s*<\/span>\s*\) : null/s,
  'Studio chat sidebar header should render the executing label inside the single engine-busy indicator instead of as a second icon block.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /isExecutingCurrentSession && selectedAgentSessionId \? \(\s*<div className="hidden items-center gap-1\.5 text-xs text-emerald-400 xl:flex">/s,
  'Studio chat sidebar header should not render a second executing indicator block alongside the refresh button.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /isAgentSessionViewExecuting\(currentAgentSession\)/,
  'Studio chat sidebar header must not spin for approval, tool, or user-reply waits; only engine-busy statuses should animate.',
);

assert.ok(
  studioSessionMenuRowSource.includes(
    '<SessionRuntimeStatusSlot',
  ),
  'Studio project menu should delegate status rendering to the shared trailing slot.',
);

assert.match(
  studioSessionMenuRowSource,
  /<SessionProviderBadge[\s\S]*?data-session-trailing-metadata="true"[\s\S]*?<SessionRuntimeStatusSlot/u,
  'Studio project menu should render provider identity before independent trailing metadata and its rightmost runtime status.',
);

assert.doesNotMatch(
  studioSessionMenuRowSource,
  /<Loader2|<RefreshCw/u,
  'Studio project menu must not own a second execution or refresh spinner outside the shared slot.',
);

assert.doesNotMatch(
  studioSessionMenuRowSource,
  /isAgentSessionViewExecuting|isAgentSessionViewEngineBusy/u,
  'Studio project menu must use the common runtime presentation state instead of a local busy predicate.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /Boolean\(selectedAgentSessionId && isSending\)/,
  'Studio chat sidebar must not use the transient send flag as the source of truth for execution state.',
);

assert.match(
  studioPageSource,
  /useAgentSessionEngineModelSelection,\s*/,
  'Studio page must import the shared engine and model selection hook instead of duplicating session persistence logic.',
);

assert.match(
  studioPageSource,
  /const \{\s*handleSelectedEngineChange,\s*handleSelectedModelChange,\s*\} = useAgentSessionEngineModelSelection\(\{\s*preferences,\s*selectedModelId,\s*sessionId,\s*setSelectedEngineId,\s*setSelectedModelId,\s*\}\);/s,
  'Studio page should centralize engine and model persistence through the shared session engine/model selection hook.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /<WorkbenchAgentEngineIcon engineId=\{headerEngine\.id\} \/>/,
  'Studio chat sidebar header should not render a agent engine icon once the engine is shown as a fixed read-only label.',
);

assert.ok(
  studioPageSource.includes('selectedEngineId={selectedEngineId}'),
  'Studio page should feed the sidebar with the preferred engine selection so new-session actions stay aligned with preferences.',
);

assert.ok(
  studioPageSource.includes('selectedModelId={selectedModelId}'),
  'Studio page should feed the sidebar with the preferred model selection so new-session actions stay aligned with preferences.',
);

assert.ok(
  studioPageSource.includes('onSelectedEngineIdChange={handleSelectedEngineChange}'),
  'Studio chat sidebar should receive the shared session-persisting engine change handler.',
);

assert.ok(
  studioPageSource.includes('onSelectedModelIdChange={handleSelectedModelChange}'),
  'Studio chat sidebar should receive the shared session-persisting model change handler.',
);

assert.ok(
  studioPageSource.includes('const [chatWidth, setChatWidth] = useState(720);'),
  'Studio page should widen the default chat sidebar width by 60 percent.',
);

assert.ok(
  studioPageSource.includes('Math.max(300, Math.min(1280, previousState + delta))'),
  'Studio page chat sidebar resize bounds should allow the wider layout.',
);

console.log('studio chat header contract passed.');
