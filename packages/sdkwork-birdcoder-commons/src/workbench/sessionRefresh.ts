import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionEvent,
  BirdCoderGetNativeSessionRequest,
  BirdCoderNativeSessionDetail,
  BirdCoderCodingSessionSummary,
} from '@sdkwork/birdcoder-types';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  ensureStoredNativeSessionMirror,
} from './nativeCodexSessionMirror.ts';
import {
  isAuthorityBackedNativeSessionId,
  readAuthorityBackedNativeSessionRecord,
  type NativeSessionAuthorityCoreReadService,
} from './nativeSessionAuthority.ts';

type CodingSessionRefreshCoreReadService =
  NativeSessionAuthorityCoreReadService &
  Pick<
    {
      getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary>;
      getNativeSession(
        codingSessionId: string,
        request?: BirdCoderGetNativeSessionRequest,
      ): Promise<BirdCoderNativeSessionDetail>;
      listCodingSessionEvents(codingSessionId: string): Promise<BirdCoderCodingSessionEvent[]>;
    },
    'getCodingSession' | 'getNativeSession' | 'listCodingSessionEvents'
  >;

export interface RefreshProjectSessionsOptions {
  coreReadService?: CodingSessionRefreshCoreReadService;
  projectService: IProjectService;
  workspaceId: string;
}

export interface RefreshCodingSessionMessagesOptions {
  codingSessionId: string;
  coreReadService?: CodingSessionRefreshCoreReadService;
  projectService: IProjectService;
  workspaceId?: string;
}

export interface RefreshProjectSessionsResult {
  mirroredSessionIds: string[];
  projectIds: string[];
  source: 'native-engine' | 'project-service';
  status: 'failed' | 'refreshed';
}

export interface RefreshCodingSessionMessagesResult {
  codingSessionId: string;
  messageCount: number;
  projectId: string;
  source: 'core' | 'engine' | 'native-engine';
  status: 'failed' | 'not-found' | 'refreshed' | 'unsupported';
}

const inflightRefreshes = new Map<string, Promise<unknown>>();

function cloneMessages(messages: readonly BirdCoderChatMessage[]): BirdCoderChatMessage[] {
  return messages.map((message) => structuredClone(message));
}

function requireProjectServiceUpsert(
  projectService: IProjectService,
): asserts projectService is IProjectService & Required<Pick<IProjectService, 'upsertCodingSession'>> {
  if (typeof projectService.upsertCodingSession !== 'function') {
    throw new Error('Project service must support upsertCodingSession for authority refresh synchronization.');
  }
}

function readProjectionPayloadString(
  payload: Record<string, unknown> | undefined,
  fieldName: string,
): string | undefined {
  const value = payload?.[fieldName];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function buildRefreshedCodingSession(
  existingSession: BirdCoderCodingSession,
  summary: BirdCoderCodingSessionSummary,
  messages?: readonly BirdCoderChatMessage[],
): BirdCoderCodingSession {
  return {
    id: summary.id,
    workspaceId: summary.workspaceId.trim() || existingSession.workspaceId,
    projectId: summary.projectId.trim() || existingSession.projectId,
    title: summary.title,
    status: summary.status,
    hostMode: summary.hostMode,
    engineId: summary.engineId,
    modelId: summary.modelId ?? existingSession.modelId,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    lastTurnAt: summary.lastTurnAt,
    displayTime: existingSession.displayTime,
    pinned: existingSession.pinned ?? false,
    archived: existingSession.archived ?? summary.status === 'archived',
    unread: existingSession.unread ?? false,
    messages: messages ? cloneMessages(messages) : cloneMessages(existingSession.messages),
  };
}

function mergeCoreVisibleMessages(
  codingSessionId: string,
  existingMessages: readonly BirdCoderChatMessage[],
  events: readonly BirdCoderCodingSessionEvent[],
): BirdCoderChatMessage[] {
  const mergedMessages = cloneMessages(existingMessages);
  const existingMessageIndexByTurnRole = new Map<string, number>();

  mergedMessages.forEach((message, index) => {
    const dedupeKey = `${message.turnId ?? ''}:${message.role}`;
    if (!existingMessageIndexByTurnRole.has(dedupeKey)) {
      existingMessageIndexByTurnRole.set(dedupeKey, index);
    }
  });

  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    if (event.kind !== 'message.completed') {
      continue;
    }

    const role = readProjectionPayloadString(event.payload, 'role');
    const content = readProjectionPayloadString(event.payload, 'content');
    if ((role !== 'assistant' && role !== 'user') || !content) {
      continue;
    }

    const dedupeKey = `${event.turnId ?? ''}:${role}`;
    const existingIndex = existingMessageIndexByTurnRole.get(dedupeKey);
    if (existingIndex !== undefined) {
      mergedMessages[existingIndex] = {
        ...mergedMessages[existingIndex],
        content,
        createdAt: mergedMessages[existingIndex].createdAt || event.createdAt,
      };
      continue;
    }

    mergedMessages.push({
      id: `${codingSessionId}:refreshed:${event.turnId ?? event.id}:${role}`,
      codingSessionId,
      turnId: event.turnId,
      role,
      content,
      createdAt: event.createdAt,
      timestamp: Date.parse(event.createdAt),
    });
  }

  return mergedMessages.sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.role.localeCompare(right.role),
  );
}

async function runGuardedRefresh<T>(key: string, task: () => Promise<T>): Promise<T> {
  const inflightRefresh = inflightRefreshes.get(key);
  if (inflightRefresh) {
    return inflightRefresh as Promise<T>;
  }

  const nextRefresh = task().finally(() => {
    if (inflightRefreshes.get(key) === nextRefresh) {
      inflightRefreshes.delete(key);
    }
  });
  inflightRefreshes.set(key, nextRefresh);
  return nextRefresh;
}

