#!/usr/bin/env node

import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  createAppbaseFailure,
  createAppbaseSuccess,
  createAgentProjectFixture,
  createAppTemplateFixture,
  createBirdCoderCursorListEnvelope,
  createBirdCoderDataEnvelope,
  createBirdCoderListEnvelope,
  createAgentSessionFixture,
  createAgentWorkspaceFixture,
  createCodeEngineCatalogFixture,
  createIamDeviceAuthorizationFixture,
  createIamRuntimeSettings,
  createIamSessionData,
  credentialsMatchSessionRequest,
  isAuthenticatedRequest,
} from './pc-e2e-mock-api-fixtures.mjs';

const port = Number(process.env.PC_E2E_MOCK_API_PORT ?? 11240);
const host = process.env.PC_E2E_MOCK_API_HOST ?? '127.0.0.1';
const allowedOrigins = new Set(
  (process.env.PC_E2E_ALLOWED_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const defaultWorkspace = createAgentWorkspaceFixture();
const workspaces = [defaultWorkspace];
const projects = [createAgentProjectFixture()];
const projectDriveId = 'drive.e2e-project';
const projectDriveRootEntryId = 'drive-entry-project-root';
const e2eCursorPrefix = 'e2e.cursor.v1.';
const codexProviderSessionId = '019b23e7-0f4b-7ae1-8b42-2ed4d6b68211';
const providerSessionIdsBySessionId = new Map([
  ['e2e-claude-session', 'claude-provider-continuation-4d03c81e'],
  ['e2e-codex-session', codexProviderSessionId],
  ['e2e-opencode-session', 'opencode-provider-continuation-795b74aa'],
  ['e2e-gemini-session', 'gemini-provider-continuation-a2db156c'],
  ['e2e-openclaw-session', 'openclaw-provider-continuation-0be32864'],
  ['e2e-hermes-session', 'hermes-provider-continuation-fcab0271'],
  ...Array.from({ length: 38 }, (_, index) => [
    `e2e-history-session-${index + 1}`,
    `codex-provider-history-${String(index + 1).padStart(2, '0')}-6d31f9a8`,
  ]),
]);
let nextDynamicProviderSessionSequence = 1;

function resolveMockProviderSessionId(sessionId) {
  const existing = providerSessionIdsBySessionId.get(sessionId);
  if (existing) {
    return existing;
  }
  const providerSessionId = `mock-provider-continuation-${String(
    nextDynamicProviderSessionSequence,
  ).padStart(4, '0')}-a17c5e92`;
  nextDynamicProviderSessionSequence += 1;
  providerSessionIdsBySessionId.set(sessionId, providerSessionId);
  return providerSessionId;
}

function createE2ECursor(scope, offset) {
  const payload = Buffer.from(JSON.stringify({ offset, scope }), 'utf8').toString('base64url');
  return `${e2eCursorPrefix}${payload}`;
}

function readE2ECursorOffset(cursor, scope) {
  if (!cursor) {
    return 0;
  }
  if (!cursor.startsWith(e2eCursorPrefix)) {
    return null;
  }
  try {
    const encodedPayload = cursor.slice(e2eCursorPrefix.length);
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (
      payload?.scope !== scope
      || !Number.isSafeInteger(payload?.offset)
      || payload.offset < 0
      || createE2ECursor(scope, payload.offset) !== cursor
    ) {
      return null;
    }
    return payload.offset;
  } catch {
    return null;
  }
}
const projectDriveLogicalPath = 'sdkwork-birdcoder';
const projectDriveEntries = [
  {
    id: 'drive-entry-src',
    sandboxId: projectDriveId,
    parentId: projectDriveRootEntryId,
    name: 'src',
    kind: 'directory',
    logicalPath: `${projectDriveLogicalPath}/src`,
    revision: 'revision-src-1',
  },
  {
    id: 'drive-entry-readme',
    sandboxId: projectDriveId,
    parentId: projectDriveRootEntryId,
    name: 'README.md',
    kind: 'file',
    logicalPath: `${projectDriveLogicalPath}/README.md`,
    revision: 'revision-readme-1',
  },
  {
    id: 'drive-entry-index',
    sandboxId: projectDriveId,
    parentId: 'drive-entry-src',
    name: 'index.ts',
    kind: 'file',
    logicalPath: `${projectDriveLogicalPath}/src/index.ts`,
    revision: 'revision-index-1',
  },
];
const projectDriveFileContents = new Map([
  ['drive-entry-readme', '# SDKWork BirdCoder\n'],
  ['drive-entry-index', "export const applicationName = 'BirdCoder';\n"],
]);
const sessions = [
  createAgentSessionFixture({
    sessionId: 'e2e-claude-session',
    agentId: 'agent.intelligence.claude-code',
    title: 'Claude architecture review',
    itemCount: '8',
    lastItemSequence: '8',
    lastItemAt: '2026-01-01T00:30:00.000Z',
    version: '3',
    updatedAt: '2026-01-01T00:30:00.000Z',
  }),
  createAgentSessionFixture({
    sessionId: 'e2e-codex-session',
    agentId: 'agent.intelligence.codex',
    title: 'Codex implementation',
    itemCount: '112',
    lastItemSequence: '112',
    lastItemAt: '2026-01-01T00:20:00.000Z',
    version: '112',
    updatedAt: '2026-01-01T00:20:00.000Z',
  }),
  createAgentSessionFixture({
    sessionId: 'e2e-opencode-session',
    agentId: 'agent.intelligence.opencode',
    title: 'OpenCode verification',
    itemCount: '6',
    lastItemSequence: '6',
    lastItemAt: '2026-01-01T00:10:06.000Z',
    version: '6',
    updatedAt: '2026-01-01T00:10:06.000Z',
  }),
  createAgentSessionFixture({
    sessionId: 'e2e-gemini-session',
    agentId: 'agent.intelligence.gemini',
    title: 'Gemini failure triage',
    itemCount: '3',
    lastItemSequence: '3',
    lastItemAt: '2026-01-01T00:05:03.000Z',
    version: '3',
    updatedAt: '2026-01-01T00:05:03.000Z',
  }),
  createAgentSessionFixture({
    sessionId: 'e2e-openclaw-session',
    agentId: 'agent.intelligence.openclaw',
    title: 'OpenClaw operations plan',
    itemCount: '4',
    lastItemSequence: '4',
    lastItemAt: '2026-01-01T00:04:00.000Z',
    version: '4',
    updatedAt: '2026-01-01T00:04:00.000Z',
  }),
  createAgentSessionFixture({
    sessionId: 'e2e-hermes-session',
    agentId: 'agent.intelligence.hermes',
    title: 'Hermes research brief',
    itemCount: '2',
    lastItemSequence: '2',
    lastItemAt: '2026-01-01T00:03:00.000Z',
    version: '2',
    updatedAt: '2026-01-01T00:03:00.000Z',
  }),
  ...Array.from({ length: 38 }, (_, index) => {
    const historyNumber = index + 1;
    const updatedAt = new Date(Date.UTC(2025, 11, 31, 23, 59 - index)).toISOString();
    return createAgentSessionFixture({
      sessionId: `e2e-history-session-${historyNumber}`,
      agentId: 'agent.intelligence.codex',
      title: index === 17
        ? 'History page two session'
        : index === 37
          ? 'History page three session'
          : `History session ${historyNumber}`,
      lastItemSequence: String(historyNumber),
      lastItemAt: updatedAt,
      version: String(historyNumber),
      updatedAt,
    });
  }),
];
const sessionItemsBySessionId = new Map([
  [
    'e2e-claude-session',
    [
      {
        sessionId: 'e2e-claude-session',
        itemId: 'e2e-claude-item-8',
        turnId: 'e2e-claude-turn-1',
        kind: 'tool_result',
        status: 'completed',
        sequence: '8',
        content: null,
        contentType: 'application/json',
        toolName: 'provider_event',
        toolCallId: 'e2e-claude-result-1',
        toolResult: {
          id: 'e2e-claude-result-1',
          type: 'result',
          subtype: 'success',
          duration_ms: 4_200,
          total_cost_usd: 0.041,
          usage: {
            input_tokens: 520,
            output_tokens: 130,
          },
        },
        createdAt: '2026-01-01T00:30:08.000Z',
      },
      {
        sessionId: 'e2e-claude-session',
        itemId: 'e2e-claude-item-7',
        turnId: 'e2e-claude-turn-1',
        kind: 'system_instruction',
        status: 'completed',
        sequence: '7',
        content: 'INTERNAL_SYSTEM_INSTRUCTION_MUST_NOT_RENDER',
        contentType: 'text/plain',
        createdAt: '2026-01-01T00:30:07.000Z',
      },
      {
        sessionId: 'e2e-claude-session',
        itemId: 'e2e-claude-item-6',
        turnId: 'e2e-claude-turn-1',
        kind: 'tool_call',
        status: 'completed',
        sequence: '6',
        content: null,
        contentType: 'application/json',
        toolName: 'TodoWrite',
        toolCallId: 'e2e-claude-todo-1',
        toolArguments: {
          todos: [
            { content: 'Inspect message protocol parts', status: 'completed' },
            { content: 'Align the shared renderer', status: 'in_progress' },
            { content: 'Verify compact layout', status: 'pending' },
          ],
        },
        createdAt: '2026-01-01T00:30:06.000Z',
      },
      {
        sessionId: 'e2e-claude-session',
        itemId: 'e2e-claude-item-5',
        turnId: 'e2e-claude-turn-1',
        kind: 'tool_result',
        status: 'completed',
        sequence: '5',
        content: null,
        contentType: 'application/json',
        toolName: 'provider_event',
        toolCallId: 'e2e-claude-assistant-1',
        toolResult: {
          type: 'assistant',
          message: {
            id: 'e2e-claude-assistant-1',
            role: 'assistant',
            content: [{
              type: 'text',
              text: [
                "The transcript now keeps `sdkwork-agents` rich content and BirdCoder's command evidence together.",
                '',
                '```mermaid',
                'flowchart LR',
                '  A["Provider message"] --> B{"Structured?"}',
                '  B -->|Yes| C["Render diagram"]',
                '  B -->|No| D["Show source"]',
                '```',
                '',
                '```typescript',
                'const productionRuntimeReady: boolean = true;',
                '```',
              ].join('\n'),
            }],
          },
        },
        createdAt: '2026-01-01T00:30:05.000Z',
      },
      {
        sessionId: 'e2e-claude-session',
        itemId: 'e2e-claude-item-4',
        turnId: 'e2e-claude-turn-1',
        kind: 'tool_result',
        status: 'completed',
        sequence: '4',
        content: null,
        contentType: 'application/json',
        toolName: 'shell_command',
        toolCallId: 'e2e-claude-command-1',
        toolResult: {
          exitCode: 0,
          stdout: 'TypeScript check passed.',
          fileChanges: [
            {
              path: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx',
              additions: 42,
              deletions: 8,
              originalContent: 'previous UniversalChat content',
              content: 'updated UniversalChat content',
              diff: '@@ -1 +1 @@\n-previous UniversalChat content\n+updated UniversalChat content',
            },
            {
              path: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatMarkdown.tsx',
              additions: 31,
              deletions: 6,
              originalContent: 'previous Markdown content',
              content: 'updated Markdown content',
            },
            {
              path: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chatMarkdownHeuristics.ts',
              additions: 18,
              deletions: 3,
              originalContent: 'previous heuristics content',
              content: 'updated heuristics content',
            },
            {
              path: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChatCodeBlock.tsx',
              additions: 24,
              deletions: 5,
              originalContent: 'previous code block content',
              content: 'updated code block content',
            },
            {
              path: 'apps/sdkwork-birdcoder-pc/tests/e2e/message-presentation.spec.ts',
              additions: 16,
              deletions: 2,
              originalContent: 'previous test content',
              content: 'updated test content',
            },
          ],
        },
        createdAt: '2026-01-01T00:30:04.000Z',
      },
      {
        sessionId: 'e2e-claude-session',
        itemId: 'e2e-claude-item-3',
        turnId: 'e2e-claude-turn-1',
        kind: 'tool_call',
        status: 'pending',
        sequence: '3',
        content: null,
        contentType: 'application/json',
        toolName: 'shell_command',
        toolCallId: 'e2e-claude-command-1',
        toolArguments: {
          command: 'pnpm typecheck',
        },
        createdAt: '2026-01-01T00:30:03.000Z',
      },
      {
        sessionId: 'e2e-claude-session',
        itemId: 'e2e-claude-item-2',
        turnId: 'e2e-claude-turn-1',
        kind: 'status_notice',
        status: 'completed',
        sequence: '2',
        content: 'The agent connection was restored.',
        contentType: 'text/plain',
        createdAt: '2026-01-01T00:30:02.000Z',
      },
      {
        sessionId: 'e2e-claude-session',
        itemId: 'e2e-claude-item-1',
        turnId: 'e2e-claude-turn-1',
        kind: 'user_input',
        status: 'completed',
        sequence: '1',
        content: [
          'Review the message presentation:',
          '',
          '| Area | Status |',
          '| --- | --- |',
          '| Commands | Ready |',
          '',
          '- [x] Preserve activity output',
          `- [ ] Open [README](./README.md) [preview](http://127.0.0.1:${port}/readyz)`,
          '',
          '![first upload](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=)',
          '![second upload](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=)',
          '',
          `[DRIVE_MEDIA:{"id":"e2e-uploaded-file","kind":"document","fileName":"message-notes.txt","mimeType":"text/plain","uri":"drive://nodes/e2e-uploaded-file","previewUrl":"http://127.0.0.1:${port}/fixtures/message-notes.txt"}]`,
          '',
          'File: message-notes.txt',
          '```text',
          'This attachment payload is provided to the model but hidden from the transcript bubble.',
          '```',
        ].join('\n'),
        contentType: 'text/markdown',
        createdAt: '2026-01-01T00:30:01.000Z',
      },
    ],
  ],
  [
    'e2e-opencode-session',
    [
      {
        sessionId: 'e2e-opencode-session',
        itemId: 'e2e-opencode-item-6',
        turnId: 'e2e-opencode-turn-1',
        kind: 'tool_result',
        status: 'completed',
        sequence: '6',
        content: null,
        contentType: 'application/json',
        toolName: 'provider_event',
        toolCallId: 'e2e-opencode-step-finish-1',
        toolResult: {
          type: 'message.part.updated',
          properties: {
            part: {
              id: 'e2e-opencode-step-finish-1',
              type: 'step-finish',
              reason: 'stop',
              cost: 0.012,
              tokens: {
                input: 1_200,
                output: 340,
                reasoning: 80,
                cache: { read: 500, write: 20 },
              },
            },
          },
          message: {
            summary: {
              diffs: [
                {
                  file: 'src/index.ts',
                  patch: "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-export const applicationName = 'BirdCoder';\n+export const applicationName = 'BirdCoder Pro';",
                  additions: 1,
                  deletions: 1,
                  status: 'modified',
                },
                {
                  file: 'README.md',
                  patch: '--- a/README.md\n+++ b/README.md\n@@ -1 +1,2 @@\n # SDKWork BirdCoder\n+Commercial message presentation ready.',
                  additions: 1,
                  deletions: 0,
                  status: 'modified',
                },
              ],
            },
          },
        },
        createdAt: '2026-01-01T00:10:06.000Z',
      },
      {
        sessionId: 'e2e-opencode-session',
        itemId: 'e2e-opencode-item-5',
        turnId: 'e2e-opencode-turn-1',
        kind: 'tool_result',
        status: 'completed',
        sequence: '5',
        content: null,
        contentType: 'application/json',
        toolName: 'provider_event',
        toolCallId: 'e2e-opencode-text-1',
        toolResult: {
          type: 'message.part.updated',
          properties: {
            part: {
              id: 'e2e-opencode-text-1',
              type: 'text',
              text: 'The OpenCode-aligned message presentation is ready.',
            },
          },
        },
        createdAt: '2026-01-01T00:10:05.000Z',
      },
      {
        sessionId: 'e2e-opencode-session',
        itemId: 'e2e-opencode-item-4',
        turnId: 'e2e-opencode-turn-1',
        kind: 'tool_call',
        status: 'completed',
        sequence: '4',
        content: null,
        contentType: 'application/json',
        toolName: 'question',
        toolCallId: 'e2e-opencode-question-1',
        toolArguments: {
          part: {
            id: 'e2e-opencode-question-1',
            type: 'tool',
            tool: 'question',
            state: {
              status: 'completed',
              input: {
                questions: [{
                  header: 'Presentation',
                  question: 'How should provider interactions be rendered?',
                  options: [
                    {
                      label: 'Structured',
                      description: 'Use one provider-neutral transcript component.',
                    },
                    {
                      label: 'Raw JSON',
                      description: 'Expose the provider payload directly.',
                    },
                  ],
                }],
              },
              metadata: { answers: [['Structured']] },
            },
          },
        },
        createdAt: '2026-01-01T00:10:04.000Z',
      },
      {
        sessionId: 'e2e-opencode-session',
        itemId: 'e2e-opencode-item-3',
        turnId: 'e2e-opencode-turn-1',
        kind: 'tool_call',
        status: 'completed',
        sequence: '3',
        content: null,
        contentType: 'application/json',
        toolName: 'grep',
        toolCallId: 'e2e-opencode-grep-1',
        toolArguments: {
          part: {
            id: 'e2e-opencode-grep-1',
            callID: 'e2e-opencode-grep-1',
            type: 'tool',
            tool: 'grep',
            state: {
              status: 'completed',
              input: { pattern: 'ContextToolCallGroup', path: 'src' },
              output: 'src/components/chat/messages/contentBlocks/ContextToolCallGroup.tsx:1',
            },
          },
        },
        createdAt: '2026-01-01T00:10:03.000Z',
      },
      {
        sessionId: 'e2e-opencode-session',
        itemId: 'e2e-opencode-item-2',
        turnId: 'e2e-opencode-turn-1',
        kind: 'tool_call',
        status: 'completed',
        sequence: '2',
        content: null,
        contentType: 'application/json',
        toolName: 'read',
        toolCallId: 'e2e-opencode-read-1',
        toolArguments: {
          part: {
            id: 'e2e-opencode-read-1',
            callID: 'e2e-opencode-read-1',
            type: 'tool',
            tool: 'read',
            state: {
              status: 'completed',
              input: { filePath: 'src/components/chat/messages/ChatTranscriptMessage.tsx' },
              output: 'export const ChatTranscriptMessage = memo(...);',
            },
          },
        },
        createdAt: '2026-01-01T00:10:02.000Z',
      },
      {
        sessionId: 'e2e-opencode-session',
        itemId: 'e2e-opencode-item-1',
        turnId: 'e2e-opencode-turn-1',
        kind: 'user_input',
        status: 'completed',
        sequence: '1',
        content: 'Verify OpenCode lifecycle rendering.',
        contentType: 'text/plain',
        createdAt: '2026-01-01T00:10:01.000Z',
      },
    ],
  ],
  [
    'e2e-codex-session',
    Array.from({ length: 112 }, (_, index) => {
      const sequence = 112 - index;
      const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString();
      if (sequence === 112) {
        return {
          sessionId: 'e2e-codex-session',
          itemId: 'e2e-codex-item-112',
          turnId: 'e2e-codex-turn-1',
          kind: 'tool_result',
          status: 'completed',
          sequence: '112',
          content: null,
          contentType: 'application/json',
          toolName: 'provider_event',
          toolCallId: 'e2e-codex-turn-completed-1',
          toolResult: {
            item: {
              id: 'e2e-codex-turn-completed-1',
              type: 'turn.completed',
              usage: {
                inputTokens: 2_000,
                cachedInputTokens: 1_000,
                outputTokens: 200,
                reasoningOutputTokens: 50,
              },
            },
          },
          createdAt,
        };
      }
      const providerItemBySequence = {
        111: {
          id: 'e2e-codex-context-compaction-1',
          type: 'contextCompaction',
          source: 'manual',
        },
        110: {
          id: 'e2e-codex-image-view-3',
          type: 'imageView',
          path: 'E:\\workspace\\codex-image-after-sleep.png',
        },
        109: {
          id: 'e2e-codex-sleep-between-images',
          type: 'sleep',
          durationMs: 25,
        },
        108: {
          id: 'e2e-codex-image-view-2',
          type: 'imageView',
          path: 'E:\\workspace\\codex-image-consecutive-2.png',
        },
        107: {
          id: 'e2e-codex-image-view-1',
          type: 'imageView',
          path: 'E:\\workspace\\codex-image-consecutive-1.png',
        },
        106: {
          id: 'e2e-codex-exited-review-mode-1',
          type: 'exitedReviewMode',
          review: 'INTERNAL_CODEX_EXITED_REVIEW_MODE_MUST_NOT_RENDER',
        },
        105: {
          id: 'e2e-codex-entered-review-mode-1',
          type: 'enteredReviewMode',
          review: 'INTERNAL_CODEX_ENTERED_REVIEW_MODE_MUST_NOT_RENDER',
        },
      }[sequence];
      if (providerItemBySequence) {
        return {
          sessionId: 'e2e-codex-session',
          itemId: `e2e-codex-item-${sequence}`,
          turnId: 'e2e-codex-turn-1',
          kind: 'tool_result',
          status: 'completed',
          sequence: String(sequence),
          content: null,
          contentType: 'application/json',
          toolName: 'provider_event',
          toolCallId: String(providerItemBySequence.id),
          toolResult: providerItemBySequence,
          createdAt,
        };
      }
      if (sequence === 104) {
        return {
          sessionId: 'e2e-codex-session',
          itemId: 'e2e-codex-item-104',
          turnId: 'e2e-codex-turn-1',
          kind: 'tool_result',
          status: 'completed',
          sequence: '104',
          content: null,
          contentType: 'application/json',
          toolName: 'apply_patch',
          toolCallId: 'e2e-codex-file-change-1',
          toolResult: {
            threadId: codexProviderSessionId,
            turnId: 'e2e-codex-turn-1',
            item: {
              id: 'e2e-codex-file-change-1',
              type: 'fileChange',
              status: 'completed',
              changes: [
                {
                  path: 'src/index.ts',
                  kind: { type: 'update', movePath: null },
                  diff: "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-export const applicationName = 'BirdCoder';\n+export const applicationName = 'BirdCoder Codex';",
                },
              ],
            },
          },
          createdAt,
        };
      }
      if (sequence === 103) {
        return {
          sessionId: 'e2e-codex-session',
          itemId: 'e2e-codex-item-103',
          turnId: 'e2e-codex-turn-1',
          kind: 'tool_result',
          status: 'completed',
          sequence: '103',
          content: null,
          contentType: 'application/json',
          toolName: 'provider_event',
          toolCallId: 'e2e-codex-agent-message-1',
          toolResult: {
            method: 'item/completed',
            params: {
              threadId: codexProviderSessionId,
              turnId: 'e2e-codex-turn-1',
              completedAtMs: Date.parse(createdAt),
              item: {
                id: 'e2e-codex-agent-message-1',
                type: 'agentMessage',
                text: 'Codex completed the provider-neutral file presentation.',
              },
            },
          },
          createdAt,
        };
      }
      if (sequence === 102) {
        return {
          sessionId: 'e2e-codex-session',
          itemId: 'e2e-codex-user-text',
          turnId: 'e2e-codex-multimodal-turn',
          kind: 'user_input',
          status: 'completed',
          sequence: '102',
          content: [
            '# Files mentioned by the user:',
            '',
            '## codex-screenshot.png: C:\\Users\\admin\\AppData\\Local\\Temp\\codex-screenshot.png',
            '',
            '## codex-protocol-notes.md: E:\\sdkwork-space\\sdkwork-birdcoder\\docs\\codex-protocol-notes.md',
            '',
            '## My request for Codex:',
            'Inspect this Codex screenshot and the attached protocol notes.',
          ].join('\n'),
          contentType: 'text/plain',
          providerId: 'openai',
          createdAt: '2026-01-01T00:00:42.004Z',
        };
      }
      if (sequence === 101) {
        return {
          sessionId: 'e2e-codex-session',
          itemId: 'e2e-codex-user-image-placeholder',
          turnId: 'e2e-codex-multimodal-turn',
          kind: 'artifact_reference',
          status: 'completed',
          sequence: '101',
          content: '<image name=[Image #1] path="C:\\Users\\admin\\AppData\\Local\\Temp\\codex-screenshot.png">',
          contentType: 'text/plain',
          providerId: 'openai',
          createdAt: '2026-01-01T00:00:42.003Z',
        };
      }
      if (sequence === 100) {
        return {
          sessionId: 'e2e-codex-session',
          itemId: 'e2e-codex-user-image',
          turnId: 'e2e-codex-multimodal-turn',
          kind: 'artifact_reference',
          status: 'completed',
          sequence: '100',
          content: JSON.stringify({
            type: 'input_image',
            image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
          }),
          contentType: 'application/json',
          providerId: null,
          createdAt: '2026-01-01T00:00:42.002Z',
        };
      }
      return {
        sessionId: 'e2e-codex-session',
        itemId: `e2e-codex-item-${sequence}`,
        kind: sequence % 2 === 0 ? 'assistant_output' : 'user_input',
        status: 'completed',
        sequence: String(sequence),
        content: `Codex historical message ${sequence}`,
        contentType: 'text/plain',
        createdAt,
      };
    }),
  ],
  [
    'e2e-gemini-session',
    [
      {
        sessionId: 'e2e-gemini-session',
        itemId: 'e2e-gemini-item-3',
        turnId: 'e2e-gemini-turn-1',
        kind: 'tool_result',
        status: 'completed',
        sequence: '3',
        content: null,
        contentType: 'application/json',
        toolName: 'provider_event',
        toolCallId: 'e2e-gemini-content-1',
        toolResult: {
          type: 'content',
          value: 'Gemini preserved the file change before the blocked event.',
        },
        createdAt: '2026-01-01T00:05:03.000Z',
      },
      {
        sessionId: 'e2e-gemini-session',
        itemId: 'e2e-gemini-item-2',
        turnId: 'e2e-gemini-turn-1',
        kind: 'tool_result',
        status: 'completed',
        sequence: '2',
        content: null,
        contentType: 'application/json',
        toolName: 'provider_event',
        toolCallId: 'e2e-gemini-compression-1',
        toolResult: {
          id: 'e2e-gemini-compression-1',
          type: 'chat_compressed',
          value: {
            originalTokenCount: 10_000,
            newTokenCount: 2_200,
            compressionStatus: 1,
          },
        },
        createdAt: '2026-01-01T00:05:02.000Z',
      },
      {
        sessionId: 'e2e-gemini-session',
        itemId: 'e2e-gemini-item-1',
        turnId: 'e2e-gemini-turn-1',
        kind: 'tool_result',
        status: 'failed',
        sequence: '1',
        content: null,
        contentType: 'application/json',
        toolName: 'provider_event',
        toolCallId: 'e2e-gemini-blocked-1',
        toolResult: {
          id: 'e2e-gemini-blocked-1',
          type: 'agent_execution_blocked',
          response: {
            callId: 'e2e-gemini-write-file-1',
            responseParts: [],
            display: {
              name: 'WriteFile',
              resultSummary: '1 added, 1 removed',
              result: {
                type: 'diff',
                path: 'src/gemini-message.ts',
                beforeText: 'export const state = "before";\n',
                afterText: 'export const state = "after";\n',
              },
            },
            resultDisplay: {
              fileDiff: '@@ -1 +1 @@\n-export const state = "before";\n+export const state = "after";',
              fileName: 'gemini-message.ts',
              filePath: 'src/gemini-message.ts',
              originalContent: 'export const state = "before";\n',
              newContent: 'export const state = "after";\n',
              diffStat: {
                model_added_lines: 1,
                model_removed_lines: 1,
              },
            },
          },
          value: {
            reason: 'Policy denied the requested action.',
            systemMessage: 'Review the command before continuing.',
          },
        },
        createdAt: '2026-01-01T00:05:01.000Z',
      },
    ],
  ],
]);
let createdWorkspaceSequence = 0;
let createdProjectSequence = 0;
let createdDriveEntrySequence = 0;
let createdInteractionSequence = 0;
let completedTurnSequence = 0;
let createdTurnInputQueueSequence = 0;
let mutableFixtureGeneration = 0;
const sessionInteractionsByKey = new Map();
const sessionInteractionClaimsByKey = new Map();
const sessionTurnDeliveriesByKey = new Map();
const sessionTurnInputQueuesByKey = new Map();
const sessionTurnInputQueueClaimTokensByEntryId = new Map();

function buildSessionTurnDeliveryKey(agentId, sessionId, turnId) {
  return `${agentId}\u0001${sessionId}\u0001${turnId}`;
}

function buildSessionInteractionKey(agentId, sessionId, interactionId) {
  return `${agentId}\u0001${sessionId}\u0001${interactionId}`;
}

function buildSessionTurnInputQueueKey(agentId, sessionId) {
  return `${agentId}\u0001${sessionId}`;
}

function getSessionTurnInputQueue(agentId, sessionId) {
  const key = buildSessionTurnInputQueueKey(agentId, sessionId);
  const existing = sessionTurnInputQueuesByKey.get(key);
  if (existing) {
    return existing;
  }
  const queue = [];
  sessionTurnInputQueuesByKey.set(key, queue);
  return queue;
}

function findTurnDeliveryByIdempotencyKey(agentId, sessionId, idempotencyKey) {
  return [...sessionTurnDeliveriesByKey.values()].find((delivery) => (
    delivery.fixtureGeneration === mutableFixtureGeneration
    && delivery.turn.agentId === agentId
    && delivery.turn.sessionId === sessionId
    && delivery.turn.idempotencyKey === idempotencyKey
  ));
}

function hasActiveSessionTurn(agentId, sessionId) {
  return [...sessionTurnDeliveriesByKey.values()].some((delivery) => (
    delivery.fixtureGeneration === mutableFixtureGeneration
    && delivery.turn.agentId === agentId
    && delivery.turn.sessionId === sessionId
    && (delivery.turn.status === 'requested' || delivery.turn.status === 'running')
  ));
}

function hashE2ETurnInputQueuePayload(entry) {
  return `sha256:e2e-${Buffer.from(JSON.stringify({
    accessModeId: entry.accessModeId,
    attachmentNames: entry.attachmentNames,
    content: entry.content,
    contentType: entry.contentType,
    driveRefs: entry.driveRefs,
    requestedModelId: entry.requestedModelId,
    runtimeBindingId: entry.runtimeBindingId,
    turnMode: entry.turnMode,
  }), 'utf8').toString('base64url').slice(0, 48)}`;
}

const mutableFixtureBaseline = structuredClone({
  projectDriveEntries,
  projectDriveFileContents: [...projectDriveFileContents.entries()],
  projects,
  sessionItemsBySessionId: [...sessionItemsBySessionId.entries()],
  sessions,
  workspaces,
});

function restoreArrayFixture(target, baseline) {
  target.splice(0, target.length, ...structuredClone(baseline));
}

function restoreMapFixture(target, baselineEntries) {
  target.clear();
  for (const [key, value] of structuredClone(baselineEntries)) {
    target.set(key, value);
  }
}

function resetMutableFixtureState() {
  mutableFixtureGeneration += 1;
  createdWorkspaceSequence = 0;
  createdProjectSequence = 0;
  createdDriveEntrySequence = 0;
  createdInteractionSequence = 0;
  completedTurnSequence = 0;
  createdTurnInputQueueSequence = 0;
  sessionInteractionsByKey.clear();
  sessionInteractionClaimsByKey.clear();
  sessionTurnDeliveriesByKey.clear();
  sessionTurnInputQueuesByKey.clear();
  sessionTurnInputQueueClaimTokensByEntryId.clear();
  restoreArrayFixture(workspaces, mutableFixtureBaseline.workspaces);
  restoreArrayFixture(projects, mutableFixtureBaseline.projects);
  restoreArrayFixture(projectDriveEntries, mutableFixtureBaseline.projectDriveEntries);
  restoreArrayFixture(sessions, mutableFixtureBaseline.sessions);
  restoreMapFixture(
    projectDriveFileContents,
    mutableFixtureBaseline.projectDriveFileContents,
  );
  restoreMapFixture(
    sessionItemsBySessionId,
    mutableFixtureBaseline.sessionItemsBySessionId,
  );
}

function createSessionRuntimeBinding(session) {
  const runtimeByAgentId = {
    'agent.intelligence.claude-code': {
      modelId: 'claude-sonnet-4-5',
      providerBindingId: 'claude-code',
      providerId: 'anthropic',
    },
    'agent.intelligence.codex': {
      modelId: 'gpt-5-codex',
      providerBindingId: 'codex',
      providerId: 'openai',
    },
    'agent.intelligence.opencode': {
      modelId: 'auto',
      providerBindingId: 'opencode',
      providerId: 'opencode',
    },
    'agent.intelligence.gemini': {
      modelId: 'gemini-2.5-pro',
      providerBindingId: 'gemini-cli',
      providerId: 'google',
    },
    'agent.intelligence.openclaw': {
      modelId: 'openclaw-default',
      providerBindingId: 'binding.agent-provider.openclaw',
      providerId: 'provider.model.openclaw',
    },
    'agent.intelligence.hermes': {
      modelId: 'hermes-runtime-default',
      providerBindingId: 'binding.agent-provider.hermes',
      providerId: 'provider.model.hermes',
    },
  };
  const runtime = runtimeByAgentId[session.agentId]
    ?? runtimeByAgentId['agent.intelligence.codex'];
  return {
    runtimeBindingId: `runtime-binding.${session.sessionId}`,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    sessionId: session.sessionId,
    runtimeLocationId: `runtime-location.${session.sessionId}`,
    hostMode: 'web',
    transportKind: 'sdk-stream',
    providerBindingId: runtime.providerBindingId,
    modelId: runtime.modelId,
    providerId: runtime.providerId,
    providerSessionId: resolveMockProviderSessionId(session.sessionId),
    status: 'active',
    isCurrent: true,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    activatedAt: session.createdAt,
  };
}

function createSessionActivityTurn(session, runtimeBinding, status) {
  const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled';
  return {
    turnId: `activity-turn.${session.sessionId}`,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    sessionId: session.sessionId,
    agentId: session.agentId,
    ownerUserId: session.ownerUserId,
    runtimeBindingId: runtimeBinding.runtimeBindingId,
    clientRequestId: null,
    idempotencyKey: `activity-idempotency.${session.sessionId}`,
    payloadHash: `activity-payload.${session.sessionId}`,
    requestItemId: `activity-request-item.${session.sessionId}`,
    responseItemId: isTerminal ? `activity-response-item.${session.sessionId}` : null,
    turnMode: 'interactive',
    status,
    requestedModelId: runtimeBinding.modelId,
    providerBindingId: runtimeBinding.providerBindingId,
    modelId: runtimeBinding.modelId,
    providerId: runtimeBinding.providerId,
    inputTokens: '0',
    outputTokens: '0',
    cachedTokens: '0',
    finishReason: isTerminal ? 'stop' : null,
    errorCode: status === 'failed' ? 'provider_runtime_failed' : null,
    errorDetail: status === 'failed' ? 'Sanitized E2E provider failure.' : null,
    traceId: `activity-trace.${session.sessionId}`,
    attemptCount: 1,
    maxAttempts: 1,
    nextRetryAt: null,
    availableAt: session.updatedAt,
    leaseOwner: status === 'running' ? 'e2e-worker' : null,
    leaseExpiresAt: status === 'running' ? '2099-01-01T00:00:00.000Z' : null,
    fencingToken: '1',
    version: '1',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    startedAt: status === 'requested' ? null : session.updatedAt,
    completedAt: isTerminal ? session.updatedAt : null,
    cancelRequestedAt: null,
    cancelledAt: status === 'cancelled' ? session.updatedAt : null,
    retentionUntil: null,
  };
}

function createSessionActivityInteraction(session, runtimeBinding) {
  return {
    interactionId: `activity-interaction.${session.sessionId}`,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    sessionId: session.sessionId,
    turnId: `activity-turn.${session.sessionId}`,
    runtimeBindingId: runtimeBinding.runtimeBindingId,
    providerInteractionId: `provider-interaction.${session.sessionId}`,
    kind: 'approval',
    status: 'pending',
    prompt: 'Approve the pending E2E tool operation.',
    options: [],
    resolution: null,
    claimOwner: null,
    claimExpiresAt: null,
    fencingToken: '1',
    version: '1',
    createdAt: session.updatedAt,
    updatedAt: session.updatedAt,
    resolvedAt: null,
    retentionUntil: null,
  };
}

function createSessionActivitySummary(session) {
  const runtimeBinding = createSessionRuntimeBinding(session);
  const userState = createSessionUserState(session);
  const presentationBySessionId = {
    'e2e-claude-session': { phase: 'running', state: 'working', turnStatus: 'running' },
    'e2e-codex-session': { phase: 'queued', state: 'working', turnStatus: 'requested' },
    'e2e-opencode-session': { phase: 'waiting', state: 'idle', turnStatus: 'completed' },
    'e2e-gemini-session': { phase: 'failed', state: 'failed', turnStatus: 'failed' },
    'e2e-history-session-1': { phase: 'unknown', state: null, turnStatus: 'completed' },
    'e2e-history-session-2': { phase: 'running', state: 'working', turnStatus: 'running' },
  };
  const presentation = presentationBySessionId[session.sessionId] ?? {
    phase: 'idle',
    state: 'idle',
    turnStatus: 'completed',
  };
  const latestTurn = createSessionActivityTurn(
    session,
    runtimeBinding,
    presentation.turnStatus,
  );
  const pendingInteraction = session.agentId === 'agent.intelligence.opencode'
    ? createSessionActivityInteraction(session, runtimeBinding)
    : null;
  const isUnknownPresentation = presentation.phase === 'unknown';
  const observedAt = isUnknownPresentation ? null : session.updatedAt;
  const freshUntil = isUnknownPresentation
    ? null
    : session.sessionId === 'e2e-history-session-2'
      ? '2026-01-01T00:00:00.000Z'
      : '2099-01-01T00:00:00.000Z';
  return {
    session,
    latestTurn,
    pendingInteraction,
    currentRuntimeBinding: runtimeBinding,
    latestRuntimeBinding: runtimeBinding,
    userState,
    providerIdentity: {
      runtimeBindingId: runtimeBinding.runtimeBindingId,
      providerBindingId: runtimeBinding.providerBindingId,
      providerId: runtimeBinding.providerId,
      modelId: runtimeBinding.modelId,
      providerSessionId: runtimeBinding.providerSessionId,
      providerSessionTreeId: null,
      providerParentSessionId: null,
      providerForkedFromSessionId: null,
    },
    freshness: {
      activityAt: session.updatedAt,
      source: pendingInteraction ? 'interaction' : 'turn',
      observedAt,
      freshUntil,
      sessionVersion: session.version,
      latestTurnVersion: latestTurn.version,
      latestInteractionId: pendingInteraction?.interactionId ?? null,
      latestInteractionVersion: pendingInteraction?.version ?? null,
      latestRuntimeBindingId: runtimeBinding.runtimeBindingId,
      latestRuntimeBindingVersion: runtimeBinding.version,
      pendingInteractionVersion: pendingInteraction?.version ?? null,
      currentRuntimeBindingVersion: runtimeBinding.version,
      userStateVersion: userState.version,
    },
    providerActivity: isUnknownPresentation
      ? null
      : {
          providerSessionId: runtimeBinding.providerSessionId,
          state: presentation.state,
          freshness: 'fresh',
          evidenceKind: 'provider_event',
          interactionHint: pendingInteraction ? 'approval_required' : null,
          observedAt,
          freshUntil,
        },
    presentationPhase: presentation.phase,
  };
}

function createSessionUserState(session) {
  return {
    id: session.id,
    tenantId: session.tenantId,
    organizationId: session.organizationId,
    userId: session.ownerUserId,
    resourceType: 'session',
    resourceId: session.sessionId,
    pinnedAt: session.agentId === 'agent.intelligence.claude-code'
      ? session.updatedAt
      : undefined,
    lastOpenedAt: session.updatedAt,
    lastReadItemSequence: session.lastItemSequence,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function corsHeaders(request) {
  const origin = request.headers.origin?.trim();
  if (!origin || !allowedOrigins.has(origin)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function writeJson(request, response, statusCode, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...corsHeaders(request),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Access-Token, Content-Type, X-Request-Id',
  });
  response.end(body);
}

async function writeSse(
  request,
  response,
  statusCode,
  events,
  eventIntervalMs = 0,
  onCompletion,
  shouldWriteEvent,
) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff',
    ...corsHeaders(request),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Access-Token, Content-Type, X-Request-Id',
  });
  response.flushHeaders();
  for (const [index, event] of events.entries()) {
    if (shouldWriteEvent?.(event) === false) {
      break;
    }
    if (event.eventType === 'completion') {
      onCompletion?.();
    }
    response.write(`data: ${JSON.stringify(event)}\n\n`);
    if (eventIntervalMs > 0 && index < events.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, eventIntervalMs));
    }
  }
  response.end();
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function findTurnInputQueueSession(agentId, sessionId) {
  return sessions.find((item) => item.agentId === agentId && item.sessionId === sessionId);
}

