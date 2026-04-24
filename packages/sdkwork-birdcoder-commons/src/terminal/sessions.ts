import { getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import {
  createDesktopRuntimeBridgeClient,
  type DesktopTerminalSessionInventorySnapshot,
} from '@sdkwork/terminal-infrastructure';

export type TerminalSessionStatus = 'idle' | 'running' | 'error' | 'closed';

export interface TerminalSessionRecord {
  id: string;
  title: string;
  profileId: TerminalProfileId;
  cwd: string;
  updatedAt: number;
  workspaceId: string;
  projectId: string;
  status: TerminalSessionStatus;
  lastExitCode: number | null;
}

export interface ListStoredTerminalSessionsOptions {
  projectId?: string | null;
  includeGlobal?: boolean;
  limit?: number;
}

async function resolveDesktopRuntimeClient() {
  if (typeof window === 'undefined' || !window.__TAURI__) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return createDesktopRuntimeBridgeClient(invoke);
  } catch {
    return null;
  }
}

function normalizeTerminalSessionStatus(value: string): TerminalSessionStatus {
  return value === 'running' || value === 'error' || value === 'closed' || value === 'idle'
    ? value
    : 'idle';
}

function normalizeRuntimeTerminalSessionRecord(
  record: DesktopTerminalSessionInventorySnapshot,
): TerminalSessionRecord {
  const profileId = getTerminalProfile(record.profileId).id;
  const profile = getTerminalProfile(profileId);

  return {
    id: record.sessionId,
    title: record.title?.trim() || profile.title,
    profileId,
    cwd: record.cwd?.trim() || '',
    updatedAt: Number.isNaN(Date.parse(record.updatedAt)) ? 0 : Date.parse(record.updatedAt),
    workspaceId: record.workspaceId?.trim() || '',
    projectId: record.projectId?.trim() || '',
    status: normalizeTerminalSessionStatus(record.status),
    lastExitCode: typeof record.lastExitCode === 'number' ? record.lastExitCode : null,
  };
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

function filterTerminalSessions(
  records: readonly TerminalSessionRecord[],
  options: ListStoredTerminalSessionsOptions,
): TerminalSessionRecord[] {
  if (options.projectId === undefined) {
    return [...records];
  }

  const includeGlobal = options.includeGlobal ?? true;
  return records.filter((session) =>
    includeGlobal
      ? matchesTerminalSessionScope(session, options.projectId)
      : session.projectId === (options.projectId?.trim() ?? ''),
  );
}

function sortAndSliceTerminalSessions(
  records: readonly TerminalSessionRecord[],
  options: ListStoredTerminalSessionsOptions,
): TerminalSessionRecord[] {
  const sortedRecords = [...records].sort((left, right) => right.updatedAt - left.updatedAt);
  if (typeof options.limit !== 'number') {
    return sortedRecords;
  }

  return sortedRecords.slice(0, Math.max(options.limit, 0));
}

export async function listStoredTerminalSessions(
  options: ListStoredTerminalSessionsOptions = {},
): Promise<TerminalSessionRecord[]> {
  const desktopRuntimeClient = await resolveDesktopRuntimeClient();
  if (!desktopRuntimeClient) {
    return [];
  }

  try {
    const runtimeRecords = await desktopRuntimeClient.terminalSessionInventory();
    return sortAndSliceTerminalSessions(
      filterTerminalSessions(runtimeRecords.map(normalizeRuntimeTerminalSessionRecord), options),
      options,
    );
  } catch {
    return [];
  }
}
