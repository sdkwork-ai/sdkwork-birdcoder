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
        assert.equal(
          command,
          'fs_snapshot_folder',
          'desktop file-system runtime must use the Tauri host bridge for mounted folder snapshots.',
        );
        assert.deepEqual(payload, {
          rootPath: 'D:/workspace/sample-app',
        });
        return {
          rootVirtualPath: '/sample-app',
          tree: {
            name: 'sample-app',
            type: 'directory',
            path: '/sample-app',
            children: [],
          },
        };
      },
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    const runtime = createBirdCoderTauriFileSystemRuntime();
    assert.deepEqual(await runtime.snapshotFolder('D:/workspace/sample-app'), {
      rootVirtualPath: '/sample-app',
      tree: {
        name: 'sample-app',
        type: 'directory',
        path: '/sample-app',
        children: [],
      },
    });
  },
);

console.log('tauri file system runtime contract passed.');
