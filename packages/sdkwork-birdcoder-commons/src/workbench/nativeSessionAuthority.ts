import type {
  BirdCoderChatMessage,
  BirdCoderCodingSessionSummary,
  BirdCoderGetNativeSessionRequest,
  BirdCoderListNativeSessionsRequest,
  BirdCoderLongIntegerString,
  BirdCoderNativeSessionDetail,
  BirdCoderNativeSessionSummary,
} from '@sdkwork/birdcoder-types';
import {
  isBirdCoderCodeEngineNativeSessionId,
  normalizeBirdCoderCodeEngineNativeSessionId,
  resolveBirdCoderCodeEngineNativeSessionIdPrefix,
} from '@sdkwork/birdcoder-codeengine';

export interface StoredCodingSessionInventoryRecord extends BirdCoderCodingSessionSummary {
  kind: 'coding';
  nativeCwd?: string | null;
  sortTimestamp: BirdCoderLongIntegerString;
  transcriptUpdatedAt?: string | null;
}

export interface AuthorityBackedNativeSessionRecord {
  filePath: string;
  messages: BirdCoderChatMessage[];
  summary: StoredCodingSessionInventoryRecord;
}

export function resolveAuthorityBackedNativeSessionIdPrefix(
  engineId: string | null | undefined,
): string | null {
  return resolveBirdCoderCodeEngineNativeSessionIdPrefix(engineId);
}

export function isAuthorityBackedNativeSessionId(
  codingSessionId: string,
  engineId?: string,
  nativeSessionId?: string | null,
): boolean {
  if (isBirdCoderCodeEngineNativeSessionId(codingSessionId, engineId)) {
    return true;
  }

  const normalizedCodingSessionId = normalizeBirdCoderCodeEngineNativeSessionId(
    codingSessionId,
    engineId,
  );
  const normalizedNativeSessionId = normalizeBirdCoderCodeEngineNativeSessionId(
    nativeSessionId,
    engineId,
  );
  return (
    !!normalizedCodingSessionId &&
    !!normalizedNativeSessionId &&
    normalizedCodingSessionId === normalizedNativeSessionId
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
  const nativeSessionId =
    normalizeBirdCoderCodeEngineNativeSessionId(summary.nativeSessionId ?? summary.id, summary.engineId) ??
    summary.nativeSessionId ??
    summary.id;
  const sessionId =
    normalizeBirdCoderCodeEngineNativeSessionId(summary.id, summary.engineId) ?? summary.id;
  return {
    createdAt: summary.createdAt,
    engineId: summary.engineId,
    hostMode: summary.hostMode,
    id: sessionId,
    kind: 'coding',
    lastTurnAt: summary.lastTurnAt,
    modelId: summary.modelId,
    nativeSessionId,
    nativeCwd: summary.nativeCwd ?? null,
    projectId: summary.projectId,
    runtimeStatus: summary.runtimeStatus,
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
      kind: command.kind,
      output: command.output,
      requiresApproval: command.requiresApproval,
      requiresReply: command.requiresReply,
      runtimeStatus: command.runtimeStatus,
      status: command.status,
      toolCallId: command.toolCallId,
      toolName: command.toolName,
    })),
    fileChanges: message.fileChanges as BirdCoderChatMessage['fileChanges'],
    metadata: message.metadata,
    role: message.role,
    taskProgress: message.taskProgress as BirdCoderChatMessage['taskProgress'],
    timestamp: Date.parse(message.createdAt),
    tool_call_id: message.tool_call_id,
    tool_calls: message.tool_calls as BirdCoderChatMessage['tool_calls'],
    turnId: message.turnId,
  };
}

function toAuthorityBackedNativeSessionRecord(
  detail: BirdCoderNativeSessionDetail,
): AuthorityBackedNativeSessionRecord {
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
  offset?: number;
  projectId?: string | null;
  workspaceId?: string | null;
}

export async function listAuthorityBackedNativeSessions(
  options: ListAuthorityBackedNativeSessionsOptions = {},
): Promise<StoredCodingSessionInventoryRecord[]> {
  if (!options.coreReadService) {
    return [];
  }

  try {
    const summaries = await options.coreReadService.listNativeSessions({
      engineId: options.engineId,
      limit: options.limit,
      offset: options.offset,
      projectId: options.projectId ?? undefined,
      workspaceId: options.workspaceId ?? undefined,
    });

    return summaries
      .filter((summary) => summary.kind === 'coding')
      .map(toStoredNativeSessionSummary);
  } catch (error) {
    console.error('Failed to list native sessions from server authority', error);
    return [];
  }
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
): Promise<AuthorityBackedNativeSessionRecord | null> {
  if (!options.coreReadService) {
    return null;
  }

  try {
    const detail = await options.coreReadService.getNativeSession(codingSessionId, {
      engineId: options.engineId,
      projectId: options.projectId,
      workspaceId: options.workspaceId,
    });
    return toAuthorityBackedNativeSessionRecord(detail);
  } catch (error) {
    console.error('Failed to read native session from server authority', error);
    return null;
  }
}
