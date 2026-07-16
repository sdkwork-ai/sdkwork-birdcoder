import assert from 'node:assert/strict';

import type {
  LocalFolderMountSource,
  ProjectDeviceMountState,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts';
import {
  ProjectDeviceMountRegistry,
  type ProjectDeviceMountSubject,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/ProjectDeviceMountRegistry.ts';
import { RuntimeFileSystemService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts';
import type {
  BirdCoderTauriDirectoryListing,
  BirdCoderTauriFileSystemRuntime,
  BirdCoderTauriFileSystemWatchEvent,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts';

interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
}

interface RuntimeFileSystemServiceInternals {
  pollProjectFileTreeChanges(projectId: string, poller: unknown): Promise<void>;
  projectFileTreePollers: Map<string, unknown>;
}

interface TestTauriRuntime {
  initialListingStarted: () => boolean;
  runtime: BirdCoderTauriFileSystemRuntime;
  watchListeners: Array<(event: BirdCoderTauriFileSystemWatchEvent) => void>;
}

function createDeferred<T>(): Deferred<T> {
  let reject: (reason?: unknown) => void = () => undefined;
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function waitFor(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (condition()) {
      return;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(message);
}

function createMountedState(host: LocalFolderMountSource['type']): ProjectDeviceMountState {
  return {
    displayName: 'workspace',
    host,
    status: 'recoverable',
  };
}

function createDirectoryListing(): BirdCoderTauriDirectoryListing {
  return {
    rootVirtualPath: '/workspace',
    directory: {
      children: [],
      name: 'workspace',
      path: '/workspace',
      type: 'directory',
    },
  };
}

function createTestTauriRuntime(options: {
  initialListing?: Deferred<BirdCoderTauriDirectoryListing>;
  watchMode: 'fail' | 'succeed';
}): TestTauriRuntime {
  const listing = createDirectoryListing();
  const watchListeners: Array<(event: BirdCoderTauriFileSystemWatchEvent) => void> = [];
  let initialListingStarted = false;
  let useDeferredListing = options.initialListing !== undefined;

  const runtime: BirdCoderTauriFileSystemRuntime = {
    async createDirectory() {},
    async createFile() {},
    async deleteEntry() {},
    async getDirectoryRevisions(_rootSystemPath, _rootVirtualPath, mountedPaths) {
      return mountedPaths.map((path) => ({
        missing: false,
        path,
        revision: 'revision-1',
      }));
    },
    async getFileRevision() {
      return 'revision-1';
    },
    async getFileRevisions(_rootSystemPath, _rootVirtualPath, mountedPaths) {
      return mountedPaths.map((path) => ({
        missing: false,
        path,
        revision: 'revision-1',
      }));
    },
    async listDirectory() {
      if (useDeferredListing) {
        useDeferredListing = false;
        initialListingStarted = true;
        return options.initialListing!.promise;
      }

      return listing;
    },
    async readFile() {
      return '';
    },
    async renameEntry() {},
    async revealInFileManager() {},
    async snapshotFolder() {
      return {
        rootVirtualPath: listing.rootVirtualPath,
        tree: listing.directory,
      };
    },
    async watchProjectTree(_rootSystemPath, listener) {
      if (options.watchMode === 'fail') {
        throw new Error('watcher unavailable in test runtime');
      }

      watchListeners.push(listener);
      return async () => undefined;
    },
    async writeFile() {},
  };

  return {
    initialListingStarted: () => initialListingStarted,
    runtime,
    watchListeners,
  };
}

class MutableSubjectMountRegistry extends ProjectDeviceMountRegistry {
  readonly registrations: Array<{ expectedSubjectKey: string | null | undefined; subjectKey: string | null }> = [];
  subjectKey: string | null = 'subject-a';

  override async getCurrentSubjectKey(): Promise<string | null> {
    return this.subjectKey;
  }

  override async register(
    _projectId: string,
    source: LocalFolderMountSource,
    expectedSubjectKey?: string | null,
  ): Promise<ProjectDeviceMountState> {
    this.registrations.push({ expectedSubjectKey, subjectKey: this.subjectKey });
    if (expectedSubjectKey !== undefined && expectedSubjectKey !== this.subjectKey) {
      return {
        displayName: null,
        host: null,
        status: 'mount_required',
      };
    }

    return createMountedState(source.type);
  }
}

async function verifyRegistrySubjectSwitchIsolation(): Promise<void> {
  let subject: ProjectDeviceMountSubject | null = {
    realm: 'test-realm',
    subjectId: 'tenant-a\u0001organization-a\u0001user-a',
  };
  const registry = new ProjectDeviceMountRegistry({
    subjectProvider: async () => subject,
  });
  const storage = new Map<string, string>();
  let delayedRead: Deferred<string | null> | null = null;
  let delayedWrite: Deferred<void> | null = null;
  let readStarted = false;
  let writeStarted = false;
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

  const invoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    const key = String(args?.key ?? '');
    if (command === 'local_store_get') {
      if (delayedRead) {
        const pendingRead = delayedRead;
        delayedRead = null;
        readStarted = true;
        return pendingRead.promise as Promise<T>;
      }

      return (storage.get(key) ?? null) as T;
    }

    if (command === 'local_store_set') {
      if (delayedWrite) {
        const pendingWrite = delayedWrite;
        delayedWrite = null;
        writeStarted = true;
        await pendingWrite.promise;
      }

      storage.set(key, String(args?.value ?? ''));
      return undefined as T;
    }

    throw new Error(`Unexpected Tauri storage command: ${command}`);
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: { invoke },
    },
  });

  try {
    const pendingRecoveryRead = createDeferred<string | null>();
    delayedRead = pendingRecoveryRead;
    const recoveryPromise = registry.resolveRecoverySource('shared-project');
    await waitFor(() => readStarted, 'Tauri recovery read was not started.');
    subject = {
      realm: 'test-realm',
      subjectId: 'tenant-b\u0001organization-b\u0001user-b',
    };
    pendingRecoveryRead.resolve(
      JSON.stringify({
        displayName: 'workspace-a',
        path: 'C:\\workspace-a',
        version: 1,
      }),
    );
    const recovery = await recoveryPromise;
    assert.equal(recovery.source, null, 'A stale recovery read must not return subject A mount data to subject B.');
    assert.equal(recovery.state.status, 'mount_required');
    assert.equal(recovery.state.displayName, null);

    subject = {
      realm: 'test-realm',
      subjectId: 'tenant-a\u0001organization-a\u0001user-a',
    };
    const pendingRegistrationWrite = createDeferred<void>();
    delayedWrite = pendingRegistrationWrite;
    const registrationPromise = registry.register('shared-project', {
      path: 'C:\\workspace-a',
      type: 'tauri',
    });
    await waitFor(() => writeStarted, 'Tauri mount write was not started.');
    subject = {
      realm: 'test-realm',
      subjectId: 'tenant-b\u0001organization-b\u0001user-b',
    };
    pendingRegistrationWrite.resolve();
    const staleRegistration = await registrationPromise;
    assert.equal(staleRegistration.status, 'mount_required');
    assert.equal(staleRegistration.displayName, null);

    const subjectBRecovery = await registry.resolveRecoverySource('shared-project');
    assert.equal(subjectBRecovery.source, null, 'A stale write must remain unavailable to subject B.');
  } finally {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
}

async function verifyStaleMountCompletionIsolation(): Promise<void> {
  const registry = new MutableSubjectMountRegistry();
  const initialListing = createDeferred<BirdCoderTauriDirectoryListing>();
  const tauriRuntime = createTestTauriRuntime({
    initialListing,
    watchMode: 'succeed',
  });
  const service = new RuntimeFileSystemService({
    mountRegistry: registry,
    tauriRuntime: tauriRuntime.runtime,
  });

  const mountPromise = service.mountFolder('shared-project', {
    path: 'C:\\workspace-a',
    type: 'tauri',
  });
  await waitFor(
    () => tauriRuntime.initialListingStarted(),
    'Mount should build before it persists.',
  );
  registry.subjectKey = 'subject-b';
  await service.getFiles('shared-project');
  initialListing.resolve(createDirectoryListing());

  await assert.rejects(
    mountPromise,
    /active session changed/u,
    'An async subject A mount must be rejected after subject B becomes active.',
  );
  assert.deepEqual(await service.getFiles('shared-project'), []);
  assert.equal(registry.registrations.length, 0, 'A stale mount must not persist through subject B.');
}

async function verifyStaleRealtimeGenerationIsolation(): Promise<void> {
  const watcherRegistry = new MutableSubjectMountRegistry();
  const watcherRuntime = createTestTauriRuntime({ watchMode: 'succeed' });
  const watcherService = new RuntimeFileSystemService({
    mountRegistry: watcherRegistry,
    tauriRuntime: watcherRuntime.runtime,
  });
  const unmountA = await mountAndSubscribe(watcherService, () => undefined);
  await waitFor(() => watcherRuntime.watchListeners.length === 1, 'Subject A watcher was not started.');
  const staleWatcher = watcherRuntime.watchListeners[0]!;

  watcherRegistry.subjectKey = 'subject-b';
  await watcherService.getFiles('shared-project');
  await watcherService.mountFolder('shared-project', {
    path: 'C:\\workspace-b',
    type: 'tauri',
  });
  const subjectBEvents: BirdCoderTauriFileSystemWatchEvent[] = [];
  const unsubscribeB = watcherService.subscribeToFileChanges('shared-project', (event) => {
    subjectBEvents.push({ kind: event.kind, paths: event.paths });
  });
  await waitFor(() => watcherRuntime.watchListeners.length === 2, 'Subject B watcher was not started.');

  staleWatcher({ kind: 'modify', paths: ['/workspace-a/stale.ts'] });
  await new Promise<void>((resolve) => setTimeout(resolve, 80));
  assert.deepEqual(subjectBEvents, [], 'A stale watcher callback must not notify subject B subscribers.');
  unmountA();
  unsubscribeB();

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].startsWith('Failed to start desktop-mounted file watcher')
    ) {
      return;
    }

    originalConsoleError(...args);
  };
  try {
    const pollerRegistry = new MutableSubjectMountRegistry();
    const pollerRuntime = createTestTauriRuntime({ watchMode: 'fail' });
    const pollerService = new RuntimeFileSystemService({
      mountRegistry: pollerRegistry,
      tauriRuntime: pollerRuntime.runtime,
    });
    const unsubscribePollerA = await mountAndSubscribe(pollerService, () => undefined);
    const pollerInternals = pollerService as unknown as RuntimeFileSystemServiceInternals;
    await waitFor(
      () => pollerInternals.projectFileTreePollers.has('shared-project'),
      'Subject A fallback poller was not started.',
    );
    const stalePoller = pollerInternals.projectFileTreePollers.get('shared-project');
    assert.ok(stalePoller);

    pollerRegistry.subjectKey = 'subject-b';
    await pollerService.getFiles('shared-project');
    await pollerService.mountFolder('shared-project', {
      path: 'C:\\workspace-b',
      type: 'tauri',
    });
    const pollerSubjectBEvents: ProjectDeviceMountState[] = [];
    const unsubscribePollerB = pollerService.subscribeToFileChanges('shared-project', () => {
      pollerSubjectBEvents.push(createMountedState('tauri'));
    });
    await waitFor(
      () => pollerInternals.projectFileTreePollers.has('shared-project'),
      'Subject B fallback poller was not started.',
    );
    assert.notEqual(pollerInternals.projectFileTreePollers.get('shared-project'), stalePoller);

    await pollerInternals.pollProjectFileTreeChanges('shared-project', stalePoller);
    assert.deepEqual(
      pollerSubjectBEvents,
      [],
      'A stale poller callback must not notify subject B subscribers.',
    );
    unsubscribePollerA();
    unsubscribePollerB();
  } finally {
    console.error = originalConsoleError;
  }
}

