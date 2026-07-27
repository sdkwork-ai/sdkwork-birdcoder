import { describe, expect, it } from 'vitest';
import type {
  AgentSessionItemView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  mergeLatestAgentSessionItems,
  mergeRefreshedAgentSessionIntoCurrent,
} from '../src/workbench/sessionRefresh.ts';
import { mergeAgentSessionProjectionForStore } from '../src/stores/projectsStore.ts';

function item(
  id: string,
  role: AgentSessionItemView['role'],
  overrides: Partial<AgentSessionItemView> = {},
): AgentSessionItemView {
  return {
    id,
    sessionId: 'session.test',
    role,
    content: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function session(
  overrides: Partial<AgentSessionView> = {},
): AgentSessionView {
  return {
    id: 'session.test',
    agentId: 'agent.test',
    projectId: 'project.test',
    title: 'Test Session',
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'codex-default',
    providerId: 'provider.openai',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    displayTime: 'Just now',
    items: [],
    ...overrides,
  };
}

describe('Agent turn item reconciliation', () => {
  it('replaces stale optimistic and stream items with authoritative items from the same turn', () => {
    const turnId = 'turn.test';
    const historyItem = item('item.history', 'assistant');
    const optimisticUser = item('item.optimistic', 'user', {
      content: 'hello',
      metadata: { optimistic: true, transient: true },
      turnId,
    });
    const streamingAssistant = item('item.stream', 'assistant', {
      content: 'partial',
      metadata: { transient: true },
      turnId,
    });
    const resolvedUser = item('item.user', 'user', { content: 'hello', turnId });
    const resolvedAssistant = item('item.assistant', 'assistant', {
      content: 'complete',
      turnId,
    });

    expect(mergeLatestAgentSessionItems(
      [historyItem, optimisticUser, streamingAssistant],
      [resolvedUser, resolvedAssistant],
    )).toEqual([historyItem, resolvedUser, resolvedAssistant]);
  });

  it('preserves canonical duplicate content and unmatched local transient items', () => {
    const firstCanonical = item('item.first', 'user', {
      content: 'continue',
      turnId: 'turn.first',
    });
    const secondCanonical = item('item.second', 'user', {
      content: 'continue',
      turnId: 'turn.second',
    });
    const unmatchedTransient = item('item.stream', 'assistant', {
      metadata: { transient: true },
      turnId: 'turn.pending',
    });

    expect(mergeLatestAgentSessionItems(
      [firstCanonical, unmatchedTransient],
      [secondCanonical],
    )).toEqual([firstCanonical, unmatchedTransient, secondCanonical]);
  });

  it('commits authority refreshes on top of stream deltas that arrived after the read started', () => {
    const current = session({
      runtimeStatus: 'streaming',
      lastRuntimeEventAt: '2026-01-01T00:00:03.000Z',
      transcriptUpdatedAt: '2026-01-01T00:00:03.000Z',
      items: [item('item.stream', 'assistant', {
        content: 'new delta',
        metadata: { transient: true },
        turnId: 'turn.pending',
      })],
    });
    const refreshed: AgentSessionView = {
      ...current,
      runtimeStatus: 'ready',
      lastRuntimeEventAt: '2026-01-01T00:00:01.000Z',
      transcriptUpdatedAt: '2026-01-01T00:00:01.000Z',
      items: [item('item.history', 'user')],
    };

    const merged = mergeRefreshedAgentSessionIntoCurrent(current, refreshed);

    expect(merged.runtimeStatus).toBe('streaming');
    expect(merged.lastRuntimeEventAt).toBe('2026-01-01T00:00:03.000Z');
    expect(merged.items.map((candidate) => candidate.id)).toEqual([
      'item.stream',
      'item.history',
    ]);
  });

  it('allows terminal authority state to end a locally observed busy session', () => {
    const current = session({
      runtimeStatus: 'streaming',
      items: [],
    });
    const refreshed: AgentSessionView = {
      ...current,
      status: 'completed' as const,
      runtimeStatus: 'completed' as const,
    };

    expect(
      mergeRefreshedAgentSessionIntoCurrent(current, refreshed).runtimeStatus,
    ).toBe('completed');
  });

  it('preserves an authority activity projection when a transcript refresh has no activity data', () => {
    const current = session({
      activity: {
        activityAt: '2026-07-27T10:00:00.000Z',
        freshness: 'fresh',
        freshUntil: '2026-07-27T10:00:30.000Z',
        observedAt: '2026-07-27T10:00:00.000Z',
        phase: 'running',
        source: 'turn',
        versions: { session: '1', latestTurn: '2' },
      },
      runtimeStatus: 'streaming',
      items: [],
    });
    const refreshed: AgentSessionView = {
      ...current,
      activity: undefined,
      runtimeStatus: 'ready' as const,
    };

    const merged = mergeRefreshedAgentSessionIntoCurrent(current, refreshed);

    expect(merged.activity).toBe(current.activity);
    expect(merged.runtimeStatus).toBe('streaming');
  });

  it('preserves newer activity and loaded transcript pagination across a stale refresh response', () => {
    const current = session({
      activity: {
        activityAt: '2026-07-27T10:00:03.000Z',
        freshness: 'fresh',
        phase: 'running',
        source: 'turn',
        versions: { session: '3', latestTurn: '2' },
      },
      runtimeStatus: 'streaming',
      itemPageInfo: { hasMore: true, page: 3, pageSize: 20 },
      items: [item('item.loaded', 'user')],
    });
    const refreshed: AgentSessionView = {
      ...current,
      activity: {
        activityAt: '2026-07-27T10:00:01.000Z',
        freshness: 'fresh' as const,
        phase: 'idle' as const,
        source: 'session' as const,
        versions: { session: '2' },
      },
      runtimeStatus: 'ready' as const,
      itemPageInfo: undefined,
      items: [],
    };

    const merged = mergeRefreshedAgentSessionIntoCurrent(current, refreshed);

    expect(merged.activity).toBe(current.activity);
    expect(merged.runtimeStatus).toBe('streaming');
    expect(merged.itemPageInfo).toEqual({ hasMore: true, page: 3, pageSize: 20 });
    expect(merged.items).toEqual(current.items);
  });

  it('preserves items appended while an older non-empty transcript refresh is committing', () => {
    const itemA = item('item-a', 'user');
    const itemB = item('item-b', 'assistant');
    const itemC = item('item-c', 'assistant');
    const current = session({
      items: [itemA, itemB, itemC],
      transcriptUpdatedAt: '2026-07-27T10:00:03.000Z',
    });
    const delayedRefresh = session({
      items: [itemA, itemB],
      transcriptUpdatedAt: '2026-07-27T10:00:02.000Z',
    });

    const merged = mergeAgentSessionProjectionForStore(current, delayedRefresh);

    expect(merged.items.map((entry) => entry.id)).toEqual(['item-a', 'item-b', 'item-c']);
    expect(merged.transcriptUpdatedAt).toBe('2026-07-27T10:00:03.000Z');
  });
});
