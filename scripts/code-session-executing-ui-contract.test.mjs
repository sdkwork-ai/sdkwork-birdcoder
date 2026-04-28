import assert from 'node:assert/strict';
import fs from 'node:fs';

const projectExplorerSessionRowSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorerSessionRow.tsx', import.meta.url),
  'utf8',
);
const topBarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/TopBar.tsx', import.meta.url),
  'utf8',
);
const enLocaleSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-i18n/src/locales/en/code/sidebar.ts', import.meta.url),
  'utf8',
);
const zhLocaleSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-i18n/src/locales/zh/code/sidebar.ts', import.meta.url),
  'utf8',
);
const legacyExecutionSelectionPattern = new RegExp(
  ['selectedCodingSessionId === ', ['th', 'read'].join(''), '\\.id && isSending'].join(''),
);

assert.match(
  projectExplorerSessionRowSource,
  /const isEngineBusySession = isBirdCoderCodingSessionEngineBusy\(session\);/,
  'Code ProjectExplorer session rows should derive spinning rows from the engine-busy runtime state.',
);

assert.match(
  projectExplorerSessionRowSource,
  /isEngineBusySession && <Loader2 size=\{12\} className="text-emerald-400 shrink-0 animate-spin" \/>/,
  'Code ProjectExplorer session rows should render a neutral spinning icon only while the engine is actively working.',
);

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  /isEngineBusySession && <RefreshCw size=\{12\} className="text-emerald-400 shrink-0 animate-spin" \/>/,
  'Code ProjectExplorer session rows must not use the refresh icon for execution state because it reads as "refreshing" on startup.',
);

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  /isExecutingSession && <Loader2 size=\{12\} className="text-emerald-400 shrink-0 animate-spin" \/>/,
  'Code ProjectExplorer session rows must not spin for approval or user-reply waits; those states use explicit labels instead.',
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
  enLocaleSource.includes("awaitingToolSession: 'Ready'"),
  'English Code locale must define a non-spinning settled tool state label.',
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
  'Chinese Code locale must define a non-spinning settled tool state label.',
);

assert.match(
  projectExplorerSessionRowSource,
  /session\.runtimeStatus === 'awaiting_approval'\s*\?\s*awaitingApprovalSessionLabel/s,
  'Code ProjectExplorer session rows must show an explicit approval-waiting label.',
);

assert.match(
  projectExplorerSessionRowSource,
  /session\.runtimeStatus === 'awaiting_user'\s*\?\s*awaitingUserSessionLabel/s,
  'Code ProjectExplorer session rows must show an explicit user-reply waiting label.',
);

assert.match(
  projectExplorerSessionRowSource,
  /session\.runtimeStatus === 'awaiting_tool'\s*\?\s*awaitingToolSessionLabel/s,
  'Code ProjectExplorer session rows must show awaiting_tool as a settled non-spinning label instead of the generic executing state.',
);

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  legacyExecutionSelectionPattern,
  'Code ProjectExplorer session rows must not derive execution state from the transient send flag.',
);

console.log('code session executing ui contract passed.');
