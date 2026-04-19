import {
  createJsonRecordRepository,
  type BirdCoderJsonRecordRepository,
} from '../storage/dataKernel.ts';
import { getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import type { TerminalHostSessionStatus } from './runtime.ts';
import {
  BIRDCODER_TERMINAL_SESSION_STORAGE_BINDING,
} from '@sdkwork/birdcoder-types/storageBindings';

const MAX_COMMAND_HISTORY = 50;
const MAX_OUTPUT_LINES = 40;

export interface TerminalSessionRecord {
  id: string;
  title: string;
  profileId: TerminalProfileId;
  cwd: string;
  commandHistory: string[];
  recentOutput: string[];
  updatedAt: number;
  workspaceId: string;
  projectId: string;
  status: TerminalHostSessionStatus;
  lastExitCode: number | null;
}

interface TerminalSessionPersistedEntry {
  id: string;
  title?: string;
  profileId?: string;
  cwd?: string;
  commandHistory?: unknown;
  recentOutput?: unknown;
  updatedAt?: number;
  workspaceId?: string;
  projectId?: string;
  status?: string;
  lastExitCode?: number | null;
}

interface DesktopTerminalSessionInventorySnapshot {
  sessionId: string;
  title: string;
  profileId: string;
  cwd: string;
  updatedAt: string;
  workspaceId: string;
  projectId: string;
  status: string;
  lastExitCode: number | null;
}

type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

interface TerminalTabLike {
  id: string;
  title: string;
  profileId: TerminalProfileId;
  cwd: string;
  history: ReadonlyArray<string | unknown>;
  commandHistory: ReadonlyArray<string>;
  status?: TerminalHostSessionStatus;
  lastExitCode?: number | null;
}

export interface TerminalSessionContext {
  workspaceId?: string | null;
  projectId?: string | null;
}

interface ListStoredTerminalSessionsOptions {
  projectId?: string | null;
  includeGlobal?: boolean;
  limit?: number;
}

const terminalSessionRepository: BirdCoderJsonRecordRepository<TerminalSessionRecord[]> =
  createJsonRecordRepository<TerminalSessionRecord[]>({
    binding: BIRDCODER_TERMINAL_SESSION_STORAGE_BINDING,
    fallback: [],
    normalize(value) {
      return normalizeStoredTerminalSessionCollection(value);
    },
  });

function compactStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(-limit);
}

function resolveTauriInvoke(): Promise<TauriInvoke | null> {
  if (typeof window === 'undefined' || !window.__TAURI__) {
    return Promise.resolve(null);
  }

  return import('@tauri-apps/api/core')
    .then(({ invoke }) => invoke)
    .catch(() => null);
}

function normalizeStoredTerminalSessionCollection(value: unknown): TerminalSessionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is TerminalSessionPersistedEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as Partial<TerminalSessionPersistedEntry>).id === 'string',
    )
    .map(normalizeTerminalSessionRecord)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function getTerminalSessionRepository(): BirdCoderJsonRecordRepository<TerminalSessionRecord[]> {
  return terminalSessionRepository;
}

export function normalizeTerminalSessionRecord(
  value: TerminalSessionPersistedEntry,
): TerminalSessionRecord {
  const profileId = getTerminalProfile(value.profileId ?? 'powershell').id;
  const title = value.title?.trim() || getTerminalProfile(profileId).title;

  return {
    id: value.id,
    title,
    profileId,
    cwd: value.cwd ?? '',
    commandHistory: compactStringList(value.commandHistory, MAX_COMMAND_HISTORY),
    recentOutput: compactStringList(value.recentOutput, MAX_OUTPUT_LINES),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
    workspaceId: value.workspaceId?.trim() ?? '',
    projectId: value.projectId?.trim() ?? '',
    status:
      value.status === 'running' ||
      value.status === 'error' ||
      value.status === 'closed' ||
      value.status === 'idle'
        ? value.status
        : 'idle',
    lastExitCode: typeof value.lastExitCode === 'number' ? value.lastExitCode : null,
  };
}

export function buildTerminalLayoutStorageKey(projectId: string | null | undefined): string {
  const normalizedProjectId = projectId?.trim();
  return normalizedProjectId ? `layout.${normalizedProjectId}.v1` : 'layout.global.v1';
}

