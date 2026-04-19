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

assert.match(
  studioChatSidebarSource,
  /showEngineHeader=\{false\}/,
  'Studio chat sidebar must disable the embedded UniversalChat engine header to avoid double headers.',
);

assert.match(
  studioChatSidebarSource,
  /const currentCodingSession = currentProject\?\.codingSessions\.find\(\s*\(codingSession\) => codingSession\.id === selectedCodingSessionId,\s*\);/s,
  'Studio chat sidebar header must resolve the selected coding session before choosing which engine to display.',
);

assert.match(
  studioChatSidebarSource,
  /const headerEngineId = currentCodingSession\?\.engineId \?\? selectedEngineId;/,
  'Studio chat sidebar header must prefer the active session engine over the global chat selection.',
);

assert.match(
  studioChatSidebarSource,
  /const headerModelId = currentCodingSession\?\.modelId \?\? selectedModelId;/,
  'Studio chat sidebar header must prefer the active session model over the global chat selection.',
);

assert.match(
  studioChatSidebarSource,
  /const headerEngine = getWorkbenchCodeEngineDefinition\(headerEngineId, preferences\);/,
  'Studio chat sidebar must resolve the header engine from the active session-aware engine id.',
);

assert.match(
  studioChatSidebarSource,
  /const headerEngineSummary =\s*headerModelLabel\.trim\(\)\.toLowerCase\(\) === headerEngine\.label\.trim\(\)\.toLowerCase\(\)\s*\?\s*headerEngine\.label\s*:\s*`\$\{headerEngine\.label\} \/ \$\{headerModelLabel\}`;/s,
  'Studio chat sidebar header should collapse duplicate engine and model labels into a single visible label.',
);

assert.match(
  studioChatSidebarSource,
  /const isExecutingCurrentSession = isBirdCoderCodingSessionExecuting\(currentCodingSession\);/,
  'Studio chat sidebar header must derive the current execution state from the selected session runtime state.',
);

assert.match(
  studioChatSidebarSource,
  /\{headerEngineSummary\}/,
  'Studio chat sidebar header should render the de-duplicated engine summary label.',
);

