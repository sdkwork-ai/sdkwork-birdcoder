import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AgentSessionItemView } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts';
import { normalizeAgentSessionItemToolCalls } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts';
import { TurnProcessDisclosure } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/presentation/TurnProcessDisclosure.tsx';
import { resolveChatTurnProcessPresentations } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/presentation/turnProcessPresentation.ts';

const toolFixtures = {
  codex: {
    type: 'function_call',
    id: 'codex-command-item',
    call_id: 'codex-command',
    name: 'shell_command',
    arguments: '{"command":"pnpm typecheck"}',
  },
  'claude-code': {
    contentBlock: {
      type: 'tool_use',
      id: 'claude-command',
      name: 'Bash',
      input: { command: 'pnpm typecheck' },
    },
  },
  opencode: {
    type: 'tool',
    callID: 'opencode-command',
    tool: 'bash',
    state: {
      status: 'completed',
      input: { command: 'pnpm typecheck' },
      output: 'Done',
    },
  },
  gemini: {
    type: 'tool_call_request',
    value: {
      callId: 'gemini-command',
      name: 'run_shell_command',
      args: { command: 'pnpm typecheck' },
    },
  },
} as const;

function createTurn(toolCall: unknown): AgentSessionItemView[] {
  return [
    {
      id: 'user-item',
      sessionId: 'process-session',
      turnId: 'process-turn',
      role: 'user',
      content: 'Verify the application.',
      createdAt: '2026-07-29T08:00:00.000Z',
    },
    {
      id: 'tool-item',
      sessionId: 'process-session',
      turnId: 'process-turn',
      role: 'tool',
      content: '',
      createdAt: '2026-07-29T08:00:00.500Z',
      completedAt: '2026-07-29T08:00:01.500Z',
      tool_calls: [toolCall],
    },
    {
      id: 'assistant-item',
      sessionId: 'process-session',
      turnId: 'process-turn',
      role: 'assistant',
      content: 'Verification completed.',
      createdAt: '2026-07-29T08:00:01.600Z',
      completedAt: '2026-07-29T08:00:02.000Z',
    },
  ];
}

for (const [engineId, fixture] of Object.entries(toolFixtures)) {
  assert.equal(
    normalizeAgentSessionItemToolCalls([fixture], { engineId }).length,
    1,
    `${engineId} must normalize through its provider adapter before presentation.`,
  );
  const turn = createTurn(fixture);
  const projection = resolveChatTurnProcessPresentations(turn, { engineId });
  const process = projection[2]?.process;
  assert.ok(process, `${engineId} must project tool activity into one turn process.`);
  assert.equal(process.targetIndex, 2);
  assert.equal(process.startedAtMs, Date.parse('2026-07-29T08:00:00.000Z'));
  assert.equal(process.completedAtMs, Date.parse('2026-07-29T08:00:02.000Z'));
  assert.equal(projection[1]?.suppressProcessBlocks, true);
  assert.equal(
    process.items.some((item) => item.view.blocks.some((block) => (
      block.type === 'activity' || block.type === 'tool-calls'
    ))),
    true,
  );
}

const completedProjection = resolveChatTurnProcessPresentations(
  createTurn(toolFixtures.codex),
  { engineId: 'codex' },
)[2]?.process;
assert.ok(completedProjection);

const html = renderToStaticMarkup(
  <TurnProcessDisclosure
    presentation={completedProjection}
    context={{
      actionTarget: null,
      allMessages: createTurn(toolFixtures.codex),
      copyMessageToClipboard: () => undefined,
      engineId: 'codex',
      environment: null,
      expandedDisclosureKeys: new Set(),
      index: 2,
      layout: 'main',
      renderMarkdownContent: (content) => <span>{content}</span>,
      sessionId: 'process-session',
      showMessageActions: false,
      toggleDisclosure: () => undefined,
      turn: {
        isActiveTail: false,
        isEnd: true,
        isStart: false,
        key: 'turn:process-turn',
        position: 'end',
      },
    }}
  />,
);
assert.match(html, /data-chat-turn-process="true"/u);
assert.match(html, /data-chat-turn-process-state="completed"/u);
assert.match(html, /data-chat-turn-process-expanded="false"/u);
assert.match(html, /Processed/u);
assert.match(html, /2s/u);
assert.doesNotMatch(html, /Verification completed/u);

console.log('Universal chat turn process contract passed.');
