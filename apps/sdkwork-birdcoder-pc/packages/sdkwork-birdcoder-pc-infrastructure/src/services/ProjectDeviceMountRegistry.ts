import { sha256Hash } from '@sdkwork/utils/crypto';
import type {
  LocalFolderMountSource,
  ProjectDeviceMountState,
} from '@sdkwork/birdcoder-pc-types';

import {
  isBirdCoderTauriRuntime,
  resolveBirdCoderTauriInvoke,
} from '../platform/tauriRuntime.ts';

const BROWSER_DATABASE_NAME = 'sdkwork-birdcoder-project-device-mounts';
const BROWSER_DATABASE_VERSION = 1;
const BROWSER_MOUNT_STORE_NAME = 'mounts';
const TAURI_MOUNT_STORAGE_SCOPE = 'project-device-mounts';
const TAURI_MOUNT_STORAGE_VERSION = 1;
const SUBJECT_KEY_PREFIX = 'sdkwork.birdcoder.project-device-mount.v1';

interface BrowserStoredProjectMount {
  displayName: string;
  handle: FileSystemDirectoryHandle;
  key: string;
  version: number;
}

interface TauriStoredProjectMount {
  displayName: string;
  path: string;
  requiresRebind?: boolean;
  rootLocator?: string;
  runtimeLocationCreateGeneration?: number;
  runtimeLocationId?: string;
  runtimeLocationVersion?: string;
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

/**
 * Safe metadata for a Tauri-local runtime location binding. The native path
 * remains private to this registry and is deliberately absent from this type.
 */
export interface TauriProjectRuntimeLocationBinding {
  displayName: string;
  requiresRebind: boolean;
  rootLocator?: string;
  runtimeLocationCreateGeneration: number;
  runtimeLocationId?: string;
  runtimeLocationVersion?: string;
}

export interface ResolveTauriProjectRuntimeLocationBindingInput {
  absolutePath: string;
  expectedSubjectKey?: string | null;
  projectId: string;
}

export interface EnsureTauriProjectRuntimeLocationRootLocatorInput
  extends ResolveTauriProjectRuntimeLocationBindingInput {
  rootLocator: string;
}

export interface PersistTauriProjectRuntimeLocationRemoteBindingInput
  extends ResolveTauriProjectRuntimeLocationBindingInput {
  rootLocator: string;
  runtimeLocationId: string;
  runtimeLocationVersion: string;
}

export interface ClearTauriProjectRuntimeLocationRemoteBindingInput
  extends ResolveTauriProjectRuntimeLocationBindingInput {
  rootLocator: string;
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

function normalizeAbsoluteTauriPath(path: string): string | null {
  const normalizedPath = path.trim();
  return normalizedPath && isAbsoluteTauriPath(normalizedPath) ? normalizedPath : null;
}

function isSameTauriPath(left: string, right: string): boolean {
  const normalizedLeft = normalizeAbsoluteTauriPath(left);
  const normalizedRight = normalizeAbsoluteTauriPath(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  const collapseSeparators = (value: string) => value.replace(/[\\/]+$/u, '').replace(/\\/gu, '/');
  const normalizedLeftPath = collapseSeparators(normalizedLeft);
  const normalizedRightPath = collapseSeparators(normalizedRight);
  const isWindowsPath = /^[a-zA-Z]:\//u.test(normalizedLeftPath)
    || normalizedLeftPath.startsWith('//');

  return isWindowsPath
    ? normalizedLeftPath.toLowerCase() === normalizedRightPath.toLowerCase()
    : normalizedLeftPath === normalizedRightPath;
}

function normalizeRootLocator(value: unknown): string | undefined {
  const rootLocator = typeof value === 'string' ? value.trim() : '';
  return /^desktop-root:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
    rootLocator,
  )
    ? rootLocator
    : undefined;
}

function normalizeSafeRuntimeBindingValue(value: unknown): string | undefined {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue
    && normalizedValue.length <= 512
    && !/[\u0000-\u001f\u007f]/u.test(normalizedValue)
    ? normalizedValue
    : undefined;
}

function normalizeRuntimeLocationCreateGeneration(value: unknown): number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 2_147_483_647
    ? value
    : 0;
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
    const path = normalizeAbsoluteTauriPath(parsed.path ?? '');
    if (
      parsed.version !== TAURI_MOUNT_STORAGE_VERSION ||
      !path ||
      !isAbsoluteTauriPath(path)
    ) {
      return null;
    }

    const rootLocator = normalizeRootLocator(parsed.rootLocator);
    const runtimeLocationCreateGeneration = normalizeRuntimeLocationCreateGeneration(
      parsed.runtimeLocationCreateGeneration,
    );
    const runtimeLocationId = normalizeSafeRuntimeBindingValue(parsed.runtimeLocationId);
    const runtimeLocationVersion = normalizeSafeRuntimeBindingValue(parsed.runtimeLocationVersion);
    const hasCompleteRemoteBinding = Boolean(runtimeLocationId && runtimeLocationVersion);

    return {
      displayName: normalizeDisplayName(parsed.displayName),
      path,
      runtimeLocationCreateGeneration,
      ...(rootLocator ? { rootLocator } : {}),
      ...(hasCompleteRemoteBinding
        ? {
            runtimeLocationId,
            runtimeLocationVersion,
            requiresRebind: Boolean(parsed.requiresRebind),
          }
        : {}),
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

async function readTauriStoredProjectMount(key: string): Promise<TauriStoredProjectMount | null> {
  const invoke = await resolveBirdCoderTauriInvoke();
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
  mount: TauriStoredProjectMount,
): Promise<boolean> {
  const normalizedPath = normalizeAbsoluteTauriPath(mount.path);
  if (!normalizedPath) {
    return false;
  }

  const invoke = await resolveBirdCoderTauriInvoke();
  if (!invoke) {
    return false;
  }

  try {
    await invoke('local_store_set', {
      key,
      scope: TAURI_MOUNT_STORAGE_SCOPE,
      value: JSON.stringify({
        ...mount,
        displayName: normalizeDisplayName(mount.displayName),
        path: normalizedPath,
        version: TAURI_MOUNT_STORAGE_VERSION,
      } satisfies TauriStoredProjectMount),
    });
    return true;
  } catch {
    return false;
  }
}

function toTauriRuntimeLocationBinding(
  mount: TauriStoredProjectMount,
): TauriProjectRuntimeLocationBinding {
  const hasCompleteRemoteBinding = Boolean(
    mount.runtimeLocationId && mount.runtimeLocationVersion,
  );
  return {
    displayName: mount.displayName,
    requiresRebind: hasCompleteRemoteBinding && Boolean(mount.requiresRebind),
    runtimeLocationCreateGeneration: mount.runtimeLocationCreateGeneration ?? 0,
    ...(mount.rootLocator ? { rootLocator: mount.rootLocator } : {}),
    ...(hasCompleteRemoteBinding
      ? {
          runtimeLocationId: mount.runtimeLocationId,
          runtimeLocationVersion: mount.runtimeLocationVersion,
        }
      : {}),
  };
}

function createTauriStoredProjectMount(
  source: Extract<LocalFolderMountSource, { type: 'tauri' }>,
  previousMount: TauriStoredProjectMount | null,
): TauriStoredProjectMount | null {
  const path = normalizeAbsoluteTauriPath(source.path);
  if (!path) {
    return null;
  }

  const hasCompleteRemoteBinding = Boolean(
    previousMount?.runtimeLocationId && previousMount.runtimeLocationVersion,
  );
  const pathChanged = previousMount ? !isSameTauriPath(previousMount.path, path) : false;

  return {
    displayName: resolveTauriMountDisplayName(path),
    path,
    ...(previousMount?.rootLocator ? { rootLocator: previousMount.rootLocator } : {}),
    runtimeLocationCreateGeneration: previousMount?.runtimeLocationCreateGeneration ?? 0,
    ...(hasCompleteRemoteBinding
      ? {
          runtimeLocationId: previousMount?.runtimeLocationId,
          runtimeLocationVersion: previousMount?.runtimeLocationVersion,
          requiresRebind: Boolean(previousMount?.requiresRebind || pathChanged),
        }
      : {}),
    version: TAURI_MOUNT_STORAGE_VERSION,
  };
}

/**
 * Persists a local folder reference only in the active device boundary.
 * Generic Project records and app SDK DTOs never receive the stored source.
 * The dedicated runtime-location registration boundary persists encrypted,
 * write-only path material for the authoritative target-specific record.
 */
export class ProjectDeviceMountRegistry {
  private readonly subjectProvider?: ProjectDeviceMountSubjectProvider;

  constructor(options: ProjectDeviceMountRegistryOptions = {}) {
    this.subjectProvider = options.subjectProvider;
  }

  async getCurrentSubjectKey(): Promise<string | null> {
    return (await this.resolveCurrentSubject())?.key ?? null;
  }

  /**
   * Reads only safe runtime-location binding metadata for an active Tauri
   * mount. This is intentionally unavailable in browser mode and never
   * returns the private native path held by the mount record.
   */
  async resolveTauriRuntimeLocationBinding(
    input: ResolveTauriProjectRuntimeLocationBindingInput,
  ): Promise<TauriProjectRuntimeLocationBinding | null> {
    const resolvedMount = await this.resolveCurrentTauriStoredMount(input);
    return resolvedMount ? toTauriRuntimeLocationBinding(resolvedMount.mount) : null;
  }

  /**
   * Persists a host-generated opaque root locator next to the active native
   * mount. Existing locators win so a reselected or moved path never changes
   * the server-side target identity.
   */
  async ensureTauriRuntimeLocationRootLocator(
    input: EnsureTauriProjectRuntimeLocationRootLocatorInput,
  ): Promise<TauriProjectRuntimeLocationBinding | null> {
    const rootLocator = normalizeRootLocator(input.rootLocator);
    if (!rootLocator) {
      return null;
    }

    const resolvedMount = await this.resolveCurrentTauriStoredMount(input);
    if (!resolvedMount) {
      return null;
    }

    if (resolvedMount.mount.rootLocator) {
      return toTauriRuntimeLocationBinding(resolvedMount.mount);
    }

    const updatedMount: TauriStoredProjectMount = {
      ...resolvedMount.mount,
      rootLocator,
    };
    const persisted = await writeTauriStoredProjectMount(resolvedMount.key, updatedMount);
    if (!persisted || !(await this.isCurrentSubjectKey(resolvedMount.subjectKey))) {
      return null;
    }

    return toTauriRuntimeLocationBinding(updatedMount);
  }

  /**
   * Stores the safe remote binding after the composed SDK has accepted a
   * create or rebind request. A changed mount or changed subject rejects the
   * write so stale asynchronous work cannot cross project-owner boundaries.
   */
  async persistTauriRuntimeLocationRemoteBinding(
    input: PersistTauriProjectRuntimeLocationRemoteBindingInput,
  ): Promise<boolean> {
    const rootLocator = normalizeRootLocator(input.rootLocator);
    const runtimeLocationId = normalizeSafeRuntimeBindingValue(input.runtimeLocationId);
    const runtimeLocationVersion = normalizeSafeRuntimeBindingValue(input.runtimeLocationVersion);
    if (!rootLocator || !runtimeLocationId || !runtimeLocationVersion) {
      return false;
    }

    const resolvedMount = await this.resolveCurrentTauriStoredMount(input);
    if (!resolvedMount || resolvedMount.mount.rootLocator !== rootLocator) {
      return false;
    }

    const updatedMount: TauriStoredProjectMount = {
      ...resolvedMount.mount,
      requiresRebind: false,
      runtimeLocationId,
      runtimeLocationVersion,
    };
    const persisted = await writeTauriStoredProjectMount(resolvedMount.key, updatedMount);
    return persisted && (await this.isCurrentSubjectKey(resolvedMount.subjectKey));
  }

  /**
   * Removes only stale remote identifiers after a server-side 404 or binding
   * mismatch. The opaque root locator remains stable while the persisted
   * create generation advances, giving the replacement create a new safe
   * idempotency key without changing ordinary retry behavior.
   */
  async clearTauriRuntimeLocationRemoteBinding(
    input: ClearTauriProjectRuntimeLocationRemoteBindingInput,
  ): Promise<number | null> {
    const rootLocator = normalizeRootLocator(input.rootLocator);
    if (!rootLocator) {
      return null;
    }

    const resolvedMount = await this.resolveCurrentTauriStoredMount(input);
    if (!resolvedMount || resolvedMount.mount.rootLocator !== rootLocator) {
      return null;
    }

    const currentGeneration = normalizeRuntimeLocationCreateGeneration(
      resolvedMount.mount.runtimeLocationCreateGeneration,
    );
    if (currentGeneration >= 2_147_483_647) {
      return null;
    }
    const nextGeneration = currentGeneration + 1;

    const {
      requiresRebind: _requiresRebind,
      runtimeLocationId: _runtimeLocationId,
      runtimeLocationVersion: _runtimeLocationVersion,
      ...mountWithoutRemoteBinding
    } = resolvedMount.mount;
    const updatedMount: TauriStoredProjectMount = {
      ...mountWithoutRemoteBinding,
      runtimeLocationCreateGeneration: nextGeneration,
    };
    const persisted = await writeTauriStoredProjectMount(
      resolvedMount.key,
      updatedMount,
    );
    return persisted && (await this.isCurrentSubjectKey(resolvedMount.subjectKey))
      ? nextGeneration
      : null;
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
    let persisted: boolean;
    if (source.type === 'browser') {
      persisted = await writeBrowserStoredProjectMount(key, source);
    } else {
      const previousMount = await readTauriStoredProjectMount(key);
      if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
        return createMountState('mount_required');
      }

      const nextMount = createTauriStoredProjectMount(source, previousMount);
      persisted = nextMount ? await writeTauriStoredProjectMount(key, nextMount) : false;
    }

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

  private async resolveCurrentTauriStoredMount(
    input: ResolveTauriProjectRuntimeLocationBindingInput,
  ): Promise<{
    key: string;
    mount: TauriStoredProjectMount;
    subjectKey: string;
  } | null> {
    if (!(await isBirdCoderTauriRuntime())) {
      return null;
    }

    const absolutePath = normalizeAbsoluteTauriPath(input.absolutePath);
    if (!absolutePath) {
      return null;
    }

    const normalizedProjectId = normalizeProjectId(input.projectId);
    const resolvedSubject = await this.resolveCurrentSubject();
    const subjectKey = resolvedSubject?.key;
    if (
      !resolvedSubject ||
      !subjectKey ||
      (input.expectedSubjectKey !== undefined && subjectKey !== input.expectedSubjectKey)
    ) {
      return null;
    }

    const key = buildSubjectProjectMountKey(resolvedSubject.subject, normalizedProjectId);
    const mount = await readTauriStoredProjectMount(key);
    if (!(await this.isCurrentSubjectKey(subjectKey))) {
      return null;
    }

    if (!mount || !isSameTauriPath(mount.path, absolutePath)) {
      return null;
    }

    return { key, mount, subjectKey };
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