assert.match(
  studioChatSidebarSource,
  /<div className="flex items-center gap-2 px-1\.5 py-1 text-xs text-gray-300">/,
  'Studio chat sidebar should render the code engine as a borderless read-only label.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /className=\{`flex items-center gap-2 rounded-lg border border-white\/10 px-3 py-1\.5 text-xs transition-colors/,
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

assert.match(
  studioChatSidebarSource,
  /className="flex max-w-full items-center gap-2 px-2 py-1\.5 -ml-2 rounded-lg hover:bg-white\/5 transition-all text-gray-200 font-medium group whitespace-nowrap overflow-hidden"/,
  'Studio chat sidebar project selector button should enforce a single-row header layout.',
);

assert.match(
  studioChatSidebarSource,
  /<span className="truncate text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">/,
  'Studio chat sidebar project name should truncate instead of wrapping.',
);

assert.match(
  studioChatSidebarSource,
  /<div className="flex min-w-0 items-center gap-1\.5 overflow-hidden">/,
  'Studio chat sidebar title row should clip overflowing text instead of wrapping to a second line.',
);

assert.match(
  studioChatSidebarSource,
  /const handleRefreshCurrentContext = \(\) => \{\s*if \(selectedCodingSessionId\) \{\s*void onRefreshCodingSessionMessages\(selectedCodingSessionId\);\s*return;\s*\}\s*if \(currentProjectId\) \{\s*void onRefreshProjectSessions\(currentProjectId\);\s*\}\s*\};/s,
  'Studio chat sidebar header should expose one context-aware refresh action instead of separate project and session refresh icons.',
);

assert.match(
  studioChatSidebarSource,
  /onClick=\{handleRefreshCurrentContext\}/,
  'Studio chat sidebar header must wire its refresh button through the shared context-aware handler.',
);

assert.match(
  studioChatSidebarSource,
  /isExecutingCurrentSession \? 'animate-spin text-emerald-400' : 'text-gray-500'/,
  'Studio chat sidebar header should show a spinning execution icon while the active session is running.',
);

assert.match(
  studioChatSidebarSource,
  /isExecutingCurrentSession && selectedCodingSessionId \? \(\s*<div className="hidden items-center gap-1\.5 text-xs text-emerald-400 xl:flex">\s*<RefreshCw size=\{12\} className="animate-spin" \/>\s*<span>\{t\('studio\.executingSession'\)\}<\/span>\s*<\/div>\s*\) : null/s,
  'Studio chat sidebar header should render an explicit executing label for the active session.',
);

assert.match(
  studioChatSidebarSource,
  /const isExecutingThread = isBirdCoderCodingSessionExecuting\(thread\);/,
  'Studio project menu should identify executing sessions from the session runtime state.',
);

assert.match(
  studioChatSidebarSource,
  /isExecutingThread \? \(\s*<RefreshCw size=\{14\} className="animate-spin text-emerald-400 shrink-0" \/>\s*\) : isSelected \? \(\s*<Check size=\{14\} className="text-blue-400 shrink-0" \/>\s*\) : null/s,
  'Studio project menu should replace the static selected indicator with a spinner for the executing session.',
);

assert.doesNotMatch(
  studioChatSidebarSource,
  /Boolean\(selectedCodingSessionId && isSending\)/,
  'Studio chat sidebar must not use the transient send flag as the source of truth for execution state.',
);

assert.match(
  studioPageSource,
  /updateCodingSession,/,
  'Studio page must obtain updateCodingSession so engine and model changes can persist onto the active session.',
);

assert.match(
  studioPageSource,
  /const handleSelectedEngineChange = useCallback\(\s*async \(engineId: string\) => \{\s*setSelectedEngineId\(engineId\);\s*if \(!currentProjectId \|\| !selectedCodingSessionId\) \{\s*return;\s*\}\s*const nextModelId = normalizeWorkbenchCodeModelId\(\s*engineId,\s*currentThread\?\.modelId \?\? selectedModelId,\s*preferences,\s*\);\s*await updateCodingSession\(currentProjectId, selectedCodingSessionId, \{\s*engineId,\s*modelId: nextModelId,\s*\}\);\s*\},/s,
  'Studio page should persist engine changes onto the active coding session and normalize the paired model id.',
);

assert.match(
  studioPageSource,
  /const handleSelectedModelChange = useCallback\(\s*async \(modelId: string, engineId\?: string\) => \{\s*setSelectedModelId\(modelId\);\s*if \(!currentProjectId \|\| !selectedCodingSessionId\) \{\s*return;\s*\}\s*const nextEngineId = engineId \?\? currentThread\?\.engineId \?\? selectedEngineId;\s*await updateCodingSession\(currentProjectId, selectedCodingSessionId, \{\s*engineId: nextEngineId,\s*modelId,\s*\}\);\s*\},/s,
  'Studio page should persist model changes onto the active coding session using the explicit or session-aware engine id.',
);

assert.match(
  studioPageSource,
  /onSelectedEngineIdChange=\{handleSelectedEngineChange\}/,
  'Studio chat sidebar should receive the session-persisting engine change handler.',
);

assert.match(
  studioPageSource,
  /onSelectedModelIdChange=\{handleSelectedModelChange\}/,
  'Studio chat sidebar should receive the session-persisting model change handler.',
);

assert.match(
  studioPageSource,
  /const \[chatWidth, setChatWidth\] = useState\(720\);/,
  'Studio page should widen the default chat sidebar width by 60 percent.',
);

assert.match(
  studioPageSource,
  /Math\.max\(300, Math\.min\(1280, previousState \+ delta\)\)/,
  'Studio page chat sidebar resize bounds should allow the wider layout.',
);

console.log('studio chat header contract passed.');