function createTurnInputQueueFailure(message, code) {
  return {
    statusCode: Number(code),
    payload: createAppbaseFailure(message, String(code)),
  };
}

function createTurnInputQueueEntryFixture(agentId, sessionId, queue, body) {
  const content = String(body.content ?? '').trim();
  const requestedAt = String(body.requestedAt ?? '').trim();
  if (!content || Number.isNaN(Date.parse(requestedAt))) {
    return null;
  }
  createdTurnInputQueueSequence += 1;
  const queueEntryId = String(
    body.queueEntryId ?? `queue-entry.e2e-${createdTurnInputQueueSequence}`,
  );
  const entry = {
    queueEntryId,
    sessionId,
    agentId,
    content,
    displayText: String(body.displayText ?? content),
    contentType: String(body.contentType ?? 'text/plain'),
    attachmentNames: Array.isArray(body.attachmentNames) ? body.attachmentNames : [],
    driveRefs: Array.isArray(body.driveRefs) ? body.driveRefs : [],
    turnMode: String(body.turnMode ?? 'interactive'),
    runtimeBindingId: body.runtimeBindingId ?? null,
    requestedModelId: body.requestedModelId ?? null,
    accessModeId: body.accessModeId ?? null,
    idempotencyKey: `${queueEntryId}.v0`,
    payloadHash: '',
    clientRequestId: queueEntryId,
    position: String(queue.length + 1),
    status: 'queued',
    claimOwner: null,
    claimExpiresAt: null,
    fencingToken: '0',
    errorCode: null,
    errorDetail: null,
    version: '0',
    createdAt: requestedAt,
    updatedAt: requestedAt,
    claimedAt: null,
    failedAt: null,
  };
  entry.payloadHash = hashE2ETurnInputQueuePayload(entry);
  return entry;
}

