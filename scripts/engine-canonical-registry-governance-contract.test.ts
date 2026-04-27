import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ClaudeChatEngine } from '../packages/sdkwork-birdcoder-chat-claude/src/index.ts';
import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { OpenCodeChatEngine } from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';
import type { ChatEngineOfficialSdkBridgeLoader } from '../packages/sdkwork-birdcoder-chat/src/index.ts';
import type { ChatMessage, IChatEngine } from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-codeengine/src/kernel.ts';
import { createWorkbenchCanonicalChatEngine } from '../packages/sdkwork-birdcoder-codeengine/src/runtime.ts';
import {
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
} from '../packages/sdkwork-birdcoder-types/src/coding-session.ts';
import { withMockCodexCliJsonl } from './test-support/mockCodexCli.ts';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readMarkdownBulletList(source: string, heading: string): string[] {
  const headingPattern = new RegExp(
    `^## ${escapeRegExp(heading)}\\r?\\n([\\s\\S]*?)(?=^##\\s|\\Z)`,
    'm',
  );
  const match = source.match(headingPattern);

  assert.ok(match, `Missing markdown section: ${heading}`);

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim().replace(/^`/, '').replace(/`$/, ''));
}

const integrationReferenceSource = await readFile(
  new URL('../docs/reference/engine-sdk-integration.md', import.meta.url),
  'utf8',
);
const eventKindRegistry = new Set<string>(BIRDCODER_CODING_SESSION_EVENT_KINDS);
const artifactKindRegistry = new Set<string>(BIRDCODER_CODING_SESSION_ARTIFACT_KINDS);

assert.deepEqual(
  readMarkdownBulletList(integrationReferenceSource, 'Canonical event kinds'),
  [...BIRDCODER_CODING_SESSION_EVENT_KINDS],
  'engine SDK integration reference must document the canonical event registry exactly as shared types declare it',
);

assert.deepEqual(
  readMarkdownBulletList(integrationReferenceSource, 'Canonical artifact kinds'),
  [...BIRDCODER_CODING_SESSION_ARTIFACT_KINDS],
  'engine SDK integration reference must document the canonical artifact registry exactly as shared types declare it',
);

const messages: ChatMessage[] = [
  {
    id: 'msg-user-1',
    role: 'user',
    content: 'Inspect the workspace and take the next coding action.',
    timestamp: Date.now(),
  },
];

function createCanonicalGovernanceMockLoader(
  engineId: string,
  modelId: string,
): ChatEngineOfficialSdkBridgeLoader {
  const created = Math.floor(Date.now() / 1000);
  return {
    load: async () => ({
      async sendMessage() {
        return {
          id: `${engineId}-canonical-governance-response`,
          object: 'chat.completion',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              message: {
                id: `${engineId}-canonical-governance-message`,
                role: 'assistant',
                content: `${engineId} canonical governance response.`,
                timestamp: Date.now(),
              },
              finish_reason: 'stop',
            },
          ],
        };
      },
      async *sendMessageStream() {
        yield {
          id: `${engineId}-canonical-governance-stream`,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                content: `${engineId} canonical governance stream. `,
              },
              finish_reason: null,
            },
          ],
        };
        yield {
          id: `${engineId}-canonical-governance-stream`,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: `${engineId}-canonical-governance-tool`,
                    type: 'function',
                    function: {
                      name: 'run_command',
                      arguments: JSON.stringify({ command: 'pnpm lint' }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };
        yield {
          id: `${engineId}-canonical-governance-stream`,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        };
      },
    }),
  };
}

function createCanonicalGovernanceRuntime(
  engine: ReturnType<typeof listWorkbenchCliEngines>[number],
): IChatEngine {
  if (engine.id === 'codex') {
    return createChatEngineById(engine.id);
  }

  const officialSdkBridgeLoader = createCanonicalGovernanceMockLoader(
    engine.id,
    engine.defaultModelId,
  );
  const nativeRuntime =
    engine.id === 'claude-code'
      ? new ClaudeChatEngine({ officialSdkBridgeLoader })
      : engine.id === 'gemini'
        ? new GeminiChatEngine({ officialSdkBridgeLoader })
        : new OpenCodeChatEngine({ officialSdkBridgeLoader });

  return createWorkbenchCanonicalChatEngine(nativeRuntime, {
    defaultModelId: engine.defaultModelId,
    descriptor: engine.descriptor,
  });
}

for (const engine of listWorkbenchCliEngines()) {
  const runtime = createCanonicalGovernanceRuntime(engine);
  const emittedEventKinds = new Set<string>();
  const emittedArtifactKinds = new Set<string>();

  const collectCanonicalEvents = async () => {
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
      emittedEventKinds.add(event.kind);
      assert.equal(
        eventKindRegistry.has(event.kind),
        true,
        `${engine.id} canonical runtime must only emit registered event kinds`,
      );

      if (event.artifact) {
        emittedArtifactKinds.add(event.artifact.kind);
        assert.equal(
          artifactKindRegistry.has(event.artifact.kind),
          true,
          `${engine.id} canonical runtime must only emit registered artifact kinds`,
        );
      }
    }
  };

  if (engine.id === 'codex') {
    await withMockCodexCliJsonl(collectCanonicalEvents);
  } else {
    await collectCanonicalEvents();
  }

  assert.equal(
    emittedEventKinds.size > 0,
    true,
    `${engine.id} canonical runtime must emit registered events`,
  );
  assert.equal(
    emittedArtifactKinds.size > 0,
    true,
    `${engine.id} canonical runtime must emit registered artifacts`,
  );
}

console.log('engine canonical registry governance contract passed.');
