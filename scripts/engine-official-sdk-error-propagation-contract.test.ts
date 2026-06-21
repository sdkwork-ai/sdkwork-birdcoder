import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createChatEngineById } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/engines.ts';

const root = path.resolve(import.meta.dirname, '..');

const previousBinary = process.env.BIRDCODER_KERNEL_TURN_BIN;
process.env.BIRDCODER_KERNEL_TURN_BIN = path.join(root, 'target/missing-kernel-turn-binary');

const runtime = createChatEngineById('codex');
const events = [];

try {
  for await (const event of runtime.sendCanonicalEvents?.(
    [
      {
        id: 'sdk-error-propagation-user-1',
        role: 'user',
        content: 'Surface official SDK execution failures to the caller.',
        timestamp: Date.now(),
      },
    ],
    { model: 'gpt-5.4' },
  ) ?? []) {
    events.push(event);
  }
  assert.fail('kernel runtime must reject missing bridge binary');
} catch (error) {
  assert.match(String(error), /birdcoder-kernel-turn|Command failed/i);
}

assert.equal(events.some((event) => event.kind === 'turn.failed'), true);

if (previousBinary) {
  process.env.BIRDCODER_KERNEL_TURN_BIN = previousBinary;
} else {
  delete process.env.BIRDCODER_KERNEL_TURN_BIN;
}

const opencodeTransportSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/opencode.rs'),
  'utf8',
);
assert.match(opencodeTransportSource, /stream_opencode_session_events/);
assert.match(opencodeTransportSource, /reply_opencode_permission_request/);

console.log('engine official sdk error propagation contract passed.');
