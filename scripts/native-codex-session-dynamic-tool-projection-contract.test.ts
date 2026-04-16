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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-dynamic-tool-'));
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
    path.join(sessionsDirectory, 'native-dynamic-tool-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T14:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-dynamic-tool-session',
          timestamp: '2026-04-16T14:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T14:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Lookup ticket ABC-123 with the project tool',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T14:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'dynamic_tool_call_request',
          callId: 'dyn-1',
          turnId: 'turn-1',
          tool: 'lookup_ticket',
          arguments: {
            id: 'ABC-123',
          },
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T14:03:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'dynamic_tool_call_response',
          call_id: 'dyn-1',
          turn_id: 'turn-1',
          tool: 'lookup_ticket',
          arguments: {
            id: 'ABC-123',
          },
          content_items: [
            {
              type: 'inputText',
              text: 'Ticket is open',
            },
          ],
          success: true,
          error: null,
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const record = await readNativeCodexSessionRecord('codex-native:native-dynamic-tool-session');

  assert.ok(record, 'native Codex session record should resolve dynamic-tool-bearing sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T14:03:00.000Z',
    'dynamic tool completion should advance transcript freshness so session refresh detects the projected tool item.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Lookup ticket ABC-123 with the project tool',
      },
      {
        role: 'tool',
        content: [
          'Dynamic tool completed: lookup_ticket',
          'Arguments: {"id":"ABC-123"}',
          'Output: Ticket is open',
        ].join('\n'),
      },
    ],
    'native Codex parser should project dynamic tool calls into a single visible tool message instead of dropping the request/response pair.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-dynamic-tool-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Lookup ticket ABC-123 with the project tool',
      },
      {
        role: 'tool',
        content: [
          'Dynamic tool completed: lookup_ticket',
          'Arguments: {"id":"ABC-123"}',
          'Output: Ticket is open',
        ].join('\n'),
      },
    ],
    'native Codex mirror should persist projected dynamic tool messages after import and refresh.',
  );
});

console.log('native codex session dynamic tool projection contract passed.');
