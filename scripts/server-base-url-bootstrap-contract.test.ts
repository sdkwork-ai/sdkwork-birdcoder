import assert from 'node:assert/strict';

const bootstrapServerBaseUrlModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapServerBaseUrl.ts',
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
    resolveBirdCoderBrowserServerBaseUrl,
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

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        async invoke() {
          throw new Error('local_store_get bridge is not ready yet');
        },
      },
      localStorage: {
        getItem(key: string) {
          return localStore.has(key) ? localStore.get(key)! : null;
        },
      },
    },
  });

  assert.equal(
    await readStoredBirdCoderServerBaseUrl(),
    'https://user.example.com/birdcoder-api',
    'bootstrap must fall back to browser storage when the desktop local_store bridge is temporarily unavailable.',
  );

  assert.equal(
    resolveBirdCoderBootstrapServerBaseUrl({
      configuredApiBaseUrl: 'https://env.example.com/birdcoder-api',
      runtimeApiBaseUrl: 'http://127.0.0.1:65172',
      storedApiBaseUrl: 'https://user.example.com/birdcoder-api',
    }),
    'http://127.0.0.1:65172',
    'the runtime-discovered desktop URL must outrank persisted settings so a new desktop process never reuses an expired ephemeral port.',
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

  assert.equal(
    resolveBirdCoderBrowserServerBaseUrl('http://127.0.0.1:10240', {
      browserLocationUrl: 'http://192.168.31.108:3001/app/code',
    }),
    'http://192.168.31.108:10240',
    'a remote browser must address the API through the web server host instead of its own loopback interface.',
  );

  assert.equal(
    resolveBirdCoderBrowserServerBaseUrl('http://localhost:10240/birdcoder-gateway', {
      browserLocationUrl: 'http://10.42.0.18:3001/',
    }),
    'http://10.42.0.18:10240/birdcoder-gateway',
    'LAN host substitution must preserve the configured API port and path across different private subnets.',
  );

  assert.equal(
    resolveBirdCoderBrowserServerBaseUrl('http://127.0.0.1:10240', {
      browserLocationUrl: 'http://192.168.31.108:3001/',
      preferSameOrigin: true,
    }),
    'http://192.168.31.108:3001',
    'development browser requests should use the Vite same-origin proxy boundary.',
  );

  assert.equal(
    resolveBirdCoderBrowserServerBaseUrl(undefined, {
      browserLocationUrl: 'http://192.168.31.108:3001/app/code',
      preferSameOrigin: true,
    }),
    'http://192.168.31.108:3001',
    'development browser requests must default to the same-origin proxy when API origins are intentionally removed from the public runtime environment.',
  );

  assert.equal(
    resolveBirdCoderBrowserServerBaseUrl('https://api.example.com/birdcoder', {
      browserLocationUrl: 'http://192.168.31.108:3001/',
    }),
    'https://api.example.com/birdcoder',
    'an explicit non-local API authority must never be rewritten.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

console.log('server base url bootstrap contract passed.');
