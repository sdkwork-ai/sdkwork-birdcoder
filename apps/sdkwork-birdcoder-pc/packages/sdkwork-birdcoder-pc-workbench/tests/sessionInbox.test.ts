import { describe, expect, it, vi } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionRuntimeDisplayStatus,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { AgentSessionActivitySummaryRecord } from '../src/services/agentSessionViewModels.ts';
import {
  buildProjectsStoreScopeKey,
  canCommitAgentSessionToProjectsStore,
  deleteProjectsStore,
  filterProjectsForInventoryStore,
  getProjectsStore,
  mutateProjectsStoreByScopeKey,
  peekProjectsStore,
  PROJECT_STORE_MAX_SESSION_TOMBSTONES,
  recordAgentSessionTombstoneInProjectsStore,
  upsertAgentSessionIntoCollection,
  upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
  upsertProjectIntoProjectsStoreByScopeKey,
} from '../src/stores/projectsStore.ts';
import { normalizeWorkbenchPreferences } from '../src/workbench/preferences.ts';
import {
  compareAgentSessionInboxEntries,
  resolveAgentSessionAttentionLevel,
  sortAgentSessionInboxEntries,
} from '../src/workbench/sessionInbox.ts';
import {
  applyWorkspaceSessionInboxUpdate,
  canSynchronizeWorkspaceSessionInbox,
  loadWorkspaceSessionInboxUpdate,
  resolveWorkspaceSessionInboxRefreshDelay,
  WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS,
} from '../src/workbench/workspaceSessionInboxSync.ts';

const tenantId = '100001';
const organizationId = '0';
const ownerUserId = '100001';
const workspaceId = 'workspace-1';
const projectId = 'project-1';
const createdAt = '2026-07-26T08:00:00.000Z';
const activityAt = '2026-07-26T08:10:00.000Z';
const freshUntil = '2099-07-26T08:15:00.000Z';
const providerSessionIdsBySessionId = new Map<string, string>();
let nextProviderSessionFixtureSequence = 1;

function resolveProviderSessionFixtureId(sessionId: string): string {
  const existing = providerSessionIdsBySessionId.get(sessionId);
  if (existing) {
    return existing;
  }
  const providerSessionId = `provider-continuation-fixture-${String(
    nextProviderSessionFixtureSequence,
  ).padStart(4, '0')}`;
  nextProviderSessionFixtureSequence += 1;
  providerSessionIdsBySessionId.set(sessionId, providerSessionId);
  return providerSessionId;
}

type ActivitySummary = AgentSessionActivitySummaryRecord;
type RuntimeBinding = NonNullable<ActivitySummary['currentRuntimeBinding']>;
type Interaction = NonNullable<ActivitySummary['pendingInteraction']>;
type ProviderActivity = NonNullable<ActivitySummary['providerActivity']>;

interface SummaryOptions {
  activityAt?: string;
  agentId?: string;
  currentRuntimeBinding?: RuntimeBinding | null;
  freshness?: Partial<ActivitySummary['freshness']>;
  latestRuntimeBinding?: RuntimeBinding | null;
  latestTurn?: ActivitySummary['latestTurn'];
  providerActivity?: ProviderActivity | null;
  pendingInteraction?: Interaction | null;
  presentationPhase?: ActivitySummary['presentationPhase'];
  projectId?: string;
  session?: Partial<ActivitySummary['session']>;
  sessionId?: string;
  userState?: ActivitySummary['userState'];
  version?: string;
}

function session(
  id: string,
  overrides: Partial<AgentSessionView> = {},
): AgentSessionView {
  return {
    id,
    agentId: `agent.${id}`,
    projectId,
    title: id,
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'gpt-5',
    providerId: 'provider.openai',
    runtimeStatus: 'ready',
    createdAt,
    updatedAt: createdAt,
    displayTime: 'Just now',
    items: [],
    ...overrides,
  };
}

function project(
  sessions: AgentSessionView[] = [],
  overrides: Partial<AgentProjectView> = {},
): AgentProjectView {
  return {
    projectId,
    workspaceId,
    tenantId,
    organizationId,
    ownerUserId,
    name: 'Commercial IDE',
    description: '',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'owner_library',
    defaultAgentId: 'agent.codex',
    defaultModelId: 'gpt-5',
    version: '1',
    createdAt,
    updatedAt: createdAt,
    agentSessions: sessions,
    ...overrides,
  };
}

function runtimeBinding(
  sessionId: string,
  overrides: Partial<RuntimeBinding> = {},
): RuntimeBinding {
  return {
    runtimeBindingId: `runtime-binding.${sessionId}`,
    tenantId,
    organizationId,
    sessionId,
    hostMode: 'desktop',
    transportKind: 'sdk-stream',
    providerBindingId: 'provider-binding.openai.fixture',
    modelId: 'gpt-5',
    providerId: 'provider.openai',
    providerSessionId: resolveProviderSessionFixtureId(sessionId),
    status: 'active',
    isCurrent: true,
    version: '1',
    createdAt,
    updatedAt: activityAt,
    ...overrides,
  };
}

function pendingInteraction(
  sessionId: string,
  overrides: Partial<Interaction> = {},
): Interaction {
  return {
    interactionId: `interaction.${sessionId}`,
    tenantId,
    organizationId,
    sessionId,
    kind: 'approval',
    status: 'pending',
    prompt: 'Approve the command?',
    options: [],
    fencingToken: '0',
    version: '1',
    createdAt,
    updatedAt: activityAt,
    ...overrides,
  };
}

