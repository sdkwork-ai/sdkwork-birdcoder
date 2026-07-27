import { describe, expect, it, vi } from 'vitest';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  IAgentSessionService,
  IProjectService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
  getProjectsStore,
} from '../src/stores/projectsStore';
import {
  replaceWorkbenchCodeEngineCatalogForTesting,
  resetWorkbenchCodeEngineCatalog,
} from '../src/workbench/codeEngineCatalog';
import { hydrateImportedProjectFromAuthority } from '../src/workbench/importedProjectHydration';

function createProject(workspaceId: string): AgentProjectView {
  return {
    projectId: 'project-1',
    workspaceId,
    tenantId: '100001',
    organizationId: '0',
    ownerUserId: '42',
    name: 'Project 1',
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    version: '1',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
    agentSessions: [],
  };
}

describe('hydrateImportedProjectFromAuthority', () => {
  it('hydrates a large native multi-provider inventory without per-session metadata requests', async () => {
    const userScope = '42::session:native-inventory';
    const workspaceId = 'workspace-native';
    const returnedProject = createProject(workspaceId);
    const engines = [
      { agentId: 'agent.intelligence.codex', engineId: 'codex', providerId: 'openai' },
      { agentId: 'agent.intelligence.claude-code', engineId: 'claude-code', providerId: 'anthropic' },
      { agentId: 'agent.intelligence.opencode', engineId: 'opencode', providerId: 'opencode' },
    ] as const;
    replaceWorkbenchCodeEngineCatalogForTesting(engines.map((engine) => ({
      ...engine,
      bindingId: `binding.${engine.engineId}`,
      defaultModelId: `model.${engine.engineId}`,
      displayName: engine.engineId,
      healthy: true,
      models: [{
        bindingId: `binding.${engine.engineId}`,
        defaultForEngine: true,
        description: '',
        label: engine.engineId,
        modelId: `model.${engine.engineId}`,
        providerId: engine.providerId,
      }],
    })));
    const nativeSessions = [
      ...Array.from({ length: 475 }, (_, index) => ({ engine: engines[0], index })),
      { engine: engines[1], index: 475 },
      { engine: engines[2], index: 476 },
    ].map(({ engine, index }) => {
      const timestamp = new Date(Date.UTC(2026, 6, 25, 0, 0, 0, index)).toISOString();
      return {
        agentId: engine.agentId,
        createdAt: timestamp,
        lastItemSequence: '0',
        projectId: returnedProject.projectId,
        sessionId: `session.native.${engine.engineId}.${index}`,
        sessionKind: 'coding',
        sourceContextKind: 'provider_native_session',
        status: 'active',
        title: `${engine.engineId} Session ${index}`,
        updatedAt: timestamp,
      };
    });
    const projectService = {
      getProjectById: vi.fn(async () => returnedProject),
    } as unknown as IProjectService;
    const listRuntimeBindings = vi.fn(async () => {
      throw new Error('native inventory must not issue per-session runtime binding requests');
    });
    const getSessionUserState = vi.fn(async () => {
      throw new Error('native inventory must not issue per-session user-state requests');
    });
    const agentSessionService = {
      listSessions: vi.fn(async (request: { page?: number; pageSize?: number }) => {
        const page = request.page ?? 1;
        const pageSize = request.pageSize ?? 20;
        const windowStart = (page - 1) * pageSize;
        const items = nativeSessions.slice(windowStart, windowStart + pageSize);
        return {
          items,
          pageInfo: {
            hasMore: windowStart + items.length < nativeSessions.length,
            mode: 'offset',
            page,
            pageSize,
          },
        };
      }),
      getSessionUserState,
      listRuntimeBindings,
    } as unknown as IAgentSessionService;
    const requestedScope = buildProjectsStoreScopeKey(userScope, workspaceId);

    try {
      const hydrated = await hydrateImportedProjectFromAuthority({
        agentSessionService,
        projectId: returnedProject.projectId,
        projectService,
        userScope,
        workspaceId,
      });

      expect(agentSessionService.listSessions).toHaveBeenCalledTimes(24);
      expect(hydrated?.project.agentSessions).toHaveLength(477);
      expect(hydrated?.project.agentSessions.filter((session) => session.engineId === 'codex'))
        .toHaveLength(475);
      expect(hydrated?.project.agentSessions.filter((session) => session.engineId === 'claude-code'))
        .toHaveLength(1);
      expect(hydrated?.project.agentSessions.filter((session) => session.engineId === 'opencode'))
        .toHaveLength(1);
      expect(listRuntimeBindings).not.toHaveBeenCalled();
      expect(getSessionUserState).not.toHaveBeenCalled();
      expect(getProjectsStore(requestedScope).snapshot.projects[0]?.agentSessions)
        .toHaveLength(477);
    } finally {
      deleteProjectsStore(requestedScope);
      resetWorkbenchCodeEngineCatalog();
    }
  });

  it('loads every provider Session page after a directory Project is created', async () => {
    const userScope = '42::session:multi-provider';
    const workspaceId = 'workspace-a';
    const returnedProject = createProject(workspaceId);
    const projectService = {
      getProjectById: vi.fn(async () => returnedProject),
    } as unknown as IProjectService;
    const agentSessionService = {
      listSessions: vi.fn(async (request: { page?: number }) => {
        const page = request.page ?? 1;
        const provider = page === 1 ? 'openai' : 'anthropic';
        return {
          items: [{
            sessionId: `session.${provider}`,
            agentId: `agent.${provider}`,
            projectId: returnedProject.projectId,
            sessionKind: 'coding',
            status: 'active',
            title: `${provider} Session`,
            lastItemSequence: '0',
            createdAt: '2026-07-25T00:00:00.000Z',
            updatedAt: '2026-07-25T00:00:00.000Z',
          }],
          pageInfo: {
            mode: 'offset',
            page,
            pageSize: 20,
            hasMore: page === 1,
          },
        };
      }),
      listRuntimeBindings: vi.fn(async (sessionId: string) => {
        const providerId = sessionId.split('.').at(-1)!;
        return {
          items: [{
            providerBindingId: `binding.${providerId}`,
            providerId,
            modelId: `model.${providerId}`,
            isCurrent: true,
            status: 'active',
            updatedAt: '2026-07-25T00:00:00.000Z',
          }],
          pageInfo: {
            mode: 'offset',
            page: 1,
            pageSize: 20,
            hasMore: false,
          },
        };
      }),
      getSessionUserState: vi.fn(async (sessionId: string) => ({
        id: `user-state.${sessionId}`,
        tenantId: '100001',
        organizationId: '0',
        userId: '42',
        resourceType: 'session',
        resourceId: sessionId,
        version: '1',
        createdAt: '2026-07-25T00:00:00.000Z',
        updatedAt: '2026-07-25T00:00:00.000Z',
        lastReadItemSequence: '0',
      })),
    } as unknown as IAgentSessionService;
    const requestedScope = buildProjectsStoreScopeKey(userScope, workspaceId);

    try {
      const hydrated = await hydrateImportedProjectFromAuthority({
        agentSessionService,
        projectId: returnedProject.projectId,
        projectService,
        userScope,
        workspaceId,
      });

      expect(agentSessionService.listSessions).toHaveBeenCalledTimes(2);
      expect(hydrated?.project.agentSessionPageInfo).toMatchObject({
        page: 2,
        hasMore: false,
      });
      expect(hydrated?.project.agentSessions.map((session) => session.providerId))
        .toEqual(['openai', 'anthropic']);
      expect(getProjectsStore(requestedScope).snapshot.projects[0]?.agentSessions)
        .toHaveLength(2);
    } finally {
      deleteProjectsStore(requestedScope);
    }
  });

  it('rejects a Project returned from a different Workspace', async () => {
    const userScope = '42::session:9';
    const requestedWorkspaceId = 'workspace-a';
    const returnedProject = createProject('workspace-b');
    const projectService = {
      getProjectById: vi.fn(async () => returnedProject),
    } as unknown as IProjectService;
    const agentSessionService = {
      listSessions: vi.fn(async () => ({
        items: [],
        pageInfo: {
          mode: 'offset',
          page: 1,
          pageSize: 20,
          hasMore: false,
        },
      })),
    } as unknown as IAgentSessionService;
    const requestedScope = buildProjectsStoreScopeKey(
      userScope,
      requestedWorkspaceId,
    );

    try {
      await expect(hydrateImportedProjectFromAuthority({
        agentSessionService,
        projectId: returnedProject.projectId,
        projectService,
        userScope,
        workspaceId: requestedWorkspaceId,
      })).resolves.toBeNull();
      expect(getProjectsStore(requestedScope).snapshot.projects).toEqual([]);
    } finally {
      deleteProjectsStore(requestedScope);
    }
  });
});
