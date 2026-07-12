import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';

import { createChatEngineById } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';
import { createWorkbenchCanonicalChatEngine } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/runtime.ts';

const root = path.resolve(import.meta.dirname, '..');
const binaryCandidates = [
  path.join(root, 'target/debug/birdcoder-kernel-turn.exe'),
  path.join(root, 'target/debug/birdcoder-kernel-turn'),
];

const binary = binaryCandidates.find((candidate) => existsSync(candidate));
assert.ok(
  binary,
  'birdcoder-kernel-turn binary must be built before kernel runtime contract tests run',
);

process.env.BIRDCODER_KERNEL_TURN_BIN = binary;

await withMockCodexCliJsonl(async () => {
  for (const engine of listWorkbenchCliEngines()) {
    const runtime = createWorkbenchCanonicalChatEngine(createChatEngineById(engine.id), {
      engineId: engine.id,
      defaultModelId: engine.descriptor.defaultModelId,
      descriptor: engine.descriptor,
    });

    assert.match(runtime.name, /-kernel-cli-adapter$/);

    const descriptor = runtime.describeRuntime?.({
      model: engine.descriptor.defaultModelId,
    });
    assert.equal(descriptor?.engineId, engine.id);

    const events = [];
    for await (const event of runtime.sendCanonicalEvents?.(
      [
        {
          id: 'msg-1',
          role: 'user',
          content: 'hello kernel contract',
          timestamp: Date.now(),
        },
      ],
      {
        model: engine.descriptor.defaultModelId,
      },
    ) ?? []) {
      events.push(event);
    }

    assert.ok(events.some((event) => event.kind === 'turn.completed'));
    assert.ok(events.some((event) => event.kind === 'message.completed'));
  }
});

const adaptersSource = await import('node:fs/promises').then((fs) =>
  fs.readFile(
    path.join(root, 'crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/adapters.rs'),
    'utf8',
  ),
);
assert.match(adaptersSource, /BirdcoderKernelHost/);
assert.match(adaptersSource, /KernelBridgeCodeEngineProvider/);
assert.doesNotMatch(adaptersSource, /RegistryCodeEngineProvider/);

console.log('kernel runtime adapter contract passed.');
