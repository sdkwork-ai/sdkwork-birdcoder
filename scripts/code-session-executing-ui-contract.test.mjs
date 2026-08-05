import assert from 'node:assert/strict';
import fs from 'node:fs';


const projectExplorerSessionRowSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/ProjectExplorerSessionRow.tsx', import.meta.url),
  'utf8',
);
const sidebarSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);
const topBarSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/TopBar.tsx', import.meta.url),
  'utf8',
);
const sessionRuntimeStatusSlotSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/SessionRuntimeStatusSlot.tsx', import.meta.url),
  'utf8',
);
const sessionProviderBadgeSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/SessionProviderBadge.tsx', import.meta.url),
  'utf8',
);
const providerVisualIdentitySource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/src/components/providerVisualIdentity.ts', import.meta.url),
  'utf8',
);
const workbenchAgentEngineIconSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell/src/components/WorkbenchAgentEngineIcon.tsx', import.meta.url),
  'utf8',
);
const agentEngineCatalogSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/agentEngineCatalog.ts', import.meta.url),
  'utf8',
);
const enLocaleSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/en/code/sidebar.ts', import.meta.url),
  'utf8',
);
const zhLocaleSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/zh/code/sidebar.ts', import.meta.url),
  'utf8',
);
const legacyExecutionSelectionPattern = new RegExp(
  ['selectedAgentSessionId === ', ['th', 'read'].join(''), '\\.id && isSending'].join(''),
);

assert.match(
  projectExplorerSessionRowSource,
  /<SessionRuntimeStatusSlot\s+label=\{runtimeStatusLabel\}\s+runtimeStatus=\{session\.runtimeStatus\}/s,
  'Code ProjectExplorer session rows should delegate execution status rendering to the shared icon component.',
);

assert.match(
  projectExplorerSessionRowSource,
  /<SessionProviderBadge[\s\S]*?<SessionRuntimeStatusSlot\s+label=\{runtimeStatusLabel\}\s+runtimeStatus=\{session\.runtimeStatus\}\s*\/>/u,
  'Code ProjectExplorer session rows should render provider identity before the trailing runtime status.',
);

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  /WorkbenchAgentEngineIcon|data-session-engine-slot=/u,
  'Code ProjectExplorer session rows must not present engine identity where provider identity belongs.',
);

assert.match(
  providerVisualIdentitySource,
  /abbreviation: 'CX',[\s\S]*?aliases: \['codex', 'openai-codex'\],[\s\S]*?label: 'Codex',[\s\S]*?tone: 'emerald'/u,
  'The shared provider visual registry must present Codex as CX with its canonical tone.',
);

assert.match(
  providerVisualIdentitySource,
  /resolveExecutionProviderVisualIdentity\(identity\.engineId\)[\s\S]*?resolveExecutionProviderVisualIdentity\(identity\.agentId\)[\s\S]*?resolveExecutionProviderVisualIdentity\(identity\.providerId\)/u,
  'The shared provider visual registry must prefer engine and agent identity before provider fallback.',
);

assert.match(
  sessionProviderBadgeSource,
  /resolveProviderVisualIdentity\(\{ agentId, engineId, providerId \}\)/u,
  'Session provider badges must consume the shared provider visual registry.',
);

assert.match(
  workbenchAgentEngineIconSource,
  /resolveProviderVisualIdentity\(\{ engineId \}\)/u,
  'New-session and engine icons must consume the shared provider visual registry.',
);

assert.doesNotMatch(
  `${sessionProviderBadgeSource}\n${workbenchAgentEngineIconSource}`,
  /THEME_CLASS_BY_ID|ENGINE_PRESENTATION|KNOWN_SESSION_PROVIDER_BADGE_TONES/u,
  'Provider icon consumers must not maintain local theme registries.',
);

assert.doesNotMatch(
  agentEngineCatalogSource,
  /WorkbenchAgentEngineThemeId|\bmonogram:|\btheme:\s*resolveTheme|function\s+(?:buildMonogram|resolveTheme)\b/u,
  'The engine catalog must not retain a second provider abbreviation or color authority.',
);

assert.match(
  sidebarSource,
  /<SessionProviderBadge\s+agentId=\{entry\.agentId\}\s+engineId=\{entry\.engineId\}\s+providerId=\{entry\.providerId\}\s*\/>/u,
  'Provider-group headings must use the complete execution-provider identity.',
);