function handleTurnInputQueueCollection({
  agentId,
  body,
  method,
  searchParams,
  sessionId,
}) {
  if (!findTurnInputQueueSession(agentId, sessionId)) {
    return createTurnInputQueueFailure('Agent Session not found.', 404);
  }
  const queue = getSessionTurnInputQueue(agentId, sessionId);
  if (method === 'GET') {
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(queue, {
        page: Number(searchParams.get('page') ?? 1),
        pageSize: Number(searchParams.get('page_size') ?? 32),
      }),
    };
  }
  if (queue.length >= 32) {
    return createTurnInputQueueFailure('Agent Turn input queue is full.', 409);
  }
  const entry = createTurnInputQueueEntryFixture(agentId, sessionId, queue, body);
  if (!entry) {
    return createTurnInputQueueFailure(
      'Queued Agent Turn input requires content and requestedAt.',
      400,
    );
  }
  queue.push(entry);
  return {
    statusCode: 201,
    payload: createBirdCoderDataEnvelope(entry),
  };
}

function reconcileExecutingTurnInputQueueEntry(queue, agentId, sessionId, requestedAt) {
  const executingIndex = queue.findIndex((entry) => entry.status === 'executing');
  if (executingIndex < 0) {
    return null;
  }
  const entry = queue[executingIndex];
  const delivery = findTurnDeliveryByIdempotencyKey(
    agentId,
    sessionId,
    entry.idempotencyKey,
  );
  if (delivery?.turn.status === 'completed') {
    queue.splice(executingIndex, 1);
    sessionTurnInputQueueClaimTokensByEntryId.delete(entry.queueEntryId);
    queue.forEach((queuedEntry, index) => {
      queuedEntry.position = String(index + 1);
    });
    return null;
  }
  if (delivery?.turn.status === 'failed' || delivery?.turn.status === 'cancelled') {
    Object.assign(entry, {
      claimExpiresAt: null,
      claimOwner: null,
      errorCode: delivery.turn.status === 'cancelled' ? 'turn_cancelled' : 'turn_failed',
      errorDetail: `Authoritative Turn ${delivery.turn.status}.`,
      failedAt: requestedAt,
      status: 'failed',
      updatedAt: requestedAt,
      version: (BigInt(entry.version) + 1n).toString(),
    });
    sessionTurnInputQueueClaimTokensByEntryId.delete(entry.queueEntryId);
    return { entry, outcome: 'blocked' };
  }
  if (delivery || Date.parse(String(entry.claimExpiresAt ?? '')) > Date.parse(requestedAt)) {
    return { entry, outcome: 'busy' };
  }
  Object.assign(entry, {
    claimExpiresAt: null,
    claimOwner: null,
    status: 'queued',
    updatedAt: requestedAt,
    version: (BigInt(entry.version) + 1n).toString(),
  });
  sessionTurnInputQueueClaimTokensByEntryId.delete(entry.queueEntryId);
  return null;
}

