import assert from 'node:assert/strict';
import fs from 'node:fs';

const userStoragePath = new URL(
  '../packages/sdkwork-birdcoder-user/src/storage.ts',
  import.meta.url,
);
const userIndexPath = new URL(
  '../packages/sdkwork-birdcoder-user/src/index.ts',
  import.meta.url,
);
const userProfileStoragePath = new URL(
  '../packages/sdkwork-birdcoder-user/src/profileStorage.ts',
  import.meta.url,
);
const workbenchUserProfileStatePath = new URL(
  '../packages/sdkwork-birdcoder-workbench-state/src/userProfileState.ts',
  import.meta.url,
);
const workbenchStateIndexPath = new URL(
  '../packages/sdkwork-birdcoder-workbench-state/src/index.ts',
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
  const userStorageSource = fs.readFileSync(userStoragePath, 'utf8');
  const userIndexSource = fs.readFileSync(userIndexPath, 'utf8');
  const workbenchStateIndexSource = fs.readFileSync(workbenchStateIndexPath, 'utf8');

  assert.equal(
    fs.existsSync(userProfileStoragePath),
    false,
    'BirdCoder user package must not retain a local profile/VIP storage module after appbase IAM integration.',
  );
  assert.equal(
    fs.existsSync(workbenchUserProfileStatePath),
    false,
    'Workbench state must not retain duplicate IAM profile/VIP repository state.',
  );

  assert.equal(typeof userStorage.createBirdCoderRuntimeUserCenterClient, 'function');
  assert.equal(userStorage.getBirdCoderUserProfileRepository, undefined);
  assert.equal(userStorage.getBirdCoderVipMembershipRepository, undefined);
  assert.equal(userStorage.readBirdCoderUserProfile, undefined);
  assert.equal(userStorage.writeBirdCoderUserProfile, undefined);
  assert.equal(userStorage.readBirdCoderVipMembership, undefined);
  assert.equal(userStorage.writeBirdCoderVipMembership, undefined);

  for (const source of [userStorageSource, userIndexSource, workbenchStateIndexSource]) {
    assert.doesNotMatch(
      source,
      /profileStorage|getBirdCoderUserProfileRepository|getBirdCoderVipMembershipRepository|readBirdCoderUserProfile|writeBirdCoderUserProfile|readBirdCoderVipMembership|writeBirdCoderVipMembership/u,
      'BirdCoder must not expose retired local IAM profile/VIP storage APIs.',
    );
  }

  assert.deepEqual(
    Array.from(backingStore.keys()),
    [],
    'Importing BirdCoder user storage must not create local IAM profile/VIP records.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete globalThis.window;
  }
}

console.log('birdcoder retired user storage contract passed.');
