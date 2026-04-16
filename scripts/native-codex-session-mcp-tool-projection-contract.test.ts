import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const storeModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts',
  import.meta.url,
);
const mirrorModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionMirror.ts',
  import.meta.url,
);
const mockProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/services/impl/MockProjectService.ts',
  import.meta.url,
);

async function withTemporaryCodexHome<T>(callback: (codexHome: string) => Promise<T>): Promise<T> {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-mcp-tool-'));
  const originalCodexHome = process.env.CODEX_HOME;

  process.env.CODEX_HOME = codexHome;

  try {
    return await callback(codexHome);
  } finally {
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }

    await rm(codexHome, { recursive: true, force: true });
  }
}

await withTemporaryCodexHome(async (codexHome) => {
  const sessionsDirectory = path.join(codexHome, 'sessions', '2026', '04', '16');
  await mkdir(sessionsDirectory, { recursive: true });

  await writeFile(
    path.join(sessionsDirectory, 'native-mcp-tool-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T15:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-mcp-tool-session',
          timestamp: '2026-04-16T15:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T15:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Check the docs MCP server for article 123',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T15:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'mcp_tool_call_begin',
          call_id: 'mcp-1',
          invocation: {
            server: 'docs',
            tool: 'lookup',
            arguments: {
              id: '123',
            },
          },
          mcp_app_resource_uri: 'ui://widget/lookup.html',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T15:03:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'mcp_tool_call_end',
          call_id: 'mcp-1',
          invocation: {
            server: 'docs',
            tool: 'lookup',
            arguments: {
              id: '123',
            },
          },
          mcp_app_resource_uri: 'ui://widget/lookup.html',
          result: {
            Ok: {
              content: [
                {
                  type: 'text',
                  text: 'result',
                },
              ],
              structured_content: {
                id: '123',
              },
              meta: {
                'ui/resourceUri': 'ui://widget/lookup.html',
              },
            },
          },
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const record = await readNativeCodexSessionRecord('codex-native:native-mcp-tool-session');

  assert.ok(record, 'native Codex session record should resolve MCP-tool-bearing sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T15:03:00.000Z',
    'MCP tool completion should advance transcript freshness so session refresh detects the projected tool item.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Check the docs MCP server for article 123',
      },
      {
        role: 'tool',
        content: [
          'MCP tool completed: docs/lookup',
          'Arguments: {"id":"123"}',
          'Resource: ui://widget/lookup.html',
          'Output: result',
          'Structured content: {"id":"123"}',
        ].join('\n'),
      },
    ],
    'native Codex parser should project MCP tool calls into a single visible tool message instead of dropping the begin/end pair.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-mcp-tool-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Check the docs MCP server for article 123',
      },
      {
        role: 'tool',
        content: [
          'MCP tool completed: docs/lookup',
          'Arguments: {"id":"123"}',
          'Resource: ui://widget/lookup.html',
          'Output: result',
          'Structured content: {"id":"123"}',
        ].join('\n'),
      },
    ],
    'native Codex mirror should persist projected MCP tool messages after import and refresh.',
  );
});

console.log('native codex session MCP tool projection contract passed.');