function handleTurnInputQueueClear(queue) {
  const retained = queue.filter((entry) => entry.status === 'executing');
  const clearedCount = queue.length - retained.length;
  queue.splice(0, queue.length, ...retained);
  retained.forEach((entry, index) => {
    entry.position = String(index + 1);
  });
  return {
    statusCode: 200,
    payload: createAppbaseSuccess({ clearedCount: String(clearedCount) }),
  };
}

function handleTurnInputQueueReorder(queue, body) {
  const orderedEntries = Array.isArray(body.orderedEntries) ? body.orderedEntries : [];
  const mutableEntries = queue.filter((entry) => entry.status !== 'executing');
  if (
    orderedEntries.length !== mutableEntries.length
    || new Set(orderedEntries.map((entry) => entry.queueEntryId)).size !== orderedEntries.length
  ) {
    return createTurnInputQueueFailure(
      'orderedEntries must contain the full mutable queue.',
      400,
    );
  }
  const mutableById = new Map(mutableEntries.map((entry) => [entry.queueEntryId, entry]));
  const reordered = [];
  for (const orderedEntry of orderedEntries) {
    const entry = mutableById.get(String(orderedEntry.queueEntryId ?? ''));
    if (!entry || entry.version !== String(orderedEntry.expectedVersion ?? '')) {
      return createTurnInputQueueFailure('Queued Turn input version mismatch.', 409);
    }
    entry.version = (BigInt(entry.version) + 1n).toString();
    entry.updatedAt = String(body.requestedAt ?? entry.updatedAt);
    reordered.push(entry);
  }
  const executing = queue.filter((entry) => entry.status === 'executing');
  queue.splice(0, queue.length, ...executing, ...reordered);
  queue.forEach((entry, index) => {
    entry.position = String(index + 1);
  });
  return {
    statusCode: 200,
    payload: createAppbaseSuccess({ items: queue }),
  };
}

