import assert from 'node:assert/strict';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  resolveAgentSessionItemPresentation,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-presentation.ts';
import {
  normalizeAgentSessionItemToolCall,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts';
import {
  ChatInteractionEvents,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/blocks/ChatInteractionEvents.tsx';

const openCodeQuestion = normalizeAgentSessionItemToolCall({
  part: {
    id: 'opencode-question',
    type: 'tool',
    tool: 'question',
    state: {
      status: 'completed',
      input: {
        questions: [{
          header: 'Rendering',
          question: 'Which presentation should BirdCoder use?',
          options: [
            { label: 'Structured', description: 'Use canonical interaction facts.' },
            { label: 'Raw JSON', description: 'Show the provider payload.' },
          ],
          custom: true,
        }],
      },
      metadata: { answers: [['Structured']] },
    },
  },
}, 0, { engineId: 'opencode' });
assert.equal(openCodeQuestion?.kind, 'question');
assert.equal(openCodeQuestion?.interaction?.status, 'answered');
assert.equal(openCodeQuestion?.interaction?.questions?.[0]?.header, 'Rendering');
assert.deepEqual(openCodeQuestion?.interaction?.questions?.[0]?.answers, ['Structured']);

const openCodePermission = normalizeAgentSessionItemToolCall({
  type: 'permission.v2.asked',
  id: 'per_01',
  sessionID: 'session-opencode',
  action: 'bash',
  resources: ['pnpm build', 'apps/sdkwork-birdcoder-pc/**'],
  metadata: { reason: 'Run the production verification.' },
}, 0, { engineId: 'opencode' });
assert.equal(openCodePermission?.kind, 'approval');
assert.equal(openCodePermission?.interaction?.status, 'pending');
assert.equal(openCodePermission?.interaction?.action, 'bash');
assert.deepEqual(openCodePermission?.interaction?.resources, [
  'pnpm build',
  'apps/sdkwork-birdcoder-pc/**',
]);

const codexQuestion = normalizeAgentSessionItemToolCall({
  item: {
    id: 'codex-question',
    type: 'function_call',
    name: 'request_user_input',
    status: 'in_progress',
    arguments: {
      questions: [{
        id: 'scope',
        header: 'Scope',
        question: 'Which surface should be updated?',
        options: [{ label: 'Desktop', description: 'Update the PC transcript.' }],
      }],
    },
  },
}, 0, { engineId: 'codex' });
assert.equal(codexQuestion?.kind, 'question');
assert.equal(codexQuestion?.interaction?.status, 'pending');
assert.equal(codexQuestion?.interaction?.requiresResponse, true);

const claudePermissionDenied = normalizeAgentSessionItemToolCall({
  type: 'system',
  subtype: 'permission_denied',
  tool_use_id: 'claude-permission',
  tool_name: 'Bash',
  tool_input: { command: 'pnpm release' },
  decision_reason: 'Release commands require explicit approval.',
  message: 'The command was not executed.',
}, 0, { engineId: 'claude-code' });
assert.equal(claudePermissionDenied?.kind, 'approval');
assert.equal(claudePermissionDenied?.interaction?.status, 'denied');
assert.equal(claudePermissionDenied?.interaction?.resources?.[0], 'pnpm release');

const geminiApproval = normalizeAgentSessionItemToolCall({
  type: 'tool_call_confirmation',
  value: {
    id: 'gemini-confirmation',
    request: {
      callId: 'gemini-call',
      name: 'run_shell_command',
      args: { command: 'pnpm typecheck' },
    },
    details: { title: 'Run typecheck' },
  },
}, 0, { engineId: 'gemini' });
assert.equal(geminiApproval?.kind, 'approval');
assert.equal(geminiApproval?.interaction?.status, 'pending');
assert.equal(geminiApproval?.interaction?.resources?.[0], 'pnpm typecheck');

const presentation = resolveAgentSessionItemPresentation({
  id: 'interaction-item',
  sessionId: 'interaction-session',
  turnId: 'interaction-turn',
  role: 'assistant',
  content: '',
  tool_calls: [
    {
      part: {
        id: 'opencode-question',
        type: 'tool',
        tool: 'question',
        state: {
          status: 'completed',
          input: {
            questions: [{
              header: 'Rendering',
              question: 'Which presentation should BirdCoder use?',
              options: [{ label: 'Structured', description: 'Use canonical facts.' }],
            }],
          },
          metadata: { answers: [['Structured']] },
        },
      },
    },
  ],
  createdAt: '2026-07-28T08:00:00.000Z',
}, { engineId: 'opencode' });
const interactionBlock = presentation.blocks.find((block) => block.type === 'interactions');
assert.equal(interactionBlock?.type, 'interactions');
assert.equal(interactionBlock?.items[0]?.status, 'answered');
assert.equal(
  presentation.blocks.some((block) => block.type === 'tool-calls'),
  false,
  'Structured interactions must not also render as generic tool cards.',
);

const interactions = [
  openCodeQuestion?.interaction,
  claudePermissionDenied?.interaction,
].filter((interaction) => interaction !== undefined);
const disclosureScopeKey = 'interaction-session\u0001interaction-turn\u0001interaction';
const html = renderToStaticMarkup(
  <ChatInteractionEvents
    copyMessageToClipboard={() => undefined}
    disclosureScopeKey={disclosureScopeKey}
    expandedDisclosureKeys={new Set(interactions.map((interaction) =>
      `${disclosureScopeKey}\u0001${interaction.id}`,
    ))}
    interactions={interactions}
    toggleDisclosure={() => undefined}
  />,
);
assert.match(html, /data-chat-interactions="true"/u);
assert.match(html, /data-chat-interaction-kind="question"/u);
assert.match(html, /data-chat-interaction-status="answered"/u);
assert.match(html, /Question answered/u);
assert.match(html, /Structured/u);
assert.match(html, /data-selected="true"/u);
assert.match(html, /data-chat-interaction-kind="approval"/u);
assert.match(html, /Approval denied/u);
assert.match(html, /pnpm release/u);

console.log('Universal chat interaction presentation contract passed.');
