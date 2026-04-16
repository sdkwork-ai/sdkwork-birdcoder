import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const refreshModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts',
  import.meta.url,
);
const mockProjectServiceModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/services/impl/MockProjectService.ts',
  import.meta.url,
);

const backingStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function createLocalStorage() {
  return {
    clear() {
      backingStore.clear();
    },
    getItem(key: string) {
      return backingStore.has(key) ? backingStore.get(key)! : null;
    },
    key(index: number) {
      return [...backingStore.keys()][index] ?? null;
    },
    removeItem(key: string) {
      backingStore.delete(key);
    },
    setItem(key: string, value: string) {
      backingStore.set(key, value);
    },
    get length() {
      return backingStore.size;
    },
  };
}

async function withTemporaryCodexHome<T>(callback: (codexHome: string) => Promise<T>): Promise<T> {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-session-refresh-'));
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

async function writeNativeCodexSessionFile(
  codexHome: string,
  fileName: string,
  lines: unknown[],
) {
  const sessionsDirectory = path.join(codexHome, 'sessions', '2026', '04', '16');
  await mkdir(sessionsDirectory, { recursive: true });
  const sessionFilePath = path.join(sessionsDirectory, fileName);
  await writeFile(
    sessionFilePath,
    `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`,
    'utf8',
  );
  return sessionFilePath;
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: createLocalStorage(),
  },
});

