import assert from 'node:assert/strict';

const runtimeServerSessionModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts',
  import.meta.url,
);

const localStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

const sessionStorage = {
  getItem(key: string) {
    return localStore.has(key) ? localStore.get(key)! : null;
  },
  removeItem(key: string) {
    localStore.delete(key);
  },
  setItem(key: string, value: string) {
    localStore.set(key, value);
  },
};

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    sessionStorage,
  },
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: sessionStorage,
});

try {
  const runtimeSession = await import(
    `${runtimeServerSessionModulePath.href}?persistence=first-${Date.now()}`
  );

  runtimeSession.clearRuntimeServerSessionId();
  assert.throws(
    () => runtimeSession.writeRuntimeServerSessionId('session-without-authentication'),
    /requires an authenticated SDKWork IAM token bundle/u,
    'a session id without the dual IAM token bundle must fail closed instead of becoming a synthetic credential.',
  );

  runtimeSession.writeRuntimeServerTokenBundle({
    accessToken: ' access-token-before-session ',
    authToken: ' auth-token-before-session ',
  });
  assert.equal(
    runtimeSession.writeRuntimeServerSessionId('  session-after-login  '),
    'session-after-login',
    'runtime session writer must normalize and return the persisted session id.',
  );
  assert.equal(
    runtimeSession.readRuntimeServerSessionId(),
    'session-after-login',
    'runtime session reader must recover the normalized SDKWork IAM session id.',
  );

  runtimeSession.writeRuntimeServerTokenBundle({
    accessToken: ' access-token ',
    authToken: ' auth-token ',
    refreshToken: ' refresh-token ',
    sessionToken: ' session-token ',
  });

  assert.deepEqual(
    runtimeSession.readRuntimeServerTokenBundle(),
    {
      accessToken: 'access-token',
      authToken: 'auth-token',
      refreshToken: 'refresh-token',
      sessionToken: 'session-token',
      tokenType: 'Bearer',
    },
    'runtime token store must persist the canonical SDKWork IAM auth/access token bundle.',
  );

  assert.deepEqual(
    runtimeSession.resolveRuntimeServerSessionHeaders(),
    {
      Authorization: 'Bearer auth-token',
      'Access-Token': 'access-token',
    },
    'generated SDK transports must receive canonical SDKWork IAM auth/access headers without forbidden client identity projection headers.',
  );

  localStore.clear();
  runtimeSession.clearRuntimeServerSessionId();
  runtimeSession.writeRuntimeServerTokenBundle({
    accessToken: ' access-token-before-quota ',
    authToken: ' auth-token-before-quota ',
  });
  const quotaFailingSessionStorage = {
    getItem(key: string) {
      return localStore.has(key) ? localStore.get(key)! : null;
    },
    removeItem(key: string) {
      localStore.delete(key);
    },
    setItem() {
      throw new DOMException('simulated quota exhaustion', 'QuotaExceededError');
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: quotaFailingSessionStorage,
    },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: quotaFailingSessionStorage,
  });

  assert.equal(
    runtimeSession.writeRuntimeServerSessionId(' session-after-quota '),
    'session-after-quota',
    'runtime session writer must not fail when browser storage quota is exhausted.',
  );
  assert.equal(
    runtimeSession.readRuntimeServerSessionId(),
    'session-after-quota',
    'runtime session reader must preserve the in-memory session for the current startup when durable storage rejects writes.',
  );
  assert.equal(
    runtimeSession.readRuntimeServerSessionId(),
    'session-after-quota',
    'in-memory runtime session must be preserved after a durable storage quota failure.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }

  if (originalSessionStorageDescriptor) {
    Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
}

console.log('runtime server session persistence contract passed.');
