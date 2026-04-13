import assert from 'node:assert/strict';
const mockAuthServicePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/MockAuthService.ts',
  import.meta.url,
);

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

if (originalWindowDescriptor) {
  delete globalThis.window;
}
if (originalLocalStorageDescriptor) {
  delete globalThis.localStorage;
}

try {
  const { MockAuthService } = await import(`${mockAuthServicePath.href}?t=${Date.now()}`);
  const authService = new MockAuthService();
  const user = await authService.login('birdcoder@example.com');
  assert.equal(user.email, 'birdcoder@example.com');
  assert.equal((await authService.getCurrentUser())?.email, 'birdcoder@example.com');
  await assert.doesNotReject(() => authService.logout());
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  }
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDescriptor);
  }
}

console.log('mock auth storage contract passed.');
