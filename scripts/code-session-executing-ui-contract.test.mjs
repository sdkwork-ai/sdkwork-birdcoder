import assert from 'node:assert/strict';
import fs from 'node:fs';

const projectExplorerSessionRowSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/ProjectExplorerSessionRow.tsx', import.meta.url),
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
  /const isExecutingSession = isBirdCoderCodingSessionExecuting\(session\);/,
  'Code ProjectExplorer session rows should derive executing rows from the session runtime state.',
);

assert.match(
  projectExplorerSessionRowSource,
  /isExecutingSession && <RefreshCw size=\{12\} className="text-emerald-400 shrink-0 animate-spin" \/>/,
  'Code ProjectExplorer session rows should render a spinning execution icon for an executing session row.',
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

assert.doesNotMatch(
  projectExplorerSessionRowSource,
  legacyExecutionSelectionPattern,
  'Code ProjectExplorer session rows must not derive execution state from the transient send flag.',
);

console.log('code session executing ui contract passed.');
