import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  formatStructuredTerminalWarningPayload,
  sanitizeDesktopSessionReplay,
  sanitizeDesktopSessionStreamEvent,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/terminalRuntimeSanitization.ts';

const rootDir = process.cwd();
const terminalRuntimeSource = fs.readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-birdcoder-commons',
    'src',
    'terminal',
    'birdcoderTerminalInfrastructureRuntime.ts',
  ),
  'utf8',
);
const webViteConfigSource = fs.readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-web', 'vite.config.ts'),
  'utf8',
);
const desktopViteConfigSource = fs.readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop', 'vite.config.ts'),
  'utf8',
);
const sharedVitePluginSource = fs.readFileSync(
  path.join(rootDir, 'scripts', 'create-birdcoder-vite-plugins.mjs'),
  'utf8',
);

assert.equal(
  formatStructuredTerminalWarningPayload(
    JSON.stringify({
      code: 'permission_denied',
      phase: 'connect',
      retryable: false,
      program: 'ssh',
      status: 255,
      message: 'Permission denied',
    }),
  ),
  'Permission denied (code: permission_denied, phase: connect, status: 255, program: ssh, not retryable)',
  'Structured runtime warnings should be converted into readable terminal text instead of raw JSON.',
);

assert.equal(
  formatStructuredTerminalWarningPayload('plain stderr'),
  null,
  'Plain stderr warnings must pass through untouched.',
);

assert.equal(
  formatStructuredTerminalWarningPayload(
    '{"message":"Terminal warning","status":101777208078558059}',
  ),
  'Terminal warning (status: 101777208078558059)',
  'Structured runtime warning JSON must preserve unsafe Long status values before formatting.',
);

const sanitizedReplay = sanitizeDesktopSessionReplay({
  sessionId: 'session-001',
  fromCursor: null,
  nextCursor: '2',
  hasMore: false,
  entries: [
    {
      sequence: 1,
      kind: 'state',
      payload: '{"state":"running","phase":"connect"}',
      occurredAt: '2026-04-20T10:00:00.000Z',
    },
    {
      sequence: 2,
      kind: 'marker',
      payload: '{"marker":"ready"}',
      occurredAt: '2026-04-20T10:00:01.000Z',
    },
    {
      sequence: 3,
      kind: 'output',
      payload: 'PS D:\\project>',
      occurredAt: '2026-04-20T10:00:02.000Z',
    },
  ],
});

assert.deepEqual(
  sanitizedReplay.entries.map((entry) => entry.kind),
  ['output'],
  'Replay sanitization must remove non-display state and marker entries so terminal tabs do not print bootstrap JSON payloads.',
);

const sanitizedEvent = sanitizeDesktopSessionStreamEvent({
  sessionId: 'session-001',
  nextCursor: '4',
  entry: {
    sequence: 4,
    kind: 'warning',
    payload: JSON.stringify({
      code: 'spawn_failed',
      phase: 'exec',
      retryable: true,
      program: 'codex',
      status: 1,
      message: 'Failed to start process',
    }),
    occurredAt: '2026-04-20T10:00:03.000Z',
  },
});

assert.equal(
  sanitizedEvent.entry.payload,
  'Failed to start process (code: spawn_failed, phase: exec, status: 1, program: codex, retryable)',
  'Runtime warning stream events should render a readable summary instead of raw JSON payloads.',
);

assert.match(
  terminalRuntimeSource,
  /from '\.\/terminalRuntimeSanitization\.ts'/,
  'BirdCoder terminal runtime entry must delegate replay and warning cleanup to the dedicated terminalRuntimeSanitization module.',
);

assert.match(
  webViteConfigSource,
  /createBirdcoderWorkspaceAliasEntries\(__dirname\)/,
  'Web Vite config must consume the shared workspace alias builder so terminal runtime integration does not drift across startup surfaces.',
);

assert.match(
  desktopViteConfigSource,
  /createBirdcoderWorkspaceAliasEntries\(__dirname\)/,
  'Desktop Vite config must consume the shared workspace alias builder so terminal runtime integration does not drift across startup surfaces.',
);

assert.match(
  sharedVitePluginSource,
  /birdcoderTerminalInfrastructureRuntime\.ts/,
  'The shared BirdCoder Vite workspace alias builder must pin @sdkwork/terminal-infrastructure to the dedicated BirdCoder terminal runtime entry.',
);

console.log('terminal runtime bridge sanitize contract passed.');
