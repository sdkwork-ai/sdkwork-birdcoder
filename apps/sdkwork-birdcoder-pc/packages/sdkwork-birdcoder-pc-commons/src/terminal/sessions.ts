import { getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import type {
  DesktopRuntimeBridgeClient,
  DesktopTerminalSessionInventorySnapshot,
} from './contracts/sdkworkTerminalInfrastructure.d.ts';
import {
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  getBirdCoderGlobalTokenManager,
  readBirdCoderRuntimePublicEnv,
} from '@sdkwork/birdcoder-pc-infrastructure';
import {
  createWebRuntimeBridgeClient,
  resolveWebRuntimeBridgeAuthToken,
} from '@sdkwork/terminal-pc-infrastructure';
import { isBirdcoderTauriRuntime } from './birdcoderTerminalRuntime.ts';

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

async function resolveDesktopRuntimeClient(): Promise<DesktopRuntimeBridgeClient | null> {
  if (!isBirdcoderTauriRuntime()) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { createDesktopRuntimeBridgeClient } = await import('@sdkwork/terminal-pc-infrastructure');
    return createDesktopRuntimeBridgeClient(invoke) as unknown as DesktopRuntimeBridgeClient;
  } catch {
    return null;
  }
}

interface BrowserRuntimeSessionDescriptor {
  sessionId: string;
  workspaceId: string;
  state: string;
  lastActiveAt: string;
  tags: string[];
}

function readTaggedValue(tags: readonly string[], prefix: string): string {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length).trim() ?? '';
}

async function listBrowserRuntimeSessions(): Promise<TerminalSessionRecord[]> {
  try {
    const baseUrl = readBirdCoderRuntimePublicEnv(
      'VITE_SDKWORK_BIRDCODER_TERMINAL_RUNTIME_BASE_URL',
    ) ?? readBirdCoderRuntimePublicEnv('VITE_SDKWORK_TERMINAL_RUNTIME_BASE_URL') ??
      getDefaultBirdCoderIdeServicesRuntimeConfig().apiBaseUrl;
    const tokenManager = getBirdCoderGlobalTokenManager();
    const authToken = resolveWebRuntimeBridgeAuthToken(
      tokenManager.getAuthToken() || tokenManager.getAccessToken(),
    );
    const accessToken = tokenManager.getAccessToken()?.trim() || undefined;
    if (!authToken || !accessToken) {
      return [];
    }
    const snapshot = await createWebRuntimeBridgeClient({
      baseUrl,
      authToken,
      accessToken,
    }).sessionIndex() as {
      sessions?: BrowserRuntimeSessionDescriptor[];
    };
    return (snapshot.sessions ?? [])
      .filter((session) => session.tags.includes('birdcoder'))
      .map((session) => {
        const profileId = getTerminalProfile(
          readTaggedValue(session.tags, 'profile:') || 'bash',
        ).id;
        return {
          id: session.sessionId,
          title: readTaggedValue(session.tags, 'title:') || getTerminalProfile(profileId).title,
          profileId,
          cwd: readTaggedValue(session.tags, 'cwd:'),
          updatedAt: Number.isNaN(Date.parse(session.lastActiveAt))
            ? 0
            : Date.parse(session.lastActiveAt),
          workspaceId: session.workspaceId,
          projectId: readTaggedValue(session.tags, 'project:'),
          status: normalizeTerminalSessionStatus(session.state),
          lastExitCode: null,
        };
      });
  } catch {
    return [];
  }
}

function normalizeTerminalSessionStatus(value: string): TerminalSessionStatus {
  switch (value.trim().toLowerCase()) {
    case 'creating':
    case 'starting':
    case 'running':
    case 'reattaching':
    case 'replaying':
    case 'stopping':
      return 'running';
    case 'failed':
    case 'error':
      return 'error';
    case 'exited':
    case 'closed':
      return 'closed';
    case 'detached':
    case 'idle':
    default:
      return 'idle';
  }
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
    return sortAndSliceTerminalSessions(
      filterTerminalSessions(await listBrowserRuntimeSessions(), options),
      options,
    );
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
