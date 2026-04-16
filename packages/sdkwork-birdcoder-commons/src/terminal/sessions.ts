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

interface TerminalSessionBridgeRecord {
  id: string;
  title: string;
  profileId: string;
  cwd: string;
  commandHistoryJson: string;
  recentOutputJson: string;
  updatedAt: number;
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

function normalizeTerminalSessionBridgeRecord(
  record: TerminalSessionBridgeRecord,
): TerminalSessionRecord {
  return normalizeTerminalSessionRecord({
    id: record.id,
    title: record.title,
    profileId: record.profileId,
    cwd: record.cwd,
    commandHistory: JSON.parse(record.commandHistoryJson),
    recentOutput: JSON.parse(record.recentOutputJson),
    updatedAt: record.updatedAt,
    workspaceId: record.workspaceId,
    projectId: record.projectId,
    status: record.status,
    lastExitCode: record.lastExitCode,
  });
}

export async function listStoredTerminalSessions(
  options: ListStoredTerminalSessionsOptions = {},
): Promise<TerminalSessionRecord[]> {
  const invoke = await resolveTauriInvoke();
  let records: TerminalSessionRecord[] = [];
  if (invoke) {
    try {
      records = (await invoke<TerminalSessionBridgeRecord[]>('terminal_session_list')).map(
        normalizeTerminalSessionBridgeRecord,
      );
    } catch {
      // Fall through to the browser store when the desktop bridge is unavailable.
    }
  }

  if (records.length === 0) {
    records = await terminalSessionRepository.read();
  }

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
  const normalizedRecord = normalizeTerminalSessionRecord(record);
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      await invoke('terminal_session_upsert', {
        record: {
          ...normalizedRecord,
          commandHistoryJson: JSON.stringify(normalizedRecord.commandHistory),
          recentOutputJson: JSON.stringify(normalizedRecord.recentOutput),
        },
      });
      return;
    } catch {
      // Fall through to the browser store when the desktop bridge is unavailable.
    }
  }

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
    try {
      await invoke('terminal_session_delete', { id });
      return;
    } catch {
      // Fall through to the browser store when the desktop bridge is unavailable.
    }
  }

  const sessions = await listStoredTerminalSessions();
  await terminalSessionRepository.write(sessions.filter((session) => session.id !== id));
}
