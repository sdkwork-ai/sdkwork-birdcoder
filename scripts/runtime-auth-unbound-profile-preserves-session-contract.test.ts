import assert from 'node:assert/strict';

const runtimeAuthModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeAuthService.ts',
  import.meta.url,
);
const runtimeConfigModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesRuntime.ts',
  import.meta.url,
);
const runtimeSessionModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/runtimeServerSession.ts',
  import.meta.url,
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
  const runtimeConfigModule = await import(
    `${runtimeConfigModulePath.href}?unbound-runtime=${Date.now()}`
  );
  const runtimeSessionModule = await import(
    `${runtimeSessionModulePath.href}?unbound-runtime=${Date.now()}`
  );
  const runtimeAuthModule = await import(
    `${runtimeAuthModulePath.href}?unbound-runtime=${Date.now()}`
  );

  runtimeConfigModule.resetDefaultBirdCoderIdeServicesRuntimeForTests();

  runtimeSessionModule.writeRuntimeServerSessionId('session-before-runtime-binding');
  const authService = runtimeAuthModule.createBirdCoderRuntimeAuthService();

  assert.equal(
    await authService.getCurrentUser(),
    null,
    'getCurrentUser should remain unauthenticated while the runtime user-center binding is unavailable.',
  );
  assert.equal(
    runtimeSessionModule.readRuntimeServerSessionId(),
    'session-before-runtime-binding',
    'an unavailable runtime profile client must not clear the durable session token because user-center metadata can bind the runtime later in the same bootstrap pass.',
  );

  await authService.logout();
  assert.equal(
    runtimeSessionModule.readRuntimeServerSessionId(),
    null,
    'logout must still clear the local durable session without surfacing a runtime-binding error when no remote logout endpoint is available yet.',
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

console.log('runtime auth unbound profile session preservation contract passed.');
