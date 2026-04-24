import assert from 'node:assert/strict';

const bootstrapServerBaseUrlModulePath = new URL(
  '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapServerBaseUrl.ts',
  import.meta.url,
);

const localStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return localStore.has(key) ? localStore.get(key)! : null;
      },
      key(index: number) {
        return [...localStore.keys()][index] ?? null;
      },
      get length() {
        return localStore.size;
      },
      removeItem(key: string) {
        localStore.delete(key);
      },
      setItem(key: string, value: string) {
        localStore.set(key, value);
      },
    },
  },
});

try {
  const {
    readStoredBirdCoderServerBaseUrl,
    resolveBirdCoderBootstrapServerBaseUrl,
  } = await import(`${bootstrapServerBaseUrlModulePath.href}?t=${Date.now()}`);

  localStore.set(
    'sdkwork-birdcoder:settings:app',
    JSON.stringify({
      serverBaseUrl: '  https://user.example.com/birdcoder-api  ',
    }),
  );

  assert.equal(
    await readStoredBirdCoderServerBaseUrl(),
    'https://user.example.com/birdcoder-api',
    'bootstrap must read the persisted server Base URL override from the shared settings store.',
  );

  assert.equal(
    resolveBirdCoderBootstrapServerBaseUrl({
      configuredApiBaseUrl: 'https://env.example.com/birdcoder-api',
      runtimeApiBaseUrl: 'http://127.0.0.1:10240',
      storedApiBaseUrl: 'https://user.example.com/birdcoder-api',
    }),
    'https://user.example.com/birdcoder-api',
    'persisted user configuration must outrank runtime/env defaults so the settings center can truly override the server Base URL.',
  );

  assert.equal(
    resolveBirdCoderBootstrapServerBaseUrl({
      configuredApiBaseUrl: 'https://env.example.com/birdcoder-api',
      runtimeApiBaseUrl: 'http://127.0.0.1:10240',
      storedApiBaseUrl: '   ',
    }),
    'http://127.0.0.1:10240',
    'desktop runtime-discovered local server URL should be used when the user has not configured an override.',
  );

  assert.equal(
    resolveBirdCoderBootstrapServerBaseUrl({
      configuredApiBaseUrl: 'https://env.example.com/birdcoder-api',
      runtimeApiBaseUrl: '   ',
      storedApiBaseUrl: '',
    }),
    'https://env.example.com/birdcoder-api',
    'build-time configured API base URL should remain the final fallback when neither persisted settings nor runtime config provide an override.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('server base url bootstrap contract passed.');
