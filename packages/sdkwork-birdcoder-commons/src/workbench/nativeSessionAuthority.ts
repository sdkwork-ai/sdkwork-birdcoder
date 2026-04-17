import type {
  BirdCoderChatMessage,
  BirdCoderGetNativeSessionRequest,
  BirdCoderListNativeSessionsRequest,
  BirdCoderNativeSessionDetail,
  BirdCoderNativeSessionSummary,
} from '@sdkwork/birdcoder-types';
import {
  readNativeCodexSessionRecord,
  type NativeCodexSessionRecord,
  type StoredCodingSessionInventoryRecord,
} from './nativeCodexSessionStore.ts';

const CODEX_NATIVE_SESSION_ID_PREFIX = 'codex-native:';

function normalizeNativeSessionAuthorityEngineId(
  value: string | null | undefined,
): string | null {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
}

export function resolveAuthorityBackedNativeSessionIdPrefix(
  engineId: string | null | undefined,
): string | null {
  const normalizedEngineId = normalizeNativeSessionAuthorityEngineId(engineId);
  return normalizedEngineId ? `${normalizedEngineId}-native:` : null;
}

export function isAuthorityBackedNativeSessionId(
  codingSessionId: string,
  engineId?: string,
): boolean {
  const normalizedCodingSessionId = codingSessionId.trim().toLowerCase();
  if (!normalizedCodingSessionId) {
    return false;
  }

  const expectedPrefix = resolveAuthorityBackedNativeSessionIdPrefix(engineId);
  return (
    normalizedCodingSessionId.startsWith(CODEX_NATIVE_SESSION_ID_PREFIX) ||
    (expectedPrefix !== null && normalizedCodingSessionId.startsWith(expectedPrefix)) ||
    /^[a-z0-9-]+-native:/u.test(normalizedCodingSessionId) ||
    normalizedCodingSessionId.includes(':native:')
  );
}

export type NativeSessionAuthorityCoreReadService = Pick<
  {
    getNativeSession(
      codingSessionId: string,
      request?: BirdCoderGetNativeSessionRequest,
    ): Promise<BirdCoderNativeSessionDetail>;
    listNativeSessions(
      request?: BirdCoderListNativeSessionsRequest,
    ): Promise<BirdCoderNativeSessionSummary[]>;
  },
  'getNativeSession' | 'listNativeSessions'
>;

function toStoredNativeSessionSummary(
  summary: BirdCoderNativeSessionSummary,
): StoredCodingSessionInventoryRecord {
  return {
    createdAt: summary.createdAt,
    engineId: summary.engineId,
    hostMode: summary.hostMode,
    id: summary.id,
    kind: 'coding',
    lastTurnAt: summary.lastTurnAt,
    modelId: summary.modelId,
    nativeCwd: summary.nativeCwd ?? null,
    projectId: summary.projectId,
    sortTimestamp: summary.sortTimestamp,
    status: summary.status,
    title: summary.title,
    transcriptUpdatedAt: summary.transcriptUpdatedAt ?? null,
    updatedAt: summary.updatedAt,
    workspaceId: summary.workspaceId,
  };
}

function toNativeChatMessage(message: BirdCoderNativeSessionDetail['messages'][number]): BirdCoderChatMessage {
  return {
    id: message.id,
    codingSessionId: message.codingSessionId,
    content: message.content,
    createdAt: message.createdAt,
    commands: message.commands?.map((command) => ({
      command: command.command,
      output: command.output,
      status: command.status,
    })),
    metadata: message.metadata,
    role: message.role,
    timestamp: Date.parse(message.createdAt),
    turnId: message.turnId,
  };
}

function toNativeCodexSessionRecord(
  detail: BirdCoderNativeSessionDetail,
): NativeCodexSessionRecord {
  return {
    filePath: '',
    messages: detail.messages.map(toNativeChatMessage),
    summary: toStoredNativeSessionSummary(detail.summary),
  };
}

export interface ListAuthorityBackedNativeSessionsOptions {
  coreReadService?: NativeSessionAuthorityCoreReadService;
  engineId?: string;
  limit?: number;
  projectId?: string | null;
  workspaceId?: string | null;
}

function shouldFallbackToLocalCodexSessions(engineId?: string): boolean {
  const normalizedEngineId = normalizeNativeSessionAuthorityEngineId(engineId);
  return !normalizedEngineId || normalizedEngineId === 'codex';
}

function shouldFallbackToLocalCodexSessionRecord(
  codingSessionId: string,
  engineId?: string,
): boolean {
  return (
    shouldFallbackToLocalCodexSessions(engineId) ||
    isAuthorityBackedNativeSessionId(codingSessionId, engineId)
  );
}

export async function listAuthorityBackedNativeSessions(
  options: ListAuthorityBackedNativeSessionsOptions = {},
): Promise<StoredCodingSessionInventoryRecord[]> {
  if (!options.coreReadService) {
    return shouldFallbackToLocalCodexSessions(options.engineId)
      ? readLocalNativeCodexSessionSummaries(options.limit)
      : [];
  }

  try {
    const summaries = await options.coreReadService.listNativeSessions({
      engineId: options.engineId,
      limit: options.limit,
      projectId: options.projectId ?? undefined,
      workspaceId: options.workspaceId ?? undefined,
    });

    return summaries
      .filter((summary) => summary.kind === 'coding')
      .map(toStoredNativeSessionSummary);
  } catch (error) {
    console.error('Failed to list native sessions from server authority, falling back locally', error);
    return shouldFallbackToLocalCodexSessions(options.engineId)
      ? readLocalNativeCodexSessionSummaries(options.limit)
      : [];
  }
}

export async function listAuthorityBackedNativeCodexSessions(
  options: ListAuthorityBackedNativeSessionsOptions = {},
): Promise<StoredCodingSessionInventoryRecord[]> {
  return listAuthorityBackedNativeSessions({
    ...options,
    engineId: options.engineId ?? 'codex',
  });
}

async function readLocalNativeCodexSessionSummaries(limit?: number) {
  const { listNativeCodexSessions } = await import('./nativeCodexSessionStore.ts');
  return listNativeCodexSessions(limit);
}

export interface ReadAuthorityBackedNativeSessionRecordOptions {
  coreReadService?: NativeSessionAuthorityCoreReadService;
  engineId?: string;
  projectId?: string;
  workspaceId?: string;
}

export async function readAuthorityBackedNativeSessionRecord(
  codingSessionId: string,
  options: ReadAuthorityBackedNativeSessionRecordOptions = {},
): Promise<NativeCodexSessionRecord | null> {
  if (!options.coreReadService) {
    return shouldFallbackToLocalCodexSessionRecord(codingSessionId, options.engineId)
      ? readNativeCodexSessionRecord(codingSessionId)
      : null;
  }

  try {
    const detail = await options.coreReadService.getNativeSession(codingSessionId, {
      engineId: options.engineId,
      projectId: options.projectId,
      workspaceId: options.workspaceId,
    });
    return toNativeCodexSessionRecord(detail);
  } catch (error) {
    console.error('Failed to read native session from server authority, falling back locally', error);
    return shouldFallbackToLocalCodexSessionRecord(codingSessionId, options.engineId)
      ? readNativeCodexSessionRecord(codingSessionId)
      : null;
  }
}

export async function readAuthorityBackedNativeCodexSessionRecord(
  codingSessionId: string,
  options: ReadAuthorityBackedNativeSessionRecordOptions = {},
): Promise<NativeCodexSessionRecord | null> {
  return readAuthorityBackedNativeSessionRecord(codingSessionId, {
    ...options,
    engineId: options.engineId ?? 'codex',
  });
}
