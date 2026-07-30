#!/usr/bin/env node

import http from 'node:http';
import process from 'node:process';
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
    itemCount: '105',
    lastItemSequence: '105',
    lastItemAt: '2026-01-01T00:20:00.000Z',
    version: '105',
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
    Array.from({ length: 105 }, (_, index) => {
      const sequence = 105 - index;
      const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)).toISOString();
      if (sequence === 105) {
        return {
          sessionId: 'e2e-codex-session',
          itemId: 'e2e-codex-item-105',
          turnId: 'e2e-codex-turn-1',
          kind: 'tool_result',
          status: 'completed',
          sequence: '105',
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
            threadId: 'e2e-codex-session',
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
              threadId: 'e2e-codex-session',
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
let completedTurnSequence = 0;

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
    providerSessionId: `provider.${session.sessionId}`,
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
    const turn = {
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
      responseItemId: assistantItemId,
      turnMode: body.turnMode ?? 'interactive',
      status: 'completed',
      requestedModelId: body.requestedModelId ?? null,
      modelId: body.requestedModelId ?? null,
      inputTokens: '0',
      outputTokens: '6',
      cachedTokens: '0',
      finishReason: 'stop',
      attemptCount: 1,
      maxAttempts: 1,
      availableAt: completedAt,
      fencingToken: '1',
      version: '1',
      createdAt: completedAt,
      updatedAt: completedAt,
      startedAt: completedAt,
      completedAt,
    };

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
      if (isCommitted) {
        return;
      }
      isCommitted = true;
      Object.assign(session, sessionUpdate);
      sessionItemsBySessionId.set(
        session.sessionId,
        [assistantItem, userItem, ...currentItems],
      );
    };

    const completion = createBirdCoderDataEnvelope({
      session: completedSession,
      turn,
      items: [userItem, assistantItem],
    });
    if (searchParams.get('stream') === 'true') {
      const deltaBoundary = Math.max(1, Math.floor(assistantItem.content.length / 2));
      return {
        statusCode: 200,
        onSseCompletion: commitTurn,
        sseEventIntervalMs: 2_000,
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

const server = http.createServer(async (request, response) => {
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

server.listen(port, host, () => {
  process.stdout.write(`pc e2e mock api listening on http://${host}:${port}\n`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
