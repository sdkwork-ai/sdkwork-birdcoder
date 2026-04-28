import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
} from '../packages/sdkwork-birdcoder-core/src/userCenterSession.ts';

const runtimeServerSessionModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/runtimeServerSession.ts',
  import.meta.url,
);
const runtimeBridgeSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-infrastructure/src/services/userCenterRuntimeBridge.ts', import.meta.url),
  'utf8',
);

const localStore = new Map<string, string>();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

const localStorage = {
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
    localStorage,
  },
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorage,
});

try {
  const firstRuntimeSession = await import(
    `${runtimeServerSessionModulePath.href}?persistence=first-${Date.now()}`
  );

  localStore.set(
    BIRDCODER_USER_CENTER_STORAGE_PLAN.refreshTokenKey,
    'stale-refresh-token',
  );

  assert.equal(
    firstRuntimeSession.writeRuntimeServerSessionId('  session-after-login  '),
    'session-after-login',
    'runtime session writer must normalize and return the persisted session id.',
  );
  assert.equal(
    localStore.get(BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionTokenKey),
    'session-after-login',
    'login must persist the runtime session id to durable user-center storage, not only an in-memory token cache.',
  );
  assert.equal(
    localStore.get(BIRDCODER_USER_CENTER_STORAGE_PLAN.refreshTokenKey),
    undefined,
    'a new login session must clear stale refresh tokens from a previous identity.',
  );

  const secondRuntimeSession = await import(
    `${runtimeServerSessionModulePath.href}?persistence=second-${Date.now()}`
  );

  assert.equal(
    secondRuntimeSession.readRuntimeServerSessionId(),
    'session-after-login',
    'a freshly imported runtime session module must recover the login session id after an app refresh.',
  );
  assert.equal(
    secondRuntimeSession.resolveRuntimeServerSessionHeaders()[
      BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionHeaderName
    ],
    'session-after-login',
    'refreshed API clients must keep sending the recovered runtime session id header.',
  );

  assert.match(
    runtimeBridgeSource,
    /tokenStore:\s*runtimeClientOptions\.tokenStore\s*\?\?\s*createRuntimeServerTokenStore\(\)/,
    'the canonical user-center runtime client must share the durable BirdCoder runtime token store so profile refreshes cannot migrate the token out of the auth bootstrap reader.',
  );

  localStore.clear();
  const quotaFailingLocalStorage = {
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
      localStorage: quotaFailingLocalStorage,
    },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: quotaFailingLocalStorage,
  });

  const quotaRuntimeSession = await import(
    `${runtimeServerSessionModulePath.href}?persistence=quota-${Date.now()}`
  );
  assert.equal(
    quotaRuntimeSession.writeRuntimeServerSessionId(' session-after-quota '),
    'session-after-quota',
    'runtime session writer must not fail when browser storage quota is exhausted.',
  );
  assert.equal(
    quotaRuntimeSession.readRuntimeServerSessionId(),
    'session-after-quota',
    'runtime session reader must preserve the in-memory session for the current startup when durable storage rejects writes.',
  );
  assert.equal(
    quotaRuntimeSession.resolveRuntimeServerSessionHeaders()[
      BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionHeaderName
    ],
    'session-after-quota',
    'API headers must continue to include the in-memory runtime session after a durable storage quota failure.',
  );

  localStore.clear();
  localStore.set(
    BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionTokenKey,
    'session-before-failed-clear',
  );
  const clearFailingLocalStorage = {
    getItem(key: string) {
      return localStore.has(key) ? localStore.get(key)! : null;
    },
    removeItem() {
      throw new DOMException('simulated blocked storage removal', 'SecurityError');
    },
    setItem(key: string, value: string) {
      localStore.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: clearFailingLocalStorage,
    },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: clearFailingLocalStorage,
  });

  const clearRuntimeSession = await import(
    `${runtimeServerSessionModulePath.href}?persistence=clear-${Date.now()}`
  );
  assert.equal(
    clearRuntimeSession.readRuntimeServerSessionId(),
    'session-before-failed-clear',
    'the failed-clear fixture must start with a durable session token.',
  );
  clearRuntimeSession.clearRuntimeServerSessionId();
  assert.equal(
    clearRuntimeSession.readRuntimeServerSessionId(),
    null,
    'clearing the runtime session must not resurrect a stale durable token when storage removal fails.',
  );
  assert.equal(
    clearRuntimeSession.resolveRuntimeServerSessionHeaders()[
      BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionHeaderName
    ],
    undefined,
    'API headers must remain cleared after logout even when durable storage removal fails.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }

  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

console.log('runtime server session persistence contract passed.');
