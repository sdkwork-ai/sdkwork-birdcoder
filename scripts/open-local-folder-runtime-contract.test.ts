import assert from 'node:assert/strict';
import fs from 'node:fs';

const openLocalFolderModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/platform/openLocalFolder.ts',
  import.meta.url,
);
const rootPackageJsonPath = new URL('../package.json', import.meta.url);
const infrastructurePackageJsonPath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/package.json',
  import.meta.url,
);
const workspaceCatalogPath = new URL('../pnpm-workspace.yaml', import.meta.url);
const openLocalFolderSource = fs.readFileSync(openLocalFolderModulePath, 'utf8');
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const infrastructurePackageJson = JSON.parse(
  fs.readFileSync(infrastructurePackageJsonPath, 'utf8'),
);
const workspaceCatalogSource = fs.readFileSync(workspaceCatalogPath, 'utf8');

assert.doesNotMatch(
  openLocalFolderSource,
  /@tauri-apps\/plugin-dialog/u,
  'openLocalFolder must not import @tauri-apps/plugin-dialog because Vite statically resolves literal dynamic imports and broken local package contents block startup before the Tauri runtime branch executes.',
);
assert.match(
  openLocalFolderSource,
  /desktop_pick_working_directory/u,
  'openLocalFolder must call BirdCoder desktop_pick_working_directory instead of the Tauri dialog plugin so generated desktop schemas do not expose retired dialog aliases.',
);
assert.doesNotMatch(
  openLocalFolderSource,
  /plugin:dialog\|open/u,
  'openLocalFolder must not call the Tauri dialog plugin command after folder-open moves to the BirdCoder desktop picker command.',
);
assert.equal(
  rootPackageJson.dependencies?.['@tauri-apps/plugin-dialog'],
  undefined,
  'The root package must not depend on @tauri-apps/plugin-dialog once folder-open uses the stable @tauri-apps/api/core invoke bridge directly.',
);
assert.equal(
  infrastructurePackageJson.dependencies?.['@tauri-apps/plugin-dialog'],
  undefined,
  'The infrastructure package must not depend on @tauri-apps/plugin-dialog once folder-open uses the stable @tauri-apps/api/core invoke bridge directly.',
);
assert.doesNotMatch(
  workspaceCatalogSource,
  /'@tauri-apps\/plugin-dialog':/u,
  'The workspace catalog must not retain @tauri-apps/plugin-dialog after the frontend no longer imports the package entry.',
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
      async invoke(command: string, payload: { options?: Record<string, unknown>; request?: Record<string, unknown> }) {
        assert.equal(
          command,
          'desktop_pick_working_directory',
          'desktop folder import must route through the BirdCoder desktop picker command.',
        );
        assert.equal(payload.options, undefined);
        assert.deepEqual(payload.request, {});
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
      async invoke(command: string, payload: { options?: Record<string, unknown>; request?: Record<string, unknown> }) {
        assert.equal(
          command,
          'desktop_pick_working_directory',
          'desktop folder import must detect Tauri v2 runtimes even when window.__TAURI__ is absent.',
        );
        assert.equal(payload.options, undefined);
        assert.deepEqual(payload.request, {});
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