export function matchesTerminalSessionScope(
  session: Pick<TerminalSessionRecord, 'projectId'>,
  projectId: string | null | undefined,
): boolean {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (!normalizedProjectId) {
    return session.projectId.length === 0;
  }

  return session.projectId.length === 0 || session.projectId === normalizedProjectId;
}

export function buildTerminalSessionRecord(
  tab: TerminalTabLike,
  updatedAt = Date.now(),
  context: TerminalSessionContext = {},
): TerminalSessionRecord {
  return normalizeTerminalSessionRecord({
    id: tab.id,
    title: tab.title,
    profileId: tab.profileId,
    cwd: tab.cwd,
    commandHistory: [...tab.commandHistory],
    recentOutput: tab.history.filter((item): item is string => typeof item === 'string'),
    updatedAt,
    workspaceId: context.workspaceId ?? '',
    projectId: context.projectId ?? '',
    status: tab.status ?? 'idle',
    lastExitCode: typeof tab.lastExitCode === 'number' ? tab.lastExitCode : null,
  });
}

function normalizeTerminalSessionRuntimeStatus(value: string): TerminalHostSessionStatus {
  return value === 'running' || value === 'error' || value === 'closed' || value === 'idle'
    ? value
    : 'idle';
}

function normalizeRuntimeTerminalSessionRecord(
  record: DesktopTerminalSessionInventorySnapshot,
): TerminalSessionRecord {
  return normalizeTerminalSessionRecord({
    id: record.sessionId,
    title: record.title,
    profileId: record.profileId,
    cwd: record.cwd,
    commandHistory: [],
    recentOutput: [],
    updatedAt: Number.isNaN(Date.parse(record.updatedAt)) ? 0 : Date.parse(record.updatedAt),
    workspaceId: record.workspaceId,
    projectId: record.projectId,
    status: normalizeTerminalSessionRuntimeStatus(record.status),
    lastExitCode: record.lastExitCode,
  });
}

export async function listStoredTerminalSessions(
  options: ListStoredTerminalSessionsOptions = {},
): Promise<TerminalSessionRecord[]> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      const runtimeRecords = await invoke<DesktopTerminalSessionInventorySnapshot[]>(
        'desktop_terminal_session_inventory_list',
      );
      const records = runtimeRecords.map(normalizeRuntimeTerminalSessionRecord);

      if (options.projectId === undefined) {
        return records.sort((left, right) => right.updatedAt - left.updatedAt);
      }

      const includeGlobal = options.includeGlobal ?? true;
      const filteredRecords = records
        .filter((session) =>
          includeGlobal
            ? matchesTerminalSessionScope(session, options.projectId)
            : session.projectId === (options.projectId?.trim() ?? ''),
        )
        .sort((left, right) => right.updatedAt - left.updatedAt);

      if (typeof options.limit === 'number') {
        return filteredRecords.slice(0, Math.max(options.limit, 0));
      }

      return filteredRecords;
    } catch {
      // Fall through to the browser store when the desktop bridge is unavailable.
    }
  }

  const records = await terminalSessionRepository.read();

  if (options.projectId === undefined) {
    return records.sort((left, right) => right.updatedAt - left.updatedAt);
  }

  const includeGlobal = options.includeGlobal ?? true;
  const filteredRecords = records
    .filter((session) =>
      includeGlobal
        ? matchesTerminalSessionScope(session, options.projectId)
        : session.projectId === (options.projectId?.trim() ?? ''),
    )
    .sort((left, right) => right.updatedAt - left.updatedAt);

  if (typeof options.limit === 'number') {
    return filteredRecords.slice(0, Math.max(options.limit, 0));
  }

  return filteredRecords;
}

export async function saveStoredTerminalSession(record: TerminalSessionRecord): Promise<void> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    return;
  }

  const normalizedRecord = normalizeTerminalSessionRecord(record);
  const sessions = await listStoredTerminalSessions();
  const nextSessions = [
    normalizedRecord,
    ...sessions.filter((session) => session.id !== normalizedRecord.id),
  ].sort((left, right) => right.updatedAt - left.updatedAt);
  await terminalSessionRepository.write(nextSessions);
}

export async function removeStoredTerminalSession(id: string): Promise<void> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    return;
  }

  const sessions = await listStoredTerminalSessions();
  await terminalSessionRepository.write(sessions.filter((session) => session.id !== id));
}
