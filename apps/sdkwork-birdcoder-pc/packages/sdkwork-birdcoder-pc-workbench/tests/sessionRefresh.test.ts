import { describe, expect, it, vi } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../src/services/interfaces/IProjectService.ts';
import {
  attachAgentSessionItemSourceWindow,
  readAgentSessionItemSourceRecords,
} from '../src/services/agentSessionItemSourceWindow.ts';
import type {
  AgentSessionActivitySummaryRecord,
  AgentSessionItemRecord,
  AgentSessionRecord,
} from '../src/services/agentSessionViewModels.ts';
import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
} from '../src/stores/projectsStore.ts';
import {
  applyProjectSessionActivityRefresh,
  loadEarlierAgentSessionItems,
  refreshAgentSessionItems,
  refreshProjectSessions,
} from '../src/workbench/sessionRefresh.ts';

const PROJECT_ID = 'project.test';
const TENANT_ID = 'tenant.test';
const ORGANIZATION_ID = 'organization.test';
const OWNER_USER_ID = 'user.test';

function project(overrides: Partial<AgentProjectView> = {}): AgentProjectView {
  return {
    projectId: PROJECT_ID,
    workspaceId: 'workspace.test',
    tenantId: TENANT_ID,
    organizationId: ORGANIZATION_ID,
    ownerUserId: OWNER_USER_ID,
    name: 'Test project',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    version: '1',
    createdAt: '2026-07-27T08:00:00.000Z',
    updatedAt: '2026-07-27T08:00:00.000Z',
    agentSessions: [],
    ...overrides,
  };
}

function summary(
  sessionId: string,
  overrides: Partial<AgentSessionActivitySummaryRecord> = {},
): AgentSessionActivitySummaryRecord {
  const value = {
    session: {
      tenantId: TENANT_ID,
      organizationId: ORGANIZATION_ID,
      ownerUserId: OWNER_USER_ID,
      sessionId,
      projectId: PROJECT_ID,
      agentId: `agent.${sessionId}`,
      title: sessionId,
      status: 'active',
      lastItemSequence: '0',
      createdAt: '2026-07-27T08:00:00.000Z',
      updatedAt: '2026-07-27T10:00:00.000Z',
      version: '1',
    },
    latestTurn: null,
    pendingInteraction: null,
    currentRuntimeBinding: null,
    latestRuntimeBinding: null,
    userState: null,
    providerIdentity: {
      runtimeBindingId: null,
      providerId: null,
      modelId: null,
      providerBindingId: null,
      providerSessionId: null,
      providerSessionTreeId: null,
      providerParentSessionId: null,
      providerForkedFromSessionId: null,
    },
    freshness: {
      activityAt: '2026-07-27T10:00:00.000Z',
      source: 'session',
      observedAt: null,
      freshUntil: null,
      sessionVersion: '1',
      latestTurnVersion: null,
      latestInteractionId: null,
      latestInteractionVersion: null,
      latestRuntimeBindingId: null,
      latestRuntimeBindingVersion: null,
      pendingInteractionVersion: null,
      currentRuntimeBindingVersion: null,
      userStateVersion: null,
    },
    providerActivity: null,
    presentationPhase: 'idle',
    ...overrides,
  };
  return value as unknown as AgentSessionActivitySummaryRecord;
}

function cursorPage(
  items: readonly AgentSessionActivitySummaryRecord[],
  overrides: Record<string, unknown> = {},
) {
  return {
    items: [...items],
    pageInfo: {
      mode: 'cursor',
      pageSize: 200,
      hasMore: false,
      nextCursor: null,
      ...overrides,
    },
  };
}

function services(
  loadedProject: AgentProjectView | null,
  page: ReturnType<typeof cursorPage>,
) {
  const listSessionActivitySummaries = vi.fn().mockResolvedValue(page);
  const listSessionsByProject = vi.fn();
  const synchronizeProjectSessions = vi.fn().mockResolvedValue({
    projectId: PROJECT_ID,
    synchronizedSessionCount: '2',
  });
  const agentSessionService = {
    listSessionActivitySummaries,
    listSessionsByProject,
    synchronizeProjectSessions,
  } as unknown as IAgentSessionService;
  const projectService = {
    getProjectById: vi.fn().mockResolvedValue(loadedProject),
  } as unknown as IProjectService;
  return {
    agentSessionService,
    listSessionActivitySummaries,
    listSessionsByProject,
    synchronizeProjectSessions,
    projectService,
  };
}

