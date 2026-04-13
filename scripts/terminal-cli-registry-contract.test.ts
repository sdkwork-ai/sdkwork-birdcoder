import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  getTerminalCliProfileDefinition,
  normalizeTerminalCliExecutable,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/registry.ts';
import { listTerminalLaunchProfileOptions } from '../packages/sdkwork-birdcoder-commons/src/terminal/profiles.ts';
import {
  buildTerminalProfileBlockedMessage,
  listTerminalCliProfileAvailability,
  resolveTerminalProfileBlockedAction,
  resolveTerminalProfileLaunchPresentation,
  resolveTerminalProfileLaunchState,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/runtime.ts';

assert.deepEqual(getTerminalCliProfileDefinition('claude-code'), {
  profileId: 'claude-code',
  executable: 'claude',
  aliases: ['claude', 'claude-code'],
  startupArgs: [],
  installHint: 'Install Claude Code CLI and ensure the claude command is on PATH.',
});

assert.equal(normalizeTerminalCliExecutable('gemini', ''), 'gemini');
assert.equal(normalizeTerminalCliExecutable('gemini', 'gemini-cli'), 'gemini');
assert.equal(normalizeTerminalCliExecutable('opencode', 'custom-opencode'), 'custom-opencode');

const launchProfiles = listTerminalLaunchProfileOptions();
const codexLaunchProfile = launchProfiles.find((profile) => profile.id === 'codex');
const powershellLaunchProfile = launchProfiles.find((profile) => profile.id === 'powershell');

assert.ok(codexLaunchProfile, 'codex launch profile must be present');
assert.equal(codexLaunchProfile?.kind, 'cli');
assert.equal(codexLaunchProfile?.executable, 'codex');
assert.equal(
  codexLaunchProfile?.installHint,
  'Install Codex CLI and ensure the codex command is on PATH.',
);
assert.deepEqual(codexLaunchProfile?.aliases, ['codex', 'openai-codex']);

assert.ok(powershellLaunchProfile, 'powershell launch profile must be present');
assert.equal(powershellLaunchProfile?.kind, 'shell');
assert.equal(powershellLaunchProfile?.executable, 'powershell');
assert.equal(powershellLaunchProfile?.installHint, undefined);

const cliAvailability = await listTerminalCliProfileAvailability();
const codexAvailability = cliAvailability.find((entry) => entry.profileId === 'codex');

assert.equal(cliAvailability.length, 4);
assert.ok(codexAvailability, 'codex availability must be present');
assert.equal(codexAvailability?.status, 'unknown');
assert.equal(codexAvailability?.resolvedExecutable, null);

assert.deepEqual(resolveTerminalProfileLaunchState('codex', codexAvailability), {
  canLaunch: true,
  reason: null,
});
assert.deepEqual(
  resolveTerminalProfileLaunchState('codex', {
    ...codexAvailability!,
    status: 'missing',
  }),
  {
    canLaunch: false,
    reason: 'Install Codex CLI and ensure the codex command is on PATH.',
  },
);
assert.deepEqual(resolveTerminalProfileLaunchState('powershell'), {
  canLaunch: true,
  reason: null,
});

assert.deepEqual(
  resolveTerminalProfileLaunchPresentation('codex', {
    ...codexAvailability!,
    status: 'missing',
  }),
  {
    canLaunch: false,
    reason: 'Install Codex CLI and ensure the codex command is on PATH.',
    statusLabel: 'Install',
    detailLabel: 'Install Codex CLI and ensure the codex command is on PATH.',
  },
);
assert.deepEqual(resolveTerminalProfileLaunchPresentation('powershell'), {
  canLaunch: true,
  reason: null,
  statusLabel: null,
  detailLabel: 'powershell',
});
assert.deepEqual(
  resolveTerminalProfileBlockedAction('codex', {
    ...codexAvailability!,
    status: 'missing',
  }),
  {
    actionId: 'open-settings',
    actionLabel: 'Open Settings',
  },
);
assert.deepEqual(resolveTerminalProfileBlockedAction('powershell'), {
  actionId: null,
  actionLabel: null,
});
assert.equal(
  buildTerminalProfileBlockedMessage('codex', {
    ...codexAvailability!,
    status: 'missing',
  }),
  'Codex is unavailable. Install Codex CLI and ensure the codex command is on PATH. Open Settings to configure the environment.',
);
assert.equal(buildTerminalProfileBlockedMessage('powershell'), null);

const terminalPageSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx', import.meta.url),
  'utf8',
);
assert.equal(
  terminalPageSource.includes('AI CLI profile'),
  false,
  'TerminalPage should use shared launch presentation text instead of legacy AI CLI fallback copy.',
);
assert.equal(
  terminalPageSource.includes('buildTerminalProfileBlockedMessage('),
  true,
  'TerminalPage should use the shared blocked-launch message helper.',
);
assert.equal(
  terminalPageSource.includes('is unavailable.'),
  false,
  'TerminalPage should not keep page-local blocked-launch toast copy.',
);

const codePageSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const codeRunEntryHookSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/useCodeRunEntryActions.ts', import.meta.url),
  'utf8',
);
assert.equal(
  codePageSource.includes('buildTerminalProfileBlockedMessage(') ||
    codeRunEntryHookSource.includes('buildTerminalProfileBlockedMessage('),
  true,
  'CodePage should use the shared blocked-launch message helper directly or through useCodeRunEntryActions.',
);
assert.equal(
  codePageSource.includes('is unavailable.') || codeRunEntryHookSource.includes('is unavailable.'),
  false,
  'CodePage should not keep page-local blocked-launch toast copy after the run-entry boundary split.',
);

const studioPageSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
assert.equal(
  studioPageSource.includes('buildTerminalProfileBlockedMessage('),
  true,
  'StudioPage should use the shared blocked-launch message helper.',
);
assert.equal(
  studioPageSource.includes('is unavailable.'),
  false,
  'StudioPage should not keep page-local blocked-launch toast copy.',
);

console.log('terminal cli registry contract passed.');