async function mountAndSubscribe(
  service: RuntimeFileSystemService,
  listener: (event: { kind: string; paths: string[] }) => void,
): Promise<() => void> {
  await service.mountFolder('shared-project', {
    path: 'C:\\workspace-a',
    type: 'tauri',
  });
  return service.subscribeToFileChanges('shared-project', listener);
}

async function verifyUnauthenticatedLocalMountIsRejected(): Promise<void> {
  const registry = new ProjectDeviceMountRegistry();
  const registration = await registry.register('local-project', {
    path: 'C:\\local-project',
    type: 'tauri',
  });
  assert.equal(registration.status, 'session_required');

  const tauriRuntime = createTestTauriRuntime({ watchMode: 'succeed' });
  const service = new RuntimeFileSystemService({ tauriRuntime: tauriRuntime.runtime });
  await assert.rejects(
    service.mountFolder('local-project', {
      path: 'C:\\local-project',
      type: 'tauri',
    }),
    /Sign in before binding a local project folder/u,
    'An unpersisted local mount must not become a restart-unsafe in-memory project root.',
  );
  assert.deepEqual(await service.getFiles('local-project'), []);
}

await verifyRegistrySubjectSwitchIsolation();
await verifyStaleMountCompletionIsolation();
await verifyStaleRealtimeGenerationIsolation();
await verifyUnauthenticatedLocalMountIsRejected();

console.log('project device mount subject isolation contract passed.');