function handleTurnInputQueueClaim(queue, agentId, sessionId, body) {
  const requestedAt = String(body.requestedAt ?? '').trim();
  const requestedAtMs = Date.parse(requestedAt);
  const leaseSeconds = Number(body.leaseSeconds ?? 120);
  const claimOwner = String(body.claimOwner ?? '').trim();
  if (
    Number.isNaN(requestedAtMs)
    || !Number.isInteger(leaseSeconds)
    || leaseSeconds < 1
    || leaseSeconds > 300
    || !claimOwner
  ) {
    return createTurnInputQueueFailure('Invalid queued Turn input claim request.', 400);
  }

  const reconciliation = reconcileExecutingTurnInputQueueEntry(
    queue,
    agentId,
    sessionId,
    requestedAt,
  );
  if (reconciliation) {
    return {
      statusCode: 200,
      payload: createAppbaseSuccess({ claimToken: null, ...reconciliation }),
    };
  }
  if (hasActiveSessionTurn(agentId, sessionId)) {
    return {
      statusCode: 200,
      payload: createAppbaseSuccess({
        claimToken: null,
        entry: null,
        outcome: 'active_turn',
      }),
    };
  }
  const head = queue[0];
  if (!head) {
    return {
      statusCode: 200,
      payload: createAppbaseSuccess({ claimToken: null, entry: null, outcome: 'empty' }),
    };
  }
  if (head.status === 'failed') {
    return {
      statusCode: 200,
      payload: createAppbaseSuccess({ claimToken: null, entry: head, outcome: 'blocked' }),
    };
  }

  head.status = 'executing';
  head.claimOwner = claimOwner;
  head.claimExpiresAt = new Date(requestedAtMs + leaseSeconds * 1_000).toISOString();
  head.claimedAt = requestedAt;
  head.updatedAt = requestedAt;
  head.fencingToken = (BigInt(head.fencingToken) + 1n).toString();
  head.version = (BigInt(head.version) + 1n).toString();
  const claimToken = `queue-claim.e2e-${createdTurnInputQueueSequence}-${head.fencingToken}`;
  sessionTurnInputQueueClaimTokensByEntryId.set(head.queueEntryId, claimToken);
  return {
    statusCode: 200,
    payload: createAppbaseSuccess({ claimToken, entry: head, outcome: 'claimed' }),
  };
}

function handleTurnInputQueueCommand({ agentId, body, command, sessionId }) {
  if (!findTurnInputQueueSession(agentId, sessionId)) {
    return createTurnInputQueueFailure('Agent Session not found.', 404);
  }
  const queue = getSessionTurnInputQueue(agentId, sessionId);
  if (command === 'clear') {
    return handleTurnInputQueueClear(queue);
  }
  if (command === 'reorder') {
    return handleTurnInputQueueReorder(queue, body);
  }
  return handleTurnInputQueueClaim(queue, agentId, sessionId, body);
}

function updateTurnInputQueueEntryFixture(entry, body, requestedAt) {
  const content = String(body.content ?? '').trim();
  if (!content) {
    return false;
  }
  Object.assign(entry, {
    accessModeId: body.accessModeId ?? null,
    attachmentNames: Array.isArray(body.attachmentNames) ? body.attachmentNames : [],
    content,
    contentType: String(body.contentType ?? 'text/plain'),
    displayText: String(body.displayText ?? content),
    driveRefs: Array.isArray(body.driveRefs) ? body.driveRefs : [],
    errorCode: null,
    errorDetail: null,
    failedAt: null,
    requestedModelId: body.requestedModelId ?? null,
    runtimeBindingId: body.runtimeBindingId ?? null,
    status: 'queued',
    turnMode: String(body.turnMode ?? 'interactive'),
    updatedAt: requestedAt,
    version: (BigInt(entry.version) + 1n).toString(),
  });
  entry.idempotencyKey = `${entry.queueEntryId}.v${entry.version}`;
  entry.clientRequestId = entry.idempotencyKey;
  entry.payloadHash = hashE2ETurnInputQueuePayload(entry);
  return true;
}

function failTurnInputQueueEntryFixture(entry, body, requestedAt) {
  const claimToken = sessionTurnInputQueueClaimTokensByEntryId.get(entry.queueEntryId);
  if (
    entry.status !== 'executing'
    || claimToken !== String(body.claimToken ?? '')
    || entry.fencingToken !== String(body.fencingToken ?? '')
  ) {
    return false;
  }
  Object.assign(entry, {
    claimExpiresAt: null,
    claimOwner: null,
    errorCode: String(body.errorCode ?? 'turn_dispatch_rejected'),
    errorDetail: body.errorDetail ?? null,
    failedAt: requestedAt,
    status: 'failed',
    updatedAt: requestedAt,
    version: (BigInt(entry.version) + 1n).toString(),
  });
  sessionTurnInputQueueClaimTokensByEntryId.delete(entry.queueEntryId);
  return true;
}

function retryTurnInputQueueEntryFixture(entry, requestedAt) {
  if (entry.status !== 'failed') {
    return false;
  }
  Object.assign(entry, {
    errorCode: null,
    errorDetail: null,
    failedAt: null,
    status: 'queued',
    updatedAt: requestedAt,
    version: (BigInt(entry.version) + 1n).toString(),
  });
  entry.idempotencyKey = `${entry.queueEntryId}.v${entry.version}`;
  entry.clientRequestId = entry.idempotencyKey;
  return true;
}

function handleTurnInputQueueEntry({
  agentId,
  body,
  command,
  method,
  queueEntryId,
  searchParams,
  sessionId,
}) {
  if (!findTurnInputQueueSession(agentId, sessionId)) {
    return createTurnInputQueueFailure('Agent Session not found.', 404);
  }
  const queue = getSessionTurnInputQueue(agentId, sessionId);
  const entryIndex = queue.findIndex((entry) => entry.queueEntryId === queueEntryId);
  const entry = queue[entryIndex];
  if (!entry) {
    return createTurnInputQueueFailure('Queued Agent Turn input not found.', 404);
  }
  if (method === 'DELETE') {
    const expectedVersion = String(searchParams.get('expected_version') ?? '');
    if (entry.status === 'executing' || entry.version !== expectedVersion) {
      return createTurnInputQueueFailure('Queued Turn input cannot be deleted.', 409);
    }
    queue.splice(entryIndex, 1);
    sessionTurnInputQueueClaimTokensByEntryId.delete(queueEntryId);
    queue.forEach((queuedEntry, index) => {
      queuedEntry.position = String(index + 1);
    });
    return { statusCode: 204, payload: null };
  }

  const expectedVersion = String(body.expectedVersion ?? '');
  const requestedAt = String(body.requestedAt ?? '').trim();
  if (entry.version !== expectedVersion || Number.isNaN(Date.parse(requestedAt))) {
    return createTurnInputQueueFailure('Queued Turn input version mismatch.', 409);
  }
  if (method === 'PATCH') {
    if (entry.status === 'executing') {
      return createTurnInputQueueFailure(
        'Executing queued Turn input cannot be edited.',
        409,
      );
    }
    if (!updateTurnInputQueueEntryFixture(entry, body, requestedAt)) {
      return createTurnInputQueueFailure('Queued Agent Turn input content is required.', 400);
    }
  } else if (command === 'fail') {
    if (!failTurnInputQueueEntryFixture(entry, body, requestedAt)) {
      return createTurnInputQueueFailure('Queued Turn input claim is stale.', 409);
    }
  } else if (command === 'retry') {
    if (!retryTurnInputQueueEntryFixture(entry, requestedAt)) {
      return createTurnInputQueueFailure(
        'Only a failed queued Turn input can be retried.',
        409,
      );
    }
  } else {
    return null;
  }
  return {
    statusCode: 200,
    payload: createBirdCoderDataEnvelope(entry),
  };
}

function handleTurnInputQueueRoute({ body, method, pathname, request, searchParams }) {
  const collectionMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/turn_input_queue$/u.exec(pathname);
  const commandMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/turn_input_queue\/(?<command>clear|reorder|claim_next)$/u.exec(pathname);
  const entryMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/turn_input_queue\/(?<queueEntryId>[^/]+)(?:\/(?<command>fail|retry))?$/u.exec(pathname);
  if (!collectionMatch && !commandMatch && !entryMatch) {
    return null;
  }
  if (!isAuthenticatedRequest(request)) {
    return createTurnInputQueueFailure('No authenticated SDKWork IAM user.', 401);
  }
  if (collectionMatch && (method === 'GET' || method === 'POST')) {
    return handleTurnInputQueueCollection({
      ...collectionMatch.groups,
      body,
      method,
      searchParams,
    });
  }
  if (commandMatch && method === 'POST') {
    return handleTurnInputQueueCommand({ ...commandMatch.groups, body });
  }
  if (entryMatch && (method === 'PATCH' || method === 'DELETE' || method === 'POST')) {
    return handleTurnInputQueueEntry({
      ...entryMatch.groups,
      body,
      method,
      searchParams,
    });
  }
  return createTurnInputQueueFailure('Unsupported queued Turn input operation.', 405);
}

