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

  assert.equal(await localStoreModule.getStoredRawValue('studio-preview', 'demo'), null);
  await assert.doesNotReject(() => localStoreModule.setStoredRawValue('studio-preview', 'demo', 'value'));
  await assert.doesNotReject(() => localStoreModule.removeStoredValue('studio-preview', 'demo'));
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
}

console.log('local store browser fallback contract passed.');
