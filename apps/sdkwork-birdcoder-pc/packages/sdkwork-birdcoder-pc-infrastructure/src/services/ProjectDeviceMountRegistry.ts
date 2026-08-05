import { sha256Hash } from '@sdkwork/utils/crypto';
import type {
  LocalFolderMountSource,
  ProjectDeviceMountState,
} from '@sdkwork/birdcoder-pc-contracts-commons';

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
const PROVIDER_SESSION_DIRECTORY_FINGERPRINT_PREFIX = 'sdkwork.provider-session-directory.v1\n';
const PROJECT_MOUNT_CLIENT_METADATA_VERSION = 1;

type ProjectMountClientArchitecture = 'aarch64' | 'arm' | 'unknown' | 'x86' | 'x86_64';
type ProjectMountClientOperatingSystem =
  | 'android'
  | 'chromeos'
  | 'ios'
  | 'linux'
  | 'macos'
  | 'unknown'
  | 'windows';

interface ProjectMountClientMetadata {
  application: 'sdkwork-birdcoder-pc';
  architecture: ProjectMountClientArchitecture;
  operatingSystem: ProjectMountClientOperatingSystem;
  runtime: 'browser' | 'tauri';
  version: number;
}

interface BrowserStoredProjectMount {
  client?: ProjectMountClientMetadata;
  createdAt?: string;
  createdSurface?: 'browser';
  directoryFingerprint?: string;
  displayName: string;
  handle: FileSystemDirectoryHandle;
  key: string;
  ownerKey?: string;
  projectId?: string;
  updatedAt?: string;
  version: number;
}

interface TauriStoredProjectMount {
  client?: ProjectMountClientMetadata;
  createdAt?: string;
  createdSurface?: 'desktop';
  displayName: string;
  ownerKey?: string;
  path: string;
  projectId?: string;
  rootLocator?: string;
  updatedAt?: string;
  version: number;
}

interface TauriProjectDeviceMountEntry {
  key: string;
  value: string;
}

interface TauriProviderSessionDirectoryIdentityResponse {
  directoryFingerprint: string;
  directoryName: string;
}

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    architecture?: string;
    platform?: string;
  };
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
  rootLocator?: string;
}

