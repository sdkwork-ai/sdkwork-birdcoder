import assert from 'node:assert/strict';

const userStoragePath = new URL(
  '../packages/sdkwork-birdcoder-user/src/storage.ts',
  import.meta.url,
);

const backingStore = new Map();
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key) {
        return backingStore.has(key) ? backingStore.get(key) : null;
      },
      setItem(key, value) {
        backingStore.set(key, value);
      },
      removeItem(key) {
        backingStore.delete(key);
      },
    },
  },
});

try {
  const userStorage = await import(`${userStoragePath.href}?t=${Date.now()}`);

  assert.equal(typeof userStorage.getBirdCoderUserProfileRepository, 'function');
  assert.equal(typeof userStorage.getBirdCoderVipMembershipRepository, 'function');

  const defaultProfile = await userStorage.readBirdCoderUserProfile();
  assert.equal(defaultProfile.company, 'SDKWork');

  await userStorage.writeBirdCoderUserProfile({
    bio: 'Ship a provider-neutral IDE data kernel.',
    company: 'SDKWork Cloud',
    displayName: 'SDKWork Cloud',
    location: 'Shanghai',
    website: 'https://sdkwork.com/birdcoder',
  });
  const storedProfile = await userStorage.readBirdCoderUserProfile();
  assert.equal(storedProfile.company, 'SDKWork Cloud');

  await userStorage.writeBirdCoderVipMembership({
    creditsPerMonth: 2048,
    planId: 'pro',
    planTitle: 'Pro',
    renewAt: '2026-06-01',
    seats: 1,
    status: 'active',
  });
  const storedMembership = await userStorage.readBirdCoderVipMembership();
  assert.equal(storedMembership.planId, 'pro');
  assert.equal(userStorage.getBirdCoderVipMembershipRepository().binding.entityName, 'vip_subscription');
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
}

console.log('birdcoder user storage contract passed.');
