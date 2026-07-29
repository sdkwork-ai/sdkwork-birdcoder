import { describe, expect, it, vi } from 'vitest';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  IAgentSessionService,
  IProjectService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { AgentSessionActivitySummaryRecord } from '../src/services/agentSessionViewModels.ts';
import { hydrateImportedProjectFromAuthority } from '../src/workbench/importedProjectHydration.ts';

const tenantId = '100001';
const organizationId = '0';
const ownerUserId = '42';
const projectId = 'project-1';
const workspaceId = 'workspace-a';
const createdAt = '2026-07-25T00:00:00.000Z';

function project(overrides: Partial<AgentProjectView> = {}): AgentProjectView {
  return {
    projectId,
    workspaceId,
    tenantId,
    organizationId,
    ownerUserId,
    name: 'Imported project',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    version: '1',
    createdAt,
    updatedAt: createdAt,
    agentSessions: [],
    ...overrides,
  };
}

function summary(
  providerKey: string,
  providerId: string,
  overrides: Partial<AgentSessionActivitySummaryRecord> = {},
): AgentSessionActivitySummaryRecord {
  const sessionId = `session.${providerKey}`;
  const binding = {
    runtimeBindingId: `runtime-binding.${providerKey}`,
    tenantId,
    organizationId,
    sessionId,
    runtimeLocationId: `runtime-location.${providerKey}`,
    hostMode: 'desktop',
    transportKind: 'sdk-stream',
    providerBindingId: `provider-binding.${providerKey}`,
    modelId: `model.${providerKey}`,
    providerId,
    providerSessionId: `provider.${providerKey}`,
    status: 'active' as const,
    isCurrent: true,
    version: '1',
    createdAt,
    updatedAt: createdAt,
  };
  return {
    session: {
      sessionId,
      tenantId,
      organizationId,
      agentId: `agent.${providerKey}`,
      ownerUserId,
      projectId,
      sessionKind: 'coding',
      entrySurface: 'pc',
      title: `${providerKey} session`,
      status: 'active',
      itemCount: '0',
      lastItemSequence: '0',
      totalInputTokens: '0',
      totalOutputTokens: '0',
      createdBy: ownerUserId,
      updatedBy: ownerUserId,
      version: '1',
      createdAt,
      updatedAt: createdAt,
    },
    latestTurn: null,
    pendingInteraction: null,
    currentRuntimeBinding: binding,
    latestRuntimeBinding: binding,
    userState: null,
    providerIdentity: {
      runtimeBindingId: binding.runtimeBindingId,
      providerBindingId: binding.providerBindingId,
      providerId: binding.providerId,
      modelId: binding.modelId,
      providerSessionId: binding.providerSessionId,
      providerSessionTreeId: null,
      providerParentSessionId: null,
      providerForkedFromSessionId: null,
    },
    freshness: {
      activityAt: createdAt,
      source: 'runtime_binding',
      observedAt: null as unknown as string,
      freshUntil: null as unknown as string,
      sessionVersion: '1',
      latestTurnVersion: null,
      latestInteractionId: null,
      latestInteractionVersion: null,
      latestRuntimeBindingId: binding.runtimeBindingId,
      latestRuntimeBindingVersion: '1',
      pendingInteractionVersion: null,
      currentRuntimeBindingVersion: '1',
      userStateVersion: null,
    },
    providerActivity: null,
    presentationPhase: 'ready',
    ...overrides,
  } as AgentSessionActivitySummaryRecord;
}

function service(items: AgentSessionActivitySummaryRecord[]) {
  const listSessionsByProject = vi.fn(async () => ({
    items: [],
    pageInfo: {
      hasMore: items.length > 1,
      mode: 'offset' as const,
      page: 1,
      pageSize: 1,
    },
  }));
  const listSessionActivitySummaries = vi.fn(async () => ({
    items,
    pageInfo: {
      mode: 'cursor' as const,
      pageSize: 200,
      hasMore: false,
      nextCursor: null,
    },
  }));
  return {
    listSessionActivitySummaries,
    listSessionsByProject,
    value: {
      listSessionActivitySummaries,
      listSessionsByProject,
    } as unknown as IAgentSessionService,
  };
}

describe('hydrateImportedProjectFromAuthority', () => {
  it('hydrates one bounded canonical activity head across all supported providers', async () => {
    const summaries = [
      summary('codex', 'provider.openai'),
      summary('claude-code', 'provider.anthropic'),
      summary('opencode', 'provider.opencode'),
      summary('gemini-cli', 'provider.google'),
    ];
    const agentSessionService = service(summaries);
    const projectService = {
      getProjectById: vi.fn(async () => project()),
    } as unknown as IProjectService;

    const hydrated = await hydrateImportedProjectFromAuthority({
      agentSessionService: agentSessionService.value,
      projectId,
      projectService,
      workspaceId,
    });

    expect(agentSessionService.listSessionActivitySummaries).toHaveBeenCalledTimes(1);
    expect(agentSessionService.listSessionsByProject).toHaveBeenCalledWith({
      page: 1,
      pageSize: 1,
      projectId,
    }, { signal: expect.any(AbortSignal) });
    expect(agentSessionService.listSessionActivitySummaries).toHaveBeenCalledWith({
      pageSize: 200,
      projectId,
    }, { signal: expect.any(AbortSignal) });
    expect(hydrated?.project.agentSessions.map((session) => session.providerId).sort()).toEqual([
      'provider.anthropic',
      'provider.google',
      'provider.openai',
      'provider.opencode',
    ]);
  });

  it('uses a known imported Project without a duplicate Project lookup', async () => {
    const agentSessionService = service([summary('codex', 'provider.openai')]);
    const projectService = {
      getProjectById: vi.fn(async () => project()),
    } as unknown as IProjectService;

    const hydrated = await hydrateImportedProjectFromAuthority({
      agentSessionService: agentSessionService.value,
      knownProjects: [project()],
      projectId,
      projectService,
      workspaceId,
    });

    expect(hydrated?.project.projectId).toBe(projectId);
    expect(projectService.getProjectById).not.toHaveBeenCalled();
  });

  it('passes Session tombstones to the Store commit layer', async () => {
    const deleted = summary('deleted', 'provider.openai', {
      presentationPhase: 'deleted',
      session: {
        ...summary('deleted', 'provider.openai').session,
        deletedAt: '2026-07-25T00:01:00.000Z',
      },
    });
    const agentSessionService = service([deleted]);

    const hydrated = await hydrateImportedProjectFromAuthority({
      agentSessionService: agentSessionService.value,
      projectId,
      projectService: {
        getProjectById: vi.fn(async () => project()),
      } as unknown as IProjectService,
      workspaceId,
    });

    expect(hydrated?.deletedSessionIds).toEqual(['session.deleted']);
    expect(hydrated?.project.agentSessions).toEqual([]);
  });

  it('rejects a Project returned from a different Workspace before Session reads', async () => {
    const agentSessionService = service([]);
    const hydrated = await hydrateImportedProjectFromAuthority({
      agentSessionService: agentSessionService.value,
      projectId,
      projectService: {
        getProjectById: vi.fn(async () => project({ workspaceId: 'workspace-b' })),
      } as unknown as IProjectService,
      workspaceId,
    });

    expect(hydrated).toBeNull();
    expect(agentSessionService.listSessionActivitySummaries).not.toHaveBeenCalled();
  });
});
