import assert from 'node:assert/strict';

const openLocalFolderModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/platform/openLocalFolder.ts',
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

const { openLocalFolder } = await import(`${openLocalFolderModulePath.href}?t=${Date.now()}`);

let desktopBrowserPickerCalls = 0;
await withWindow(
  {
    __TAURI__: {},
    __TAURI_INTERNALS__: {
      async invoke(command: string, payload: { options?: Record<string, unknown> }) {
        assert.equal(
          command,
          'plugin:dialog|open',
          'desktop folder import must route through the Tauri dialog plugin.',
        );
        assert.equal(payload.options?.directory, true);
        assert.equal(payload.options?.multiple, false);
        return 'D:/workspace/desktop-project';
      },
    },
    showDirectoryPicker: async () => {
      desktopBrowserPickerCalls += 1;
      return { name: 'browser-should-not-run' } as FileSystemDirectoryHandle;
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    const selectedFolder = await openLocalFolder();
    assert.equal(
      desktopBrowserPickerCalls,
      0,
      'desktop folder import must bypass browser directory permission prompts entirely.',
    );
    assert.deepEqual(selectedFolder, {
      type: 'tauri',
      path: 'D:/workspace/desktop-project',
    });
  },
);

let desktopInternalsOnlyBrowserPickerCalls = 0;
await withWindow(
  {
    __TAURI_INTERNALS__: {
      async invoke(command: string, payload: { options?: Record<string, unknown> }) {
        assert.equal(
          command,
          'plugin:dialog|open',
          'desktop folder import must detect Tauri v2 runtimes even when window.__TAURI__ is absent.',
        );
        assert.equal(payload.options?.directory, true);
        assert.equal(payload.options?.multiple, false);
        return 'D:/workspace/desktop-project-from-internals';
      },
    },
    showDirectoryPicker: async () => {
      desktopInternalsOnlyBrowserPickerCalls += 1;
      return { name: 'browser-should-not-run' } as FileSystemDirectoryHandle;
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    const selectedFolder = await openLocalFolder();
    assert.equal(
      desktopInternalsOnlyBrowserPickerCalls,
      0,
      'desktop folder import must not fall back to the browser permission prompt just because only __TAURI_INTERNALS__ is available.',
    );
    assert.deepEqual(selectedFolder, {
      type: 'tauri',
      path: 'D:/workspace/desktop-project-from-internals',
    });
  },
);

let desktopFailureFallbackBrowserPickerCalls = 0;
const originalConsoleError = console.error;
await withWindow(
  {
    __TAURI_INTERNALS__: {
      async invoke() {
        throw new Error('dialog bridge failed');
      },
    },
    showDirectoryPicker: async () => {
      desktopFailureFallbackBrowserPickerCalls += 1;
      return { name: 'browser-should-not-run-after-tauri-failure' } as FileSystemDirectoryHandle;
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    console.error = () => {};
    try {
      await assert.rejects(
        () => openLocalFolder(),
        /dialog bridge failed/u,
        'desktop folder import must surface native dialog failures instead of silently falling back to browser authorization prompts.',
      );
      assert.equal(
        desktopFailureFallbackBrowserPickerCalls,
        0,
        'desktop folder import must not trigger browser folder authorization after a Tauri dialog failure.',
      );
    } finally {
      console.error = originalConsoleError;
    }
  },
);

let browserPickerCalls = 0;
await withWindow(
  {
    showDirectoryPicker: async () => {
      browserPickerCalls += 1;
      return { name: 'browser-project' } as FileSystemDirectoryHandle;
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    const selectedFolder = await openLocalFolder();
    assert.equal(browserPickerCalls, 1);
    assert.deepEqual(selectedFolder, {
      type: 'browser',
      handle: { name: 'browser-project' },
    });
  },
);

console.log('open local folder runtime contract passed.');