try {
  await withTemporaryCodexHome(async (codexHome) => {
    const moduleVersion = Date.now();
    const {
      refreshCodingSessionMessages,
      refreshProjectSessions,
    } = await import(`${refreshModulePath.href}?t=${moduleVersion}`);
    const { MockProjectService } = await import(`${mockProjectServiceModulePath.href}?t=${moduleVersion}`);

    await writeNativeCodexSessionFile(codexHome, 'native-session-1.jsonl', [
      {
        type: 'session_meta',
        timestamp: '2026-04-16T10:00:00.000Z',
        payload: {
          id: 'native-session-1',
          cwd: 'D:/workspace/birdcoder',
          timestamp: '2026-04-16T10:00:00.000Z',
        },
      },
      {
        type: 'event_msg',
        timestamp: '2026-04-16T10:01:00.000Z',
        payload: {
          type: 'user_message',
          message: 'Refresh the native Codex session list.',
          turnId: 'turn-1',
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-04-16T10:02:00.000Z',
        payload: {
          type: 'message',
          role: 'assistant',
          turnId: 'turn-1',
          content: [{ type: 'output_text', text: 'Native project refresh synced the session list.' }],
        },
      },
    ]);

    const projectService = new MockProjectService();
    const projectRefreshResult = await refreshProjectSessions({
      projectService,
      workspaceId: 'ws-1',
    });

    assert.equal(projectRefreshResult.status, 'refreshed');
    assert.equal(projectRefreshResult.source, 'native-codex');

    const mirroredProjects = await projectService.getProjects('ws-1');
    const mirroredNativeSession = mirroredProjects
      .find((project) => project.name === 'Codex Sessions')
      ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-session-1');

    assert.ok(mirroredNativeSession, 'project refresh should mirror native Codex sessions into the workspace.');
    assert.deepEqual(
      mirroredNativeSession?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        {
          role: 'user',
          content: 'Refresh the native Codex session list.',
        },
        {
          role: 'assistant',
          content: 'Native project refresh synced the session list.',
        },
      ],
      'project refresh should hydrate native Codex messages, not only session summaries.',
    );

    await writeNativeCodexSessionFile(codexHome, 'native-session-1.jsonl', [
      {
        type: 'session_meta',
        timestamp: '2026-04-16T10:00:00.000Z',
        payload: {
          id: 'native-session-1',
          cwd: 'D:/workspace/birdcoder',
          timestamp: '2026-04-16T10:00:00.000Z',
        },
      },
      {
        type: 'event_msg',
        timestamp: '2026-04-16T10:01:00.000Z',
        payload: {
          type: 'user_message',
          message: 'Refresh the native Codex session list.',
          turnId: 'turn-1',
        },
      },
      {
        type: 'response_item',
        timestamp: '2026-04-16T10:03:00.000Z',
        payload: {
          type: 'message',
          role: 'assistant',
          turnId: 'turn-1',
          content: [{ type: 'output_text', text: 'Session refresh picked up the newer assistant reply.' }],
        },
      },
    ]);

    const nativeRefreshResult = await refreshCodingSessionMessages({
      codingSessionId: 'codex-native:native-session-1',
      projectService,
      workspaceId: 'ws-1',
    });

    assert.equal(nativeRefreshResult.status, 'refreshed');
    assert.equal(nativeRefreshResult.source, 'native-codex');

    const refreshedProjects = await projectService.getProjects('ws-1');
    const refreshedNativeSession = refreshedProjects
      .find((project) => project.name === 'Codex Sessions')
      ?.codingSessions.find((codingSession) => codingSession.id === 'codex-native:native-session-1');

    assert.equal(
      refreshedNativeSession?.messages[1]?.content,
      'Session refresh picked up the newer assistant reply.',
      'session refresh should reload the latest native Codex transcript.',
    );

    const coreBackedProject = await projectService.createProject('ws-1', 'Core-backed refresh project');
    const coreBackedSession = await projectService.createCodingSession(coreBackedProject.id, 'Core-backed session', {
      engineId: 'claude-code',
      modelId: 'claude-code',
    });

    await projectService.addCodingSessionMessage(coreBackedProject.id, coreBackedSession.id, {
      role: 'user',
      turnId: 'turn-core-1',
      content: 'Refresh the core-backed session.',
    });

    const coreRefreshResult = await refreshCodingSessionMessages({
      codingSessionId: coreBackedSession.id,
      coreReadService: {
        async getCodingSession(codingSessionId: string) {
          return {
            id: codingSessionId,
            workspaceId: 'ws-1',
            projectId: coreBackedProject.id,
            title: 'Core-backed session',
            status: 'completed',
            hostMode: 'desktop',
            engineId: 'claude-code',
            modelId: 'claude-code',
            createdAt: '2026-04-16T11:00:00.000Z',
            updatedAt: '2026-04-16T11:02:00.000Z',
            lastTurnAt: '2026-04-16T11:02:00.000Z',
          };
        },
        async listCodingSessionEvents() {
          return [
            {
              id: 'event-1',
              codingSessionId: coreBackedSession.id,
              turnId: 'turn-core-1',
              runtimeId: 'runtime-1',
              kind: 'message.completed',
              sequence: 1,
              payload: {
                role: 'assistant',
                content: 'Core refresh synchronized the assistant reply.',
              },
              createdAt: '2026-04-16T11:02:00.000Z',
            },
          ];
        },
      },
      projectService,
      workspaceId: 'ws-1',
    });

    assert.equal(coreRefreshResult.status, 'refreshed');
    assert.equal(coreRefreshResult.source, 'core');

    const coreRefreshedProjects = await projectService.getProjects('ws-1');
    const coreRefreshedSession = coreRefreshedProjects
      .find((project) => project.id === coreBackedProject.id)
      ?.codingSessions.find((codingSession) => codingSession.id === coreBackedSession.id);

    assert.equal(
      coreRefreshedSession?.messages.some(
        (message) =>
          message.role === 'assistant' &&
          message.content === 'Core refresh synchronized the assistant reply.',
      ),
      true,
      'core-backed session refresh should project assistant output back into the local mirror.',
    );

    const unsupportedProject = await projectService.createProject('ws-1', 'Unsupported engine project');
    const unsupportedSession = await projectService.createCodingSession(unsupportedProject.id, 'Unsupported session', {
      engineId: 'gemini',
      modelId: 'gemini-2.5-pro',
    });

    const unsupportedRefreshResult = await refreshCodingSessionMessages({
      codingSessionId: unsupportedSession.id,
      projectService,
      workspaceId: 'ws-1',
    });

    assert.equal(unsupportedRefreshResult.status, 'unsupported');
    assert.equal(unsupportedRefreshResult.source, 'engine');
  });
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('session refresh orchestrator contract passed.');
