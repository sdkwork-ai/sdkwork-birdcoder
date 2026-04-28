import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const localStorePath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'storage',
  'localStore.ts',
);
const dataKernelPath = path.join(
  rootDir,
  'packages',
  'sdkwork-birdcoder-commons',
  'src',
  'storage',
  'dataKernel.ts',
);

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem() {
        throw new Error('blocked getItem');
      },
      setItem() {
        throw new Error('blocked setItem');
      },
      removeItem() {
        throw new Error('blocked removeItem');
      },
    },
  },
});

try {
  const localStoreModule = await import(`${pathToFileURL(localStorePath).href}?t=${Date.now()}`);
  const dataKernelModule = await import(`${pathToFileURL(dataKernelPath).href}?t=${Date.now()}`);

  assert.equal(await localStoreModule.getStoredRawValue('studio-preview', 'demo'), null);
  await assert.doesNotReject(() => localStoreModule.setStoredRawValue('studio-preview', 'demo', 'value'));
  await assert.doesNotReject(() => localStoreModule.removeStoredValue('studio-preview', 'demo'));

  const fallbackLocalStore = new Map();
  const invokedCommands = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        async invoke(command) {
          invokedCommands.push(command);
          throw new Error(`${command} bridge is not ready yet`);
        },
      },
      localStorage: {
        getItem(key) {
          return fallbackLocalStore.get(key) ?? null;
        },
        key(index) {
          return [...fallbackLocalStore.keys()][index] ?? null;
        },
        get length() {
          return fallbackLocalStore.size;
        },
        removeItem(key) {
          fallbackLocalStore.delete(key);
        },
        setItem(key, value) {
          fallbackLocalStore.set(key, value);
        },
      },
    },
  });

  await assert.doesNotReject(() =>
    localStoreModule.setStoredRawValue('workbench', 'recovery-context', 'desktop-fallback'),
  );
  assert.equal(
    await localStoreModule.getStoredRawValue('workbench', 'recovery-context'),
    'desktop-fallback',
    'local-store runtime must fall back to browser storage when the desktop local_store bridge is temporarily unavailable.',
  );
  assert.deepEqual(
    await localStoreModule.listStoredRawValues('workbench'),
    [
      {
        key: 'recovery-context',
        scope: 'workbench',
        updatedAt: null,
        value: 'desktop-fallback',
      },
    ],
    'local-store list fallback must keep startup inventories available when the desktop local_store bridge is unavailable.',
  );
  await localStoreModule.removeStoredValue('workbench', 'recovery-context');
  assert.equal(await localStoreModule.getStoredRawValue('workbench', 'recovery-context'), null);

  await localStoreModule.setStoredRawValue('workspace', 'table.sqlite.projects.v1', 'reserved');
  assert.equal(
    fallbackLocalStore.has('sdkwork-birdcoder:workspace:table.sqlite.projects.v1'),
    false,
    'Tauri local_store failures must not fall back to browser storage for reserved table authority keys.',
  );

  await assert.doesNotReject(() =>
    dataKernelModule.writeUserHomeTextFile('.sdkwork/birdcoder/code-engine-models.json', 'model-config'),
  );
  assert.equal(
    await dataKernelModule.readUserHomeTextFile('.sdkwork/birdcoder/code-engine-models.json'),
    'model-config',
    'user-home model config must fall back to local-store storage when the desktop user_home_config bridge is unavailable.',
  );
  assert.ok(
    invokedCommands.includes('local_store_get') &&
      invokedCommands.includes('local_store_set') &&
      invokedCommands.includes('local_store_list') &&
      invokedCommands.includes('local_store_delete') &&
      invokedCommands.includes('user_home_config_read') &&
      invokedCommands.includes('user_home_config_write'),
    'The fallback contract must exercise every desktop storage bridge command.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
}

console.log('local store browser fallback contract passed.');
