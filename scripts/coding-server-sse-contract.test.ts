import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { ChatMessage } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { executeBirdCoderCoreSessionRun, streamBirdCoderCoreSessionEventEnvelopes } from '../packages/sdkwork-birdcoder-server/src/index.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCliJsonl.ts';

const serverSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url),
  'utf8',
);
const sseFunctionStart = serverSource.indexOf(
  'export async function* streamBirdCoderCoreSessionEventEnvelopes',
);
const sseFunctionEnd = serverSource.indexOf(
  'export function createBirdCoderApprovalDecisionEnvelope',
  sseFunctionStart,
);
const sseFunctionBody = sseFunctionStart >= 0 && sseFunctionEnd > sseFunctionStart
  ? serverSource.slice(sseFunctionStart, sseFunctionEnd)
  : '';

assert.doesNotMatch(
  sseFunctionBody,
  /executeBirdCoderCoreSessionRun\(/u,
  'coding-server SSE must stream canonical runtime events directly instead of buffering a full core session run before yielding envelopes',
);
assert.match(
  sseFunctionBody,
  /for await \(const canonicalEvent of chatEngine\.sendCanonicalEvents\?\.\(/u,
  'coding-server SSE must consume the engine canonical event stream as the source of truth for live event envelopes',
);

const messages: ChatMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Review the workspace and use a tool if you need to modify files.',
    timestamp: Date.now(),
  },
];

const fakeCodexJsonlLines = [
  `${JSON.stringify({
    type: 'item.updated',
    item: {
      id: 'coding-server-sse-message',
      type: 'agent_message',
      text: 'Codex server SSE response.',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'item.completed',
    item: {
      id: 'coding-server-sse-command',
      type: 'command_execution',
      command: 'pnpm lint',
      aggregated_output: 'ok',
      exit_code: 0,
      status: 'completed',
    },
  })}\n`,
  `${JSON.stringify({
    type: 'turn.completed',
  })}\n`,
];

await withMockCodexCliJsonl(async () => {
  const projection = await executeBirdCoderCoreSessionRun({
    sessionId: 'coding-session-1',
    runtimeId: 'runtime-1',
    turnId: 'turn-1',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
      context: {
        workspaceRoot: 'D:/workspace',
        currentFile: {
          path: 'src/App.tsx',
          content: 'export default function App() { return null; }',
          language: 'tsx',
        },
      },
    },
  });

  assert.equal(projection.runtime.engineId, 'codex');
  assert.equal(projection.runtime.hostMode, 'server');
  assert.equal(projection.runtime.nativeRef.transportKind, 'cli-jsonl');
  assert.equal(projection.events[0]?.kind, 'session.started');
  assert.equal(projection.events[1]?.kind, 'turn.started');
  assert.equal(
    projection.events.some((event) => event.kind === 'approval.required'),
    false,
    'server projection must not request approval for completed native command history',
  );
  assert.equal(
    projection.events.some((event) => event.kind === 'tool.call.completed'),
    true,
    'server projection must preserve completed native command snapshots as completed tool events',
  );
  assert.equal(projection.artifacts.length > 0, true, 'server projection must preserve projected artifacts');
  assert.equal(projection.operation.status, 'succeeded');
  assert.equal(projection.operation.streamKind, 'sse');
  assert.equal(
    projection.operation.streamUrl,
    '/api/core/v1/coding-sessions/coding-session-1/events',
  );

  const envelopes = [];
  for await (const envelope of streamBirdCoderCoreSessionEventEnvelopes({
    sessionId: 'coding-session-1',
    runtimeId: 'runtime-1',
    turnId: 'turn-1',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
    },
  })) {
    envelopes.push(envelope);
  }

  assert.equal(envelopes.length > 0, true, 'coding-server SSE contract must emit envelopes');
  assert.equal(envelopes[0]?.meta.version, 'v1');
  assert.equal(envelopes[0]?.data.kind, 'session.started');
  assert.equal(envelopes.some((envelope) => envelope.data.kind === 'tool.call.completed'), true);
  assert.equal(envelopes.some((envelope) => envelope.data.kind === 'artifact.upserted'), true);
  assert.equal(envelopes.some((envelope) => envelope.data.kind === 'turn.completed'), true);
}, {
  stdoutLines: fakeCodexJsonlLines,
});

await withMockCodexCliJsonl(async () => {
  const failedProjection = await executeBirdCoderCoreSessionRun({
    sessionId: 'coding-session-failed-run',
    runtimeId: 'runtime-failed-run',
    turnId: 'turn-failed-run',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
      context: {
        workspaceRoot: 'D:/workspace',
      },
    },
  });

  assert.equal(
    failedProjection.runtime.status,
    'failed',
    'server projection must return a failed runtime snapshot instead of rejecting after a provider stream failure',
  );
  assert.equal(
    failedProjection.operation.status,
    'failed',
    'server projection must return a failed operation snapshot for provider stream failures so the IDE can stop showing a loading turn',
  );
  assert.equal(
    failedProjection.events.at(-1)?.kind,
    'turn.failed',
    'server projection must keep turn.failed as the terminal persisted event when a provider stream fails',
  );
  assert.equal(
    failedProjection.events.at(-1)?.payload.errorMessage,
    'Error: provider stream disconnected',
    'server projection must preserve the canonical errorMessage payload for failed turns',
  );
  assert.equal(
    Object.hasOwn(failedProjection.events.at(-1)?.payload ?? {}, 'error'),
    false,
    'server projection failed turns must not expose a competing error field beside errorMessage',
  );

  const failedEnvelopes = [];
  for await (const envelope of streamBirdCoderCoreSessionEventEnvelopes({
    sessionId: 'coding-session-failed-sse',
    runtimeId: 'runtime-failed-sse',
    turnId: 'turn-failed-sse',
    engineId: 'codex',
    modelId: 'codex',
    hostMode: 'server',
    messages,
    options: {
      model: 'codex',
      context: {
        workspaceRoot: 'D:/workspace',
      },
    },
  })) {
    failedEnvelopes.push(envelope);
  }

  assert.equal(
    failedEnvelopes.at(-1)?.data.kind,
    'turn.failed',
    'coding-server SSE must close through a terminal turn.failed envelope instead of rethrowing provider stream errors after yielding it',
  );
  assert.equal(
    failedEnvelopes.at(-1)?.data.payload.runtimeStatus,
    'failed',
    'coding-server SSE failed envelopes must carry the failed runtime status used by projection consumers',
  );
  assert.equal(
    failedEnvelopes.filter((envelope) => envelope.data.kind === 'turn.failed').length,
    1,
    'coding-server SSE must not duplicate turn.failed when the canonical runtime yields a failure event and then rethrows for direct debuggers',
  );
}, {
  exitCode: 1,
  stderrLines: ['provider stream disconnected'],
  stdoutLines: [],
});

console.log('coding server sse contract passed.');
