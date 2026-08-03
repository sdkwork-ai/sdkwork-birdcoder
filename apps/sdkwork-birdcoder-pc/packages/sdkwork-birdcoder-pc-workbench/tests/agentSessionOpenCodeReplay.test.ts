import { describe, expect, it, vi } from 'vitest';

import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  toAgentSessionTranscriptItemViews,
  type AgentSessionItemRecord,
  type AgentSessionRecord,
} from '../src/services/agentSessionViewModels.ts';
import {
  areAgentSessionItemSourceWindowsEquivalent,
  attachAgentSessionItemSourceWindow,
  hasAgentSessionItemSourceWindow,
  mergeAgentSessionItemSourceRecords,
  readAgentSessionItemSourceRecords,
} from '../src/services/agentSessionItemSourceWindow.ts';
import {
  AGENT_SESSION_ITEM_RETENTION_MAX_CHARACTERS,
  AGENT_SESSION_ITEM_RETENTION_MAX_ITEMS,
} from '../src/services/agentSessionItemRetention.ts';
import {
  loadEarlierAgentSessionItems,
  refreshAgentSessionItems,
} from '../src/workbench/sessionRefresh.ts';

const CANONICAL_SESSION_ID = 'session.opencode.replay';
const PROVIDER_SESSION_ID = 'provider-session-opencode-a';
const PROVIDER_MESSAGE_ID = 'provider-message-opencode-a';
const PROVIDER_PART_ID = 'provider-part-opencode-a';
const CREATED_AT = '2026-08-01T08:00:00.000Z';

function sourceItem(
  sequence: number,
  payload: Record<string, unknown>,
  overrides: Partial<AgentSessionItemRecord> = {},
): AgentSessionItemRecord {
  return {
    content: null,
    createdAt: CREATED_AT,
    itemId: `provider-event-${sequence}`,
    kind: 'tool_result',
    sequence: String(sequence),
    sessionId: CANONICAL_SESSION_ID,
    status: 'completed',
    toolName: 'provider_event',
    toolResult: payload,
    updatedAt: CREATED_AT,
    version: String(sequence),
    ...overrides,
  } as AgentSessionItemRecord;
}

function textSnapshot(
  sequence: number,
  text: string,
  identity: {
    providerMessageId?: string;
    providerPartId?: string;
    providerSessionId?: string;
  } = {},
): AgentSessionItemRecord {
  return sourceItem(sequence, {
    type: 'message.part.updated',
    properties: {
      part: {
        id: identity.providerPartId ?? PROVIDER_PART_ID,
        messageID: identity.providerMessageId ?? PROVIDER_MESSAGE_ID,
        sessionID: identity.providerSessionId ?? PROVIDER_SESSION_ID,
        text,
        type: 'text',
      },
    },
  });
}

function textDelta(
  sequence: number,
  delta: string,
  identity: {
    providerMessageId?: string;
    providerPartId?: string;
    providerSessionId?: string;
  } = {},
): AgentSessionItemRecord {
  return sourceItem(sequence, {
    type: 'message.part.delta',
    properties: {
      delta,
      field: 'text',
      messageID: identity.providerMessageId ?? PROVIDER_MESSAGE_ID,
      partID: identity.providerPartId ?? PROVIDER_PART_ID,
      sessionID: identity.providerSessionId ?? PROVIDER_SESSION_ID,
    },
  });
}

function partRemoved(sequence: number): AgentSessionItemRecord {
  return sourceItem(sequence, {
    type: 'message.part.removed',
    properties: {
      messageID: PROVIDER_MESSAGE_ID,
      partID: PROVIDER_PART_ID,
      sessionID: PROVIDER_SESSION_ID,
    },
  });
}

function project(records: readonly AgentSessionItemRecord[]) {
  return toAgentSessionTranscriptItemViews(records, {
    engineId: 'opencode',
  });
}