describe('manual Project Session refresh', () => {
  it('loads the canonical activity head without triggering Provider discovery', async () => {
    const page = cursorPage([
      summary('session.codex'),
      summary('session.claude'),
    ], {
      hasMore: true,
      nextCursor: 'next-page',
    });
    const dependencies = services(project(), page);

    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });

    expect(dependencies.synchronizeProjectSessions).not.toHaveBeenCalled();
    expect(dependencies.listSessionActivitySummaries).toHaveBeenCalledTimes(1);
    expect(dependencies.listSessionActivitySummaries).toHaveBeenCalledWith({
      pageSize: 200,
      projectId: PROJECT_ID,
    }, { signal: expect.any(AbortSignal) });
    expect(dependencies.listSessionsByProject).not.toHaveBeenCalled();
    expect(result.status).toBe('refreshed');
    expect(result.sessionIds).toEqual(['session.codex', 'session.claude']);
    expect(result.projects?.[0]?.agentSessions.map((candidate) => candidate.id)).toEqual([
      'session.codex',
      'session.claude',
    ]);
  });
});

describe('Agent Session transcript pagination', () => {
  const transcriptAgentId = 'agent.intelligence.cursor';
  const transcriptSessionId = 'session.cursor.test';
  const transcriptCreatedAt = '2026-07-27T08:00:00.000Z';

  function transcriptItemRecord(sequence: number): AgentSessionItemRecord {
    return {
      content: `message ${sequence}`,
      createdAt: transcriptCreatedAt,
      itemId: `item.${sequence}`,
      kind: 'user_input',
      sequence: String(sequence),
      sessionId: transcriptSessionId,
      status: 'completed',
    } as AgentSessionItemRecord;
  }

  function transcriptSession(
    overrides: Partial<AgentSessionView> = {},
  ): AgentSessionView {
    return {
      agentId: transcriptAgentId,
      createdAt: transcriptCreatedAt,
      displayTime: '10:00',
      engineId: 'cursor-engine',
      hostMode: 'web',
      id: transcriptSessionId,
      items: [],
      modelId: 'auto',
      projectId: PROJECT_ID,
      providerId: 'cursor-provider',
      runtimeStatus: 'ready',
      status: 'active',
      title: 'Cursor transcript',
      updatedAt: '2026-07-27T10:00:00.000Z',
      ...overrides,
    };
  }

  function transcriptSessionRecord(lastItemSequence = '0'): AgentSessionRecord {
    return {
      agentId: transcriptAgentId,
      createdAt: transcriptCreatedAt,
      lastItemAt: '2026-07-27T10:00:00.000Z',
      lastItemSequence,
      organizationId: ORGANIZATION_ID,
      ownerUserId: OWNER_USER_ID,
      projectId: PROJECT_ID,
      sessionId: transcriptSessionId,
      status: 'active',
      tenantId: TENANT_ID,
      title: 'Cursor transcript',
      updatedAt: '2026-07-27T10:00:00.000Z',
      version: lastItemSequence,
    } as AgentSessionRecord;
  }

  function transcriptService(
    listSessionItems: ReturnType<typeof vi.fn>,
    sessionRecord = transcriptSessionRecord(),
    synchronizeSessionItems: ReturnType<typeof vi.fn> = listSessionItems,
  ): IAgentSessionService {
    return {
      getSession: vi.fn(async () => sessionRecord),
      getSessionUserStates: vi.fn(async () => new Map()),
      listRuntimeBindings: vi.fn(async () => ({
        items: [],
        pageInfo: {
          hasMore: false,
          mode: 'offset',
          page: 1,
          pageSize: 20,
        },
      })),
      listSessionItems,
      synchronizeSessionItems,
    } as unknown as IAgentSessionService;
  }

  it('loads the latest 50 items first and reaches all 105 items through upward pagination', async () => {
    const agentId = 'agent.intelligence.codex';
    const sessionId = 'session.provider.codex.test';
    const createdAt = '2026-07-27T08:00:00.000Z';
    const updatedAt = '2026-07-27T10:00:00.000Z';
    const selectedSession: AgentSessionView = {
      agentId,
      createdAt,
      displayTime: '10:00',
      engineId: 'codex',
      hostMode: 'web',
      id: sessionId,
      items: [],
      modelId: 'auto',
      projectId: PROJECT_ID,
      providerId: 'codex',
      runtimeStatus: 'ready',
      status: 'active',
      title: 'Codex transcript',
      updatedAt,
    };
    const selectedProject = project({ agentSessions: [selectedSession] });
    const sessionRecord = {
      agentId,
      createdAt,
      lastItemAt: updatedAt,
      lastItemSequence: '105',
      organizationId: ORGANIZATION_ID,
      ownerUserId: OWNER_USER_ID,
      projectId: PROJECT_ID,
      sessionId,
      status: 'active',
      tenantId: TENANT_ID,
      title: 'Codex transcript',
      updatedAt,
      version: '105',
    } as AgentSessionRecord;
    const item = (sequence: number): AgentSessionItemRecord => ({
      content: `message ${sequence}`,
      createdAt,
      itemId: `item.${sequence}`,
      kind: 'user_input',
      sequence: String(sequence),
      sessionId,
      status: 'completed',
    } as AgentSessionItemRecord);
    const pageItems = (page: number) => {
      const high = page === 1 ? 105 : page === 2 ? 55 : 5;
      const low = page === 1 ? 56 : page === 2 ? 6 : 1;
      return Array.from({ length: high - low + 1 }, (_, index) => item(high - index));
    };
    const loadSessionItems = async (
      identity: { agentId: string; sessionId: string },
      request: { cursor?: string; pageSize?: number; sort?: string },
    ) => {
      const page = request.cursor === undefined ? 1 : request.cursor === 'cursor.1' ? 2 : 3;
      return {
        items: pageItems(page),
        pageInfo: {
          hasMore: page < 3,
          mode: 'cursor' as const,
          nextCursor: page < 3 ? `cursor.${page}` : null,
          pageSize: 50,
        },
      };
    };
    const listSessionItems = vi.fn(loadSessionItems);
    const synchronizeSessionItems = vi.fn(loadSessionItems);
    const agentSessionService = {
      getSession: vi.fn(async () => sessionRecord),
      getSessionUserStates: vi.fn(async () => new Map()),
      listRuntimeBindings: vi.fn(async () => ({
        items: [],
        pageInfo: {
          hasMore: false,
          mode: 'offset',
          page: 1,
          pageSize: 20,
        },
      })),
      listSessionItems,
      synchronizeSessionItems,
    } as unknown as IAgentSessionService;

    const latest = await refreshAgentSessionItems({
      agentSessionId: sessionId,
      agentSessionService,
      resolvedLocation: {
        agentSession: selectedSession,
        project: selectedProject,
      },
    });

    expect(latest.status).toBe('refreshed');
    expect(latest.agentSession?.items).toHaveLength(50);
    expect(latest.agentSession?.items.at(0)?.id).toBe('item.56');
    expect(latest.agentSession?.items.at(-1)?.id).toBe('item.105');
    expect(latest.agentSession?.itemPageInfo).toEqual({
      hasMore: true,
      nextCursor: 'cursor.1',
      pageSize: 50,
    });

    const secondPage = await loadEarlierAgentSessionItems({
      agentSession: latest.agentSession!,
      agentSessionService,
    });
    expect(secondPage.agentSession.items).toHaveLength(100);
    expect(secondPage.agentSession.items.at(0)?.id).toBe('item.6');
    expect(secondPage.agentSession.itemPageInfo?.nextCursor).toBe('cursor.2');

    const thirdPage = await loadEarlierAgentSessionItems({
      agentSession: secondPage.agentSession,
      agentSessionService,
    });
    expect(thirdPage.agentSession.items).toHaveLength(105);
    expect(thirdPage.agentSession.items.at(0)?.id).toBe('item.1');
    expect(thirdPage.agentSession.items.at(-1)?.id).toBe('item.105');
    expect(thirdPage.agentSession.itemPageInfo).toEqual({
      hasMore: false,
      nextCursor: null,
      pageSize: 50,
    });

    const complete = await loadEarlierAgentSessionItems({
      agentSession: thirdPage.agentSession,
      agentSessionService,
    });
    expect(complete.status).toBe('complete');
    expect(complete.loadedItemCount).toBe(0);
    expect(synchronizeSessionItems).toHaveBeenCalledTimes(1);
    expect(synchronizeSessionItems).toHaveBeenCalledWith(
      { agentId, sessionId },
      {
        cursor: undefined,
        pageSize: 50,
        sort: '-sequence',
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(listSessionItems).toHaveBeenCalledTimes(2);
    expect(listSessionItems.mock.calls.map(([identity, request]) => ({
      cursor: request.cursor,
      identity,
      pageSize: request.pageSize,
      sort: request.sort,
    }))).toEqual([
      {
        cursor: 'cursor.1',
        identity: { agentId, sessionId },
        pageSize: 50,
        sort: '-sequence',
      },
      {
        cursor: 'cursor.2',
        identity: { agentId, sessionId },
        pageSize: 50,
        sort: '-sequence',
      },
    ]);
  });

  it('replays an OpenCode delta when its full part snapshot arrives on an earlier page', async () => {
    const providerSessionId = 'opencode-provider-session-history';
    const providerMessageId = 'opencode-message-history';
    const providerPartId = 'opencode-part-history';
    const eventItem = (
      sequence: number,
      event: Record<string, unknown>,
    ): AgentSessionItemRecord => ({
      ...transcriptItemRecord(sequence),
      content: null,
      contentType: 'application/json',
      kind: 'tool_result',
      providerId: 'opencode',
      toolCallId: `opencode-event-${sequence}`,
      toolName: 'provider_event',
      toolResult: event,
    });
    const snapshot = eventItem(1, {
      type: 'message.part.updated',
      properties: {
        part: {
          id: providerPartId,
          messageID: providerMessageId,
          sessionID: providerSessionId,
          text: 'Hello',
          type: 'text',
        },
        sessionID: providerSessionId,
        time: 1_785_568_800_001,
      },
    });
    const delta = eventItem(2, {
      type: 'message.part.delta',
      properties: {
        delta: ' world',
        field: 'text',
        messageID: providerMessageId,
        partID: providerPartId,
        sessionID: providerSessionId,
      },
    });
    const selectedSession = attachAgentSessionItemSourceWindow(transcriptSession({
      engineId: 'opencode',
      itemPageInfo: {
        hasMore: true,
        nextCursor: 'opaque-opencode-history-cursor',
        pageSize: 50,
      },
      items: [],
      providerId: 'opencode',
    }), [delta]);
    const listSessionItems = vi.fn().mockResolvedValue({
      items: [snapshot],
      pageInfo: {
        hasMore: false,
        mode: 'cursor',
        nextCursor: null,
        pageSize: 50,
      },
    });

    const result = await loadEarlierAgentSessionItems({
      agentSession: selectedSession,
      agentSessionService: transcriptService(listSessionItems),
    });

    expect(result.loadedItemCount).toBe(1);
    expect(result.agentSession.items).toHaveLength(1);
    expect(result.agentSession.items[0]?.content).toBe('Hello world');
    expect(readAgentSessionItemSourceRecords(result.agentSession)?.map((item) => item.sequence))
      .toEqual(['1', '2']);
    expect(listSessionItems).toHaveBeenCalledWith(
      { agentId: transcriptAgentId, sessionId: transcriptSessionId },
      {
        cursor: 'opaque-opencode-history-cursor',
        pageSize: 50,
        sort: '-sequence',
      },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('preserves the oldest loaded cursor when concurrent head items overlap the window', async () => {
    const selectedSession = transcriptSession({
      itemPageInfo: {
        hasMore: true,
        nextCursor: 'cursor.oldest-loaded',
        pageSize: 50,
      },
      items: Array.from({ length: 60 }, (_, index) => ({
        content: `message ${index + 1}`,
        createdAt: transcriptCreatedAt,
        id: `item.${index + 1}`,
        role: 'user' as const,
        sessionId: transcriptSessionId,
      })),
    });
    const listSessionItems = vi.fn().mockResolvedValue({
      items: Array.from({ length: 50 }, (_, index) => transcriptItemRecord(65 - index)),
      pageInfo: {
        hasMore: true,
        mode: 'cursor',
        nextCursor: 'cursor.fresh-head',
        pageSize: 50,
      },
    });

    const result = await refreshAgentSessionItems({
      agentSessionId: transcriptSessionId,
      agentSessionService: transcriptService(
        listSessionItems,
        transcriptSessionRecord('65'),
      ),
      resolvedLocation: {
        agentSession: selectedSession,
        project: project({ agentSessions: [selectedSession] }),
      },
    });

    expect(result.replaceLoadedAuthorityWindow).toBe(false);
    expect(result.agentSession?.itemPageInfo).toEqual({
      hasMore: true,
      nextCursor: 'cursor.oldest-loaded',
      pageSize: 50,
    });
    expect(result.agentSession?.items).toHaveLength(65);
    expect(result.agentSession?.items.at(0)?.id).toBe('item.1');
    expect(result.agentSession?.items.at(-1)?.id).toBe('item.65');
    expect(listSessionItems).toHaveBeenCalledTimes(1);
  });

  it('replaces a disconnected authority window after the bounded eight-page scan', async () => {
    const selectedSession = transcriptSession({
      itemPageInfo: {
        hasMore: true,
        nextCursor: 'cursor.stale-window',
        pageSize: 50,
      },
      items: [{
        content: 'stale message',
        createdAt: transcriptCreatedAt,
        id: 'item.stale',
        role: 'user',
        sessionId: transcriptSessionId,
      }],
    });
    const listSessionItems = vi.fn(async (
      _identity: unknown,
      request: { cursor?: string },
    ) => {
      const pageIndex = request.cursor === undefined
        ? 1
        : Number(request.cursor.replace('cursor.head.', '')) + 1;
      const high = 851 - pageIndex * 50;
      return {
        items: Array.from({ length: 50 }, (_, index) => transcriptItemRecord(high - index)),
        pageInfo: {
          hasMore: true,
          mode: 'cursor' as const,
          nextCursor: `cursor.head.${pageIndex}`,
          pageSize: 50,
        },
      };
    });

    const result = await refreshAgentSessionItems({
      agentSessionId: transcriptSessionId,
      agentSessionService: transcriptService(
        listSessionItems,
        transcriptSessionRecord('800'),
      ),
      resolvedLocation: {
        agentSession: selectedSession,
        project: project({ agentSessions: [selectedSession] }),
      },
    });

    expect(listSessionItems).toHaveBeenCalledTimes(8);
    expect(result.replaceLoadedAuthorityWindow).toBe(true);
    expect(result.agentSession?.itemPageInfo).toEqual({
      hasMore: true,
      nextCursor: 'cursor.head.8',
      pageSize: 50,
    });
    expect(result.agentSession?.items.some((item) => item.id === 'item.stale')).toBe(false);
    expect(result.agentSession?.items).toHaveLength(400);
  });

  it('bounds duplicate-only history scans while committing cursor progress', async () => {
    const selectedSession = transcriptSession({
      itemPageInfo: {
        hasMore: true,
        nextCursor: 'cursor.duplicate.1',
        pageSize: 50,
      },
      items: [{
        content: 'message 100',
        createdAt: transcriptCreatedAt,
        id: 'item.100',
        role: 'user',
        sessionId: transcriptSessionId,
      }],
    });
    const listSessionItems = vi.fn(async (
      _identity: unknown,
      request: { cursor?: string },
    ) => {
      const cursorIndex = Number(request.cursor?.split('.').at(-1));
      return {
        items: [transcriptItemRecord(100)],
        pageInfo: {
          hasMore: true,
          mode: 'cursor' as const,
          nextCursor: `cursor.duplicate.${cursorIndex + 1}`,
          pageSize: 50,
        },
      };
    });

    const result = await loadEarlierAgentSessionItems({
      agentSession: selectedSession,
      agentSessionService: transcriptService(listSessionItems),
    });

    expect(result.status).toBe('loaded');
    expect(result.loadedItemCount).toBe(0);
    expect(result.agentSession.itemPageInfo?.nextCursor).toBe('cursor.duplicate.4');
    expect(listSessionItems.mock.calls.map(([, request]) => request.cursor)).toEqual([
      'cursor.duplicate.1',
      'cursor.duplicate.2',
      'cursor.duplicate.3',
    ]);
  });

  it.each([
    ['non-progressing', true, 'cursor.invalid'],
    ['non-null terminal', false, 'cursor.unexpected'],
  ])('rejects %s Session Item cursor metadata', async (_label, hasMore, nextCursor) => {
    const selectedSession = transcriptSession({
      itemPageInfo: {
        hasMore: true,
        nextCursor: 'cursor.invalid',
        pageSize: 50,
      },
    });
    const listSessionItems = vi.fn().mockResolvedValue({
      items: [transcriptItemRecord(100)],
      pageInfo: {
        hasMore,
        mode: 'cursor',
        nextCursor,
        pageSize: 50,
      },
    });

    await expect(loadEarlierAgentSessionItems({
      agentSession: selectedSession,
      agentSessionService: transcriptService(listSessionItems),
    })).rejects.toThrow(
      hasMore ? 'non-progressing cursor page' : 'terminal page must omit or null its cursor',
    );
  });
});

describe('Agent Session transcript refresh errors', () => {
  function createRefreshHarness() {
    const agentId = 'agent.intelligence.codex';
    const sessionId = 'session.provider.codex.not-found';
    const createdAt = '2026-07-27T08:00:00.000Z';
    const updatedAt = '2026-07-27T10:00:00.000Z';
    const agentSession: AgentSessionView = {
      agentId,
      createdAt,
      displayTime: '10:00',
      engineId: 'codex',
      hostMode: 'web',
      id: sessionId,
      items: [],
      modelId: 'auto',
      projectId: PROJECT_ID,
      providerId: 'codex',
      runtimeStatus: 'ready',
      status: 'active',
      title: 'Codex transcript',
      updatedAt,
    };
    const sessionRecord = {
      agentId,
      createdAt,
      lastItemAt: updatedAt,
      lastItemSequence: '0',
      organizationId: ORGANIZATION_ID,
      ownerUserId: OWNER_USER_ID,
      projectId: PROJECT_ID,
      sessionId,
      status: 'active',
      tenantId: TENANT_ID,
      title: 'Codex transcript',
      updatedAt,
      version: '1',
    } as AgentSessionRecord;
    const getSession = vi.fn().mockResolvedValue(sessionRecord);
    const getSessionUserStates = vi.fn().mockResolvedValue(new Map());
    const listRuntimeBindings = vi.fn().mockResolvedValue({
      items: [],
      pageInfo: {
        hasMore: false,
        mode: 'offset',
        page: 1,
        pageSize: 20,
      },
    });
    const listSessionItems = vi.fn().mockResolvedValue({
      items: [],
      pageInfo: {
        hasMore: false,
        mode: 'cursor',
        nextCursor: null,
        pageSize: 50,
      },
    });
    const synchronizeSessionItems = vi.fn().mockResolvedValue({
      items: [],
      pageInfo: {
        hasMore: false,
        mode: 'cursor',
        nextCursor: null,
        pageSize: 50,
      },
    });
    const agentSessionService = {
      getSession,
      getSessionUserStates,
      listRuntimeBindings,
      listSessionItems,
      synchronizeSessionItems,
    } as unknown as IAgentSessionService;
    return {
      agentId,
      agentSession,
      agentSessionService,
      getSession,
      getSessionUserStates,
      listRuntimeBindings,
      listSessionItems,
      synchronizeSessionItems,
      project: project({ agentSessions: [agentSession] }),
      sessionId,
    };
  }

  function sdkNotFoundError() {
    return Object.assign(new Error('Resource not found'), {
      code: 'NOT_FOUND',
      httpStatus: 404,
      name: 'NotFoundError',
      problem: { status: 404 },
    });
  }

  function refreshTranscript(harness: ReturnType<typeof createRefreshHarness>) {
    return refreshAgentSessionItems({
      agentSessionId: harness.sessionId,
      agentSessionService: harness.agentSessionService,
      resolvedLocation: {
        agentSession: harness.agentSession,
        project: harness.project,
      },
    });
  }

  it('treats only the canonical getSession 404 as Session absence', async () => {
    const harness = createRefreshHarness();
    const error = sdkNotFoundError();
    harness.getSession.mockRejectedValueOnce(error);

    const result = await refreshTranscript(harness);

    expect(result.status).toBe('not-found');
    expect(harness.listSessionItems).not.toHaveBeenCalled();
    expect(harness.listRuntimeBindings).not.toHaveBeenCalled();
    expect(harness.getSessionUserStates).not.toHaveBeenCalled();
  });

  it('rethrows an SDK synchronizeSessionItems 404 after getSession succeeds', async () => {
    const harness = createRefreshHarness();
    const error = sdkNotFoundError();
    harness.synchronizeSessionItems.mockRejectedValueOnce(error);

    await expect(refreshTranscript(harness)).rejects.toBe(error);

    const identity = {
      agentId: harness.agentId,
      sessionId: harness.sessionId,
    };
    expect(harness.getSession).toHaveBeenCalledWith(
      identity,
      { signal: expect.any(AbortSignal) },
    );
    expect(harness.synchronizeSessionItems).toHaveBeenCalledWith(
      identity,
      {
        cursor: undefined,
        pageSize: 50,
        sort: '-sequence',
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(harness.listSessionItems).not.toHaveBeenCalled();
  });

  it('keeps transcript data when runtime binding metadata returns 404', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createRefreshHarness();
    const error = sdkNotFoundError();
    Object.assign(harness.agentSession, {
      providerBindingId: 'provider-binding.codex',
      providerSessionId: 'provider-session.codex',
      runtimeBindingId: 'runtime-binding.codex',
    });
    harness.listRuntimeBindings.mockRejectedValueOnce(error);

    const result = await refreshTranscript(harness);

    expect(result.status).toBe('refreshed');
    expect(result.agentSession).toMatchObject({
      providerBindingId: 'provider-binding.codex',
      providerSessionId: 'provider-session.codex',
      runtimeBindingId: 'runtime-binding.codex',
    });
    expect(harness.listRuntimeBindings).toHaveBeenCalledWith(
      {
        agentId: harness.agentId,
        sessionId: harness.sessionId,
      },
      { page: 1, pageSize: 20 },
      { signal: expect.any(AbortSignal) },
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      'Failed to load Agents Session runtime bindings; preserving available transcript data',
      error,
    );
    consoleWarn.mockRestore();
  });

  it('keeps transcript data and prior user state when user state metadata returns 404', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const harness = createRefreshHarness();
    const error = sdkNotFoundError();
    Object.assign(harness.agentSession, {
      pinned: true,
      title: 'Pinned custom title',
      unread: true,
    });
    harness.getSessionUserStates.mockRejectedValueOnce(error);

    const result = await refreshTranscript(harness);

    expect(result.status).toBe('refreshed');
    expect(result.agentSession).toMatchObject({
      pinned: true,
      title: 'Pinned custom title',
      unread: true,
    });
    expect(harness.getSessionUserStates).toHaveBeenCalledWith(
      [{
        agentId: harness.agentId,
        sessionId: harness.sessionId,
      }],
      { signal: expect.any(AbortSignal) },
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      'Failed to load Agents Session user state; preserving available transcript data',
      error,
    );
    consoleWarn.mockRestore();
  });

  it('rethrows a non-404 SDK failure', async () => {
    const harness = createRefreshHarness();
    const error = Object.assign(new Error('Internal server error'), {
      code: 'INTERNAL_SERVER_ERROR',
      httpStatus: 500,
      name: 'SdkError',
      problem: { status: 500 },
    });
    harness.synchronizeSessionItems.mockRejectedValueOnce(error);

    await expect(refreshTranscript(harness)).rejects.toBe(error);
    expect(harness.synchronizeSessionItems).toHaveBeenCalledWith(
      {
        agentId: harness.agentId,
        sessionId: harness.sessionId,
      },
      {
        cursor: undefined,
        pageSize: 50,
        sort: '-sequence',
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(harness.listSessionItems).not.toHaveBeenCalled();
  });
});

describe('manual Project Session refresh consistency', () => {
  it('returns Session tombstones separately instead of mapping them into active rows', async () => {
    const deleted = summary('session.deleted', {
      presentationPhase: 'deleted',
      session: {
        ...summary('session.deleted').session,
        deletedAt: '2026-07-27T10:00:01.000Z',
      },
    });
    const dependencies = services(project(), cursorPage([deleted]));

    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });

    expect(result.deletedSessionIds).toEqual(['session.deleted']);
    expect(result.deletedSessionTombstones.map((session) => session.id))
      .toEqual(['session.deleted']);
    expect(result.sessionIds).toEqual([]);
    expect(result.projects?.[0]?.agentSessions).toEqual([]);
  });

  it('rejects a Project refresh response that started before a newer tombstone', async () => {
    const sessionId = 'session.racing-project-refresh';
    const live = summary(sessionId);
    const staleDependencies = services(project(), cursorPage([live]));
    const staleResult = await refreshProjectSessions({
      agentSessionService: staleDependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: staleDependencies.projectService,
    });
    const tombstoneBase = summary(sessionId);
    const deleted = summary(sessionId, {
      freshness: {
        ...tombstoneBase.freshness,
        sessionVersion: '2',
      },
      presentationPhase: 'deleted',
      session: {
        ...tombstoneBase.session,
        deletedAt: '2026-07-27T10:01:00.000Z',
        version: '2',
      },
    });
    const deletionDependencies = services(project(), cursorPage([deleted]));
    const deletionResult = await refreshProjectSessions({
      agentSessionService: deletionDependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: deletionDependencies.projectService,
    });
    const scopeKey = buildProjectsStoreScopeKey('user.refresh-race', 'workspace.test');
    let projects = [project({
      agentSessions: staleResult.projects![0]!.agentSessions,
    })];

    projects = applyProjectSessionActivityRefresh(
      projects,
      deletionResult.projects![0]!,
      deletionResult.deletedSessionIds,
      {
        deletedSessionTombstones: deletionResult.deletedSessionTombstones,
        scopeKey,
      },
    );
    expect(projects[0]?.agentSessions).toEqual([]);

    projects = applyProjectSessionActivityRefresh(
      projects,
      staleResult.projects![0]!,
      staleResult.deletedSessionIds,
      {
        deletedSessionTombstones: staleResult.deletedSessionTombstones,
        scopeKey,
      },
    );
    expect(projects[0]?.agentSessions).toEqual([]);
    deleteProjectsStore(scopeKey);
  });

  it('does not let an older Project tombstone delete a newer activity-less Session', async () => {
    const sessionId = 'session.recreated-after-delete';
    const tombstoneBase = summary(sessionId);
    const deleted = summary(sessionId, {
      freshness: {
        ...tombstoneBase.freshness,
        sessionVersion: '2',
      },
      presentationPhase: 'deleted',
      session: {
        ...tombstoneBase.session,
        deletedAt: '2026-07-27T10:01:00.000Z',
        version: '2',
      },
    });
    const deletionDependencies = services(project(), cursorPage([deleted]));
    const deletionResult = await refreshProjectSessions({
      agentSessionService: deletionDependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: deletionDependencies.projectService,
    });
    const deletedSession = deletionResult.deletedSessionTombstones[0]!;
    const recreatedSession = {
      ...deletedSession,
      activity: undefined,
      serverVersion: '3',
      status: 'active' as const,
      updatedAt: '2026-07-27T10:02:00.000Z',
    };
    const scopeKey = buildProjectsStoreScopeKey('user.stale-delete-race', 'workspace.test');

    const committed = applyProjectSessionActivityRefresh(
      [project({ agentSessions: [recreatedSession] })],
      deletionResult.projects![0]!,
      deletionResult.deletedSessionIds,
      {
        deletedSessionTombstones: deletionResult.deletedSessionTombstones,
        scopeKey,
      },
    );

    expect(committed[0]?.agentSessions).toHaveLength(1);
    expect(committed[0]?.agentSessions[0]).toMatchObject({
      activity: undefined,
      id: sessionId,
      serverVersion: '3',
      status: 'active',
    });
    deleteProjectsStore(scopeKey);
  });

  it('commits a bounded head without dropping rows outside the head and applies tombstones', async () => {
    const dependencies = services(project(), cursorPage([summary('session.head')]));
    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });
    const refreshedProject = result.projects![0]!;
    const head = refreshedProject.agentSessions[0]!;
    const outsideHead = {
      ...head,
      id: 'session.outside-head',
      agentId: 'agent.session.outside-head',
      title: 'Outside bounded head',
    };
    const deleted = {
      ...head,
      id: 'session.deleted',
      agentId: 'agent.session.deleted',
      title: 'Deleted',
    };

    const committed = applyProjectSessionActivityRefresh(
      [project({ agentSessions: [head, outsideHead, deleted] })],
      refreshedProject,
      ['session.deleted'],
    );

    expect(committed[0]?.agentSessions.map((session) => session.id).sort()).toEqual([
      'session.head',
      'session.outside-head',
    ]);
  });

  it('rejects a refresh that marks the same Session live and deleted', async () => {
    const dependencies = services(project(), cursorPage([summary('session.conflict')]));
    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });

    expect(() => applyProjectSessionActivityRefresh(
      [project()],
      result.projects![0]!,
      ['session.conflict'],
    )).toThrow('conflicting live and deleted rows');
  });

  it.each([
    ['missing', null],
    ['deleted', project({ status: 'deleted' })],
  ])('fails closed for a %s Project without querying Session activity', async (_label, loadedProject) => {
    const dependencies = services(loadedProject, cursorPage([]));

    const result = await refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    });

    expect(result.status).toBe('failed');
    expect(result.deletedSessionIds).toEqual([]);
    expect(dependencies.listSessionActivitySummaries).not.toHaveBeenCalled();
  });

  it('rejects invalid cursor metadata without applying a partial snapshot', async () => {
    const dependencies = services(project(), cursorPage([summary('session.test')], {
      hasMore: true,
      nextCursor: null,
    }));

    await expect(refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    })).rejects.toThrow('non-progressing cursor page');
  });

  it('rejects duplicate Session identities without applying a partial snapshot', async () => {
    const dependencies = services(project(), cursorPage([
      summary('session.duplicate'),
      summary('session.duplicate'),
    ]));

    await expect(refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    })).rejects.toThrow('duplicate Session identity');
  });

  it('rejects internally inconsistent freshness evidence', async () => {
    const invalidFreshness = summary('session.freshness');
    const dependencies = services(project(), cursorPage([{
      ...invalidFreshness,
      freshness: {
        ...invalidFreshness.freshness,
        observedAt: '2026-07-27T10:00:05.000Z',
        freshUntil: '2026-07-27T10:00:04.000Z',
      },
    }]));

    await expect(refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    })).rejects.toThrow('freshness interval is invalid');
  });

  it.each([
    ['Project', { projectId: 'project.other' }],
    ['tenant', { tenantId: 'tenant.other' }],
    ['organization', { organizationId: 'organization.other' }],
    ['owner', { ownerUserId: 'user.other' }],
  ])('rejects a Session summary outside the requested %s scope', async (_label, sessionOverrides) => {
    const scopedSummary = summary('session.scope');
    const dependencies = services(project(), cursorPage([{
      ...scopedSummary,
      session: {
        ...scopedSummary.session,
        ...sessionOverrides,
      },
    }]));

    await expect(refreshProjectSessions({
      agentSessionService: dependencies.agentSessionService,
      projectId: PROJECT_ID,
      projectService: dependencies.projectService,
    })).rejects.toThrow('escaped its requested Project scope');
  });
});