function summary(options: SummaryOptions = {}): ActivitySummary {
  const resolvedSessionId = options.sessionId ?? 'session-1';
  const resolvedProjectId = options.projectId ?? projectId;
  const resolvedAgentId = options.agentId ?? `agent.${resolvedSessionId}`;
  const version = options.version ?? '1';
  const currentRuntimeBinding = options.currentRuntimeBinding === undefined
    ? null
    : options.currentRuntimeBinding;
  const latestRuntimeBinding = options.latestRuntimeBinding === undefined
    ? currentRuntimeBinding
    : options.latestRuntimeBinding;
  const pending = options.pendingInteraction === undefined ? null : options.pendingInteraction;
  const latestTurn = options.latestTurn === undefined ? null : options.latestTurn;
  const providerActivity = options.providerActivity === undefined ? null : options.providerActivity;
  const resolvedActivityAt = options.activityAt ?? activityAt;
  const identitySource = currentRuntimeBinding ?? latestTurn;
  return {
    session: {
      id: `id.${resolvedSessionId}`,
      sessionId: resolvedSessionId,
      tenantId,
      organizationId,
      agentId: resolvedAgentId,
      ownerUserId,
      projectId: resolvedProjectId,
      sessionKind: 'coding',
      entrySurface: 'pc',
      title: resolvedSessionId,
      titleSource: 'system',
      status: 'active',
      itemCount: '0',
      lastItemSequence: '0',
      totalInputTokens: '0',
      totalOutputTokens: '0',
      createdBy: ownerUserId,
      updatedBy: ownerUserId,
      version,
      createdAt,
      updatedAt: resolvedActivityAt,
      ...options.session,
    },
    latestTurn,
    pendingInteraction: pending,
    currentRuntimeBinding,
    latestRuntimeBinding,
    userState: options.userState === undefined ? null : options.userState,
    providerIdentity: {
      runtimeBindingId: identitySource?.runtimeBindingId ?? null,
      providerBindingId: identitySource?.providerBindingId ?? null,
      providerId: identitySource?.providerId ?? null,
      modelId: identitySource?.modelId ?? null,
      providerSessionId: currentRuntimeBinding?.providerSessionId ?? null,
      providerSessionTreeId: currentRuntimeBinding?.providerSessionTreeId ?? null,
      providerParentSessionId: currentRuntimeBinding?.providerParentSessionId ?? null,
      providerForkedFromSessionId: currentRuntimeBinding?.providerForkedFromSessionId ?? null,
    },
    freshness: {
      activityAt: resolvedActivityAt,
      source: 'session',
      observedAt: resolvedActivityAt,
      freshUntil,
      sessionVersion: version,
      latestTurnVersion: latestTurn?.version ?? null,
      latestInteractionId: pending?.interactionId ?? null,
      latestInteractionVersion: pending?.version ?? null,
      latestRuntimeBindingId: latestRuntimeBinding?.runtimeBindingId ?? null,
      latestRuntimeBindingVersion: latestRuntimeBinding?.version ?? null,
      pendingInteractionVersion: pending?.version ?? null,
      currentRuntimeBindingVersion: currentRuntimeBinding?.version ?? null,
      userStateVersion: options.userState?.version ?? null,
      ...options.freshness,
    },
    providerActivity,
    presentationPhase: options.presentationPhase ?? 'ready',
  };
}

function cursorPage(
  items: ActivitySummary[],
  options: { hasMore?: boolean; nextCursor?: string | null } = {},
) {
  return {
    items,
    pageInfo: {
      mode: 'cursor' as const,
      pageSize: 100,
      hasMore: options.hasMore ?? false,
      nextCursor: options.nextCursor ?? null,
    },
  };
}

function activityService(
  implementation: IAgentSessionService['listSessionActivitySummaries'],
): IAgentSessionService {
  return { listSessionActivitySummaries: implementation } as IAgentSessionService;
}

