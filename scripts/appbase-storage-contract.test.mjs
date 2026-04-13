import assert from 'node:assert/strict';
const appbaseStoragePath = new URL(
  '../packages/sdkwork-birdcoder-appbase/src/storage.ts',
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
  const appbaseStorage = await import(`${appbaseStoragePath.href}?t=${Date.now()}`);

  assert.equal(typeof appbaseStorage.getBirdCoderUserProfileRepository, 'function');
  assert.equal(typeof appbaseStorage.getBirdCoderVipMembershipRepository, 'function');

  const userProfilePromise = appbaseStorage.readBirdCoderUserProfile();
  assert.equal(typeof userProfilePromise?.then, 'function');
  const defaultProfile = await userProfilePromise;
  assert.equal(defaultProfile.company, 'SDKWork');

  await appbaseStorage.writeBirdCoderUserProfile({
    bio: 'Ship a provider-neutral IDE data kernel.',
    company: 'SDKWork Cloud',
    location: 'Shanghai',
    website: 'https://sdkwork.com/birdcoder',
  });
  const storedProfile = await appbaseStorage.readBirdCoderUserProfile();
  assert.equal(storedProfile.company, 'SDKWork Cloud');

  await appbaseStorage.writeBirdCoderVipMembership({
    creditsPerMonth: 2048,
    planId: 'pro',
    planTitle: 'Pro',
    renewAt: '2026-06-01',
    seats: 1,
    status: 'active',
  });
  const storedMembership = await appbaseStorage.readBirdCoderVipMembership();
  assert.equal(storedMembership.planId, 'pro');
  assert.equal(appbaseStorage.getBirdCoderVipMembershipRepository().binding.entityName, 'vip_subscription');
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
}

console.log('appbase storage contract passed.');
