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
    vipLevelId: '1',
    pointBalance: '101777208078558101',
    totalRechargedPoints: '101777208078558103',
    validTo: '2026-06-01',
    status: 'active',
  });
  const storedMembership = await userStorage.readBirdCoderVipMembership();
  assert.equal(storedMembership.vipLevelId, '1');
  assert.equal(
    storedMembership.pointBalance,
    '101777208078558101',
    'VIP pointBalance maps to Java Long/BIGINT and must remain an exact decimal string.',
  );
  assert.equal(
    storedMembership.totalRechargedPoints,
    '101777208078558103',
    'VIP totalRechargedPoints maps to Java Long/BIGINT and must remain an exact decimal string.',
  );
  await assert.rejects(
    () =>
      userStorage.writeBirdCoderVipMembership({
        pointBalance: Number('101777208078558101'),
        totalRechargedPoints: '0',
        status: 'active',
      }),
    /unsafe JavaScript number/u,
    'VIP Long/BIGINT fields must reject unsafe JavaScript numbers instead of falling back to zero.',
  );
  assert.equal(userStorage.getBirdCoderVipMembershipRepository().binding.entityName, 'vip_user');
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
}

console.log('birdcoder user storage contract passed.');