function handleRoute(method, url, request, body) {
  const { pathname, searchParams } = url;
  if (method === 'OPTIONS') {
    return { statusCode: 204, payload: null };
  }

  if (pathname === '/healthz') {
    return { statusCode: 200, payload: { status: 'ok' } };
  }

  if (pathname === '/readyz') {
    return { statusCode: 200, payload: { status: 'ready' } };
  }

  if (pathname === '/livez') {
    return { statusCode: 200, payload: { status: 'ok' } };
  }

  if (pathname === '/app/v3/api/system/health') {
    return { statusCode: 200, payload: createBirdCoderDataEnvelope({ status: 'ok' }) };
  }

  if (pathname === '/app/v3/api/system/iam/runtime' && method === 'GET') {
    return { statusCode: 200, payload: createAppbaseSuccess(createIamRuntimeSettings()) };
  }

  if (pathname === '/app/v3/api/system/iam/verification_policy' && method === 'GET') {
    return {
      statusCode: 200,
      payload: createAppbaseSuccess(createIamRuntimeSettings().verificationPolicy),
    };
  }

  if (pathname === '/app/v3/api/oauth/device_authorizations' && method === 'POST') {
    return {
      statusCode: 201,
      payload: createAppbaseSuccess(createIamDeviceAuthorizationFixture()),
    };
  }

  if (
    pathname === '/app/v3/api/oauth/device_authorizations/e2e-device-authorization-1'
    && method === 'GET'
  ) {
    return {
      statusCode: 200,
      payload: createAppbaseSuccess(createIamDeviceAuthorizationFixture()),
    };
  }

  if (pathname === '/app/v3/api/auth/sessions' && method === 'POST') {
    if (!credentialsMatchSessionRequest(body)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('SDKWork IAM credentials were rejected.', '401'),
      };
    }

    resetMutableFixtureState();
    return { statusCode: 200, payload: createAppbaseSuccess(createIamSessionData()) };
  }

  if (pathname === '/app/v3/api/auth/sessions/current' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No active SDKWork IAM session.', '401'),
      };
    }

    return { statusCode: 200, payload: createAppbaseSuccess(createIamSessionData()) };
  }

  if (pathname === '/app/v3/api/auth/sessions/refresh' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No active SDKWork IAM session.', '401'),
      };
    }

    return { statusCode: 200, payload: createAppbaseSuccess(createIamSessionData()) };
  }

  if (pathname === '/app/v3/api/iam/users/current' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return { statusCode: 200, payload: createAppbaseSuccess(createIamSessionData().user) };
  }

  if (pathname === '/app/v3/api/app_templates' && method === 'GET') {
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope([createAppTemplateFixture()]),
    };
  }

  if (pathname === '/app/v3/api/model_config' && method === 'GET') {
    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope({
        engines: [],
        models: [],
      }),
    };
  }

  if (pathname === '/app/v3/api/ai/code_engines' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(createCodeEngineCatalogFixture()),
    };
  }

  if (pathname === '/app/v3/api/ai/workspaces/default' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(defaultWorkspace),
    };
  }

  if (pathname === '/app/v3/api/ai/workspaces' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(
        workspaces.filter((workspace) => workspace.status === 'active'),
      ),
    };
  }

  if (pathname === '/app/v3/api/ai/workspaces' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    createdWorkspaceSequence += 1;
    const workspace = createAgentWorkspaceFixture({
      id: String(9_001 + createdWorkspaceSequence),
      workspaceId: `workspace.e2e-created-${createdWorkspaceSequence}`,
      name: String(body.name ?? '').trim() || `E2E Workspace ${createdWorkspaceSequence}`,
      description: String(body.description ?? '').trim() || null,
      isDefault: false,
    });
    workspaces.push(workspace);
    return {
      statusCode: 201,
      payload: createBirdCoderDataEnvelope(workspace),
    };
  }

  if (pathname === '/app/v3/api/ai/projects' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const workspaceId = searchParams.get('workspaceId')?.trim();
    const workspaceProjects = workspaceId
      ? projects.filter((project) => project.workspaceId === workspaceId)
      : projects;
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(workspaceProjects),
    };
  }

  if (pathname === '/app/v3/api/ai/projects' && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const requestedName = String(body.name ?? '').trim();
    const requestedDescription = String(body.description ?? '').trim();
    createdProjectSequence += 1;
    const project = createAgentProjectFixture({
      id: String(10_001 + createdProjectSequence),
      projectId: `project.e2e-created-${createdProjectSequence}`,
      workspaceId: String(body.workspaceId ?? '').trim() || defaultWorkspace.workspaceId,
      name: requestedName || 'E2E Project',
      description: requestedDescription || createAgentProjectFixture().description,
    });
    projects.push(project);
    return {
      statusCode: 201,
      payload: createBirdCoderDataEnvelope(project),
    };
  }

  if (pathname === '/app/v3/api/ai/projects/project.e2e-1' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(createAgentProjectFixture()),
    };
  }

  const projectCompositionSlotMatch = /^\/app\/v3\/api\/ai\/projects\/(?<projectId>[^/]+)\/composition_slots\/(?<slotId>[^/]+)$/u.exec(pathname);
  if (projectCompositionSlotMatch && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    if (
      projectCompositionSlotMatch.groups.projectId !== 'project.e2e-1'
      || projectCompositionSlotMatch.groups.slotId !== 'primary-drive'
    ) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Project composition slot not found.', '404'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope({
        enabled: true,
        policyJson: JSON.stringify({
          logicalPath: projectDriveLogicalPath,
          rootEntryId: projectDriveRootEntryId,
          schema: 'sdkwork.agents.project-drive/v1',
        }),
        projectId: 'project.e2e-1',
        slotId: 'primary-drive',
        slotKind: 'drive',
        targetModule: 'drive',
        targetRef: projectDriveId,
        version: '1',
      }),
    };
  }

  if (pathname === '/app/v3/api/drive/sandboxes' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope([
        {
          capabilities: {
            browse: true,
            createDirectory: true,
            createFile: true,
            deleteEntry: true,
            moveEntry: true,
            readFile: true,
            selectDirectory: true,
            writeFile: true,
          },
          displayName: 'E2E Project Drive',
          id: projectDriveId,
          rootEntryId: 'drive-entry-sandbox-root',
        },
      ], {
        page: Number(searchParams.get('page') ?? 1),
        pageSize: Number(searchParams.get('page_size') ?? 20),
      }),
    };
  }

  const sandboxEntriesMatch = /^\/app\/v3\/api\/drive\/sandboxes\/(?<sandboxId>[^/]+)\/entries$/u.exec(pathname);
  if (sandboxEntriesMatch && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const parentPath = searchParams.get('parent_path') ?? '';
    const items = sandboxEntriesMatch.groups.sandboxId === projectDriveId
      ? projectDriveEntries.filter((entry) => {
          const separatorIndex = entry.logicalPath.lastIndexOf('/');
          return entry.logicalPath.slice(0, separatorIndex) === parentPath;
        })
      : [];
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(items, {
        pageSize: Number(searchParams.get('page_size') ?? 200),
      }),
    };
  }

  const sandboxCreateMatch = /^\/app\/v3\/api\/drive\/sandboxes\/(?<sandboxId>[^/]+)\/(?<entryKind>directories|files)$/u.exec(pathname);
  if (sandboxCreateMatch && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    createdDriveEntrySequence += 1;
    const parentPath = String(body.parentPath ?? '').trim();
    const name = String(body.name ?? '').trim();
    const parent = projectDriveEntries.find((entry) => entry.logicalPath === parentPath);
    const entry = {
      id: `drive-entry-created-${createdDriveEntrySequence}`,
      sandboxId: sandboxCreateMatch.groups.sandboxId,
      parentId: parent?.id ?? projectDriveRootEntryId,
      name,
      kind: sandboxCreateMatch.groups.entryKind === 'directories' ? 'directory' : 'file',
      logicalPath: `${parentPath}/${name}`,
      revision: `revision-created-${createdDriveEntrySequence}`,
    };
    projectDriveEntries.push(entry);
    if (entry.kind === 'file') {
      projectDriveFileContents.set(entry.id, String(body.content ?? ''));
    }
    return {
      statusCode: 201,
      payload: createBirdCoderDataEnvelope(entry),
    };
  }

  const sandboxFileContentMatch = /^\/app\/v3\/api\/drive\/sandboxes\/(?<sandboxId>[^/]+)\/files\/(?<entryId>[^/]+)\/content$/u.exec(pathname);
  if (sandboxFileContentMatch && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const entry = projectDriveEntries.find((candidate) => (
      candidate.id === sandboxFileContentMatch.groups.entryId
      && candidate.sandboxId === sandboxFileContentMatch.groups.sandboxId
      && candidate.kind === 'file'
    ));
    if (!entry) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Sandbox file not found.', '404'),
      };
    }
    const content = projectDriveFileContents.get(entry.id) ?? '';
    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope({
        checksumSha256: '0'.repeat(64),
        content,
        encoding: 'utf8',
        entry,
        sizeBytes: String(Buffer.byteLength(content, 'utf8')),
      }),
    };
  }

  const projectSessionsMatch = /^\/app\/v3\/api\/ai\/projects\/(?<projectId>[^/]+)\/sessions$/u.exec(pathname);
  const workspaceSessionsMatch = /^\/app\/v3\/api\/ai\/workspaces\/(?<workspaceId>[^/]+)\/sessions$/u.exec(pathname);
  const agentSessionsMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions$/u.exec(pathname);
  if (
    method === 'GET'
    && (projectSessionsMatch || workspaceSessionsMatch || agentSessionsMatch)
  ) {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const scopedSessions = projectSessionsMatch
      ? sessions.filter((session) => session.projectId === projectSessionsMatch.groups.projectId)
      : workspaceSessionsMatch
        ? sessions.filter((session) => {
            const project = projects.find((item) => item.projectId === session.projectId);
            return project?.workspaceId === workspaceSessionsMatch.groups.workspaceId;
          })
        : sessions.filter((session) => session.agentId === agentSessionsMatch.groups.agentId);
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(scopedSessions, {
        page: Number(searchParams.get('page') ?? 1),
        pageSize: Number(searchParams.get('page_size') ?? 20),
      }),
    };
  }

  if (pathname === '/app/v3/api/ai/session_activity_summaries' && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const workspaceId = searchParams.get('workspace_id')?.trim();
    const projectId = searchParams.get('project_id')?.trim();
    const agentId = searchParams.get('agent_id')?.trim();
    const pageSize = Number(searchParams.get('page_size') ?? 100);
    const cursor = searchParams.get('cursor')?.trim() ?? '';
    const cursorScope = [
      'session-activity',
      workspaceId ?? '',
      projectId ?? '',
      agentId ?? '',
    ].join(':');
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      return {
        statusCode: 400,
        payload: createAppbaseFailure('Session activity page_size must be between 1 and 200.', '400'),
      };
    }
    const cursorOffset = readE2ECursorOffset(cursor, cursorScope);
    if (cursorOffset === null) {
      return {
        statusCode: 400,
        payload: createAppbaseFailure('Session activity cursor is invalid.', '400'),
      };
    }
    const scopedSessions = sessions.filter((session) => {
      if (projectId && session.projectId !== projectId) {
        return false;
      }
      if (agentId && session.agentId !== agentId) {
        return false;
      }
      if (!workspaceId) {
        return true;
      }
      const project = projects.find((item) => item.projectId === session.projectId);
      return project?.workspaceId === workspaceId;
    });
    const pageItems = scopedSessions.slice(cursorOffset, cursorOffset + pageSize);
    const nextOffset = cursorOffset + pageItems.length;
    const hasMore = nextOffset < scopedSessions.length;
    return {
      statusCode: 200,
      payload: createBirdCoderCursorListEnvelope(
        pageItems.map(createSessionActivitySummary),
        {
          hasMore,
          nextCursor: hasMore ? createE2ECursor(cursorScope, nextOffset) : null,
          pageSize,
        },
      ),
    };
  }

  const sessionUserStatesMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/user_states$/u.exec(pathname);
  if (sessionUserStatesMatch && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const requestedSessionIds = new Set(
      (searchParams.get('session_ids') ?? '')
        .split(',')
        .map((sessionId) => sessionId.trim())
        .filter(Boolean),
    );
    const userStates = sessions
      .filter((session) => (
        session.agentId === sessionUserStatesMatch.groups.agentId
        && (requestedSessionIds.size === 0 || requestedSessionIds.has(session.sessionId))
      ))
      .map(createSessionUserState);
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(userStates, {
        page: Number(searchParams.get('page') ?? 1),
        pageSize: Number(searchParams.get('page_size') ?? 20),
      }),
    };
  }

  const sessionResourceMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)$/u.exec(pathname);
  if (sessionResourceMatch && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const session = sessions.find((item) =>
      item.agentId === sessionResourceMatch.groups.agentId
      && item.sessionId === sessionResourceMatch.groups.sessionId,
    );
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }
    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(session),
    };
  }

  const sessionTurnCancelMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/turns\/(?<turnId>[^/]+)\/cancel$/u.exec(pathname);
  if (sessionTurnCancelMatch && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }
    const { agentId, sessionId, turnId } = sessionTurnCancelMatch.groups;
    const session = sessions.find((item) => (
      item.agentId === agentId && item.sessionId === sessionId
    ));
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }
    const turnDeliveryKey = buildSessionTurnDeliveryKey(agentId, sessionId, turnId);
    const turnDelivery = sessionTurnDeliveriesByKey.get(turnDeliveryKey);
    if (!turnDelivery || turnDelivery.fixtureGeneration !== mutableFixtureGeneration) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Turn not found.', '404'),
      };
    }
    const expectedVersion = String(body.expectedVersion ?? '').trim();
    const requestedAt = String(body.requestedAt ?? '').trim();
    if (!/^(?:0|[1-9]\d*)$/u.test(expectedVersion) || Number.isNaN(Date.parse(requestedAt))) {
      return {
        statusCode: 400,
        payload: createAppbaseFailure(
          'Agent Turn cancellation requires expectedVersion and requestedAt.',
          '400',
        ),
      };
    }
    if (turnDelivery.turn.version !== expectedVersion) {
      return {
        statusCode: 409,
        payload: createAppbaseFailure('Agent Turn version mismatch.', '409'),
      };
    }
    if (turnDelivery.turn.status !== 'requested' && turnDelivery.turn.status !== 'running') {
      return {
        statusCode: 400,
        payload: createAppbaseFailure('Agent Turn cannot be cancelled.', '400'),
      };
    }
    turnDelivery.turn = {
      ...turnDelivery.turn,
      status: 'cancelled',
      responseItemId: null,
      outputTokens: '0',
      leaseOwner: null,
      leaseExpiresAt: null,
      version: (BigInt(expectedVersion) + 1n).toString(),
      updatedAt: requestedAt,
      completedAt: requestedAt,
      cancelRequestedAt: requestedAt,
      cancelledAt: requestedAt,
    };
    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(turnDelivery.turn),
    };
  }

  const sessionTurnResourceMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/turns\/(?<turnId>[^/]+)$/u.exec(pathname);
  if (sessionTurnResourceMatch && method === 'GET') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }
    const { agentId, sessionId, turnId } = sessionTurnResourceMatch.groups;
    const turnDelivery = sessionTurnDeliveriesByKey.get(
      buildSessionTurnDeliveryKey(agentId, sessionId, turnId),
    );
    if (!turnDelivery || turnDelivery.fixtureGeneration !== mutableFixtureGeneration) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Turn not found.', '404'),
      };
    }
    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(turnDelivery.turn),
    };
  }

  const sessionTurnsMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/turns$/u.exec(pathname);
  if (sessionTurnsMatch && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const session = sessions.find((item) =>
      item.agentId === sessionTurnsMatch.groups.agentId
      && item.sessionId === sessionTurnsMatch.groups.sessionId,
    );
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }

    const content = String(body.content ?? '').trim();
    if (!content) {
      return {
        statusCode: 400,
        payload: createAppbaseFailure('Agent turn content is required.', '400'),
      };
    }

    completedTurnSequence += 1;
    const currentItems = sessionItemsBySessionId.get(session.sessionId) ?? [];
    const previousSequence = Number(session.lastItemSequence ?? 0);
    const userSequence = previousSequence + 1;
    const assistantSequence = previousSequence + 2;
    const completedAt = new Date().toISOString();
    const turnId = String(body.turnId ?? `turn.e2e-${completedTurnSequence}`);
    const turnFixtureGeneration = mutableFixtureGeneration;
    const userItemId = `item.e2e-${completedTurnSequence}-user`;
    const assistantItemId = `item.e2e-${completedTurnSequence}-assistant`;
    const commonItemFields = {
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      sessionId: session.sessionId,
      status: 'completed',
      contentType: 'text/plain',
      driveRefs: [],
      createdBy: session.ownerUserId,
      version: '1',
      createdAt: completedAt,
      updatedAt: completedAt,
      completedAt,
      turnId,
    };
    const userItem = {
      ...commonItemFields,
      itemId: userItemId,
      kind: 'user_input',
      sequence: String(userSequence),
      content,
      inputTokens: '0',
      outputTokens: '0',
    };
    const assistantItem = {
      ...commonItemFields,
      itemId: assistantItemId,
      kind: 'assistant_output',
      sequence: String(assistantSequence),
      content: `Mock assistant response to: ${content}`,
      inputTokens: '0',
      outputTokens: '6',
      modelId: body.requestedModelId ?? null,
    };
    const runningTurn = {
      turnId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      sessionId: session.sessionId,
      agentId: session.agentId,
      ownerUserId: session.ownerUserId,
      runtimeBindingId: body.runtimeBindingId ?? null,
      clientRequestId: body.clientRequestId ?? null,
      idempotencyKey: String(body.idempotencyKey ?? `e2e-${completedTurnSequence}`),
      payloadHash: String(body.payloadHash ?? `e2e-${completedTurnSequence}`),
      requestItemId: userItemId,
      responseItemId: null,
      turnMode: body.turnMode ?? 'interactive',
      status: 'running',
      requestedModelId: body.requestedModelId ?? null,
      modelId: body.requestedModelId ?? null,
      inputTokens: '0',
      outputTokens: '0',
      cachedTokens: '0',
      finishReason: null,
      attemptCount: 1,
      maxAttempts: 1,
      availableAt: completedAt,
      fencingToken: '1',
      version: '1',
      createdAt: completedAt,
      updatedAt: completedAt,
      startedAt: completedAt,
      completedAt: null,
      cancelRequestedAt: null,
      cancelledAt: null,
      retentionUntil: null,
    };
    const completedTurn = {
      ...runningTurn,
      responseItemId: assistantItemId,
      status: 'completed',
      outputTokens: '6',
      finishReason: 'stop',
      completedAt,
    };
    const turnDeliveryKey = buildSessionTurnDeliveryKey(
      session.agentId,
      session.sessionId,
      turnId,
    );
    const turnDelivery = {
      fixtureGeneration: turnFixtureGeneration,
      turn: runningTurn,
    };
    sessionTurnDeliveriesByKey.set(turnDeliveryKey, turnDelivery);

    const sessionUpdate = {
      itemCount: String(currentItems.length + 2),
      lastItemSequence: String(assistantSequence),
      lastItemAt: completedAt,
      totalOutputTokens: String(Number(session.totalOutputTokens ?? 0) + 6),
      updatedAt: completedAt,
      version: String(Number(session.version ?? 0) + 1),
    };
    const completedSession = { ...session, ...sessionUpdate };
    let isCommitted = false;
    const commitTurn = () => {
      if (
        isCommitted
        || turnFixtureGeneration !== mutableFixtureGeneration
        || sessionTurnDeliveriesByKey.get(turnDeliveryKey) !== turnDelivery
        || turnDelivery.turn.status === 'cancelled'
      ) {
        return;
      }
      isCommitted = true;
      turnDelivery.turn = completedTurn;
      Object.assign(session, sessionUpdate);
      sessionItemsBySessionId.set(
        session.sessionId,
        [assistantItem, userItem, ...currentItems],
      );
    };

    const completion = createBirdCoderDataEnvelope({
      session: completedSession,
      turn: completedTurn,
      items: [userItem, assistantItem],
    });
    if (searchParams.get('stream') === 'true') {
      const deltaBoundary = Math.max(1, Math.floor(assistantItem.content.length / 2));
      const streamEventIntervalMs = content.startsWith('E2E durable queue blocker')
        ? 5_000
        : 2_000;
      return {
        statusCode: 200,
        onSseCompletion: commitTurn,
        shouldWriteSseEvent: () => (
          turnFixtureGeneration === mutableFixtureGeneration
          && sessionTurnDeliveriesByKey.get(turnDeliveryKey) === turnDelivery
          && turnDelivery.turn.status !== 'cancelled'
        ),
        sseEventIntervalMs: streamEventIntervalMs,
        sseEvents: [
          {
            eventType: 'delta',
            index: 0,
            delta: assistantItem.content.slice(0, deltaBoundary),
          },
          {
            eventType: 'delta',
            index: 1,
            delta: assistantItem.content.slice(deltaBoundary),
          },
          {
            eventType: 'completion',
            response: completion,
          },
        ],
      };
    }

    commitTurn();
    return { statusCode: 200, payload: completion };
  }

  const sessionItemsSynchronizeMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/items\/synchronize$/u.exec(pathname);
  if (sessionItemsSynchronizeMatch && method === 'POST') {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }
    const session = sessions.find((item) =>
      item.agentId === sessionItemsSynchronizeMatch.groups.agentId
      && item.sessionId === sessionItemsSynchronizeMatch.groups.sessionId,
    );
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }
    const pageSize = Number(searchParams.get('page_size') ?? 20);
    const sort = searchParams.get('sort')?.trim() ?? '';
    if (
      searchParams.has('cursor')
      || searchParams.has('page')
      || !Number.isSafeInteger(pageSize)
      || pageSize < 1
      || pageSize > 200
      || sort !== '-sequence'
    ) {
      return {
        statusCode: 400,
        payload: createAppbaseFailure(
          'Session Item synchronization requires page_size between 1 and 200 and sort=-sequence.',
          '400',
        ),
      };
    }
    const cursorScope = [
      'session-items',
      session.agentId,
      session.sessionId,
      sort,
    ].join(':');
    const items = sessionItemsBySessionId.get(session.sessionId) ?? [];
    const pageItems = items.slice(0, pageSize);
    const hasMore = pageItems.length < items.length;
    return {
      statusCode: 200,
      payload: createBirdCoderCursorListEnvelope(pageItems, {
        hasMore,
        nextCursor: hasMore ? createE2ECursor(cursorScope, pageItems.length) : null,
        pageSize,
      }),
    };
  }

  const sessionInteractionsMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/interactions$/u.exec(pathname);
  if (sessionInteractionsMatch && (method === 'GET' || method === 'POST')) {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }
    const { agentId, sessionId } = sessionInteractionsMatch.groups;
    const session = sessions.find((item) => (
      item.agentId === agentId && item.sessionId === sessionId
    ));
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }

    if (method === 'GET') {
      const page = Number(searchParams.get('page') ?? 1);
      const pageSize = Number(searchParams.get('page_size') ?? 20);
      const kind = searchParams.get('kind')?.trim() ?? '';
      const status = searchParams.get('status')?.trim() ?? '';
      if (
        !Number.isSafeInteger(page)
        || page < 1
        || !Number.isSafeInteger(pageSize)
        || pageSize < 1
        || pageSize > 200
        || (kind && kind !== 'approval' && kind !== 'user_question')
        || (
          status
          && !['pending', 'resolved', 'rejected', 'expired', 'cancelled'].includes(status)
        )
      ) {
        return {
          statusCode: 400,
          payload: createAppbaseFailure('Agent Interaction filters are invalid.', '400'),
        };
      }
      const interactions = [...sessionInteractionsByKey.values()]
        .filter((entry) => (
          entry.fixtureGeneration === mutableFixtureGeneration
          && entry.agentId === agentId
          && entry.interaction.sessionId === sessionId
          && (!kind || entry.interaction.kind === kind)
          && (!status || entry.interaction.status === status)
        ))
        .map((entry) => entry.interaction)
        .sort((left, right) => (
          Date.parse(left.createdAt) - Date.parse(right.createdAt)
          || left.interactionId.localeCompare(right.interactionId)
        ));
      return {
        statusCode: 200,
        payload: createBirdCoderListEnvelope(interactions, { page, pageSize }),
      };
    }

    const kind = String(body.kind ?? '').trim();
    const prompt = String(body.prompt ?? '').trim();
    const requestedAt = String(body.requestedAt ?? '').trim();
    const rawOptions = body.options ?? [];
    if (
      (kind !== 'approval' && kind !== 'user_question')
      || !prompt
      || Number.isNaN(Date.parse(requestedAt))
      || !Array.isArray(rawOptions)
      || rawOptions.some((option) => (
        !option
        || typeof option !== 'object'
        || !String(option.value ?? '').trim()
        || !String(option.label ?? '').trim()
      ))
    ) {
      return {
        statusCode: 400,
        payload: createAppbaseFailure('Agent Interaction creation payload is invalid.', '400'),
      };
    }
    createdInteractionSequence += 1;
    const interactionId = String(
      body.interactionId ?? `interaction.e2e-${createdInteractionSequence}`,
    ).trim();
    const interactionKey = buildSessionInteractionKey(agentId, sessionId, interactionId);
    if (!interactionId || sessionInteractionsByKey.has(interactionKey)) {
      return {
        statusCode: interactionId ? 409 : 400,
        payload: createAppbaseFailure(
          interactionId ? 'Agent Interaction already exists.' : 'Agent Interaction ID is required.',
          interactionId ? '409' : '400',
        ),
      };
    }
    const interaction = {
      interactionId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      sessionId,
      turnId: String(body.turnId ?? '').trim() || null,
      runtimeBindingId: String(body.runtimeBindingId ?? '').trim() || null,
      providerInteractionId: String(body.providerInteractionId ?? '').trim()
        || `provider-interaction.e2e-${createdInteractionSequence}`,
      kind,
      status: 'pending',
      prompt,
      options: rawOptions.map((option) => ({
        value: String(option.value).trim(),
        label: String(option.label).trim(),
      })),
      resolution: null,
      claimOwner: null,
      claimExpiresAt: null,
      fencingToken: '0',
      version: '1',
      createdAt: requestedAt,
      updatedAt: requestedAt,
      resolvedAt: null,
      retentionUntil: String(body.retentionUntil ?? '').trim() || null,
    };
    sessionInteractionsByKey.set(interactionKey, {
      agentId,
      fixtureGeneration: mutableFixtureGeneration,
      interaction,
    });
    return {
      statusCode: 201,
      payload: createBirdCoderDataEnvelope(interaction),
    };
  }

  const sessionInteractionResourceMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/interactions\/(?<interactionId>[^/]+)(?:\/(?<action>claim|approve|answer))?$/u.exec(pathname);
  if (
    sessionInteractionResourceMatch
    && (method === 'GET' || method === 'POST')
  ) {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }
    const {
      action,
      agentId,
      interactionId,
      sessionId,
    } = sessionInteractionResourceMatch.groups;
    const session = sessions.find((item) => (
      item.agentId === agentId && item.sessionId === sessionId
    ));
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }
    const interactionKey = buildSessionInteractionKey(agentId, sessionId, interactionId);
    const entry = sessionInteractionsByKey.get(interactionKey);
    if (!entry || entry.fixtureGeneration !== mutableFixtureGeneration) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Interaction not found.', '404'),
      };
    }
    if (method === 'GET' && !action) {
      return {
        statusCode: 200,
        payload: createBirdCoderDataEnvelope(entry.interaction),
      };
    }
    if (method !== 'POST' || !action) {
      return {
        statusCode: 405,
        payload: createAppbaseFailure('Agent Interaction method is not supported.', '405'),
      };
    }

    const requestedAt = String(body.requestedAt ?? '').trim();
    const expectedVersion = String(body.expectedVersion ?? '').trim();
    if (
      Number.isNaN(Date.parse(requestedAt))
      || !/^(?:0|[1-9]\d*)$/u.test(expectedVersion)
      || entry.interaction.version !== expectedVersion
      || entry.interaction.status !== 'pending'
    ) {
      return {
        statusCode: 409,
        payload: createAppbaseFailure('Agent Interaction version or status is invalid.', '409'),
      };
    }

    if (action === 'claim') {
      const claimOwner = String(body.claimOwner ?? '').trim();
      const leaseSeconds = Number(body.leaseSeconds ?? 30);
      const activeClaim = sessionInteractionClaimsByKey.get(interactionKey);
      if (
        !claimOwner
        || !Number.isSafeInteger(leaseSeconds)
        || leaseSeconds < 1
        || leaseSeconds > 3_600
        || (
          activeClaim
          && activeClaim.fixtureGeneration === mutableFixtureGeneration
          && Date.parse(activeClaim.claimExpiresAt) > Date.parse(requestedAt)
        )
      ) {
        return {
          statusCode: activeClaim ? 409 : 400,
          payload: createAppbaseFailure('Agent Interaction claim is invalid.', activeClaim ? '409' : '400'),
        };
      }
      const version = (BigInt(entry.interaction.version) + 1n).toString();
      const fencingToken = (BigInt(entry.interaction.fencingToken) + 1n).toString();
      const claimExpiresAt = new Date(
        Date.parse(requestedAt) + leaseSeconds * 1_000,
      ).toISOString();
      const claimToken = `claim.e2e-${createdInteractionSequence}-${version}`;
      entry.interaction = {
        ...entry.interaction,
        claimOwner,
        claimExpiresAt,
        fencingToken,
        version,
        updatedAt: requestedAt,
      };
      sessionInteractionClaimsByKey.set(interactionKey, {
        claimExpiresAt,
        claimToken,
        fencingToken,
        fixtureGeneration: mutableFixtureGeneration,
      });
      return {
        statusCode: 200,
        payload: createBirdCoderDataEnvelope({
          interaction: entry.interaction,
          claimToken,
          claimExpiresAt,
          fencingToken,
        }),
      };
    }

    const claim = sessionInteractionClaimsByKey.get(interactionKey);
    if (
      !claim
      || claim.fixtureGeneration !== mutableFixtureGeneration
      || claim.claimToken !== String(body.claimToken ?? '').trim()
      || claim.fencingToken !== String(body.fencingToken ?? '').trim()
      || Date.parse(claim.claimExpiresAt) <= Date.parse(requestedAt)
    ) {
      return {
        statusCode: 409,
        payload: createAppbaseFailure('Agent Interaction claim is invalid or expired.', '409'),
      };
    }

    let status;
    let resolution;
    if (action === 'approve') {
      if (entry.interaction.kind !== 'approval' || typeof body.approved !== 'boolean') {
        return {
          statusCode: 400,
          payload: createAppbaseFailure('Agent approval resolution is invalid.', '400'),
        };
      }
      const reason = String(body.reason ?? '').trim();
      status = body.approved ? 'resolved' : 'rejected';
      resolution = {
        outcome: body.approved ? 'approved' : 'rejected',
        ...(reason ? { reason } : {}),
      };
    } else {
      const rejected = body.rejected === true;
      const answer = String(body.answer ?? '').trim();
      const selectedOptionValue = String(body.selectedOptionValue ?? '').trim();
      if (
        entry.interaction.kind !== 'user_question'
        || (!rejected && !answer)
        || (
          selectedOptionValue
          && !entry.interaction.options.some((option) => option.value === selectedOptionValue)
        )
      ) {
        return {
          statusCode: 400,
          payload: createAppbaseFailure('Agent question resolution is invalid.', '400'),
        };
      }
      status = rejected ? 'rejected' : 'resolved';
      resolution = rejected
        ? { outcome: 'rejected' }
        : {
            outcome: 'answered',
            answer,
            ...(selectedOptionValue ? { selectedOptionValue } : {}),
          };
    }

    entry.interaction = {
      ...entry.interaction,
      status,
      resolution,
      claimOwner: null,
      claimExpiresAt: null,
      version: (BigInt(entry.interaction.version) + 1n).toString(),
      updatedAt: requestedAt,
      resolvedAt: requestedAt,
    };
    sessionInteractionClaimsByKey.delete(interactionKey);
    return {
      statusCode: 200,
      payload: createBirdCoderDataEnvelope(entry.interaction),
    };
  }

  const turnInputQueueRoute = handleTurnInputQueueRoute({
    body,
    method,
    pathname,
    request,
    searchParams,
  });
  if (turnInputQueueRoute) {
    return turnInputQueueRoute;
  }

  const sessionChildMatch = /^\/app\/v3\/api\/ai\/agents\/(?<agentId>[^/]+)\/sessions\/(?<sessionId>[^/]+)\/(?<resource>checkpoints|interactions|items|runtime_bindings|turns|user_state)$/u.exec(pathname);
  if (sessionChildMatch && (method === 'GET' || method === 'PATCH')) {
    if (!isAuthenticatedRequest(request)) {
      return {
        statusCode: 401,
        payload: createAppbaseFailure('No authenticated SDKWork IAM user.', '401'),
      };
    }

    const session = sessions.find((item) =>
      item.agentId === sessionChildMatch.groups.agentId
      && item.sessionId === sessionChildMatch.groups.sessionId,
    );
    if (!session) {
      return {
        statusCode: 404,
        payload: createAppbaseFailure('Agent Session not found.', '404'),
      };
    }
    if (sessionChildMatch.groups.resource === 'user_state') {
      return {
        statusCode: 200,
        payload: createBirdCoderDataEnvelope(createSessionUserState(session)),
      };
    }
    if (sessionChildMatch.groups.resource === 'items') {
      const pageSize = Number(searchParams.get('page_size') ?? 20);
      const cursor = searchParams.get('cursor')?.trim() ?? '';
      const sort = searchParams.get('sort')?.trim() ?? '';
      const cursorScope = [
        'session-items',
        session.agentId,
        session.sessionId,
        sort,
      ].join(':');
      if (
        searchParams.has('page')
        || !Number.isSafeInteger(pageSize)
        || pageSize < 1
        || pageSize > 200
        || sort !== '-sequence'
      ) {
        return {
          statusCode: 400,
          payload: createAppbaseFailure(
            'Session Items require cursor pagination, page_size between 1 and 200, and sort=-sequence.',
            '400',
          ),
        };
      }
      const cursorOffset = readE2ECursorOffset(cursor, cursorScope);
      if (cursorOffset === null) {
        return {
          statusCode: 400,
          payload: createAppbaseFailure('Session Item cursor is invalid.', '400'),
        };
      }
      const items = sessionItemsBySessionId.get(session.sessionId) ?? [];
      const pageItems = items.slice(cursorOffset, cursorOffset + pageSize);
      const nextOffset = cursorOffset + pageItems.length;
      const hasMore = nextOffset < items.length;
      return {
        statusCode: 200,
        payload: createBirdCoderCursorListEnvelope(pageItems, {
          hasMore,
          nextCursor: hasMore ? createE2ECursor(cursorScope, nextOffset) : null,
          pageSize,
        }),
      };
    }
    if (sessionChildMatch.groups.resource === 'turns') {
      const page = Number(searchParams.get('page') ?? 1);
      const pageSize = Number(searchParams.get('page_size') ?? 20);
      const status = searchParams.get('status')?.trim();
      const turns = [...sessionTurnDeliveriesByKey.values()]
        .filter((turnDelivery) => (
          turnDelivery.fixtureGeneration === mutableFixtureGeneration
          && turnDelivery.turn.agentId === session.agentId
          && turnDelivery.turn.sessionId === session.sessionId
          && (!status || turnDelivery.turn.status === status)
        ))
        .map((turnDelivery) => turnDelivery.turn)
        .sort((left, right) => (
          Date.parse(right.createdAt) - Date.parse(left.createdAt)
          || right.turnId.localeCompare(left.turnId)
        ));
      return {
        statusCode: 200,
        payload: createBirdCoderListEnvelope(turns, { page, pageSize }),
      };
    }
    const items = sessionChildMatch.groups.resource === 'runtime_bindings'
      ? [createSessionRuntimeBinding(session)]
      : [];
    return {
      statusCode: 200,
      payload: createBirdCoderListEnvelope(items, {
        page: Number(searchParams.get('page') ?? 1),
        pageSize: Number(searchParams.get('page_size') ?? 20),
      }),
    };
  }

  return {
    statusCode: 200,
    payload: createAppbaseSuccess({ ok: true }),
  };
}

