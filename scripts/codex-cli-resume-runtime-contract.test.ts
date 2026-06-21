import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { buildWorkbenchCodeEngineTerminalResumeCommand } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';

const root = path.resolve(import.meta.dirname, '..');
const codexCliSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/codex_cli.rs'),
  'utf8',
);
const codexSessionsSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/codex_sessions.rs'),
  'utf8',
);

assert.equal(
  buildWorkbenchCodeEngineTerminalResumeCommand({
    engineId: 'codex',
    nativeSessionId: 'session-abc',
  }),
  'resume session-abc',
);

assert.match(codexCliSource, /resume/);
assert.match(codexSessionsSource, /parse_codex_session_summary/);

console.log('codex cli resume runtime contract passed.');
