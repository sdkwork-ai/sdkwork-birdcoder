import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';

import { createChatEngineById } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';
import { createWorkbenchCanonicalChatEngine } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/runtime.ts';
import type { ChatMessage } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection/src/types.ts';

const root = path.resolve(import.meta.dirname, '..');
const binaryCandidates = [
  path.join(root, 'target/debug/birdcoder-kernel-turn.exe'),
  path.join(root, 'target/debug/birdcoder-kernel-turn'),
];

const binary = binaryCandidates.find((candidate) => existsSync(candidate));
assert.ok(
  binary,
  'birdcoder-kernel-turn binary must be built before engine conformance contract tests run',
);

process.env.BIRDCODER_KERNEL_TURN_BIN = binary;

const messages: ChatMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Review the current workspace and propose the next code change.',
    timestamp: Date.now(),
  },
];

await withMockCodexCliJsonl(async () => {
  for (const engine of listWorkbenchCliEngines()) {
    const runtime = createWorkbenchCanonicalChatEngine(createChatEngineById(engine.id), {
      engineId: engine.id,
      defaultModelId: engine.descriptor.defaultModelId,
      descriptor: engine.descriptor,
    });

    assert.match(runtime.name, /-kernel-cli-adapter$/);
    assert.equal(typeof runtime.sendCanonicalEvents, 'function');

    const events = [];
    for await (const event of runtime.sendCanonicalEvents?.(
      messages,
      { model: engine.descriptor.defaultModelId },
    ) ?? []) {
      events.push(event);
    }

    assert.ok(events.some((event) => event.kind === 'session.started'));
    assert.ok(events.some((event) => event.kind === 'turn.started'));
    assert.ok(events.some((event) => event.kind === 'turn.completed'));
    assert.ok(events.some((event) => event.kind === 'message.completed'));
  }
});

const verticalContractOutput = execFileSync(
  process.execPath,
  ['--test', path.join(root, 'scripts/code-engine-local-provider-vertical-contract.test.mjs')],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  },
);
assert.match(
  verticalContractOutput,
  /All four code-engine local Provider vertical contracts passed/,
);

console.log('engine conformance contract passed.');
