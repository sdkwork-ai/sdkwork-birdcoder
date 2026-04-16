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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-collab-'));
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
    path.join(sessionsDirectory, 'native-collab-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T18:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-collab-session',
          timestamp: '2026-04-16T18:00:00.000Z',
          cwd: 'D:/workspace/birdcoder',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T18:01:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'user_message',
          turn_id: 'turn-1',
          message: 'Coordinate a multi-agent audit',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T18:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_agent_spawn_end',
          call_id: 'spawn-1',
          sender_thread_id: 'sender-thread-1',
          new_thread_id: 'agent-thread-1',
          new_agent_nickname: 'Hilbert',
          new_agent_role: 'explorer',
          prompt: 'Compare parity gaps',
          model: 'gpt-5.4',
          reasoning_effort: 'xhigh',
          status: 'pending_init',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T18:03:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_agent_interaction_end',
          call_id: 'send-1',
          sender_thread_id: 'sender-thread-1',
          receiver_thread_id: 'agent-thread-1',
          receiver_agent_nickname: 'Hilbert',
          receiver_agent_role: 'explorer',
          prompt: 'Continue the audit',
          status: 'running',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T18:04:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_waiting_end',
          sender_thread_id: 'sender-thread-1',
          call_id: 'wait-1',
          agent_statuses: [
            {
              thread_id: 'agent-thread-1',
              agent_nickname: 'Hilbert',
              agent_role: 'explorer',
              status: {
                completed: 'PASS: audit done',
              },
            },
          ],
          statuses: {
            'agent-thread-1': {
              completed: 'PASS: audit done',
            },
          },
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T18:05:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_resume_end',
          call_id: 'resume-1',
          sender_thread_id: 'sender-thread-1',
          receiver_thread_id: 'agent-thread-1',
          receiver_agent_nickname: 'Hilbert',
          receiver_agent_role: 'explorer',
          status: {
            completed: null,
          },
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T18:06:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'collab_close_end',
          call_id: 'close-1',
          sender_thread_id: 'sender-thread-1',
          receiver_thread_id: 'agent-thread-1',
          receiver_agent_nickname: 'Hilbert',
          receiver_agent_role: 'explorer',
          status: {
            errored: 'agent already exited',
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

  const record = await readNativeCodexSessionRecord('codex-native:native-collab-session');

  assert.ok(record, 'native Codex session record should resolve collab-bearing sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T18:06:00.000Z',
    'collab tool completions should advance transcript freshness so session refresh detects the projected tool items.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Coordinate a multi-agent audit',
      },
      {
        role: 'tool',
        content: [
          'Spawn agent completed: Hilbert (explorer)',
          'Thread: agent-thread-1',
          'Model: gpt-5.4',
          'Reasoning: xhigh',
          'Prompt: Compare parity gaps',
          'Agent status: pending init',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Send input completed: Hilbert (explorer)',
          'Thread: agent-thread-1',
          'Prompt: Continue the audit',
          'Agent status: running',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Wait completed for 1 agent(s)',
          '- Hilbert (explorer) [agent-thread-1]: completed',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Resume agent completed: Hilbert (explorer)',
          'Thread: agent-thread-1',
          'Agent status: completed',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Close agent failed: Hilbert (explorer)',
          'Thread: agent-thread-1',
          'Agent status: errored',
          'Error: agent already exited',
        ].join('\n'),
      },
    ],
    'native Codex parser should project collab tool completions into visible tool messages instead of silently dropping them.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-collab-session');

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Coordinate a multi-agent audit',
      },
      {
        role: 'tool',
        content: [
          'Spawn agent completed: Hilbert (explorer)',
          'Thread: agent-thread-1',
          'Model: gpt-5.4',
          'Reasoning: xhigh',
          'Prompt: Compare parity gaps',
          'Agent status: pending init',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Send input completed: Hilbert (explorer)',
          'Thread: agent-thread-1',
          'Prompt: Continue the audit',
          'Agent status: running',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Wait completed for 1 agent(s)',
          '- Hilbert (explorer) [agent-thread-1]: completed',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Resume agent completed: Hilbert (explorer)',
          'Thread: agent-thread-1',
          'Agent status: completed',
        ].join('\n'),
      },
      {
        role: 'tool',
        content: [
          'Close agent failed: Hilbert (explorer)',
          'Thread: agent-thread-1',
          'Agent status: errored',
          'Error: agent already exited',
        ].join('\n'),
      },
    ],
    'native Codex mirror should persist projected collab tool messages after import and refresh.',
  );
});

console.log('native codex session collab projection contract passed.');
