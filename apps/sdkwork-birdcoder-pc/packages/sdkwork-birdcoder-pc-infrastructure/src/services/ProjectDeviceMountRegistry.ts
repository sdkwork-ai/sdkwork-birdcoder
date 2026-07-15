import { sha256Hash } from '@sdkwork/utils/crypto';
import type {
  LocalFolderMountSource,
  ProjectDeviceMountState,
} from '@sdkwork/birdcoder-pc-types';

import { isBirdCoderTauriRuntime } from '../platform/tauriRuntime.ts';

const BROWSER_DATABASE_NAME = 'sdkwork-birdcoder-project-device-mounts';
const BROWSER_DATABASE_VERSION = 1;
const BROWSER_MOUNT_STORE_NAME = 'mounts';
const TAURI_MOUNT_STORAGE_SCOPE = 'project-device-mounts';
const TAURI_MOUNT_STORAGE_VERSION = 1;
const SUBJECT_KEY_PREFIX = 'sdkwork.birdcoder.project-device-mount.v1';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type TauriInvokeWindow = Window &
  typeof globalThis & {
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  };

interface BrowserStoredProjectMount {
  displayName: string;
  handle: FileSystemDirectoryHandle;
  key: string;
  version: number;
}

interface TauriStoredProjectMount {
  displayName: string;
  path: string;
  version: number;
}

interface BrowserDirectoryPermissionHandle {
  name: string;
  queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
}

export interface ProjectDeviceMountSubject {
  realm: string;
  subjectId: string;
}

export type ProjectDeviceMountSubjectProvider = () => Promise<ProjectDeviceMountSubject | null>;

export interface ProjectDeviceMountRecoverySource {
  source: LocalFolderMountSource | null;
  state: ProjectDeviceMountState;
}

export interface ProjectDeviceMountRegistryOptions {
  subjectProvider?: ProjectDeviceMountSubjectProvider;
}

interface ResolvedProjectDeviceMountSubject {
  key: string;
  subject: ProjectDeviceMountSubject;
}

function createMountState(
  status: ProjectDeviceMountState['status'],
  host: ProjectDeviceMountState['host'] = null,
  displayName: string | null = null,
): ProjectDeviceMountState {
  return {
    displayName,
    host,
    status,
  };
}

function normalizeProjectId(projectId: string): string {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new Error('Project ID is required to access a device-local folder mount.');
  }

  return normalizedProjectId;
}

function normalizeDisplayName(value: string | null | undefined): string {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue || 'Local folder';
}

function resolveBrowserMountDisplayName(source: LocalFolderMountSource): string {
  return source.type === 'browser'
    ? normalizeDisplayName(source.handle.name)
    : resolveTauriMountDisplayName(source.path);
}

function resolveTauriMountDisplayName(path: string): string {
  const normalizedPath = path.trim().replace(/[\\/]+$/u, '');
  const segments = normalizedPath.split(/[\\/]/u).filter(Boolean);
  return normalizeDisplayName(segments[segments.length - 1]);
}

function isAbsoluteTauriPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/u.test(path) || path.startsWith('\\\\') || path.startsWith('/');
}

function normalizeMountSubject(
  subject: ProjectDeviceMountSubject | null,
): ProjectDeviceMountSubject | null {
  if (!subject) {
    return null;
  }

  const realm = subject.realm.trim();
  const subjectId = subject.subjectId.trim();
  if (!realm || !subjectId) {
    return null;
  }

  return { realm, subjectId };
}

function buildSubjectProjectMountKey(
  subject: ProjectDeviceMountSubject,
  projectId: string,
): string {
  return sha256Hash(
    [SUBJECT_KEY_PREFIX, subject.realm, subject.subjectId, projectId].join('\u0001'),
  );
}

function parseTauriStoredProjectMount(value: string | null): TauriStoredProjectMount | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<TauriStoredProjectMount>;
    const path = typeof parsed.path === 'string' ? parsed.path.trim() : '';
    if (
      parsed.version !== TAURI_MOUNT_STORAGE_VERSION ||
      !path ||
      !isAbsoluteTauriPath(path)
    ) {
      return null;
    }

    return {
      displayName: normalizeDisplayName(parsed.displayName),
      path,
      version: TAURI_MOUNT_STORAGE_VERSION,
    };
  } catch {
    return null;
  }
}

function openBrowserMountDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(BROWSER_DATABASE_NAME, BROWSER_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BROWSER_MOUNT_STORE_NAME)) {
        database.createObjectStore(BROWSER_MOUNT_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

function awaitIndexedDbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('Browser mount storage request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function readBrowserStoredProjectMount(
  key: string,
): Promise<BrowserStoredProjectMount | null> {
  const database = await openBrowserMountDatabase();
  if (!database) {
    return null;
  }

  try {
    const transaction = database.transaction(BROWSER_MOUNT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(BROWSER_MOUNT_STORE_NAME);
    const value = await awaitIndexedDbRequest(store.get(key) as IDBRequest<unknown>);
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Partial<BrowserStoredProjectMount>;
    if (
      record.key !== key ||
      record.version !== BROWSER_DATABASE_VERSION ||
      !record.handle ||
      typeof record.handle !== 'object' ||
      typeof record.handle.name !== 'string'
    ) {
      return null;
    }

    return {
      displayName: normalizeDisplayName(record.displayName),
      handle: record.handle,
      key,
      version: BROWSER_DATABASE_VERSION,
    };
  } catch {
    return null;
  } finally {
    database.close();
  }
}

async function writeBrowserStoredProjectMount(
  key: string,
  source: Extract<LocalFolderMountSource, { type: 'browser' }>,
): Promise<boolean> {
  const database = await openBrowserMountDatabase();
  if (!database) {
    return false;
  }

  try {
    const transaction = database.transaction(BROWSER_MOUNT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BROWSER_MOUNT_STORE_NAME);
    await awaitIndexedDbRequest(
      store.put({
        displayName: normalizeDisplayName(source.handle.name),
        handle: source.handle,
        key,
        version: BROWSER_DATABASE_VERSION,
      } satisfies BrowserStoredProjectMount),
    );
    return true;
  } catch {
    return false;
  } finally {
    database.close();
  }
}

async function queryBrowserMountPermission(
  handle: FileSystemDirectoryHandle,
): Promise<'granted' | 'permission_required'> {
  const permissionHandle = handle as unknown as BrowserDirectoryPermissionHandle;
  if (typeof permissionHandle.queryPermission !== 'function') {
    return 'permission_required';
  }

  try {
    return (await permissionHandle.queryPermission({ mode: 'readwrite' })) === 'granted'
      ? 'granted'
      : 'permission_required';
  } catch {
    return 'permission_required';
  }
}

async function resolveTauriInvoke(): Promise<TauriInvoke | null> {
  if (!(await isBirdCoderTauriRuntime())) {
    return null;
  }

  const directInvoke =
    typeof window === 'undefined'
      ? undefined
      : (window as TauriInvokeWindow).__TAURI_INTERNALS__?.invoke;
  if (typeof directInvoke === 'function') {
    return directInvoke;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

async function readTauriStoredProjectMount(key: string): Promise<TauriStoredProjectMount | null> {
  const invoke = await resolveTauriInvoke();
  if (!invoke) {
    return null;
  }

  try {
    return parseTauriStoredProjectMount(
      await invoke<string | null>('local_store_get', {
        key,
        scope: TAURI_MOUNT_STORAGE_SCOPE,
      }),
    );
  } catch {
    return null;
  }
}

async function writeTauriStoredProjectMount(
  key: string,
  source: Extract<LocalFolderMountSource, { type: 'tauri' }>,
): Promise<boolean> {
  const normalizedPath = source.path.trim();
  if (!normalizedPath || !isAbsoluteTauriPath(normalizedPath)) {
    return false;
  }

  const invoke = await resolveTauriInvoke();
  if (!invoke) {
    return false;
  }

  try {
    await invoke('local_store_set', {
      key,
      scope: TAURI_MOUNT_STORAGE_SCOPE,
      value: JSON.stringify({
        displayName: resolveTauriMountDisplayName(normalizedPath),
        path: normalizedPath,
        version: TAURI_MOUNT_STORAGE_VERSION,
      } satisfies TauriStoredProjectMount),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists a local folder reference only in the active device boundary.
 * Remote project records and app SDK DTOs never receive the stored source.
 */
export class ProjectDeviceMountRegistry {
  private readonly subjectProvider?: ProjectDeviceMountSubjectProvider;

  constructor(options: ProjectDeviceMountRegistryOptions = {}) {
    this.subjectProvider = options.subjectProvider;
  }

  async getCurrentSubjectKey(): Promise<string | null> {
    return (await this.resolveCurrentSubject())?.key ?? null;
  }

  async register(
    projectId: string,
    source: LocalFolderMountSource,
    expectedSubjectKey?: string | null,
  ): Promise<ProjectDeviceMountState> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const resolvedSubject = await this.resolveCurrentSubject();
    const currentSubjectKey = resolvedSubject?.key ?? null;
    if (expectedSubjectKey !== undefined && currentSubjectKey !== expectedSubjectKey) {
      return createMountState('mount_required');
    }

    if (!resolvedSubject) {
      return createMountState('session_required', source.type, resolveBrowserMountDisplayName(source));
    }

    const key = buildSubjectProjectMountKey(resolvedSubject.subject, normalizedProjectId);
    const persisted =
      source.type === 'browser'
        ? await writeBrowserStoredProjectMount(key, source)
        : await writeTauriStoredProjectMount(key, source);

    // A local store write cannot be cancelled once issued. Its key remains bound to
    // the initiating subject, and the stale caller must not receive mount metadata.
    if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
      return createMountState('mount_required');
    }

    return createMountState(
      persisted ? 'recoverable' : 'mount_required',
      source.type,
      resolveBrowserMountDisplayName(source),
    );
  }

  async inspect(
    projectId: string,
    expectedSubjectKey?: string | null,
  ): Promise<ProjectDeviceMountState> {
    const recovery = await this.resolveRecoverySource(projectId, expectedSubjectKey);
    return recovery.state;
  }

  async resolveRecoverySource(
    projectId: string,
    expectedSubjectKey?: string | null,
  ): Promise<ProjectDeviceMountRecoverySource> {
    const normalizedProjectId = normalizeProjectId(projectId);
    const resolvedSubject = await this.resolveCurrentSubject();
    const currentSubjectKey = resolvedSubject?.key ?? null;
    if (expectedSubjectKey !== undefined && currentSubjectKey !== expectedSubjectKey) {
      return {
        source: null,
        state: createMountState('mount_required'),
      };
    }

    if (!resolvedSubject) {
      return {
        source: null,
        state: createMountState('session_required'),
      };
    }

    const key = buildSubjectProjectMountKey(resolvedSubject.subject, normalizedProjectId);
    if (await isBirdCoderTauriRuntime()) {
      if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
        return {
          source: null,
          state: createMountState('mount_required'),
        };
      }

      const storedMount = await readTauriStoredProjectMount(key);
      if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
        return {
          source: null,
          state: createMountState('mount_required'),
        };
      }

      if (!storedMount) {
        return {
          source: null,
          state: createMountState('mount_required'),
        };
      }

      return {
        source: {
          path: storedMount.path,
          type: 'tauri',
        },
        state: createMountState('recoverable', 'tauri', storedMount.displayName),
      };
    }

    const storedMount = await readBrowserStoredProjectMount(key);
    if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
      return {
        source: null,
        state: createMountState('mount_required'),
      };
    }

    if (!storedMount) {
      return {
        source: null,
        state: createMountState('mount_required'),
      };
    }

    const permission = await queryBrowserMountPermission(storedMount.handle);
    if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
      return {
        source: null,
        state: createMountState('mount_required'),
      };
    }

    if (permission !== 'granted') {
      return {
        source: null,
        state: createMountState('permission_required', 'browser', storedMount.displayName),
      };
    }

    return {
      source: {
        handle: storedMount.handle,
        type: 'browser',
      },
      state: createMountState('recoverable', 'browser', storedMount.displayName),
    };
  }

  private async resolveCurrentSubject(): Promise<ResolvedProjectDeviceMountSubject | null> {
    const subject = normalizeMountSubject((await this.subjectProvider?.()) ?? null);
    if (!subject) {
      return null;
    }

    return {
      key: buildSubjectProjectMountKey(subject, 'subject'),
      subject,
    };
  }

  private async isCurrentSubjectKey(expectedSubjectKey: string | null): Promise<boolean> {
    return (await this.getCurrentSubjectKey()) === expectedSubjectKey;
  }
}