describe('OpenCode Session Item replay', () => {
  it('applies ordered deltas to an existing part snapshot', () => {
    const views = project([
      textSnapshot(1, 'Hello'),
      textDelta(2, ' world'),
      textDelta(3, '!'),
    ]);

    expect(views).toHaveLength(1);
    expect(views[0]).toEqual(expect.objectContaining({
      content: 'Hello world!',
      id: 'provider-event-1',
      role: 'assistant',
      sessionId: CANONICAL_SESSION_ID,
    }));
  });

  it('lets a later full snapshot replace accumulated delta state', () => {
    const views = project([
      textSnapshot(1, 'Draft'),
      textDelta(2, ' text'),
      textSnapshot(3, 'Final answer'),
    ]);

    expect(views).toHaveLength(1);
    expect(views[0]?.content).toBe('Final answer');
    expect(views[0]?.id).toBe('provider-event-3');
  });

  it('honors removal tombstones and permits a later full update to restore the part', () => {
    expect(project([
      textSnapshot(1, 'Remove me'),
      partRemoved(2),
      textDelta(3, ' must stay hidden'),
    ])).toEqual([]);

    const restored = project([
      textSnapshot(1, 'Remove me'),
      partRemoved(2),
      textDelta(3, ' must stay hidden'),
      textSnapshot(4, 'Restored'),
      textDelta(5, ' safely'),
    ]);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.content).toBe('Restored safely');
  });

  it('isolates equal part ids across provider Sessions and messages', () => {
    const views = project([
      textSnapshot(1, 'Session A'),
      textSnapshot(2, 'Session B', {
        providerSessionId: 'provider-session-opencode-b',
      }),
      textDelta(3, ' plus A'),
      textDelta(4, ' plus B', {
        providerSessionId: 'provider-session-opencode-b',
      }),
      textSnapshot(5, 'Message B', {
        providerMessageId: 'provider-message-opencode-b',
      }),
      textDelta(6, ' plus message B', {
        providerMessageId: 'provider-message-opencode-b',
      }),
    ]);

    expect(views.map((view) => view.content)).toEqual([
      'Session A plus A',
      'Session B plus B',
      'Message B plus message B',
    ]);
  });

  it('ignores an orphan delta and replays the same canonical item set idempotently', () => {
    const records = [
      textDelta(1, 'orphan'),
      textSnapshot(2, 'Snapshot'),
      textDelta(3, ' plus delta'),
    ];
    const first = project(records);
    const second = project([...records, records[2]!]);

    expect(first[0]?.content).toBe('Snapshot plus delta');
    expect(second).toEqual(first);
  });
});