assert.doesNotMatch(
  sidebarSource,
  /<WorkbenchAgentEngineIcon engineId=\{entry\.engineId\} \/>/u,
  'Provider-group headings must not derive a misleading PR badge from an engine fallback.',
);

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  /isEngineBusySession && <RefreshCw size=\{12\} className="text-emerald-400 shrink-0 animate-spin" \/>/,
  'Code ProjectExplorer session rows must not use the refresh icon for execution state because it reads as "refreshing" on startup.',
);

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  /<Loader2/u,
  'Code ProjectExplorer session rows must not own a second spinner outside the shared status slot.',
);

assert.match(
  topBarSource,
  /isEngineBusyCurrentSession && \(/,
  'Code top bar should derive its spinner from the engine-busy runtime state, not every executing/waiting state.',
);

assert.match(
  topBarSource,
  /<Loader2 size=\{12\} className="animate-spin" \/>\s*<span>\{t\('code\.executingSession'\)\}<\/span>/,
  'Code top bar busy state should use Loader2 so active execution is visually distinct from refresh actions.',
);

assert.ok(
  enLocaleSource.includes("executingSession: 'Executing'"),
  'English Code locale must define the session executing label.',
);

assert.ok(
  enLocaleSource.includes("awaitingApprovalSession: 'Needs approval'"),
  'English Code locale must define a distinct approval-waiting session label.',
);

assert.ok(
  enLocaleSource.includes("awaitingUserSession: 'Needs reply'"),
  'English Code locale must define a distinct user-question waiting session label.',
);

assert.ok(
  enLocaleSource.includes("awaitingToolSession: 'Waiting for tool'"),
  'English Code locale must describe tool waiting as static attention rather than ready or active execution.',
);

assert.ok(
  zhLocaleSource.includes('executingSession:'),
  'Chinese Code locale must define the session executing label.',
);

assert.ok(
  zhLocaleSource.includes('awaitingApprovalSession:'),
  'Chinese Code locale must define a distinct approval-waiting session label.',
);

assert.ok(
  zhLocaleSource.includes('awaitingUserSession:'),
  'Chinese Code locale must define a distinct user-question waiting session label.',
);

assert.ok(
  zhLocaleSource.includes('awaitingToolSession:'),
  'Chinese Code locale must define a static tool-attention label.',
);

assert.ok(
  zhLocaleSource.includes('staleSession:'),
  'Chinese Code locale must define the stale runtime-status label.',
);

assert.match(
  projectExplorerSessionRowSource,
  /resolveSessionRuntimeStatusLabel\(\s*session\.runtimeStatus,\s*runtimeStatusLabels,\s*\)/u,
  'Code ProjectExplorer session rows must resolve status labels through the shared presentation contract.',
);

assert.match(
  sessionRuntimeStatusSlotSource,
  /const isBusy = presentation === 'busy'/u,
  'The shared status slot must use the common busy presentation for initializing and streaming.',
);

assert.match(
  sessionRuntimeStatusSlotSource,
  /CircleAlert[\s\S]*?TriangleAlert[\s\S]*?Clock3/u,
  'The shared status slot must expose static attention, failed, and stale icons.',
);

assert.doesNotMatch(
  sessionRuntimeStatusSlotSource,
  /CircleHelp/u,
  'The unavailable runtime status must not render an icon.',
);

assert.match(
  sessionRuntimeStatusSlotSource,
  /Unavailable runtime states \(`unknown`, `null`, or `undefined`\)[\s\S]*?no label, icon, or reserved icon space/u,
  'The unavailable runtime-status silence rule must be documented at its shared authority.',
);

assert.match(
  sessionRuntimeStatusSlotSource,
  /if \(isSilentSessionRuntimeStatus\(runtimeStatus\)\) \{\s*return null;\s*\}/u,
  'The unavailable runtime status must resolve no label and render no status slot.',
);

assert.match(
  sessionRuntimeStatusSlotSource,
  /<Loader2 className="h-3 w-3 animate-spin text-emerald-400"/u,
  'The shared status slot must animate only the busy Loader2 icon.',
);

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  legacyExecutionSelectionPattern,
  'Code ProjectExplorer session rows must not derive execution state from the transient send flag.',
);

console.log('code session executing ui contract passed.');
