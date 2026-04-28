import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

function readSource(...segments) {
  return fs.readFileSync(path.join(rootDir, ...segments), 'utf8');
}

const studioChatSidebarSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioChatSidebar.tsx',
);
const studioPageSource = readSource(
  'packages',
  'sdkwork-birdcoder-studio',
  'src',
  'pages',
  'StudioPage.tsx',
);

assert.ok(
  studioChatSidebarSource.includes('showEngineHeader={false}'),
  'Studio chat sidebar must disable the embedded UniversalChat engine header to avoid double headers.',
);

assert.ok(
  studioChatSidebarSource.includes('showComposerEngineSelector={!selectedCodingSessionId}'),
  'Studio chat sidebar should only expose the composer engine selector before a session exists so the session engine remains fixed after creation.',
);

assert.match(
  studioChatSidebarSource,
  /const currentCodingSession = useMemo\(\s*\(\)\s*=>\s*currentProject\?\.codingSessions\.find\(/s,
  'Studio chat sidebar header must resolve the selected coding session before choosing which engine to display.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'const headerEngineSummary = currentCodingSession?.engineId?.trim()',
  ),
  'Studio chat sidebar header must branch on the persisted session engine before choosing a display summary.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'getWorkbenchCodeEngineSessionSummary(',
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
    'const currentChatModelId = currentCodingSession',
  ),
  'Studio chat sidebar must derive the session-bound chat model value locally so existing sessions do not inherit the global preference.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'const isEngineBusyCurrentSession = isBirdCoderCodingSessionEngineBusy(currentCodingSession);',
  ),
  'Studio chat sidebar header must derive the spinning indicator from the selected session engine-busy runtime state.',
);

assert.match(
  studioChatSidebarSource,
  /const showEngineBusyCurrentSessionIndicator =\s*isEngineBusyCurrentSession && Boolean\(selectedCodingSessionId\);/s,
  'Studio chat sidebar header should collapse engine-busy rendering into one session-aware indicator flag.',
);

assert.ok(
  studioChatSidebarSource.includes('{headerEngineSummary}'),
  'Studio chat sidebar header should render the de-duplicated engine summary label.',
);

assert.ok(
  studioChatSidebarSource.includes(
    '<div className="flex items-center gap-2 px-1.5 py-1 text-xs text-gray-300">',
  ),
  'Studio chat sidebar should render the code engine as a borderless read-only label.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /rounded-lg border border-white\/10 px-3 py-1\.5 text-xs transition-colors/,
  'Studio chat sidebar should not render the code engine using a bordered button treatment.',
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
    'className="flex max-w-full items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg hover:bg-white/5 transition-all text-gray-200 font-medium group whitespace-nowrap overflow-hidden"',
  ),
  'Studio chat sidebar project selector button should enforce a single-row header layout.',
);

assert.ok(
  studioChatSidebarSource.includes(
    '<span className="truncate text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">',
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
  /const handleRefreshCurrentContext = \(\) => \{\s*if \(selectedCodingSessionId\) \{\s*void onRefreshCodingSessionMessages\(selectedCodingSessionId\);\s*return;\s*\}\s*if \(currentProjectId\) \{\s*void onRefreshProjectSessions\(currentProjectId\);\s*\}\s*\};/s,
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
  /isExecutingCurrentSession && selectedCodingSessionId \? \(\s*<div className="hidden items-center gap-1\.5 text-xs text-emerald-400 xl:flex">/s,
  'Studio chat sidebar header should not render a second executing indicator block alongside the refresh button.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /isBirdCoderCodingSessionExecuting\(currentCodingSession\)/,
  'Studio chat sidebar header must not spin for approval, tool, or user-reply waits; only engine-busy statuses should animate.',
);

assert.ok(
  studioChatSidebarSource.includes(
    'const isEngineBusySession = isBirdCoderCodingSessionEngineBusy(session);',
  ),
  'Studio project menu should identify spinner rows from the engine-busy runtime state.',
);

assert.match(
  studioChatSidebarSource,
  /isEngineBusySession \? \(\s*<Loader2 size=\{14\} className="animate-spin text-emerald-400 shrink-0" \/>\s*\) : isSelected \? \(\s*<Check size=\{14\} className="text-blue-400 shrink-0" \/>\s*\) : null/s,
  'Studio project menu should replace the static selected indicator with a neutral spinner only while the engine is actively working.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /isEngineBusySession \? \(\s*<RefreshCw size=\{14\} className="animate-spin text-emerald-400 shrink-0" \/>\s*\) : isSelected/s,
  'Studio project menu must not use the refresh icon for execution state because it reads as "refreshing" on startup.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /isExecutingSession \? \(\s*<Loader2 size=\{14\} className="animate-spin text-emerald-400 shrink-0" \/>\s*\) : isSelected/s,
  'Studio project menu must not spin for approval or user-reply waits; those are active sessions but not engine-busy sessions.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /Boolean\(selectedCodingSessionId && isSending\)/,
  'Studio chat sidebar must not use the transient send flag as the source of truth for execution state.',
);

assert.match(
  studioPageSource,
  /useCodingSessionEngineModelSelection,\s*/,
  'Studio page must import the shared engine and model selection hook instead of duplicating session persistence logic.',
);

assert.match(
  studioPageSource,
  /const \{\s*handleSelectedEngineChange,\s*handleSelectedModelChange,\s*\} = useCodingSessionEngineModelSelection\(\{\s*preferences,\s*selectedModelId,\s*sessionId,\s*setSelectedEngineId,\s*setSelectedModelId,\s*\}\);/s,
  'Studio page should centralize engine and model persistence through the shared session engine/model selection hook.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /<WorkbenchCodeEngineIcon engineId=\{headerEngine\.id\} \/>/,
  'Studio chat sidebar header should not render a code engine icon once the engine is shown as a fixed read-only label.',
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
