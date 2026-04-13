import assert from 'node:assert/strict';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-commons/src/workbench/engines.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';

const messages: ChatMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Inspect the current workspace and use the appropriate tool if needed.',
    timestamp: Date.now(),
  },
];

for (const engine of listWorkbenchCliEngines()) {
  const runtime = createChatEngineById(engine.id);

  assert.equal(
    typeof runtime.describeRuntime,
    'function',
    `${engine.id} must expose a canonical runtime descriptor`,
  );
  assert.equal(
    typeof runtime.sendCanonicalEvents,
    'function',
    `${engine.id} must expose a canonical runtime event stream`,
  );

  const descriptor = runtime.describeRuntime?.({
    model: engine.defaultModelId,
  });

  assert.ok(descriptor, `${engine.id} runtime descriptor must be available`);
  assert.equal(descriptor?.engineId, engine.id);
  assert.equal(descriptor?.modelId, engine.defaultModelId);
  assert.ok(
    descriptor?.transportKind
      ? engine.descriptor.transportKinds.includes(descriptor.transportKind)
      : false,
    `${engine.id} transportKind must stay inside the shared kernel descriptor`,
  );
  assert.equal(descriptor?.approvalPolicy, 'OnRequest');

  const events = [];
  for await (const event of runtime.sendCanonicalEvents?.(messages, {
    model: engine.defaultModelId,
    context: {
      workspaceRoot: 'D:/workspace',
      currentFile: {
        path: 'src/App.tsx',
        content: 'export default function App() { return null; }',
        language: 'tsx',
      },
    },
  }) ?? []) {
    events.push(event);
  }

  assert.equal(events.length > 0, true, `${engine.id} must emit canonical runtime events`);
  assert.equal(events[0]?.kind, 'session.started');
  assert.equal(events[1]?.kind, 'turn.started');
  assert.equal(
    events.some((event) => event.kind === 'message.delta'),
    true,
    `${engine.id} must normalize content chunks into message.delta events`,
  );
  assert.equal(
    events.some((event) => event.kind === 'message.completed'),
    true,
    `${engine.id} must normalize stream completion into message.completed`,
  );
  assert.equal(
    events.some((event) => event.kind === 'tool.call.requested'),
    true,
    `${engine.id} must normalize tool requests`,
  );
  assert.equal(
    events.some((event) => event.kind === 'artifact.upserted'),
    true,
    `${engine.id} must project tool results into canonical artifacts`,
  );
  assert.equal(
    events.some((event) => event.kind === 'operation.updated'),
    true,
    `${engine.id} must expose canonical runtime status updates`,
  );
  assert.equal(
    events.some((event) => event.kind === 'turn.completed'),
    true,
    `${engine.id} must close the canonical turn stream`,
  );

  const toolRequestedEvent = events.find((event) => event.kind === 'tool.call.requested');
  assert.doesNotThrow(
    () => JSON.parse(String(toolRequestedEvent?.payload.toolArguments ?? '{}')),
    `${engine.id} tool.call.requested payload must keep JSON-safe tool arguments`,
  );

  if (engine.id !== 'gemini') {
    assert.equal(
      events.some((event) => event.kind === 'approval.required'),
      true,
      `${engine.id} side-effecting tool projections must emit approval.required`,
    );
  }
}

console.log('engine runtime adapter contract passed.');
