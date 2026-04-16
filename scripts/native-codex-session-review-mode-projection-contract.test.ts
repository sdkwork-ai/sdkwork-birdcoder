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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-native-codex-review-mode-'));
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
    path.join(sessionsDirectory, 'native-review-mode-session.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-04-16T14:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'native-review-mode-session',
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
          message: 'Review the latest refresh changes',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T14:02:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'entered_review_mode',
          target: {
            type: 'custom',
            instructions: 'Inspect the changed files for regressions.',
          },
          user_facing_hint: 'Code review requested for the latest refresh changes.',
        },
      }),
      JSON.stringify({
        timestamp: '2026-04-16T14:03:00.000Z',
        type: 'event_msg',
        payload: {
          type: 'exited_review_mode',
          review_output: {
            findings: [],
            overall_correctness: 'partially_correct',
            overall_explanation: 'Session refresh is mostly correct, but project-scoped invalidation still needs a regression check.',
            overall_confidence_score: 0.82,
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

  const record = await readNativeCodexSessionRecord('codex-native:native-review-mode-session');

  assert.ok(record, 'native Codex session record should resolve review-mode sessions.');
  assert.equal(
    record?.summary.transcriptUpdatedAt,
    '2026-04-16T14:03:00.000Z',
    'review-mode events should advance transcript freshness so review summaries appear after refresh.',
  );
  assert.deepEqual(
    record?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Review the latest refresh changes',
      },
      {
        role: 'reviewer',
        content: 'Code review requested for the latest refresh changes.',
      },
      {
        role: 'reviewer',
        content: 'Session refresh is mostly correct, but project-scoped invalidation still needs a regression check.',
      },
    ],
    'entered/exited review mode should surface as reviewer messages so imported Codex sessions show the review lifecycle and final explanation.',
  );

  const projectService = new MockProjectService();
  await ensureNativeCodexSessionMirror({
    inventory: [record!.summary],
    projectService,
    workspaceId: 'ws-1',
  });

  const mirroredSession = (await projectService.getProjects('ws-1'))
    .find((project) => project.name === 'Codex Sessions')
    ?.codingSessions.find(
      (codingSession) => codingSession.id === 'codex-native:native-review-mode-session',
    );

  assert.deepEqual(
    mirroredSession?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      {
        role: 'user',
        content: 'Review the latest refresh changes',
      },
      {
        role: 'reviewer',
        content: 'Code review requested for the latest refresh changes.',
      },
      {
        role: 'reviewer',
        content: 'Session refresh is mostly correct, but project-scoped invalidation still needs a regression check.',
      },
    ],
    'native Codex mirror should persist review-mode messages so project session imports show the same review trail after sync.',
  );
});

console.log('native codex session review mode projection contract passed.');
