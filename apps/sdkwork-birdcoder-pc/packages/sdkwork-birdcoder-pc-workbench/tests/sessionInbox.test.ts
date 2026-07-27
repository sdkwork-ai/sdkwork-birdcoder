import { describe, expect, it } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionRuntimeDisplayStatus,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { AgentSessionRecord } from '../src/services/agentSessionViewModels.ts';
import {
  compareAgentSessionInboxEntries,
  resolveAgentSessionAttentionLevel,
  sortAgentSessionInboxEntries,
} from '../src/workbench/sessionInbox.ts';
import { normalizeWorkbenchPreferences } from '../src/workbench/preferences.ts';
import {
  applyWorkspaceSessionInboxUpdate,
  canSynchronizeWorkspaceSessionInbox,
  loadWorkspaceSessionInboxUpdate,
  resolveWorkspaceSessionInboxRefreshDelay,
} from '../src/workbench/workspaceSessionInboxSync.ts';

function session(
  id: string,
  overrides: Partial<AgentSessionView> = {},
): AgentSessionView {
  return {
    id,
    agentId: `agent.${id}`,
    projectId: 'project-1',
    title: id,
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'gpt-5',
    providerId: 'openai',
    runtimeStatus: 'ready',
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: '2026-07-26T08:00:00.000Z',
    displayTime: 'Just now',
    items: [],
    ...overrides,
  };
}

function project(sessions: AgentSessionView[]): AgentProjectView {
  return {
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    tenantId: '100001',
    organizationId: '0',
    ownerUserId: '100001',
    name: 'Commercial IDE',
    description: '',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'owner_library',
    defaultAgentId: 'agent.codex',
    defaultModelId: 'gpt-5',
    version: '1',
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: '2026-07-26T08:00:00.000Z',
    agentSessions: sessions,
  };
}

function record(
  sessionId: string,
  overrides: Partial<AgentSessionRecord> = {},
): AgentSessionRecord {
  return {
    sessionId,
    tenantId: '100001',
    organizationId: '0',
    agentId: `agent.${sessionId}`,
    ownerUserId: '100001',
    projectId: 'project-1',
    sessionKind: 'coding',
    entrySurface: 'pc',
    status: 'active',
    itemCount: '1',
    lastItemSequence: '1',
    totalInputTokens: '0',
    totalOutputTokens: '0',
    createdBy: '100001',
    updatedBy: '100001',
    version: '2',
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: '2026-07-26T08:10:00.000Z',
    lastItemAt: '2026-07-26T08:10:00.000Z',
    ...overrides,
  };
}

