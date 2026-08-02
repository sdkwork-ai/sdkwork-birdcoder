import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Hash } from '@sdkwork/utils/crypto';

import {
  ProjectDeviceMountRegistry,
  type ProjectDeviceMountSubject,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/ProjectDeviceMountRegistry.ts';
import { RuntimeFileSystemService } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeFileSystemService.ts';
import { RuntimeProjectRuntimeLocationService } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/impl/RuntimeProjectRuntimeLocationService.ts';
import type { BirdCoderTauriFileSystemRuntime } from '../../sdkwork-birdcoder-pc-infrastructure/src/platform/tauriFileSystemRuntime.ts';

const projectId = 'project.desktop-persistence';
const absolutePath = 'E:\\projects\\sdkwork-birdcoder';
const legacyKey = '1'.repeat(64);
const directoryFingerprint = `sha256:${'a'.repeat(64)}`;
const subject: ProjectDeviceMountSubject = {
  realm: 'birdcoder\u0001standalone\u0001development\u0001http://127.0.0.1:49152',
  subjectId: 'tenant-1\u0001organization-1\u0001user-1',
};

function createTauriFileSystemRuntime(): BirdCoderTauriFileSystemRuntime {
  return {
    getDirectoryRevisions: vi.fn(async (
      _root: string,
      _virtualRoot: string,
      paths: readonly string[],
    ) => paths.map((path) => ({
      missing: false,
      path,
      revision: 'revision-1',
    }))),
    listDirectory: vi.fn(async () => ({
      directory: {
        children: [],
        name: 'sdkwork-birdcoder',
        path: '/sdkwork-birdcoder',
        type: 'directory' as const,
      },
      rootVirtualPath: '/sdkwork-birdcoder',
    })),
  } as unknown as BirdCoderTauriFileSystemRuntime;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('desktop project device mount persistence', () => {
  it('migrates a stale realm key and restores the absolute terminal directory after restart', async () => {
    const ownerKey = sha256Hash(subject.subjectId);
    const valuesByKey = new Map<string, string>();
    const legacyValue = JSON.stringify({
      displayName: 'sdkwork-birdcoder',
      ownerKey,
      path: absolutePath,
      projectId,
      rootLocator: 'desktop-root:11111111-1111-4111-8111-111111111111',
      version: 1,
    });
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case 'local_store_get':
          return valuesByKey.get(String(args?.key)) ?? null;
        case 'project_device_mount_find':
          return (args?.ownerKeys as string[]).includes(ownerKey)
            && args?.projectId === projectId
            ? { key: legacyKey, value: legacyValue }
            : null;
        case 'project_device_mount_provider_session_directory_identity':
          return (args?.ownerKeys as string[]).includes(ownerKey)
            && args?.projectId === projectId
            ? {
                directoryFingerprint,
                directoryName: 'sdkwork-birdcoder',
              }
            : null;
        case 'local_store_set':
          valuesByKey.set(String(args?.key), String(args?.value));
          return undefined;
        case 'local_store_delete':
          valuesByKey.delete(String(args?.key));
          return undefined;
        default:
          throw new Error(`Unexpected Tauri command: ${command}`);
      }
    });
    vi.stubGlobal('window', { __TAURI_INTERNALS__: { invoke } });

    const createRuntimeLocationService = () => {
      const registry = new ProjectDeviceMountRegistry({
        subjectProvider: async () => subject,
      });
      const fileSystemService = new RuntimeFileSystemService({
        mountRegistry: registry,
        tauriRuntime: createTauriFileSystemRuntime(),
      });
      return new RuntimeProjectRuntimeLocationService({ fileSystemService });
    };

    const firstService = createRuntimeLocationService();
    const firstResolution = await firstService.resolveProjectRuntimeLocation(projectId, {
      allowFolderSelection: false,
      capability: 'terminal',
    });
    expect(firstResolution).toMatchObject({
      location: {
        localWorkingDirectory: absolutePath,
        projectId,
        source: 'recovered_mount',
      },
      status: 'resolved',
    });
    expect(invoke).toHaveBeenCalledWith('project_device_mount_find', {
      ownerKeys: expect.arrayContaining([ownerKey]),
      projectId,
    });

    const canonicalEntry = [...valuesByKey.entries()][0];
    expect(canonicalEntry).toBeDefined();
    expect(canonicalEntry?.[0]).not.toBe(legacyKey);
    expect(JSON.parse(canonicalEntry?.[1] ?? '{}')).toMatchObject({
      client: {
        application: 'sdkwork-birdcoder-pc',
        runtime: 'tauri',
        version: 1,
      },
      createdSurface: 'desktop',
      ownerKey,
      path: absolutePath,
      projectId,
      version: 1,
    });

    const identityRegistry = new ProjectDeviceMountRegistry({
      subjectProvider: async () => subject,
    });
    await expect(identityRegistry.resolveProviderSessionDirectoryIdentity(projectId)).resolves.toEqual({
      directoryFingerprint,
      directoryName: 'sdkwork-birdcoder',
    });
    expect(invoke).toHaveBeenCalledWith('project_device_mount_provider_session_directory_identity', {
      ownerKeys: expect.arrayContaining([ownerKey]),
      projectId,
    });

    invoke.mockClear();
    const restartedRegistry = new ProjectDeviceMountRegistry({
      subjectProvider: async () => subject,
    });
    const restartedFileSystemService = new RuntimeFileSystemService({
      mountRegistry: restartedRegistry,
      tauriRuntime: createTauriFileSystemRuntime(),
    });
    const restartedService = new RuntimeProjectRuntimeLocationService({
      fileSystemService: restartedFileSystemService,
    });
    const restartedResolution = await restartedService.resolveProjectRuntimeLocation(projectId, {
      allowFolderSelection: false,
      capability: 'terminal',
    });
    expect(restartedResolution).toMatchObject({
      location: { localWorkingDirectory: absolutePath },
      status: 'resolved',
    });
    expect(invoke).not.toHaveBeenCalledWith(
      'project_device_mount_find',
      expect.anything(),
    );
    await expect(restartedFileSystemService.getFiles(projectId)).resolves.toEqual([
      {
        children: [],
        name: 'sdkwork-birdcoder',
        path: '/sdkwork-birdcoder',
        type: 'directory',
      },
    ]);

    const otherUserRegistry = new ProjectDeviceMountRegistry({
      subjectProvider: async () => ({
        ...subject,
        subjectId: 'tenant-1\u0001organization-1\u0001user-2',
      }),
    });
    const otherUserService = new RuntimeProjectRuntimeLocationService({
      fileSystemService: new RuntimeFileSystemService({
        mountRegistry: otherUserRegistry,
        tauriRuntime: createTauriFileSystemRuntime(),
      }),
    });
    await expect(otherUserService.resolveProjectRuntimeLocation(projectId, {
      allowFolderSelection: false,
      capability: 'terminal',
    })).resolves.toMatchObject({
      code: 'mount_required',
      status: 'unavailable',
    });
  });

  it('migrates a stale projectId under the same path and owner when the project is re-imported', async () => {
    const ownerKey = sha256Hash(subject.subjectId);
    const retiredProjectId = 'project.retired';
    const valuesByKey = new Map<string, string>();
    const staleValue = JSON.stringify({
      client: {
        application: 'sdkwork-birdcoder-pc',
        runtime: 'tauri',
        version: 1,
      },
      createdSurface: 'desktop',
      ownerKey,
      path: absolutePath,
      projectId: retiredProjectId,
      version: 1,
    });
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case 'local_store_get':
          return valuesByKey.get(String(args?.key)) ?? null;
        case 'local_store_set':
          valuesByKey.set(String(args?.key), String(args?.value));
          return undefined;
        case 'project_device_mount_find':
          return (args?.ownerKeys as string[]).includes(ownerKey)
            && args?.projectId === projectId
            ? { key: legacyKey, value: staleValue }
            : null;
        case 'project_device_mount_provider_session_directory_identity':
          return (args?.ownerKeys as string[]).includes(ownerKey)
            && args?.projectId === projectId
            ? {
                directoryFingerprint,
                directoryName: 'sdkwork-birdcoder',
              }
            : null;
        default:
          throw new Error(`Unexpected Tauri command: ${command}`);
      }
    });
    vi.stubGlobal('window', { __TAURI_INTERNALS__: { invoke } });

    const registry = new ProjectDeviceMountRegistry({
      subjectProvider: async () => subject,
    });
    const fileSystemService = new RuntimeFileSystemService({
      mountRegistry: registry,
      tauriRuntime: createTauriFileSystemRuntime(),
    });
    const service = new RuntimeProjectRuntimeLocationService({ fileSystemService });

    const resolution = await service.resolveProjectRuntimeLocation(projectId, {
      allowFolderSelection: false,
      capability: 'terminal',
    });
    expect(resolution).toMatchObject({
      location: {
        localWorkingDirectory: absolutePath,
        projectId,
        source: 'recovered_mount',
      },
      status: 'resolved',
    });

    // The stored mount is rewritten against the active project record so the
    // next restart resolves without the legacy migration path.
    const migratedEntry = [...valuesByKey.entries()][0];
    expect(migratedEntry).toBeDefined();
    expect(JSON.parse(migratedEntry?.[1] ?? '{}')).toMatchObject({
      ownerKey,
      path: absolutePath,
      projectId,
      version: 1,
    });

    invoke.mockClear();
    const restartedRegistry = new ProjectDeviceMountRegistry({
      subjectProvider: async () => subject,
    });
    const restartedService = new RuntimeProjectRuntimeLocationService({
      fileSystemService: new RuntimeFileSystemService({
        mountRegistry: restartedRegistry,
        tauriRuntime: createTauriFileSystemRuntime(),
      }),
    });
    await expect(restartedService.resolveProjectRuntimeLocation(projectId, {
      allowFolderSelection: false,
      capability: 'terminal',
    })).resolves.toMatchObject({
      location: { localWorkingDirectory: absolutePath },
      status: 'resolved',
    });
    expect(invoke).not.toHaveBeenCalledWith(
      'project_device_mount_find',
      expect.anything(),
    );
  });
});
