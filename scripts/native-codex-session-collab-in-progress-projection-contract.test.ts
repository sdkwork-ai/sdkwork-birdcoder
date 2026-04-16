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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-collab-in-progress-'));
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
    path.join(sessionsDirectory, 'native-collab-in-progress-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T20:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-collab-in-progress-session',
          timestamp: '2026-04-16T20:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T20:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Kick off a multi-agent review',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T20:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_agent_spawn_begin',
          call_id: 'spawn-1',
          sender_thread_id: 'sender-thread-1',
          prompt: 'Compare parity gaps',
          model: 'gpt-5.4',
          reasoning_effort: 'high',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T20:03:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_agent_interaction_begin',
          call_id: 'send-1',
          sender_thread_id: 'sender-thread-1',
          receiver_thread_id: 'agent-thread-1',
          prompt: 'Continue the audit',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T20:04:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_waiting_begin',
          sender_thread_id: 'sender-thread-1',
          receiver_thread_ids: ['agent-thread-1'],
          receiver_agents: [
            {
              thread_id: 'agent-thread-1',
              agent_nickname: 'Hilbert',
              agent_role: 'explorer',
            },
          ],
          call_id: 'wait-1',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T20:05:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_resume_begin',
          call_id: 'resume-1',
          sender_thread_id: 'sender-thread-1',
          receiver_thread_id: 'agent-thread-1',
          receiver_agent_nickname: 'Hilbert',
          receiver_agent_role: 'explorer',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T20:06:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_close_begin',
          call_id: 'close-1',
          sender_thread_id: 'sender-thread-1',
          receiver_thread_id: 'agent-thread-1',
        },
      }),
    ].join('\n'),
    'utf8',
  );

  const moduleVersion = Date.now();
  const { readNativeCodexSessionRecord } = await import(`${storeModulePath.href}?t=${moduleVersion}`);
  const { ensureNativeCodexSessionMirror } = await import(`${mirrorModulePath.href}?t=${moduleVersion}`);
  const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

  const record = await readNativeCodexSessionRecord('codex-native:native-collab-in-progress-session');

  assert.ok(record, 'native Codex session record should resolve collab-in-progress sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T20:06:00.000Z',
    'collab begin events should advance transcript freshness so refreshing a running session still sees in-progress tool items.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Kick off a multi-agent review',
      },
      {
        role: 'tool',
        content: [
          'Spawn agent running',
          'Model: gpt-5.4',
          'Reasoning: high',
          'Prompt: Compare parity gaps',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Send input running: agent-thread-1',
          'Thread: agent-thread-1',
          'Prompt: Continue the audit',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Wait running for 1 agent(s)',
          '- Hilbert (explorer) [agent-thread-1]',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Resume agent running: Hilbert (explorer)',
          'Thread: agent-thread-1',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Close agent running: agent-thread-1',
          'Thread: agent-thread-1',
        ].join('\n'),
      },
    ],
    'native Codex parser should project collab begin events into visible in-progress tool messages instead of dropping them.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-collab-in-progress-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Kick off a multi-agent review',
      },
      {
        role: 'tool',
        content: [
          'Spawn agent running',
          'Model: gpt-5.4',
          'Reasoning: high',
          'Prompt: Compare parity gaps',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Send input running: agent-thread-1',
          'Thread: agent-thread-1',
          'Prompt: Continue the audit',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Wait running for 1 agent(s)',
          '- Hilbert (explorer) [agent-thread-1]',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Resume agent running: Hilbert (explorer)',
          'Thread: agent-thread-1',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Close agent running: agent-thread-1',
          'Thread: agent-thread-1',
        ].join('\n'),
      },
    ],
    'native Codex mirror should persist in-progress collab tool messages after import and refresh.',
  );
});

console.log('native codex session collab in-progress projection contract passed.');