describe('Session Inbox', () => {
  it('orders smart priority deterministically across independent providers', () => {
    const statuses: Array<[string, Partial<AgentSessionView>, string]> = [
      ['pinned', { pinned: true, providerId: 'anthropic' }, 'pinned'],
      ['approval', { runtimeStatus: 'awaiting_approval', providerId: 'openai' }, 'attention'],
      ['executing', { runtimeStatus: 'streaming', providerId: 'opencode' }, 'executing'],
      ['failed', { runtimeStatus: 'failed' }, 'failed'],
      ['unread', { unread: true }, 'unread'],
      ['ready', {}, 'normal'],
    ];
    const sessions = statuses.map(([id, overrides]) => session(id, overrides));

    expect(sortAgentSessionInboxEntries([...sessions].reverse(), 'smart').map((item) => item.id))
      .toEqual(statuses.map(([id]) => id));
    for (const [id, , attentionLevel] of statuses) {
      expect(resolveAgentSessionAttentionLevel(sessions.find((item) => item.id === id)!))
        .toBe(attentionLevel);
    }
  });

  it('uses the newest meaningful activity instead of a stale explicit sort timestamp', () => {
    const older = session('older', {
      sortTimestamp: String(Date.parse('2026-07-26T08:05:00.000Z')),
      lastRuntimeEventAt: '2026-07-26T08:30:00.000Z',
    });
    const newer = session('newer', {
      sortTimestamp: String(Date.parse('2026-07-26T08:20:00.000Z')),
    });

    expect(compareAgentSessionInboxEntries(older, newer, 'recent')).toBeLessThan(0);
  });

  it('moves only the background Session while retaining external selection', () => {
    const selectedSessionId = 'claude-session';
    const claude = session(selectedSessionId, {
      providerId: 'anthropic',
      serverVersion: '1',
      lastItemSequence: '1',
      lastReadItemSequence: '1',
      sortTimestamp: String(Date.parse('2026-07-26T08:20:00.000Z')),
    });
    const codex = session('codex-session', {
      providerId: 'openai',
      serverVersion: '1',
      lastItemSequence: '1',
      lastReadItemSequence: '1',
      sortTimestamp: String(Date.parse('2026-07-26T08:10:00.000Z')),
    });

    const updatedProjects = applyWorkspaceSessionInboxUpdate([project([claude, codex])], {
      hydratedSessions: new Map(),
      records: [record('codex-session', {
        lastItemSequence: '2',
        lastItemAt: '2026-07-26T08:30:00.000Z',
        updatedAt: '2026-07-26T08:30:00.000Z',
      })],
    });
    const sorted = sortAgentSessionInboxEntries(updatedProjects[0]!.agentSessions, 'recent');

    expect(sorted.map((item) => item.id)).toEqual(['codex-session', 'claude-session']);
    expect(sorted[0]?.unread).toBe(true);
    expect(selectedSessionId).toBe('claude-session');
    expect(sorted.find((item) => item.id === selectedSessionId)?.providerId).toBe('anthropic');
  });

  it('loads only the bounded Workspace Inbox page and hydrates new Sessions for loaded Projects', async () => {
    const workspaceRequests: unknown[] = [];
    const runtimeBindingReads: string[] = [];
    const userStateReads: string[] = [];
    const existing = session('existing', { serverVersion: '1' });
    const loadedProject = project([existing]);
    const service = {
      async listSessionsByWorkspace(request: unknown) {
        workspaceRequests.push(request);
        return {
          items: [
            record('existing'),
            record('new-loaded'),
            record('new-loaded'),
            record('new-unloaded', { projectId: 'project-not-loaded' }),
          ],
          pageInfo: {
            mode: 'offset',
            page: 1,
            pageSize: 20,
            hasMore: true,
          },
        };
      },
      async listRuntimeBindings(sessionId: string) {
        runtimeBindingReads.push(sessionId);
        return {
          items: [],
          pageInfo: {
            mode: 'offset',
            page: 1,
            pageSize: 20,
            hasMore: false,
          },
        };
      },
      async getSessionUserState(sessionId: string) {
        userStateReads.push(sessionId);
        return {
          id: `user-state.${sessionId}`,
          tenantId: '100001',
          organizationId: '0',
          userId: '100001',
          resourceType: 'session',
          resourceId: sessionId,
          version: '1',
          createdAt: '2026-07-26T08:00:00.000Z',
          updatedAt: '2026-07-26T08:00:00.000Z',
          lastReadItemSequence: '0',
        };
      },
    } as unknown as IAgentSessionService;

    const update = await loadWorkspaceSessionInboxUpdate(
      service,
      ' workspace-1 ',
      [loadedProject],
    );
    const updatedProjects = applyWorkspaceSessionInboxUpdate([loadedProject], update);

    expect(workspaceRequests).toEqual([{
      workspaceId: 'workspace-1',
      page: 1,
      pageSize: 20,
    }]);
    expect(runtimeBindingReads).toEqual(['new-loaded']);
    expect(userStateReads).toEqual(['new-loaded']);
    expect(updatedProjects[0]?.agentSessions.map((item) => item.id))
      .toEqual(['existing', 'new-loaded']);
    expect(updatedProjects[0]?.agentSessions.some((item) => item.id === 'new-unloaded'))
      .toBe(false);
  });

  it('fails closed when Workspace pagination cannot make forward progress', async () => {
    const service = {
      async listSessionsByWorkspace() {
        return {
          items: [],
          pageInfo: {
            mode: 'offset',
            page: 1,
            pageSize: 20,
            hasMore: true,
          },
        };
      },
    } as unknown as IAgentSessionService;

    await expect(loadWorkspaceSessionInboxUpdate(
      service,
      'workspace-1',
      [project([])],
    )).rejects.toThrow('empty page with hasMore=true');
  });

  it('normalizes persisted Inbox preferences without accepting arbitrary enum values', () => {
    const preferences = normalizeWorkbenchPreferences({
      sessionInboxFilter: 'attention',
      sessionInboxGroupMode: 'provider',
      sessionInboxProviderId: 'anthropic',
      sessionInboxShowArchived: true,
      sessionInboxSortMode: 'recent',
    });
    expect(preferences).toMatchObject({
      sessionInboxFilter: 'attention',
      sessionInboxGroupMode: 'provider',
      sessionInboxProviderId: 'anthropic',
      sessionInboxShowArchived: true,
      sessionInboxSortMode: 'recent',
    });
    expect(normalizeWorkbenchPreferences({
      sessionInboxFilter: 'invalid',
      sessionInboxGroupMode: 'invalid',
      sessionInboxSortMode: 'invalid',
    })).toMatchObject({
      sessionInboxFilter: 'all',
      sessionInboxGroupMode: 'project',
      sessionInboxSortMode: 'smart',
    });
  });

  it('backs off Workspace synchronization and pauses while hidden or offline', () => {
    expect([
      resolveWorkspaceSessionInboxRefreshDelay(0),
      resolveWorkspaceSessionInboxRefreshDelay(1),
      resolveWorkspaceSessionInboxRefreshDelay(2),
      resolveWorkspaceSessionInboxRefreshDelay(3),
      resolveWorkspaceSessionInboxRefreshDelay(20),
    ]).toEqual([15_000, 30_000, 60_000, 120_000, 120_000]);
    expect(canSynchronizeWorkspaceSessionInbox('visible', true)).toBe(true);
    expect(canSynchronizeWorkspaceSessionInbox('hidden', true)).toBe(false);
    expect(canSynchronizeWorkspaceSessionInbox('visible', false)).toBe(false);
  });

  it.each<AgentSessionRuntimeDisplayStatus>([
    'initializing',
    'streaming',
    'awaiting_tool',
  ])('classifies %s as executing', (runtimeStatus) => {
    expect(resolveAgentSessionAttentionLevel(session(runtimeStatus, { runtimeStatus })))
      .toBe('executing');
  });
});