export function createPcE2EMockApiServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${host}`);
    const body = request.method === 'POST' || request.method === 'PATCH'
      ? await readJsonBody(request)
      : {};
    const route = handleRoute(request.method ?? 'GET', url, request, body);

    if (route.sseEvents) {
      await writeSse(
        request,
        response,
        route.statusCode,
        route.sseEvents,
        route.sseEventIntervalMs,
        route.onSseCompletion,
        route.shouldWriteSseEvent,
      );
      return;
    }

    if (route.payload === null) {
      response.writeHead(204, {
        ...corsHeaders(request),
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Access-Token, Content-Type, X-Request-Id',
      });
      response.end();
      return;
    }

    writeJson(request, response, route.statusCode, route.payload);
  });
}

export function startPcE2EMockApiServer() {
  const server = createPcE2EMockApiServer();
  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off('error', handleError);
      process.stdout.write(`pc e2e mock api listening on http://${host}:${port}\n`);
      resolve(server);
    };
    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(port, host);
  });
}

export function closePcE2EMockApiServer(server) {
  if (!server?.listening) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    server.closeAllConnections?.();
  });
}

async function runCli() {
  const server = await startPcE2EMockApiServer();
  const shutdown = () => {
    closePcE2EMockApiServer(server).then(
      () => process.exit(0),
      (error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      },
    );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
