import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';
import { createChatEngineById } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';
import {
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/coding-session.ts';

assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('tool.call.requested'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('tool.call.completed'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('artifact.upserted'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('approval.required'), true);
assert.equal(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS.includes('command-log'), true);
assert.equal(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS.includes('diagnostic-bundle'), true);

const root = path.resolve(import.meta.dirname, '..');
const binaryCandidates = [
  path.join(root, 'target/debug/birdcoder-kernel-turn.exe'),
  path.join(root, 'target/debug/birdcoder-kernel-turn'),
];
const binary = binaryCandidates.find((candidate) => existsSync(candidate));
assert.ok(binary, 'birdcoder-kernel-turn binary must be built before tool protocol contract tests run');
process.env.BIRDCODER_KERNEL_TURN_BIN = binary;

const eventKindRegistry = new Set<string>(BIRDCODER_CODING_SESSION_EVENT_KINDS);

await withMockCodexCliJsonl(async () => {
  for (const engine of listWorkbenchCliEngines()) {
    assert.equal(
      engine.descriptor.capabilityMatrix.toolCalls,
      true,
      `${engine.id} must advertise tool-call support in the shared capability matrix`,
    );

    const runtime = createChatEngineById(engine.id);
    const emittedEventKinds = new Set<string>();

    for await (const event of runtime.sendCanonicalEvents?.(
      [
        {
          id: 'msg-user-1',
          role: 'user',
          content: 'Use a tool to inspect or modify the workspace.',
          timestamp: Date.now(),
        },
      ],
      {
        model: engine.defaultModelId,
        context: {
          workspaceRoot: 'D:/workspace',
        },
      },
    ) ?? []) {
      emittedEventKinds.add(event.kind);
      assert.equal(
        eventKindRegistry.has(event.kind),
        true,
        `${engine.id} kernel runtime must only emit registered event kinds`,
      );
    }

    assert.equal(
      emittedEventKinds.has('turn.completed'),
      true,
      `${engine.id} kernel runtime must complete turns through canonical events`,
    );
  }
});

console.log('tool protocol contract passed.');
