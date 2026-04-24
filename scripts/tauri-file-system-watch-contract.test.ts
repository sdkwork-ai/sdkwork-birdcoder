import assert from 'node:assert/strict';

const tauriFileSystemRuntimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/platform/tauriFileSystemRuntime.ts',
  import.meta.url,
);

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

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

const { createBirdCoderTauriFileSystemRuntime } = await import(
  `${tauriFileSystemRuntimeModulePath.href}?t=${Date.now()}`
);

await withWindow(
  {
    __TAURI_INTERNALS__: {
      async invoke(command: string, payload: Record<string, unknown>) {
        if (command === 'fs_watch_start') {
          assert.deepEqual(payload, {
            rootPath: 'D:/workspace/sample-app',
          });
          return {
            watchId: 'watch-sample',
          };
        }

        if (command === 'fs_watch_stop') {
          assert.deepEqual(payload, {
            watchId: 'watch-sample',
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
          assert.equal(
            eventName,
            'birdcoder:file-system-watch',
            'desktop file-system watcher runtime must listen to the dedicated file-system watch event channel.',
          );

          listener({
            payload: {
              watchId: 'watch-sample',
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

    await dispose();
  },
);

console.log('tauri file system watch contract passed.');
