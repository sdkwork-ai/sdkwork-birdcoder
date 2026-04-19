import assert from 'node:assert/strict';
import fs from 'node:fs';

const sidebarSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx', import.meta.url),
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

assert.match(
  sidebarSource,
  /const isExecutingThread = isBirdCoderCodingSessionExecuting\(thread\);/,
  'Code sidebar should derive executing rows from the session runtime state.',
);

assert.match(
  sidebarSource,
  /isExecutingThread && <RefreshCw size=\{12\} className="text-emerald-400 shrink-0 animate-spin" \/>/,
  'Code sidebar should render a spinning execution icon for an executing session row.',
);

assert.match(
  enLocaleSource,
  /"executingSession": "Executing"/,
  'English Code locale must define the session executing label.',
);

assert.match(
  zhLocaleSource,
  /executingSession["']?:/,
  'Chinese Code locale must define the session executing label.',
);

assert.doesNotMatch(
  sidebarSource,
  /selectedCodingSessionId === thread\.id && isSending/,
  'Code sidebar must not derive execution state from the transient send flag.',
);

console.log('code session executing ui contract passed.');