async function resolveCodingSessionLocation(
  projectService: IProjectService,
  codingSessionId: string,
  workspaceId?: string,
) {
  const projects = await projectService.getProjects(workspaceId);
  for (const project of projects) {
    const codingSession = project.codingSessions.find((candidate) => candidate.id === codingSessionId);
    if (codingSession) {
      return {
        codingSession,
        project,
      };
    }
  }

  return null;
}

export async function refreshProjectSessions(
  options: RefreshProjectSessionsOptions,
): Promise<RefreshProjectSessionsResult> {
  const normalizedWorkspaceId = options.workspaceId.trim();
  return runGuardedRefresh(`project:${normalizedWorkspaceId}`, async () => {
    if (!normalizedWorkspaceId) {
      return {
        mirroredSessionIds: [],
        projectIds: [],
        source: 'project-service',
        status: 'failed',
      } satisfies RefreshProjectSessionsResult;
    }

    const mirrorResult = await ensureStoredNativeSessionMirror({
      coreReadService: options.coreReadService,
      projectService: options.projectService,
      workspaceId: normalizedWorkspaceId,
    });

    if (!mirrorResult) {
      return {
        mirroredSessionIds: [],
        projectIds: [],
        source: 'project-service',
        status: 'refreshed',
      } satisfies RefreshProjectSessionsResult;
    }

    return {
      mirroredSessionIds: mirrorResult.mirroredSessionIds,
      projectIds: mirrorResult.projectIds,
      source: 'native-engine',
      status: 'refreshed',
    } satisfies RefreshProjectSessionsResult;
  });
}

export async function refreshCodingSessionMessages(
  options: RefreshCodingSessionMessagesOptions,
): Promise<RefreshCodingSessionMessagesResult> {
  const normalizedCodingSessionId = options.codingSessionId.trim();
  const normalizedWorkspaceId = options.workspaceId?.trim();

  return runGuardedRefresh(`session:${normalizedCodingSessionId}`, async () => {
    if (!normalizedCodingSessionId) {
      return {
        codingSessionId: normalizedCodingSessionId,
        messageCount: 0,
        projectId: '',
        source: 'engine',
        status: 'not-found',
      } satisfies RefreshCodingSessionMessagesResult;
    }

    const resolvedLocation = await resolveCodingSessionLocation(
      options.projectService,
      normalizedCodingSessionId,
      normalizedWorkspaceId,
    );
    if (!resolvedLocation) {
      return {
        codingSessionId: normalizedCodingSessionId,
        messageCount: 0,
        projectId: '',
        source: 'engine',
        status: 'not-found',
      } satisfies RefreshCodingSessionMessagesResult;
    }

    requireProjectServiceUpsert(options.projectService);

    if (
      isAuthorityBackedNativeSessionId(
        normalizedCodingSessionId,
        resolvedLocation.codingSession.engineId,
      )
    ) {
      const nativeSessionRecord = await readAuthorityBackedNativeSessionRecord(
        normalizedCodingSessionId,
        {
          coreReadService: options.coreReadService,
          engineId: resolvedLocation.codingSession.engineId,
          projectId: resolvedLocation.project.id,
          workspaceId: resolvedLocation.project.workspaceId,
        },
      );
      if (!nativeSessionRecord) {
        return {
          codingSessionId: normalizedCodingSessionId,
          messageCount: resolvedLocation.codingSession.messages.length,
          projectId: resolvedLocation.project.id,
          source: 'native-engine',
          status: 'failed',
        } satisfies RefreshCodingSessionMessagesResult;
      }

      const refreshedSession = buildRefreshedCodingSession(
        resolvedLocation.codingSession,
        {
          ...nativeSessionRecord.summary,
          workspaceId: resolvedLocation.project.workspaceId,
          projectId: resolvedLocation.project.id,
        },
        nativeSessionRecord.messages,
      );

      await options.projectService.upsertCodingSession(
        resolvedLocation.project.id,
        refreshedSession,
      );

      return {
        codingSessionId: normalizedCodingSessionId,
        messageCount: refreshedSession.messages.length,
        projectId: resolvedLocation.project.id,
        source: 'native-engine',
        status: 'refreshed',
      } satisfies RefreshCodingSessionMessagesResult;
    }

    if (!options.coreReadService) {
      return {
        codingSessionId: normalizedCodingSessionId,
        messageCount: resolvedLocation.codingSession.messages.length,
        projectId: resolvedLocation.project.id,
        source: 'engine',
        status: 'unsupported',
      } satisfies RefreshCodingSessionMessagesResult;
    }

    const [summary, events] = await Promise.all([
      options.coreReadService.getCodingSession(normalizedCodingSessionId),
      options.coreReadService.listCodingSessionEvents(normalizedCodingSessionId),
    ]);
    const mergedMessages = mergeCoreVisibleMessages(
      normalizedCodingSessionId,
      resolvedLocation.codingSession.messages,
      events,
    );
    const refreshedSession = buildRefreshedCodingSession(
      resolvedLocation.codingSession,
      summary,
      mergedMessages,
    );

    await options.projectService.upsertCodingSession(
      resolvedLocation.project.id,
      refreshedSession,
    );

    return {
      codingSessionId: normalizedCodingSessionId,
      messageCount: refreshedSession.messages.length,
      projectId: resolvedLocation.project.id,
      source: 'core',
      status: 'refreshed',
    } satisfies RefreshCodingSessionMessagesResult;
  });
}
