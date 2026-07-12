import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readBirdcoderAppShellSource } from './birdcoder-app-shell-contract-sources.mjs';

const rootPackageJsonPath = new URL('../package.json', import.meta.url);
const workspaceLockPath = new URL('../pnpm-lock.yaml', import.meta.url);
const commonsIndexPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/index.ts',
  import.meta.url,
);
const tauriFileManagerModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/platform/tauriFileManager.ts',
  import.meta.url,
);
const sourcePaths = [
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts',
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/useStudioWorkbenchEventBindings.ts',
];

const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const workspaceLockSource = fs.readFileSync(workspaceLockPath, 'utf8');
const commonsIndexSource = fs.readFileSync(commonsIndexPath, 'utf8');
const tauriFileManagerSource = fs.existsSync(tauriFileManagerModulePath)
  ? fs.readFileSync(tauriFileManagerModulePath, 'utf8')
  : '';

assert.equal(
  rootPackageJson.dependencies?.['@tauri-apps/plugin-shell'],
  undefined,
  'The root package must not depend on @tauri-apps/plugin-shell once local path reveal uses a typed application command.',
);
assert.doesNotMatch(
  workspaceLockSource,
  /@tauri-apps\/plugin-shell/u,
  'The lockfile must not retain the JavaScript plugin-shell package after local path reveal moves behind a typed command.',
);
assert.match(
  commonsIndexSource,
  /export \* from '\.\/platform\/tauriFileManager\.ts';/u,
  'Commons must export the shared Tauri file-manager helper.',
);
assert.match(
  tauriFileManagerSource,
  /desktop_reveal_in_file_manager/u,
  'The shared file-manager helper must call the typed BirdCoder reveal command.',
);
assert.doesNotMatch(
  tauriFileManagerSource,
  /plugin:shell\|open|openWith|\bwith:/u,
  'The shared file-manager helper must not expose the generic shell-open command or an arbitrary application selector.',
);

for (const relativeSourcePath of sourcePaths) {
  const source = fs.readFileSync(new URL(relativeSourcePath, import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /@tauri-apps\/plugin-shell/u,
    `${relativeSourcePath} must not import @tauri-apps/plugin-shell.`,
  );
  assert.doesNotMatch(
    source,
    /(?:globalEventBus\.on\(['"]revealInExplorer['"]|revealTauriPathInFileManager|openTauriShellPath)/u,
    `${relativeSourcePath} must not register a second reveal-in-file-manager owner.`,
  );
}

const birdcoderAppShellSource = readBirdcoderAppShellSource();
assert.doesNotMatch(
  birdcoderAppShellSource,
  /@tauri-apps\/plugin-shell/u,
  'BirdCoder app shell must not import @tauri-apps/plugin-shell.',
);
assert.match(
  birdcoderAppShellSource,
  /revealTauriPathInFileManager/u,
  'BirdCoder app shell must use the shared typed file-manager helper.',
);
assert.equal(
  (birdcoderAppShellSource.match(/globalEventBus\.on\(['"]revealInExplorer['"]/gu) ?? []).length,
  1,
  'BirdCoder app shell must be the single reveal-in-file-manager event owner.',
);

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

async function withWindow<T>(
  value: Window & typeof globalThis,
  operation: () => Promise<T>,
): Promise<T> {
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

const { revealTauriPathInFileManager } = await import(
  `${tauriFileManagerModulePath.href}?t=${Date.now()}`
);

let emptyPathInvokeCalls = 0;
await withWindow(
  {
    __TAURI_INTERNALS__: {
      async invoke() {
        emptyPathInvokeCalls += 1;
      },
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    assert.equal(await revealTauriPathInFileManager('   '), false);
    assert.equal(emptyPathInvokeCalls, 0);
  },
);

let invokeCalls = 0;
await withWindow(
  {
    __TAURI_INTERNALS__: {
      async invoke(command: string, payload: Record<string, unknown>) {
        invokeCalls += 1;
        assert.equal(command, 'desktop_reveal_in_file_manager');
        assert.deepEqual(payload, { path: 'D:/workspace/project' });
      },
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    assert.equal(await revealTauriPathInFileManager('D:/workspace/project'), true);
    assert.equal(invokeCalls, 1);
  },
);

await withWindow({} as Window & typeof globalThis, async () => {
  assert.equal(
    await revealTauriPathInFileManager('D:/workspace/browser-project'),
    false,
    'The helper must report false outside Tauri so callers can preserve browser fallback UX.',
  );
});

console.log('typed Tauri file-manager reveal runtime contract passed.');