export interface BrowserProviderSessionDirectoryIdentity {
  directoryFingerprint: string;
  directoryName: string;
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

function normalizeStoredTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function resolveProjectMountClientMetadata(
  runtime: ProjectMountClientMetadata['runtime'],
): ProjectMountClientMetadata {
  const runtimeNavigator = typeof navigator === 'undefined'
    ? null
    : navigator as NavigatorWithUserAgentData;
  const platform = [
    runtimeNavigator?.userAgentData?.platform,
    runtimeNavigator?.platform,
    runtimeNavigator?.userAgent,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();
  const architectureSource = [
    runtimeNavigator?.userAgentData?.architecture,
    runtimeNavigator?.platform,
    runtimeNavigator?.userAgent,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();

  let operatingSystem: ProjectMountClientOperatingSystem = 'unknown';
  if (/windows|win32|win64/iu.test(platform)) operatingSystem = 'windows';
  else if (/android/iu.test(platform)) operatingSystem = 'android';
  else if (/iphone|ipad|ios/iu.test(platform)) operatingSystem = 'ios';
  else if (/macintosh|macintel|macos/iu.test(platform)) operatingSystem = 'macos';
  else if (/cros|chromeos/iu.test(platform)) operatingSystem = 'chromeos';
  else if (/linux/iu.test(platform)) operatingSystem = 'linux';

  let architecture: ProjectMountClientArchitecture = 'unknown';
  if (/aarch64|arm64/iu.test(architectureSource)) architecture = 'aarch64';
  else if (/arm/iu.test(architectureSource)) architecture = 'arm';
  else if (/x86_64|x86-64|amd64|win64|x64/iu.test(architectureSource)) architecture = 'x86_64';
  else if (/i[3-6]86|x86|win32/iu.test(architectureSource)) architecture = 'x86';

  return {
    application: 'sdkwork-birdcoder-pc',
    architecture,
    operatingSystem,
    runtime,
    version: PROJECT_MOUNT_CLIENT_METADATA_VERSION,
  };
}

function normalizeProjectMountClientMetadata(
  value: unknown,
  expectedRuntime: ProjectMountClientMetadata['runtime'],
): ProjectMountClientMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const client = value as Partial<ProjectMountClientMetadata>;
  if (
    client.application !== 'sdkwork-birdcoder-pc'
    || client.runtime !== expectedRuntime
    || client.version !== PROJECT_MOUNT_CLIENT_METADATA_VERSION
  ) {
    return undefined;
  }
  const operatingSystem = client.operatingSystem;
  const architecture = client.architecture;
  if (
    !['android', 'chromeos', 'ios', 'linux', 'macos', 'unknown', 'windows'].includes(
      operatingSystem ?? '',
    )
    || !['aarch64', 'arm', 'unknown', 'x86', 'x86_64'].includes(architecture ?? '')
  ) {
    return undefined;
  }
  return {
    application: 'sdkwork-birdcoder-pc',
    architecture: architecture!,
    operatingSystem: operatingSystem!,
    runtime: expectedRuntime,
    version: PROJECT_MOUNT_CLIENT_METADATA_VERSION,
  };
}

function normalizeStoredProjectId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeMountOwnerKey(value: unknown): string | undefined {
  return typeof value === 'string' && /^[0-9a-f]{64}$/iu.test(value.trim())
    ? value.trim().toLowerCase()
    : undefined;
}

function normalizeDirectoryFingerprint(value: unknown): string | undefined {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/iu.test(value.trim())
    ? value.trim().toLowerCase()
    : undefined;
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
    const projectId = normalizeStoredProjectId(parsed.projectId);
    const ownerKey = normalizeMountOwnerKey(parsed.ownerKey);
    const client = normalizeProjectMountClientMetadata(parsed.client, 'tauri');
    const createdAt = normalizeStoredTimestamp(parsed.createdAt);
    const updatedAt = normalizeStoredTimestamp(parsed.updatedAt);
    return {
      ...(client ? { client } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(parsed.createdSurface === 'desktop' ? { createdSurface: 'desktop' as const } : {}),
      displayName: normalizeDisplayName(parsed.displayName),
      path,
      ...(ownerKey ? { ownerKey } : {}),
      ...(projectId ? { projectId } : {}),
      ...(rootLocator ? { rootLocator } : {}),
      ...(updatedAt ? { updatedAt } : {}),
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

    const directoryFingerprint = normalizeDirectoryFingerprint(record.directoryFingerprint);
    const client = normalizeProjectMountClientMetadata(record.client, 'browser');
    const createdAt = normalizeStoredTimestamp(record.createdAt);
    const updatedAt = normalizeStoredTimestamp(record.updatedAt);
    const projectId = normalizeStoredProjectId(record.projectId);
    const ownerKey = normalizeMountOwnerKey(record.ownerKey);
    return {
      ...(client ? { client } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(record.createdSurface === 'browser' ? { createdSurface: 'browser' as const } : {}),
      ...(directoryFingerprint ? { directoryFingerprint } : {}),
      displayName: normalizeDisplayName(record.displayName),
      handle: record.handle,
      key,
      ...(ownerKey ? { ownerKey } : {}),
      ...(projectId ? { projectId } : {}),
      ...(updatedAt ? { updatedAt } : {}),
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
  knownDirectoryFingerprint?: string,
  identity?: {
    previousMount?: BrowserStoredProjectMount | null;
    projectId: string;
    subject: ProjectDeviceMountSubject;
  },
): Promise<boolean> {
  let directoryFingerprint = normalizeDirectoryFingerprint(knownDirectoryFingerprint);
  if (!directoryFingerprint) {
    try {
      directoryFingerprint = await fingerprintBrowserDirectoryHandle(source.handle);
    } catch {
      directoryFingerprint = undefined;
    }
  }
  const database = await openBrowserMountDatabase();
  if (!database) {
    return false;
  }

  try {
    const transaction = database.transaction(BROWSER_MOUNT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BROWSER_MOUNT_STORE_NAME);
    const now = new Date().toISOString();
    await awaitIndexedDbRequest(
      store.put({
        client: resolveProjectMountClientMetadata('browser'),
        createdAt: identity?.previousMount?.createdAt ?? now,
        createdSurface: 'browser',
        ...(directoryFingerprint ? { directoryFingerprint } : {}),
        displayName: normalizeDisplayName(source.handle.name),
        handle: source.handle,
        key,
        ...(identity
          ? {
              ownerKey: sha256Hash(identity.subject.subjectId),
              projectId: identity.projectId,
            }
          : {}),
        updatedAt: now,
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

async function deleteTauriStoredProjectMount(key: string): Promise<void> {
  const invoke = await resolveBirdCoderTauriInvoke();
  if (!invoke) {
    return;
  }
  try {
    await invoke('local_store_delete', {
      key,
      scope: TAURI_MOUNT_STORAGE_SCOPE,
    });
  } catch {
    // The canonical replacement is already durable; stale-key cleanup is best effort.
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

async function prepareTauriStoredProjectMount(
  projectId: string,
  subject: ProjectDeviceMountSubject,
): Promise<BrowserProviderSessionDirectoryIdentity | null> {
  const invoke = await resolveBirdCoderTauriInvoke();
  if (!invoke) {
    return null;
  }

  try {
    const identity = await invoke<TauriProviderSessionDirectoryIdentityResponse | null>(
      'project_device_mount_provider_session_directory_identity',
      {
        ownerKeys: resolveCompatibleMountOwnerKeys(subject),
        projectId,
      },
    );
    const directoryFingerprint = normalizeDirectoryFingerprint(
      identity?.directoryFingerprint,
    );
    const directoryName = identity?.directoryName?.trim();
    if (!directoryFingerprint || !directoryName) {
      return null;
    }
    return {
      directoryFingerprint,
      directoryName: normalizeDisplayName(directoryName),
    };
  } catch {
    return null;
  }
}

function resolveCompatibleMountOwnerKeys(subject: ProjectDeviceMountSubject): string[] {
  const ownerKeys = new Set([sha256Hash(subject.subjectId)]);
  const subjectSegments = subject.subjectId.split('\u0001');
  if (subjectSegments.length === 3 && subjectSegments[0] && subjectSegments[2]) {
    ownerKeys.add(sha256Hash([subjectSegments[0], '0', subjectSegments[2]].join('\u0001')));
  }
  return [...ownerKeys];
}

function mountMatchesProjectIdentity(
  mount: TauriStoredProjectMount,
  projectId: string,
  ownerKeys: readonly string[],
  allowMissingIdentity: boolean,
): boolean {
  const storedProjectId = normalizeStoredProjectId(mount.projectId);
  const storedOwnerKey = normalizeMountOwnerKey(mount.ownerKey);
  if (!storedProjectId || !storedOwnerKey) {
    return allowMissingIdentity;
  }
  return storedProjectId === projectId && ownerKeys.includes(storedOwnerKey);
}

function enrichTauriStoredProjectMount(
  mount: TauriStoredProjectMount,
  projectId: string,
  subject: ProjectDeviceMountSubject,
): TauriStoredProjectMount {
  const now = new Date().toISOString();
  return {
    ...mount,
    client: resolveProjectMountClientMetadata('tauri'),
    createdAt: mount.createdAt ?? now,
    createdSurface: 'desktop',
    ownerKey: sha256Hash(subject.subjectId),
    projectId,
    updatedAt: now,
    version: TAURI_MOUNT_STORAGE_VERSION,
  };
}

async function recoverTauriStoredProjectMount(
  key: string,
  projectId: string,
  subject: ProjectDeviceMountSubject,
): Promise<TauriStoredProjectMount | null> {
  const ownerKeys = resolveCompatibleMountOwnerKeys(subject);
  const directMount = await readTauriStoredProjectMount(key);
  if (directMount) {
    if (!mountMatchesProjectIdentity(directMount, projectId, ownerKeys, true)) {
      // The mount is keyed by project path. When the same path is bound to a
      // different (re-imported) project record, migrate the stored projectId
      // instead of dropping the mount: a stale mount would otherwise make the
      // desktop provider Session sync fall back to the process cwd and hide
      // every Session from the project's list.
      const storedProjectId = normalizeStoredProjectId(directMount.projectId);
      const storedOwnerKey = normalizeMountOwnerKey(directMount.ownerKey);
      if (storedProjectId && storedOwnerKey && ownerKeys.includes(storedOwnerKey)) {
        const migratedMount = enrichTauriStoredProjectMount(directMount, projectId, subject);
        // Re-authorize the persisted path before writing: the host only
        // accepts mount records whose path is an authorized desktop root, and
        // the authorization registry is process-local (empty after restart).
        if (await prepareTauriStoredProjectMount(projectId, subject)) {
          if (await writeTauriStoredProjectMount(key, migratedMount)) {
            return migratedMount;
          }
        }
      }
      return null;
    }
    const currentOwnerKey = sha256Hash(subject.subjectId);
    if (
      directMount.client
      && directMount.createdAt
      && directMount.createdSurface === 'desktop'
      && directMount.ownerKey === currentOwnerKey
      && directMount.projectId === projectId
    ) {
      return (await prepareTauriStoredProjectMount(projectId, subject))
        ? directMount
        : null;
    }
    const canonicalMount = enrichTauriStoredProjectMount(directMount, projectId, subject);
    if (!(await prepareTauriStoredProjectMount(projectId, subject))) {
      return null;
    }
    if (!(await writeTauriStoredProjectMount(key, canonicalMount))) {
      return null;
    }
    return canonicalMount;
  }

  const invoke = await resolveBirdCoderTauriInvoke();
  if (!invoke) {
    return null;
  }
  let recoveryEntry: TauriProjectDeviceMountEntry | null;
  try {
    recoveryEntry = await invoke<TauriProjectDeviceMountEntry | null>('project_device_mount_find', {
      ownerKeys,
      projectId,
    });
  } catch {
    return null;
  }
  if (
    !recoveryEntry
    || !/^[0-9a-f]{64}$/iu.test(recoveryEntry.key)
    || typeof recoveryEntry.value !== 'string'
  ) {
    return null;
  }
  const recoveredMount = parseTauriStoredProjectMount(recoveryEntry.value);
  if (
    !recoveredMount
    || !mountMatchesProjectIdentity(recoveredMount, projectId, ownerKeys, false)
  ) {
    // The desktop host returns a single same-owner mount even when its
    // projectId points at a retired project record (the project was deleted
    // and re-imported under a new id). Migrate the stored projectId instead
    // of dropping the mount: a stale mount would otherwise make the desktop
    // provider Session sync fall back to the process cwd and hide every
    // Session from the project's list.
    if (!recoveredMount) {
      return null;
    }
    const storedProjectId = normalizeStoredProjectId(recoveredMount.projectId);
    const storedOwnerKey = normalizeMountOwnerKey(recoveredMount.ownerKey);
    if (!storedProjectId || !storedOwnerKey || !ownerKeys.includes(storedOwnerKey)) {
      return null;
    }
    const migratedMount = enrichTauriStoredProjectMount(recoveredMount, projectId, subject);
    // Re-authorize before writing (the host authorization registry is
    // process-local and empty after restart).
    if (!(await prepareTauriStoredProjectMount(projectId, subject))) {
      return null;
    }
    if (!(await writeTauriStoredProjectMount(key, migratedMount))) {
      return null;
    }
    if (recoveryEntry.key.toLowerCase() !== key.toLowerCase()) {
      await deleteTauriStoredProjectMount(recoveryEntry.key);
    }
    return migratedMount;
  }

  const canonicalMount = enrichTauriStoredProjectMount(recoveredMount, projectId, subject);
  if (!(await prepareTauriStoredProjectMount(projectId, subject))) {
    return null;
  }
  if (!(await writeTauriStoredProjectMount(key, canonicalMount))) {
    return null;
  }
  if (recoveryEntry.key.toLowerCase() !== key.toLowerCase()) {
    await deleteTauriStoredProjectMount(recoveryEntry.key);
  }
  return canonicalMount;
}

function toTauriRuntimeLocationBinding(
  mount: TauriStoredProjectMount,
): TauriProjectRuntimeLocationBinding {
  return {
    displayName: mount.displayName,
    ...(mount.rootLocator ? { rootLocator: mount.rootLocator } : {}),
  };
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) {
      return difference;
    }
  }
  return leftBytes.length - rightBytes.length;
}

interface BrowserDirectoryEntryIterable {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

function browserDirectoryEntries(
  handle: FileSystemDirectoryHandle,
): AsyncIterableIterator<[string, FileSystemHandle]> {
  const iterableHandle = handle as FileSystemDirectoryHandle
    & Partial<BrowserDirectoryEntryIterable>;
  if (typeof iterableHandle.entries !== 'function') {
    throw new Error('browser directory handle does not support entry iteration');
  }
  return iterableHandle.entries();
}

export async function fingerprintBrowserDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<string> {
  const entries: Array<{ kind: 'd' | 'f' | 'o'; name: string }> = [];
  for await (const [name, entry] of browserDirectoryEntries(handle)) {
    entries.push({
      kind: entry.kind === 'directory' ? 'd' : entry.kind === 'file' ? 'f' : 'o',
      name,
    });
  }
  entries.sort((left, right) => compareUtf8(left.name, right.name));
  const manifest = entries.reduce(
    (value, entry) => `${value}${entry.kind}\0${entry.name}\n`,
    PROVIDER_SESSION_DIRECTORY_FINGERPRINT_PREFIX,
  );
  return `sha256:${sha256Hash(manifest)}`;
}

function createTauriStoredProjectMount(
  source: Extract<LocalFolderMountSource, { type: 'tauri' }>,
  previousMount: TauriStoredProjectMount | null,
  projectId: string,
  subject: ProjectDeviceMountSubject,
): TauriStoredProjectMount | null {
  const path = normalizeAbsoluteTauriPath(source.path);
  if (!path) {
    return null;
  }

  return enrichTauriStoredProjectMount({
    displayName: resolveTauriMountDisplayName(path),
    path,
    ...(previousMount?.createdAt ? { createdAt: previousMount.createdAt } : {}),
    ...(previousMount?.rootLocator ? { rootLocator: previousMount.rootLocator } : {}),
    version: TAURI_MOUNT_STORAGE_VERSION,
  }, projectId, subject);
}

/**
 * Persists a local folder reference only in the active device boundary.
 * Generic Project records and app SDK DTOs never receive the stored source.
 * The Tauri host owns the private native path and issues only opaque local
 * root locators for Agents runtime bindings.
 */
export class ProjectDeviceMountRegistry {
  private readonly subjectProvider?: ProjectDeviceMountSubjectProvider;

  constructor(options: ProjectDeviceMountRegistryOptions = {}) {
    this.subjectProvider = options.subjectProvider;
  }

  async getCurrentSubjectKey(): Promise<string | null> {
    return (await this.resolveCurrentSubject())?.key ?? null;
  }

  async resolveBrowserProviderSessionDirectoryIdentity(
    projectId: string,
    expectedSubjectKey?: string | null,
  ): Promise<BrowserProviderSessionDirectoryIdentity | null> {
    if (await isBirdCoderTauriRuntime()) {
      return null;
    }
    const normalizedProjectId = normalizeProjectId(projectId);
    const resolvedSubject = await this.resolveCurrentSubject();
    const currentSubjectKey = resolvedSubject?.key ?? null;
    if (
      !resolvedSubject
      || (expectedSubjectKey !== undefined && currentSubjectKey !== expectedSubjectKey)
    ) {
      return null;
    }

    const key = buildSubjectProjectMountKey(resolvedSubject.subject, normalizedProjectId);
    const storedMount = await readBrowserStoredProjectMount(key);
    if (!storedMount || !(await this.isCurrentSubjectKey(currentSubjectKey))) {
      return null;
    }
    if ((await queryBrowserMountPermission(storedMount.handle)) !== 'granted') {
      return storedMount.directoryFingerprint
        ? {
            directoryFingerprint: storedMount.directoryFingerprint,
            directoryName: normalizeDisplayName(storedMount.handle.name),
          }
        : null;
    }
    const directoryFingerprint = await fingerprintBrowserDirectoryHandle(storedMount.handle);
    if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
      return null;
    }
    await writeBrowserStoredProjectMount(
      key,
      { handle: storedMount.handle, type: 'browser' },
      directoryFingerprint,
      {
        previousMount: storedMount,
        projectId: normalizedProjectId,
        subject: resolvedSubject.subject,
      },
    );
    if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
      return null;
    }
    return {
      directoryFingerprint,
      directoryName: normalizeDisplayName(storedMount.handle.name),
    };
  }

  async resolveProviderSessionDirectoryIdentity(
    projectId: string,
    expectedSubjectKey?: string | null,
  ): Promise<BrowserProviderSessionDirectoryIdentity | null> {
    if (!(await isBirdCoderTauriRuntime())) {
      return this.resolveBrowserProviderSessionDirectoryIdentity(projectId, expectedSubjectKey);
    }

    const normalizedProjectId = normalizeProjectId(projectId);
    const resolvedSubject = await this.resolveCurrentSubject();
    const subjectKey = resolvedSubject?.key ?? null;
    if (
      !resolvedSubject
      || (expectedSubjectKey !== undefined && subjectKey !== expectedSubjectKey)
    ) {
      return null;
    }

    const key = buildSubjectProjectMountKey(resolvedSubject.subject, normalizedProjectId);
    const mount = await recoverTauriStoredProjectMount(
      key,
      normalizedProjectId,
      resolvedSubject.subject,
    );
    if (!mount || !(await this.isCurrentSubjectKey(subjectKey))) {
      return null;
    }

    const identity = await prepareTauriStoredProjectMount(
      normalizedProjectId,
      resolvedSubject.subject,
    );
    return identity && await this.isCurrentSubjectKey(subjectKey) ? identity : null;
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
      const previousMount = await readBrowserStoredProjectMount(key);
      persisted = await writeBrowserStoredProjectMount(key, source, undefined, {
        previousMount,
        projectId: normalizedProjectId,
        subject: resolvedSubject.subject,
      });
    } else {
      const previousMount = await recoverTauriStoredProjectMount(
        key,
        normalizedProjectId,
        resolvedSubject.subject,
      );
      if (!(await this.isCurrentSubjectKey(currentSubjectKey))) {
        return createMountState('mount_required');
      }

      const nextMount = createTauriStoredProjectMount(
        source,
        previousMount,
        normalizedProjectId,
        resolvedSubject.subject,
      );
      persisted = nextMount ? await writeTauriStoredProjectMount(key, nextMount) : false;
      if (persisted) {
        persisted = Boolean(
          await prepareTauriStoredProjectMount(normalizedProjectId, resolvedSubject.subject),
        );
      }
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

      const storedMount = await recoverTauriStoredProjectMount(
        key,
        normalizedProjectId,
        resolvedSubject.subject,
      );
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
    const mount = await recoverTauriStoredProjectMount(
      key,
      normalizedProjectId,
      resolvedSubject.subject,
    );
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
