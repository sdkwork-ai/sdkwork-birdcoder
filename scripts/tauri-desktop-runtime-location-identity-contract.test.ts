import assert from 'node:assert/strict';

import {
  ProjectDeviceMountRegistry,
  type ProjectDeviceMountSubject,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/ProjectDeviceMountRegistry.ts';
import { TauriDesktopRuntimeLocationIdentityPort } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriDesktopRuntimeLocationIdentity.ts';

const runtimeTargetId = 'desktop-device:11111111-1111-4111-8111-111111111111';
const firstRootLocator = 'desktop-root:22222222-2222-4222-8222-222222222222';

let subject: ProjectDeviceMountSubject | null = {
  realm: 'identity-contract',
  subjectId: 'tenant-a\u0001organization-a\u0001user-a',
};
const storage = new Map<string, string>();
let rootLocatorCreateCalls = 0;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

const invoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  const key = String(args?.key ?? '');
  if (command === 'local_store_get') {
    return (storage.get(key) ?? null) as T;
  }
  if (command === 'local_store_set') {
    storage.set(key, String(args?.value ?? ''));
    return undefined as T;
  }
  if (command === 'desktop_runtime_location_install_identity') {
    return { runtimeTargetId } as T;
  }
  if (command === 'desktop_runtime_location_create_root_locator') {
    rootLocatorCreateCalls += 1;
    return firstRootLocator as T;
  }
  throw new Error(`Unexpected Tauri command: ${command}`);
};

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    __TAURI_INTERNALS__: { invoke },
  },
});

try {
  const registry = new ProjectDeviceMountRegistry({
    subjectProvider: async () => subject,
  });
  const identityPort = new TauriDesktopRuntimeLocationIdentityPort({
    mountRegistry: registry,
  });

  await registry.register('project-identity', {
    path: 'E:\\work\\identity-project',
    type: 'tauri',
  });
  const firstIdentity = await identityPort.resolveDesktopRuntimeLocationBinding({
    absolutePath: 'E:\\work\\identity-project',
    projectId: 'project-identity',
  });
  assert.deepEqual(firstIdentity, {
    displayName: 'identity-project',
    locationKind: 'local_directory',
    pathFlavor: 'windows',
    rootLocator: firstRootLocator,
    runtimeTargetId,
    runtimeTargetKind: 'desktop',
  });
  assert.equal(rootLocatorCreateCalls, 1);
  assert.equal(
    'absolutePath' in (firstIdentity ?? {}),
    false,
    'Desktop identity resolution must never return a private native path.',
  );

  const repeatedIdentity = await identityPort.resolveDesktopRuntimeLocationBinding({
    absolutePath: 'E:\\work\\identity-project',
    projectId: 'project-identity',
  });
  assert.equal(repeatedIdentity?.rootLocator, firstRootLocator);
  assert.equal(rootLocatorCreateCalls, 1, 'Root locator generation is one-time and mount-local.');

  await registry.register('project-identity', {
    path: 'E:\\work\\identity-project-moved',
    type: 'tauri',
  });
  const movedIdentity = await identityPort.resolveDesktopRuntimeLocationBinding({
    absolutePath: 'E:\\work\\identity-project-moved',
    projectId: 'project-identity',
  });
  assert.equal(movedIdentity?.rootLocator, firstRootLocator, 'Path rebind must preserve root locator.');
  assert.equal(rootLocatorCreateCalls, 1, 'Moving a local path must not rotate its opaque locator.');

  subject = {
    realm: 'identity-contract',
    subjectId: 'tenant-b\u0001organization-b\u0001user-b',
  };
  assert.equal(
    await identityPort.resolveDesktopRuntimeLocationBinding({
      absolutePath: 'E:\\work\\identity-project-moved',
      projectId: 'project-identity',
    }),
    null,
    'A different signed-in subject must not read another subject\'s local runtime binding.',
  );
} finally {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
}

const browserRegistry = new ProjectDeviceMountRegistry({
  subjectProvider: async () => ({ realm: 'browser-contract', subjectId: 'user' }),
});
const browserIdentityPort = new TauriDesktopRuntimeLocationIdentityPort({
  mountRegistry: browserRegistry,
});
assert.equal(
  await browserIdentityPort.resolveDesktopRuntimeLocationBinding({
    absolutePath: 'E:\\work\\browser-project',
    projectId: 'project-browser',
  }),
  null,
  'Browser mode must never synthesize a desktop identity or accept an OS path registration.',
);

console.log('tauri desktop runtime location identity contract passed.');
