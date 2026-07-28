import assert from 'node:assert/strict';

const tauriFileSystemRuntimeModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts',
  import.meta.url,
);

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const watchStartOrder: string[] = [];

async function withWindow<T>(value: Window & typeof globalThis, operation: () => Promise<T>): Promise<T> {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
  });

  try {
    return await operation();
  } finally {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
}

const {
  BirdCoderTauriFileSystemRuntimeError,
  createBirdCoderTauriFileSystemRuntime,
} = await import(
  `${tauriFileSystemRuntimeModulePath.href}?t=${Date.now()}`
);

await withWindow(
  {
    __TAURI_INTERNALS__: {
      async invoke(command: string, payload: Record<string, unknown>) {
        watchStartOrder.push(command);
        if (command === 'fs_watch_start') {
          assert.deepEqual(payload, {
            rootPath: 'D:/workspace/sample-app',
          });
          return {
            watchId: 'fs-watch-1',
          };
        }

        if (command === 'fs_watch_stop') {
          assert.deepEqual(payload, {
            watchId: 'fs-watch-1',
          });
          return null;
        }

        throw new Error(`Unexpected command: ${command}`);
      },
      event: {
        async listen(
          eventName: string,
          listener: (event: { payload: unknown }) => void,
        ): Promise<() => void> {
          watchStartOrder.push('listen');
          assert.equal(
            eventName,
            'birdcoder:file-system-watch',
            'desktop file-system watcher runtime must listen to the dedicated file-system watch event channel.',
          );

          listener({
            payload: {
              watchId: 'fs-watch-1',
              kind: 'modify',
              paths: ['/sample-app/src/index.ts'],
            },
          });

          return () => undefined;
        },
      },
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    const runtime = createBirdCoderTauriFileSystemRuntime();
    assert.equal(
      typeof runtime.watchProjectTree,
      'function',
      'desktop file-system runtime must expose watcher subscriptions so Tauri projects can avoid fixed interval polling.',
    );

    const events: Array<{ kind: string; paths: string[] }> = [];
    const dispose = await runtime.watchProjectTree('D:/workspace/sample-app', (event) => {
      events.push({
        kind: event.kind,
        paths: [...event.paths],
      });
    });

    assert.deepEqual(events, [
      {
        kind: 'modify',
        paths: ['/sample-app/src/index.ts'],
      },
    ]);

    assert.deepEqual(
      watchStartOrder.slice(0, 2),
      ['listen', 'fs_watch_start'],
      'The event listener must be active before the native watcher starts so initial changes are buffered instead of lost.',
    );
    await dispose();
    await dispose();
    assert.equal(
      watchStartOrder.filter(
        (entry) => entry === 'fs_watch_stop',
      ).length,
      1,
      'Watcher disposal must be idempotent.',
    );
  },
);

let invalidRegistrationUnlistenCalls = 0;
let invalidRegistrationStopCalls = 0;
await withWindow(
  {
    __TAURI_INTERNALS__: {
      async invoke(command: string, payload: Record<string, unknown>) {
        if (command === 'fs_watch_start') {
          return { watchId: 'D:/private/invalid-watch-id' };
        }
        if (command === 'fs_watch_stop') {
          invalidRegistrationStopCalls += 1;
          assert.deepEqual(payload, { watchId: 'D:/private/invalid-watch-id' });
          return null;
        }
        throw new Error(`Unexpected command: ${command}`);
      },
      event: {
        async listen(): Promise<() => void> {
          return () => {
            invalidRegistrationUnlistenCalls += 1;
          };
        },
      },
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    const runtime = createBirdCoderTauriFileSystemRuntime();
    await assert.rejects(
      () => runtime.watchProjectTree('D:/workspace/sample-app', () => undefined),
      (error: unknown) =>
        error instanceof BirdCoderTauriFileSystemRuntimeError
        && error.operation === 'fs_watch_start'
        && !error.message.includes('D:/private'),
    );
  },
);
assert.equal(invalidRegistrationUnlistenCalls, 1);
assert.equal(invalidRegistrationStopCalls, 1);

console.log('tauri file system watch contract passed.');