describe('Session Inbox', () => {
  it('orders smart priority deterministically across independent providers', () => {
    const statuses: Array<[string, Partial<AgentSessionView>, string]> = [
      ['pinned', { pinned: true, providerId: 'provider.anthropic' }, 'pinned'],
      ['approval', { runtimeStatus: 'awaiting_approval' }, 'attention'],
      ['executing', { runtimeStatus: 'streaming', providerId: 'provider.opencode' }, 'executing'],
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

  it('loads a bounded cursor page, trims scope input, and ignores unloaded Projects', async () => {
    const list = vi.fn(async () => cursorPage([
      summary({ sessionId: 'existing' }),
      summary({ sessionId: 'new-loaded' }),
      summary({ sessionId: 'new-unloaded', projectId: 'project-not-loaded' }),
    ], { hasMore: true, nextCursor: 'cursor.next' }));
    const loadedProject = project([session('existing')]);

    const update = await loadWorkspaceSessionInboxUpdate(
      activityService(list),
      ` ${workspaceId} `,
      [loadedProject],
      ' cursor.current ',
    );
    const updatedProjects = applyWorkspaceSessionInboxUpdate([loadedProject], update);

    expect(list).toHaveBeenCalledWith({
      cursor: 'cursor.current',
      pageSize: 100,
      workspaceId,
    }, { signal: undefined });
    expect(update).toMatchObject({
      cursor: 'cursor.current',
      hasMore: true,
      nextCursor: 'cursor.next',
    });
    expect(updatedProjects[0]?.agentSessions.map((item) => item.id))
      .toEqual(['existing', 'new-loaded']);
  });

  it.each([
    ['empty page with hasMore', cursorPage([], { hasMore: true, nextCursor: 'cursor.next' })],
    ['repeated request cursor', cursorPage([summary()], {
      hasMore: true,
      nextCursor: 'cursor.current',
    })],
  ])('rejects a non-progressing cursor: %s', async (_label, response) => {
    const service = activityService(async () => response);

    await expect(loadWorkspaceSessionInboxUpdate(
      service,
      workspaceId,
      [project()],
      'cursor.current',
    )).rejects.toThrow('non-progressing cursor page');
  });

  it('rejects an empty terminal continuation that echoes its opaque request cursor', async () => {
    await expect(loadWorkspaceSessionInboxUpdate(
      activityService(async () => cursorPage([], {
        hasMore: false,
        nextCursor: 'cursor.terminal',
      })),
      workspaceId,
      [project()],
      'cursor.terminal',
    )).rejects.toThrow('unexpected terminal cursor');
  });

  it.each([
    ['Workspace', summary(), project([], { workspaceId: 'workspace.other' })],
    ['tenant', summary({ session: { tenantId: 'tenant.other' } }), project()],
    ['organization', summary({ session: { organizationId: 'organization.other' } }), project()],
    ['owner', summary({ session: { ownerUserId: 'owner.other' } }), project()],
  ])('fails closed on %s scope mismatch', async (_label, item, loadedProject) => {
    await expect(loadWorkspaceSessionInboxUpdate(
      activityService(async () => cursorPage([item])),
      workspaceId,
      [loadedProject],
    )).rejects.toThrow('escaped its requested Workspace scope');
  });

  it('rejects duplicate Session identities in one activity page', async () => {
    await expect(loadWorkspaceSessionInboxUpdate(
      activityService(async () => cursorPage([summary(), summary()])),
      workspaceId,
      [project()],
    )).rejects.toThrow('duplicate Session identity');
  });

  it.each([
    ['Turn identity', summary({
      latestTurn: {
        turnId: 'turn-1',
        tenantId,
        organizationId,
        sessionId: 'session.other',
        agentId: 'agent.session-1',
        ownerUserId,
        idempotencyKey: 'turn-1',
        payloadHash: 'hash',
        requestItemId: 'item-1',
        turnMode: 'interactive',
        status: 'running',
        inputTokens: '0',
        outputTokens: '0',
        cachedTokens: '0',
        attemptCount: 1,
        maxAttempts: 1,
        availableAt: createdAt,
        fencingToken: '0',
        version: '1',
        createdAt,
        updatedAt: activityAt,
      },
    }), 'latest Turn identity'],
    ['Interaction identity', summary({
      pendingInteraction: pendingInteraction('session.other'),
    }), 'pending Interaction identity'],
    ['RuntimeBinding identity', summary({
      currentRuntimeBinding: runtimeBinding('session.other'),
    }), 'current RuntimeBinding identity'],
    ['user-state identity', summary({
      userState: {
        id: 'user-state-1',
        tenantId,
        organizationId,
        userId: ownerUserId,
        resourceType: 'session',
        resourceId: 'session.other',
        version: '1',
        createdAt,
        updatedAt: activityAt,
      },
    }), 'user state escaped'],
    ['component version', summary({
      latestTurn: {
        turnId: 'turn-1',
        tenantId,
        organizationId,
        sessionId: 'session-1',
        agentId: 'agent.session-1',
        ownerUserId,
        idempotencyKey: 'turn-1',
        payloadHash: 'hash',
        requestItemId: 'item-1',
        turnMode: 'interactive',
        status: 'running',
        inputTokens: '0',
        outputTokens: '0',
        cachedTokens: '0',
        attemptCount: 1,
        maxAttempts: 1,
        availableAt: createdAt,
        fencingToken: '0',
        version: '2',
        createdAt,
        updatedAt: activityAt,
      },
      freshness: { latestTurnVersion: '1' },
    }), 'latest Turn revision'],
  ])('fails closed on invalid %s', async (_label, item, message) => {
    await expect(loadWorkspaceSessionInboxUpdate(
      activityService(async () => cursorPage([item])),
      workspaceId,
      [project()],
    )).rejects.toThrow(message);
  });

  it('applies Interaction and RuntimeBinding tombstones instead of retaining stale attention', () => {
    const bindingV1 = runtimeBinding('session-1');
    const interactionV1 = pendingInteraction('session-1');
    const initial = summary({
      currentRuntimeBinding: bindingV1,
      latestRuntimeBinding: bindingV1,
      pendingInteraction: interactionV1,
      presentationPhase: 'awaiting_input',
    });
    const bindingV2 = runtimeBinding('session-1', {
      isCurrent: false,
      status: 'failed',
      version: '2',
      updatedAt: '2026-07-26T08:20:00.000Z',
    });
    const tombstone = summary({
      activityAt: '2026-07-26T08:20:00.000Z',
      currentRuntimeBinding: null,
      latestRuntimeBinding: bindingV2,
      pendingInteraction: null,
      presentationPhase: 'failed',
      freshness: {
        latestInteractionId: interactionV1.interactionId,
        latestInteractionVersion: '2',
        pendingInteractionVersion: null,
        currentRuntimeBindingVersion: null,
      },
    });

    const withPending = applyWorkspaceSessionInboxUpdate([project()], {
      hasMore: false,
      summaries: [initial],
    });
    expect(withPending[0]?.agentSessions[0]).toMatchObject({
      runtimeBindingId: bindingV1.runtimeBindingId,
      runtimeStatus: 'awaiting_approval',
      activity: { pendingInteraction: { id: interactionV1.interactionId } },
    });

    const resolved = applyWorkspaceSessionInboxUpdate(withPending, {
      hasMore: false,
      summaries: [tombstone],
    });
    expect(resolved[0]?.agentSessions[0]).toMatchObject({
      runtimeStatus: 'failed',
      activity: {
        runtimeBinding: { id: bindingV2.runtimeBindingId, status: 'failed', version: '2' },
        versions: {
          latestInteractionId: interactionV1.interactionId,
          latestInteraction: '2',
          latestRuntimeBinding: '2',
        },
      },
    });
    expect(resolved[0]?.agentSessions[0]?.runtimeBindingId).toBeUndefined();
    expect(resolved[0]?.agentSessions[0]?.activity?.pendingInteraction).toBeUndefined();
  });

  it('expires stale provider evidence and accepts a newer renewal without component revision drift', () => {
    const stale = summary({
      activityAt: '2000-01-01T00:00:00.000Z',
      providerActivity: {
        providerSessionId: 'provider.session-1',
        state: 'working',
        freshness: 'fresh',
        evidenceKind: 'provider_event',
        interactionHint: null,
        observedAt: '2000-01-01T00:00:00.000Z',
        freshUntil: '2000-01-01T00:01:00.000Z',
      },
      presentationPhase: 'running',
      freshness: {
        observedAt: '2000-01-01T00:00:00.000Z',
        freshUntil: '2000-01-01T00:01:00.000Z',
      },
    });
    const renewed = summary({
      activityAt: '2026-07-26T08:20:00.000Z',
      providerActivity: {
        providerSessionId: 'provider.session-1',
        state: 'working',
        freshness: 'fresh',
        evidenceKind: 'provider_event',
        interactionHint: null,
        observedAt: '2026-07-26T08:20:00.000Z',
        freshUntil,
      },
      presentationPhase: 'running',
      freshness: {
        observedAt: '2026-07-26T08:20:00.000Z',
        freshUntil,
      },
    });

    const expired = applyWorkspaceSessionInboxUpdate([project()], {
      hasMore: false,
      summaries: [stale],
    });
    expect(expired[0]?.agentSessions[0]?.runtimeStatus).toBe('stale');

    const refreshed = applyWorkspaceSessionInboxUpdate(expired, {
      hasMore: false,
      summaries: [renewed],
    });
    expect(refreshed[0]?.agentSessions[0]).toMatchObject({
      runtimeStatus: 'streaming',
      activity: {
        freshness: 'fresh',
        provider: { observedAt: '2026-07-26T08:20:00.000Z', state: 'working' },
      },
    });
  });

  it('removes a deleted Session from the disposable projection', () => {
    const deleted = summary({
      presentationPhase: 'deleted',
      session: { deletedAt: '2026-07-26T08:20:00.000Z' },
    });
    const updated = applyWorkspaceSessionInboxUpdate([project([session('session-1')])], {
      hasMore: false,
      summaries: [deleted],
    });

    expect(updated[0]?.agentSessions).toEqual([]);
  });

  it('keeps Codex, Claude Code, OpenCode, and Gemini CLI Sessions distinct', () => {
    const providers = [
      ['codex', 'provider.openai'],
      ['claude-code', 'provider.anthropic'],
      ['opencode', 'provider.opencode'],
      ['gemini-cli', 'provider.google'],
    ] as const;
    const summaries = providers.map(([id, providerId]) => summary({
      sessionId: `session.${id}`,
      agentId: `agent.${id}`,
      currentRuntimeBinding: runtimeBinding(`session.${id}`, {
        providerBindingId: `binding.${id}`,
        providerId,
      }),
      presentationPhase: 'running',
    }));
    const updated = applyWorkspaceSessionInboxUpdate([project()], {
      hasMore: false,
      summaries,
    });

    expect(updated[0]?.agentSessions.map((item) => `${item.id}:${item.providerId}`).sort())
      .toEqual(providers.map(([id, providerId]) => `session.${id}:${providerId}`).sort());
  });

  it('reads persisted provider Session identity from the latest matching RuntimeBinding', () => {
    const sessionId = 'session.persisted-provider-identity';
    const persistedBinding = runtimeBinding(sessionId, {
      isCurrent: false,
      runtimeLocationId: 'runtime-location.persisted',
      status: 'deactivated',
    });
    const updated = applyWorkspaceSessionInboxUpdate([project()], {
      hasMore: false,
      summaries: [summary({
        sessionId,
        currentRuntimeBinding: null,
        latestRuntimeBinding: persistedBinding,
        presentationPhase: 'completed',
      })],
    });

    expect(updated[0]?.agentSessions[0]).toMatchObject({
      hostMode: 'desktop',
      providerSessionId: persistedBinding.providerSessionId,
      providerBindingId: persistedBinding.providerBindingId,
      providerId: 'provider.openai',
      runtimeBindingId: undefined,
      runtimeLocationId: 'runtime-location.persisted',
      transportKind: 'sdk-stream',
    });
  });

  it('matches the latest Turn to its persisted RuntimeBinding provider Session identity', () => {
    const sessionId = 'session.turn-provider-identity';
    const persistedBinding = runtimeBinding(sessionId, {
      isCurrent: false,
      runtimeLocationId: 'runtime-location.turn',
      status: 'deactivated',
    });
    const updated = applyWorkspaceSessionInboxUpdate([project()], {
      hasMore: false,
      summaries: [summary({
        sessionId,
        currentRuntimeBinding: null,
        latestRuntimeBinding: persistedBinding,
        latestTurn: {
          turnId: 'turn.provider-identity',
          tenantId,
          organizationId,
          sessionId,
          agentId: `agent.${sessionId}`,
          ownerUserId,
          runtimeBindingId: persistedBinding.runtimeBindingId,
          providerBindingId: persistedBinding.providerBindingId,
          providerId: persistedBinding.providerId,
          modelId: persistedBinding.modelId,
          idempotencyKey: 'turn.provider-identity',
          payloadHash: 'hash',
          requestItemId: 'item.provider-identity',
          turnMode: 'interactive',
          status: 'completed',
          inputTokens: '0',
          outputTokens: '0',
          cachedTokens: '0',
          attemptCount: 1,
          maxAttempts: 1,
          availableAt: createdAt,
          fencingToken: '0',
          version: '1',
          createdAt,
          updatedAt: activityAt,
        },
        presentationPhase: 'completed',
      })],
    });

    expect(updated[0]?.agentSessions[0]).toMatchObject({
      hostMode: 'desktop',
      providerSessionId: persistedBinding.providerSessionId,
      providerBindingId: persistedBinding.providerBindingId,
      providerId: persistedBinding.providerId,
      runtimeBindingId: undefined,
      runtimeLocationId: 'runtime-location.turn',
      transportKind: persistedBinding.transportKind,
    });
  });

  it('prefers canonical latest Turn provider identity over an older binding tombstone', () => {
    const sessionId = 'session.provider-switch';
    const latestTurn = {
      turnId: 'turn.provider-switch',
      tenantId,
      organizationId,
      sessionId,
      agentId: 'agent.claude-code',
      ownerUserId,
      runtimeBindingId: 'runtime-binding.claude',
      providerBindingId: 'provider-binding.anthropic',
      providerId: 'provider.anthropic',
      modelId: 'claude-sonnet-4',
      idempotencyKey: 'turn.provider-switch',
      payloadHash: 'hash',
      requestItemId: 'item.provider-switch',
      turnMode: 'interactive' as const,
      status: 'running' as const,
      inputTokens: '0',
      outputTokens: '0',
      cachedTokens: '0',
      attemptCount: 1,
      maxAttempts: 1,
      availableAt: createdAt,
      fencingToken: '0',
      version: '1',
      createdAt,
      updatedAt: activityAt,
    };
    const oldBinding = runtimeBinding(sessionId, {
      isCurrent: false,
      providerBindingId: 'provider-binding.openai',
      providerId: 'provider.openai',
      status: 'deactivated',
      version: '2',
    });
    const updated = applyWorkspaceSessionInboxUpdate([project()], {
      hasMore: false,
      summaries: [summary({
        sessionId,
        agentId: 'agent.claude-code',
        currentRuntimeBinding: null,
        latestRuntimeBinding: oldBinding,
        latestTurn,
        presentationPhase: 'running',
      })],
    });
    const switched = updated[0]?.agentSessions[0];

    expect(switched).toMatchObject({
      providerBindingId: 'provider-binding.anthropic',
      providerId: 'provider.anthropic',
      modelId: 'claude-sonnet-4',
      runtimeBindingId: undefined,
      runtimeStatus: 'streaming',
    });
  });

  it('does not fill a sparse latest Turn provider identity from an older binding tombstone', () => {
    const sessionId = 'session.provider-switch-sparse';
    const latestTurn = {
      turnId: 'turn.provider-switch-sparse',
      tenantId,
      organizationId,
      sessionId,
      agentId: 'agent.claude-code',
      ownerUserId,
      runtimeBindingId: null,
      providerBindingId: null,
      providerId: 'provider.anthropic',
      modelId: null,
      idempotencyKey: 'turn.provider-switch-sparse',
      payloadHash: 'hash',
      requestItemId: 'item.provider-switch-sparse',
      turnMode: 'interactive' as const,
      status: 'running' as const,
      inputTokens: '0',
      outputTokens: '0',
      cachedTokens: '0',
      attemptCount: 1,
      maxAttempts: 1,
      availableAt: createdAt,
      fencingToken: '0',
      version: '1',
      createdAt,
      updatedAt: activityAt,
    };
    const oldBinding = runtimeBinding(sessionId, {
      isCurrent: false,
      providerBindingId: 'provider-binding.openai',
      providerId: 'provider.openai',
      status: 'deactivated',
      version: '2',
    });
    const updated = applyWorkspaceSessionInboxUpdate([project()], {
      hasMore: false,
      summaries: [summary({
        sessionId,
        agentId: 'agent.claude-code',
        currentRuntimeBinding: null,
        latestRuntimeBinding: oldBinding,
        latestTurn,
        presentationPhase: 'running',
      })],
    });
    const switched = updated[0]?.agentSessions[0];

    expect(switched).toMatchObject({
      modelId: 'auto',
      providerId: 'provider.anthropic',
      runtimeStatus: 'streaming',
      activity: {
        runtimeBinding: {
          id: oldBinding.runtimeBindingId,
          status: 'deactivated',
        },
      },
    });
    expect(switched?.providerBindingId).toBeUndefined();
    expect(switched?.runtimeBindingId).toBeUndefined();
    expect(switched?.transportKind).toBeUndefined();
    expect(switched?.providerSessionId).toBeUndefined();
  });

  it('moves only the background Session while retaining external selection', () => {
    const selectedSessionId = 'claude-session';
    const selected = session(selectedSessionId, {
      providerId: 'provider.anthropic',
      sortTimestamp: String(Date.parse('2026-07-26T08:20:00.000Z')),
    });
    const codex = session('codex-session', {
      providerId: 'provider.openai',
      sortTimestamp: String(Date.parse('2026-07-26T08:10:00.000Z')),
    });
    const updatedProjects = applyWorkspaceSessionInboxUpdate([project([selected, codex])], {
      hasMore: false,
      summaries: [summary({
        sessionId: 'codex-session',
        activityAt: '2026-07-26T08:30:00.000Z',
        version: '2',
      })],
    });
    const sorted = sortAgentSessionInboxEntries(updatedProjects[0]!.agentSessions, 'recent');

    expect(sorted.map((item) => item.id)).toEqual(['codex-session', selectedSessionId]);
    expect(selectedSessionId).toBe('claude-session');
    expect(sorted.find((item) => item.id === selectedSessionId)?.providerId)
      .toBe('provider.anthropic');
  });

  it('does not reuse a stale Session view when its RuntimeBinding changes', () => {
    const existing = session('binding-change', {
      runtimeBindingId: 'runtime-binding.old',
    });
    const updated = { ...existing, runtimeBindingId: 'runtime-binding.new' };
    const projects = upsertAgentSessionIntoCollection(
      [project([existing])],
      projectId,
      updated,
    );

    expect(projects[0]?.agentSessions[0]).not.toBe(existing);
    expect(projects[0]?.agentSessions[0]?.runtimeBindingId).toBe('runtime-binding.new');
  });

  it('does not let offset inventory hydration erase a newer activity projection', () => {
    const existing = session('activity-preserved', {
      activity: {
        activityAt,
        source: 'turn',
        freshness: 'fresh',
        phase: 'running',
        versions: { session: '2', latestTurn: '1' },
      },
      runtimeBindingId: 'runtime-binding.current',
      runtimeLocationId: 'runtime-location.current',
      hostMode: 'desktop',
      engineId: 'claude-code',
      modelId: 'claude-sonnet-4',
      providerId: 'provider.anthropic',
      providerBindingId: 'provider-binding.anthropic',
      transportKind: 'sdk-stream',
      providerSessionId: 'provider.current',
      runtimeStatus: 'streaming',
      lastTurnAt: activityAt,
      lastMessageAt: activityAt,
      lastRuntimeEventAt: activityAt,
      lastUserActivityAt: activityAt,
      sortTimestamp: String(Date.parse(activityAt)),
      lastReadItemSequence: '8',
      pinned: true,
      unread: true,
    });
    const offsetHydration = {
      ...existing,
      activity: undefined,
      runtimeBindingId: undefined,
      runtimeLocationId: undefined,
      hostMode: 'web' as const,
      engineId: 'unknown',
      modelId: 'auto',
      providerId: 'unknown',
      providerBindingId: undefined,
      transportKind: undefined,
      providerSessionId: undefined,
      runtimeStatus: 'unknown' as const,
      title: 'Provider synchronized title',
      lastTurnAt: createdAt,
      lastMessageAt: createdAt,
      lastRuntimeEventAt: createdAt,
      lastUserActivityAt: createdAt,
      sortTimestamp: String(Date.parse(createdAt)),
      lastReadItemSequence: '0',
      pinned: false,
      unread: false,
      serverVersion: '3',
    };

    const projects = upsertAgentSessionIntoCollection(
      [project([existing])],
      projectId,
      offsetHydration,
    );

    expect(projects[0]?.agentSessions[0]?.activity).toBe(existing.activity);
    expect(projects[0]?.agentSessions[0]).toMatchObject({
      runtimeBindingId: 'runtime-binding.current',
      runtimeLocationId: 'runtime-location.current',
      hostMode: 'desktop',
      engineId: 'claude-code',
      modelId: 'claude-sonnet-4',
      providerId: 'provider.anthropic',
      providerBindingId: 'provider-binding.anthropic',
      transportKind: 'sdk-stream',
      providerSessionId: 'provider.current',
      runtimeStatus: 'streaming',
      title: 'Provider synchronized title',
      lastTurnAt: activityAt,
      lastMessageAt: activityAt,
      lastRuntimeEventAt: activityAt,
      lastUserActivityAt: activityAt,
      sortTimestamp: String(Date.parse(activityAt)),
      lastReadItemSequence: '8',
      pinned: true,
      unread: true,
    });
  });

  it('rejects Session resurrection at or below the highest Store tombstone version', () => {
    const userScope = 'session-tombstone-user';
    const scopeKey = buildProjectsStoreScopeKey(userScope, workspaceId);
    const deletedSession = session('deleted-session', { serverVersion: '5' });
    const missingVersion = session('deleted-session', { serverVersion: undefined });
    upsertProjectIntoProjectsStore(project(), userScope);
    recordAgentSessionTombstoneInProjectsStore(
      scopeKey,
      projectId,
      deletedSession.id,
      '5',
    );
    recordAgentSessionTombstoneInProjectsStore(
      scopeKey,
      projectId,
      deletedSession.id,
      '4',
    );

    expect(canCommitAgentSessionToProjectsStore(
      scopeKey,
      projectId,
      missingVersion,
    )).toBe(false);
    expect(canCommitAgentSessionToProjectsStore(
      scopeKey,
      projectId,
      deletedSession,
    )).toBe(false);
    upsertAgentSessionIntoProjectsStore(
      projectId,
      deletedSession,
      workspaceId,
      userScope,
    );
    upsertProjectIntoProjectsStore(project([{
      ...deletedSession,
      serverVersion: '4',
    }]), userScope);
    expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions).toEqual([]);

    const recreatedSession = { ...deletedSession, serverVersion: '6' };
    expect(canCommitAgentSessionToProjectsStore(
      scopeKey,
      projectId,
      recreatedSession,
    )).toBe(true);
    upsertAgentSessionIntoProjectsStore(
      projectId,
      recreatedSession,
      workspaceId,
      userScope,
    );
    expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0]?.serverVersion)
      .toBe('6');

    deleteProjectsStore(scopeKey);
    expect(peekProjectsStore(scopeKey)).toBeNull();
  });

  it('filters stale inventory rows at an explicit Store scope after a Session tombstone', () => {
    const userScope = 'session-inventory-tombstone-user';
    const scopeKey = `${buildProjectsStoreScopeKey(userScope, workspaceId)}::page:10:2`;
    const staleSession = session('inventory-deleted-session', { serverVersion: '5' });
    const recreatedSession = { ...staleSession, serverVersion: '6' };
    recordAgentSessionTombstoneInProjectsStore(
      scopeKey,
      projectId,
      staleSession.id,
      '5',
    );

    expect(filterProjectsForInventoryStore(
      getProjectsStore(scopeKey),
      [project([staleSession])],
    )[0]?.agentSessions).toEqual([]);
    upsertProjectIntoProjectsStoreByScopeKey(scopeKey, project([staleSession]));
    expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions).toEqual([]);

    upsertProjectIntoProjectsStoreByScopeKey(scopeKey, project([recreatedSession]));
    expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions[0]?.serverVersion)
      .toBe('6');

    deleteProjectsStore(scopeKey);
  });

  it('records a Workspace tombstone before a stale manual Session upsert can commit', () => {
    const userScope = 'workspace-tombstone-race-user';
    const scopeKey = buildProjectsStoreScopeKey(userScope, workspaceId);
    const sessionId = 'workspace-deleted-session';
    const staleSession = session(sessionId, { serverVersion: '1' });
    upsertProjectIntoProjectsStore(project([staleSession]), userScope);
    const tombstone = summary({
      sessionId,
      version: '2',
      presentationPhase: 'deleted',
      session: {
        deletedAt: '2026-07-26T08:30:00.000Z',
      },
    });

    mutateProjectsStoreByScopeKey(
      scopeKey,
      (projects) => applyWorkspaceSessionInboxUpdate(
        projects,
        { hasMore: false, summaries: [tombstone] },
        scopeKey,
      ),
    );
    expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions).toEqual([]);
    upsertAgentSessionIntoProjectsStore(
      projectId,
      staleSession,
      workspaceId,
      userScope,
    );
    expect(getProjectsStore(scopeKey).snapshot.projects[0]?.agentSessions).toEqual([]);
    deleteProjectsStore(scopeKey);
  });

  it('does not let an older Workspace tombstone delete a newer activity-less Session', () => {
    const userScope = 'workspace-stale-tombstone-user';
    const scopeKey = buildProjectsStoreScopeKey(userScope, workspaceId);
    const sessionId = 'workspace-recreated-session';
    const recreatedSession = session(sessionId, {
      activity: undefined,
      serverVersion: '3',
    });
    const staleTombstone = summary({
      sessionId,
      version: '2',
      presentationPhase: 'deleted',
      session: {
        deletedAt: '2026-07-26T08:30:00.000Z',
      },
    });

    const committed = applyWorkspaceSessionInboxUpdate(
      [project([recreatedSession])],
      { hasMore: false, summaries: [staleTombstone] },
      scopeKey,
    );

    expect(committed[0]?.agentSessions).toEqual([recreatedSession]);
    expect(canCommitAgentSessionToProjectsStore(
      scopeKey,
      projectId,
      recreatedSession,
    )).toBe(true);
    deleteProjectsStore(scopeKey);
  });

  it('uses the newest Session version when activity and server projections diverge', () => {
    const sessionId = 'workspace-divergent-version-session';
    const activityBackedSession = applyWorkspaceSessionInboxUpdate([project()], {
      hasMore: false,
      summaries: [summary({ sessionId, version: '1' })],
    })[0]!.agentSessions[0]!;
    const recreatedSession = {
      ...activityBackedSession,
      serverVersion: '3',
    };
    const staleTombstone = summary({
      sessionId,
      version: '2',
      presentationPhase: 'deleted',
      session: {
        deletedAt: '2026-07-26T08:30:00.000Z',
      },
    });

    const committed = applyWorkspaceSessionInboxUpdate(
      [project([recreatedSession])],
      { hasMore: false, summaries: [staleTombstone] },
    );

    expect(committed[0]?.agentSessions[0]).toBe(recreatedSession);
  });

  it('normalizes persisted Inbox preferences without accepting arbitrary enum values', () => {
    expect(normalizeWorkbenchPreferences({
      sessionInboxFilter: 'attention',
      sessionInboxGroupMode: 'provider',
      sessionInboxProviderId: 'provider.anthropic',
      sessionInboxShowArchived: true,
      sessionInboxSortMode: 'recent',
    })).toMatchObject({
      sessionInboxFilter: 'attention',
      sessionInboxGroupMode: 'provider',
      sessionInboxProviderId: 'provider.anthropic',
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

  it('keeps the Session cache at a hard bound even when every row is pinned', () => {
    const loadedTranscriptSession = session('selected-session', {
      items: [{
        id: 'selected-item',
        sessionId: 'selected-session',
        role: 'assistant',
        content: 'Loaded transcript',
        createdAt,
      }],
    });
    const pinnedSessions = Array.from(
      { length: WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS + 49 },
      (_, index) => session(`pinned-${String(index).padStart(3, '0')}`, { pinned: true }),
    );

    const committed = applyWorkspaceSessionInboxUpdate(
      [project([loadedTranscriptSession, ...pinnedSessions])],
      { hasMore: false, summaries: [] },
    );

    expect(committed[0]?.agentSessions)
      .toHaveLength(WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS);
    expect(committed[0]?.agentSessions).toContain(loadedTranscriptSession);
  });

  it('bounds Session tombstones and evicts the oldest recorded identities', () => {
    const scopeKey = buildProjectsStoreScopeKey(
      'session-tombstone-bound-user',
      workspaceId,
    );
    try {
      for (
        let index = 0;
        index < PROJECT_STORE_MAX_SESSION_TOMBSTONES + 5;
        index += 1
      ) {
        recordAgentSessionTombstoneInProjectsStore(
          scopeKey,
          projectId,
          `deleted-${index}`,
          String(index + 1),
        );
      }

      const tombstones = getProjectsStore(scopeKey).agentSessionTombstones;
      expect(tombstones).toHaveLength(PROJECT_STORE_MAX_SESSION_TOMBSTONES);
      expect(tombstones.has(`${projectId}\u0001deleted-0`)).toBe(false);
      expect(
        tombstones.get(
          `${projectId}\u0001deleted-${PROJECT_STORE_MAX_SESSION_TOMBSTONES + 4}`,
        ),
      ).toBe(String(PROJECT_STORE_MAX_SESSION_TOMBSTONES + 5));
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it('prunes transcript revisions when the central Session cache evicts rows', () => {
    const scopeKey = buildProjectsStoreScopeKey(
      'session-revision-bound-user',
      workspaceId,
    );
    const sessions = Array.from(
      { length: WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS + 25 },
      (_, index) => session(`revision-${String(index).padStart(3, '0')}`),
    );
    try {
      const store = getProjectsStore(scopeKey);
      for (const agentSession of sessions) {
        store.agentSessionTranscriptRevisions.set(
          `${projectId}\u0001${agentSession.id}`,
          1,
        );
      }

      upsertProjectIntoProjectsStoreByScopeKey(scopeKey, project(sessions));

      const retainedSessions = getProjectsStore(scopeKey)
        .snapshot.projects[0]?.agentSessions ?? [];
      const retainedRevisionKeys = new Set(
        retainedSessions.map(
          (agentSession) => `${projectId}\u0001${agentSession.id}`,
        ),
      );
      expect(retainedSessions)
        .toHaveLength(WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS);
      expect(store.agentSessionTranscriptRevisions)
        .toHaveLength(WORKSPACE_SESSION_INBOX_MAX_CACHED_SESSIONS);
      expect(
        [...store.agentSessionTranscriptRevisions.keys()].every((key) =>
          retainedRevisionKeys.has(key),
        ),
      ).toBe(true);
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });

  it.each<AgentSessionRuntimeDisplayStatus>([
    'initializing',
    'streaming',
  ])('classifies %s as executing', (runtimeStatus) => {
    expect(resolveAgentSessionAttentionLevel(session(runtimeStatus, { runtimeStatus })))
      .toBe('executing');
  });

  it.each<AgentSessionRuntimeDisplayStatus>([
    'awaiting_approval',
    'awaiting_tool',
    'awaiting_user',
  ])('classifies %s as attention without implying active engine work', (runtimeStatus) => {
    expect(resolveAgentSessionAttentionLevel(session(runtimeStatus, { runtimeStatus })))
      .toBe('attention');
  });

  it.each<AgentSessionRuntimeDisplayStatus>([
    'unknown',
    'stale',
  ])('classifies %s as neutral instead of executing or attention', (runtimeStatus) => {
    expect(resolveAgentSessionAttentionLevel(session(runtimeStatus, { runtimeStatus })))
      .toBe('normal');
  });
});