describe('OpenCode Session replay across cursor history and reconnect', () => {
  const AGENT_ID = 'agent.opencode.replay';
  const PROJECT_ID = 'project.opencode.replay';

  function userItem(sequence: number): AgentSessionItemRecord {
    return sourceItem(sequence, {}, {
      content: `User message ${sequence}`,
      itemId: `user-item-${sequence}`,
      kind: 'user_input',
      toolName: null,
      toolResult: undefined,
    });
  }

  function sessionView(): AgentSessionView {
    return {
      agentId: AGENT_ID,
      createdAt: CREATED_AT,
      displayTime: 'Just now',
      engineId: 'opencode',
      hostMode: 'web',
      id: CANONICAL_SESSION_ID,
      items: [],
      modelId: 'opencode-model',
      projectId: PROJECT_ID,
      providerId: 'opencode',
      providerSessionId: PROVIDER_SESSION_ID,
      runtimeStatus: 'ready',
      status: 'active',
      title: 'OpenCode replay',
      updatedAt: CREATED_AT,
    };
  }

  function projectView(agentSession: AgentSessionView): AgentProjectView {
    return {
      agentSessions: [agentSession],
      createdAt: CREATED_AT,
      driveAccessMode: 'disabled',
      name: 'OpenCode project',
      organizationId: '2001',
      ownerUserId: '3001',
      projectId: PROJECT_ID,
      status: 'active',
      tenantId: '1001',
      updatedAt: CREATED_AT,
      version: '1',
      visibility: 'private',
      workspaceId: 'workspace.opencode.replay',
    };
  }

  function sessionRecord(): AgentSessionRecord {
    return {
      agentId: AGENT_ID,
      createdAt: CREATED_AT,
      lastItemAt: CREATED_AT,
      lastItemSequence: '10',
      organizationId: '2001',
      ownerUserId: '3001',
      projectId: PROJECT_ID,
      sessionId: CANONICAL_SESSION_ID,
      status: 'active',
      tenantId: '1001',
      title: 'OpenCode replay',
      updatedAt: CREATED_AT,
      version: '10',
    } as AgentSessionRecord;
  }

  function service() {
    const latestItems = [
      ...Array.from({ length: 8 }, (_value, index) => userItem(10 - index)),
      textDelta(2, ' world'),
    ];
    const synchronizeSessionItems = vi.fn(async () => ({
      importedItemCount: '0',
      status: 'imported',
    }));
    const listSessionItems = vi.fn(async (
      _identity: unknown,
      request: { cursor?: string },
    ) => {
      if (request?.cursor === undefined) {
        return {
          items: latestItems,
          pageInfo: {
            hasMore: true,
            mode: 'cursor' as const,
            nextCursor: 'older-page',
            pageSize: 50,
          },
        };
      }
      return {
        items: [textSnapshot(1, 'Hello')],
        pageInfo: {
          hasMore: false,
          mode: 'cursor' as const,
          nextCursor: null,
          pageSize: 50,
        },
      };
    });
    const agentSessionService = {
      getSession: vi.fn(async () => sessionRecord()),
      getSessionUserStates: vi.fn(async () => new Map()),
      listRuntimeBindings: vi.fn(async () => ({
        items: [{
          hostMode: 'web',
          isCurrent: true,
          modelId: 'opencode-model',
          providerId: 'opencode',
          providerSessionId: PROVIDER_SESSION_ID,
          runtimeBindingId: 'runtime-binding-opencode-replay',
          runtimeLocationId: 'runtime-location-opencode-replay',
          status: 'active',
          transportKind: 'provider-events',
          updatedAt: CREATED_AT,
        }],
        pageInfo: {
          hasMore: false,
          mode: 'offset' as const,
          page: 1,
          pageSize: 20,
        },
      })),
      listSessionItems,
      synchronizeSessionItems,
    } as unknown as IAgentSessionService;
    return { agentSessionService, listSessionItems, synchronizeSessionItems };
  }

  it('replays an older snapshot with a newer delta, then remains stable after refresh', async () => {
    const dependencies = service();
    const selectedSession = sessionView();
    const latest = await refreshAgentSessionItems({
      agentSessionId: CANONICAL_SESSION_ID,
      agentSessionService: dependencies.agentSessionService,
      resolvedLocation: {
        agentSession: selectedSession,
        project: projectView(selectedSession),
      },
    });

    expect(latest.agentSession?.items).toHaveLength(8);
    expect(latest.agentSession?.items.some((item) => item.content.includes('world'))).toBe(false);
    expect(dependencies.listSessionItems).toHaveBeenCalledTimes(1);

    const history = await loadEarlierAgentSessionItems({
      agentSession: latest.agentSession!,
      agentSessionService: dependencies.agentSessionService,
    });
    expect(history.agentSession.items.filter((item) => item.content === 'Hello world'))
      .toHaveLength(1);
    expect(history.agentSession.items).toHaveLength(9);

    const refreshed = await refreshAgentSessionItems({
      agentSessionId: CANONICAL_SESSION_ID,
      agentSessionService: dependencies.agentSessionService,
      resolvedLocation: {
        agentSession: history.agentSession,
        project: projectView(history.agentSession),
      },
    });
    expect(refreshed.agentSession?.items.filter((item) => item.content === 'Hello world'))
      .toHaveLength(1);
  });

  it('bounds the replay source window and stops earlier-page loading at the item cap', () => {
    const records = Array.from(
      { length: AGENT_SESSION_ITEM_RETENTION_MAX_ITEMS + 1 },
      (_value, index) => userItem(index + 1),
    );
    const retainedRecords = mergeAgentSessionItemSourceRecords(
      [],
      records,
      CANONICAL_SESSION_ID,
    );
    const sourceSession: AgentSessionView = {
      ...sessionView(),
      itemPageInfo: {
        hasMore: true,
        nextCursor: 'older-page',
        pageSize: 50,
      },
    };
    const attached = attachAgentSessionItemSourceWindow(sourceSession, retainedRecords);

    expect(readAgentSessionItemSourceRecords(attached)).toHaveLength(
      AGENT_SESSION_ITEM_RETENTION_MAX_ITEMS,
    );
    expect(readAgentSessionItemSourceRecords(attached)?.[0]?.sequence).toBe('2');
    expect(attached.itemPageInfo?.retentionLimitReached).toBe(true);
  });

  it('bounds oversized provider payloads by the shared Session Item character budget', () => {
    const oversized = textSnapshot(
      2,
      'x'.repeat(AGENT_SESSION_ITEM_RETENTION_MAX_CHARACTERS + 1),
    );
    const sourceSession: AgentSessionView = {
      ...sessionView(),
      itemPageInfo: {
        hasMore: true,
        nextCursor: 'older-page',
        pageSize: 50,
      },
    };
    const attached = attachAgentSessionItemSourceWindow(
      sourceSession,
      [textSnapshot(1, 'retained'), oversized],
    );

    expect(readAgentSessionItemSourceRecords(attached)?.map((item) => item.itemId))
      .toEqual(['provider-event-1']);
    expect(attached.itemPageInfo?.retentionLimitReached).toBe(true);
  });

  it('detects same-version provider payload changes in source-window equality', () => {
    const left = attachAgentSessionItemSourceWindow(
      sessionView(),
      [textSnapshot(1, 'Draft')],
    );
    const right = attachAgentSessionItemSourceWindow(
      sessionView(),
      [textSnapshot(1, 'Final')],
    );

    expect(areAgentSessionItemSourceWindowsEquivalent(left, right)).toBe(false);
  });

  it('does not leak the internal source window through Session object spread', () => {
    const attached = attachAgentSessionItemSourceWindow(
      sessionView(),
      [textSnapshot(1, 'Snapshot')],
    );
    const spreadSession = { ...attached };

    expect(hasAgentSessionItemSourceWindow(attached)).toBe(true);
    expect(hasAgentSessionItemSourceWindow(spreadSession)).toBe(false);
  });
});
