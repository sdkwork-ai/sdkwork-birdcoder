import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
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

async function withTemporaryCodexHome<T>(callback: () => Promise<T>): Promise<T> {
  const codexHome = await mkdtemp(path.join(os.tmpdir(), 'birdcoder-session-inventory-'));
  const originalCodexHome = process.env.CODEX_HOME;

  process.env.CODEX_HOME = codexHome;

  try {
    return await callback();
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
  await withTemporaryCodexHome(async () => {
    const runtimeModuleVersion = Date.now();
    const {
      buildLocalStoreKey,
      listStoredRawValues,
    } = await import(`${runtimeModulePath.href}?t=${runtimeModuleVersion}`);
    const {
      listStoredCodingSessions,
      listStoredSessionInventory,
    } = await import(`${sessionInventoryModulePath.href}?t=${runtimeModuleVersion}`);

    const codingSessionsStorageKey = 'table.sqlite.coding-sessions.v1';
    const codingSessionRuntimesStorageKey = 'table.sqlite.coding-session-runtimes.session-alpha.v1';
    const terminalSessionsStorageKey = 'sessions.v1';

    window.localStorage.setItem(
      buildLocalStoreKey('coding-session', codingSessionsStorageKey),
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
          lastTurnAt: '2026-04-15T10:14:00.000Z',
        },
        {
          id: 'coding-session-bravo',
          workspaceId: 'workspace-1',
          projectId: 'project-2',
          title: 'Bravo Session',
          status: 'completed',
          hostMode: 'server',
          engineId: 'codex',
          modelId: 'gpt-4o',
          createdAt: '2026-04-15T08:30:00.000Z',
          updatedAt: '2026-04-15T10:12:00.000Z',
        },
        {
          title: 'Invalid Session Missing Id',
        },
      ]),
    );
    window.localStorage.setItem(
      buildLocalStoreKey('coding-session', codingSessionRuntimesStorageKey),
      JSON.stringify([
        {
          id: 'runtime-alpha',
        },
      ]),
    );
    window.localStorage.setItem(
      buildLocalStoreKey('runtime.terminal', terminalSessionsStorageKey),
      JSON.stringify([
        {
          id: 't-project',
          title: 'Project Terminal',
          profileId: 'codex',
          cwd: 'D:/workspace/project-1',
          commandHistory: ['codex'],
          recentOutput: ['ready'],
          updatedAt: Date.parse('2026-04-15T10:20:00.000Z'),
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          status: 'idle',
          lastExitCode: 0,
        },
        {
          id: 't-global',
          title: 'Global Terminal',
          profileId: 'powershell',
          cwd: 'D:/workspace',
          commandHistory: ['Get-ChildItem'],
          recentOutput: ['ok'],
          updatedAt: Date.parse('2026-04-15T10:10:00.000Z'),
          workspaceId: 'workspace-1',
          projectId: '',
          status: 'idle',
          lastExitCode: 0,
        },
      ]),
    );

    const listedRawValues = await listStoredRawValues('coding-session');
    assert.deepEqual(
      listedRawValues.map((entry: { key: string }) => entry.key).sort(),
      [codingSessionRuntimesStorageKey, codingSessionsStorageKey],
    );

    const storedCodingSessions = await listStoredCodingSessions();
    assert.deepEqual(
      storedCodingSessions.map((session: { id: string; engineId: string; modelId?: string; updatedAt: string }) => ({
        id: session.id,
        engineId: session.engineId,
        modelId: session.modelId,
        updatedAt: session.updatedAt,
      })),
      [
        {
          id: 'coding-session-alpha',
          engineId: 'claude-code',
          modelId: 'claude-code',
          updatedAt: '2026-04-15T10:15:00.000Z',
        },
        {
          id: 'coding-session-bravo',
          engineId: 'codex',
          modelId: 'gpt-4o',
          updatedAt: '2026-04-15T10:12:00.000Z',
        },
      ],
    );

    assert.deepEqual(
      (await listStoredCodingSessions({ projectId: 'project-1' })).map(
        (session: { id: string }) => session.id,
      ),
      ['coding-session-alpha'],
    );

    assert.deepEqual(
      (
        await listStoredSessionInventory({
          projectId: 'project-1',
        })
      ).map((session: { id: string; kind: string }) => `${session.kind}:${session.id}`),
      ['terminal:t-project', 'coding:coding-session-alpha', 'terminal:t-global'],
    );

    assert.deepEqual(
      (
        await listStoredSessionInventory({
          includeGlobal: false,
          projectId: 'project-1',
        })
      ).map((session: { id: string; kind: string }) => `${session.kind}:${session.id}`),
      ['terminal:t-project', 'coding:coding-session-alpha'],
    );
  });
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('session inventory contract passed.');
