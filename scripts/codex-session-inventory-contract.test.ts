import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const runtimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/storage/runtime.ts',
  import.meta.url,
);
const sessionInventoryModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts',
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
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-codex-sessions-'));
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

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: createLocalStorage(),
  },
});

try {
  await withTemporaryCodexHome(async (codexHome) => {
    const sessionsDirectory = path.join(codexHome, 'sessions', '2026', '04', '16');
    await mkdir(sessionsDirectory, { recursive: true });
    await writeFile(
      path.join(codexHome, 'session_index.jsonl'),
      [
        JSON.stringify({
          id: 'native-session-1',
          thread_name: 'Pinned session title from index',
          updated_at: '2026-04-16T09:06:00.000Z',
        }),
      ].join('\n'),
      'utf8',
    );

    const nativeCompletedSessionPath = path.join(
      sessionsDirectory,
      'rollout-2026-04-16T09-00-00-native-session-1.jsonl',
    );
    const nativePausedSessionPath = path.join(
      sessionsDirectory,
      'rollout-2026-04-16T10-00-00-native-session-2.jsonl',
    );

    await writeFile(
      nativeCompletedSessionPath,
      [
        {
          timestamp: '2026-04-16T09:00:00.000Z',
          type: 'session_meta',
          payload: {
            id: 'native-session-1',
            timestamp: '2026-04-16T09:00:00.000Z',
            cwd: 'D:\\workspace\\birdcoder',
            originator: 'codex-tui',
            cli_version: '0.118.0',
            source: 'cli',
            model_provider: 'custom',
          },
        },
        {
          timestamp: '2026-04-16T09:00:01.000Z',
          type: 'event_msg',
          payload: {
            type: 'task_started',
          },
        },
        {
          timestamp: '2026-04-16T09:00:02.000Z',
          type: 'event_msg',
          payload: {
            type: 'user_message',
            message: 'Repair Codex session inventory.',
          },
        },
        {
          timestamp: '2026-04-16T09:05:00.000Z',
          type: 'event_msg',
          payload: {
            type: 'task_complete',
          },
        },
      ].map((entry) => JSON.stringify(entry)).join('\n'),
      'utf8',
    );

    await writeFile(
      nativePausedSessionPath,
      [
        {
          timestamp: '2026-04-16T10:00:00.000Z',
          type: 'session_meta',
          payload: {
            id: 'native-session-2',
            timestamp: '2026-04-16T10:00:00.000Z',
            cwd: 'D:\\workspace\\recovery-app',
            originator: 'codex-tui',
            cli_version: '0.118.0',
            source: 'cli',
            model_provider: 'custom',
          },
        },
        {
          timestamp: '2026-04-16T10:00:01.000Z',
          type: 'event_msg',
          payload: {
            type: 'task_started',
          },
        },
        {
          timestamp: '2026-04-16T10:02:00.000Z',
          type: 'event_msg',
          payload: {
            type: 'turn_aborted',
          },
        },
      ].map((entry) => JSON.stringify(entry)).join('\n'),
      'utf8',
    );

    const runtimeModuleVersion = Date.now();
    const { buildLocalStoreKey } = await import(`${runtimeModulePath.href}?t=${runtimeModuleVersion}`);
    const { listStoredSessionInventory } = await import(
      `${sessionInventoryModulePath.href}?t=${runtimeModuleVersion}`
    );

    window.localStorage.setItem(
      buildLocalStoreKey('coding-session', 'table.sqlite.coding-sessions.v1'),
      JSON.stringify([
        {
          id: 'coding-session-alpha',
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          title: 'Alpha Session',
          status: 'active',
          hostMode: 'desktop',
          engineId: 'claude',
          createdAt: '2026-04-15T09:00:00.000Z',
          updatedAt: '2026-04-15T10:15:00.000Z',
        },
      ]),
    );

    const inventory = await listStoredSessionInventory({ includeGlobal: true, limit: 10 });
    const nativeSessions = inventory.filter(
      (
        record,
      ): record is {
        id: string;
        kind: 'coding';
        title: string;
        status: string;
        engineId: string;
        hostMode: string;
        workspaceId: string;
        projectId: string;
        createdAt: string;
        updatedAt: string;
        lastTurnAt?: string;
      } => record.kind === 'coding' && record.engineId === 'codex',
    );

    assert.deepEqual(
      nativeSessions.map((session) => ({
        id: session.id,
        title: session.title,
        status: session.status,
        engineId: session.engineId,
        hostMode: session.hostMode,
        workspaceId: session.workspaceId,
        projectId: session.projectId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        nativeCwd: 'nativeCwd' in session ? session.nativeCwd : undefined,
      })),
      [
        {
          id: 'codex-native:native-session-2',
          title: 'recovery-app',
          status: 'paused',
          engineId: 'codex',
          hostMode: 'desktop',
          workspaceId: '',
          projectId: '',
          createdAt: '2026-04-16T10:00:00.000Z',
          updatedAt: '2026-04-16T10:02:00.000Z',
          nativeCwd: 'D:\\workspace\\recovery-app',
        },
        {
          id: 'codex-native:native-session-1',
          title: 'Pinned session title from index',
          status: 'completed',
          engineId: 'codex',
          hostMode: 'desktop',
          workspaceId: '',
          projectId: '',
          createdAt: '2026-04-16T09:00:00.000Z',
          updatedAt: '2026-04-16T09:06:00.000Z',
          nativeCwd: 'D:\\workspace\\birdcoder',
        },
      ],
    );

    assert.equal(
      nativeSessions.every((session) => typeof session.lastTurnAt === 'string' && session.lastTurnAt.length > 0),
      true,
      'Native Codex sessions should expose a stable lastTurnAt value for inventory sorting and recovery.',
    );

    const scopedInventoryWithGlobal = await listStoredSessionInventory({
      projectId: 'project-1',
    });
    assert.equal(
      scopedInventoryWithGlobal.some((record) => record.id === 'codex-native:native-session-1'),
      true,
      'Project-scoped inventory should still include global native Codex sessions when includeGlobal is enabled.',
    );

    const scopedInventoryWithoutGlobal = await listStoredSessionInventory({
      includeGlobal: false,
      projectId: 'project-1',
    });
    assert.equal(
      scopedInventoryWithoutGlobal.some((record) => record.id === 'codex-native:native-session-1'),
      false,
      'Project-scoped inventory should exclude global native Codex sessions when includeGlobal is disabled.',
    );
  });
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('codex session inventory contract passed.');
