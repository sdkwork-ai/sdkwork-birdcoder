import assert from 'node:assert/strict';
import fs from 'node:fs';

const rootPackageJsonPath = new URL('../package.json', import.meta.url);
const workspaceLockPath = new URL('../pnpm-lock.yaml', import.meta.url);
const commonsIndexPath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/index.ts',
  import.meta.url,
);
const tauriShellModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/platform/tauriShell.ts',
  import.meta.url,
);
const sourcePaths = [
  '../packages/sdkwork-birdcoder-code/src/pages/useCodeWorkbenchCommands.ts',
  '../packages/sdkwork-birdcoder-studio/src/pages/useStudioWorkbenchEventBindings.ts',
  '../packages/sdkwork-birdcoder-shell/src/application/app/BirdcoderApp.tsx',
];

const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const workspaceLockSource = fs.readFileSync(workspaceLockPath, 'utf8');
const commonsIndexSource = fs.readFileSync(commonsIndexPath, 'utf8');
const tauriShellSource = fs.existsSync(tauriShellModulePath)
  ? fs.readFileSync(tauriShellModulePath, 'utf8')
  : '';

assert.equal(
  rootPackageJson.dependencies?.['@tauri-apps/plugin-shell'],
  undefined,
  'The root package must not depend on @tauri-apps/plugin-shell once shell open uses the stable @tauri-apps/api/core invoke bridge directly.',
);
assert.doesNotMatch(
  workspaceLockSource,
  /@tauri-apps\/plugin-shell/u,
  'The lockfile must not retain @tauri-apps/plugin-shell after runtime code stops importing the package entry.',
);
assert.match(
  commonsIndexSource,
  /export \* from '\.\/platform\/tauriShell\.ts';/u,
  'Commons must export the shared Tauri shell-open helper so code, studio, and shell surfaces do not duplicate plugin invoke details.',
);
assert.match(
  tauriShellSource,
  /plugin:shell\|open/u,
  'The shared shell-open helper must call the registered Tauri shell plugin command directly.',
);
assert.match(
  tauriShellSource,
  /with:\s*openWith/u,
  'The shared shell-open helper must preserve the official plugin-shell openWith payload field.',
);

for (const relativeSourcePath of sourcePaths) {
  const source = fs.readFileSync(new URL(relativeSourcePath, import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /@tauri-apps\/plugin-shell/u,
    `${relativeSourcePath} must not import @tauri-apps/plugin-shell because Vite statically resolves literal dynamic imports and broken local package contents block startup before runtime branching.`,
  );
  assert.match(
    source,
    /openTauriShellPath/u,
    `${relativeSourcePath} must use the shared openTauriShellPath helper.`,
  );
}

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

const { openTauriShellPath } = await import(`${tauriShellModulePath.href}?t=${Date.now()}`);

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
    assert.equal(
      await openTauriShellPath('   '),
      false,
      'The shared shell-open helper must reject empty paths before invoking the Tauri shell plugin.',
    );
    assert.equal(emptyPathInvokeCalls, 0);
  },
);

let invokeCalls = 0;
await withWindow(
  {
    __TAURI_INTERNALS__: {
      async invoke(command: string, payload: Record<string, unknown>) {
        invokeCalls += 1;
        assert.equal(command, 'plugin:shell|open');
        assert.deepEqual(payload, {
          path: 'D:/workspace/project',
          with: 'code',
        });
      },
    },
  } as unknown as Window & typeof globalThis,
  async () => {
    assert.equal(await openTauriShellPath('D:/workspace/project', 'code'), true);
    assert.equal(invokeCalls, 1);
  },
);

await withWindow({} as Window & typeof globalThis, async () => {
  assert.equal(
    await openTauriShellPath('D:/workspace/browser-project'),
    false,
    'The shared shell-open helper must report false outside Tauri so callers can keep their browser fallback UX.',
  );
});

console.log('tauri shell open runtime contract passed.');
