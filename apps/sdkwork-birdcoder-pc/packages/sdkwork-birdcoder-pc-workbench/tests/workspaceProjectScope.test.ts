import { describe, expect, it } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionView,
  AgentWorkspaceView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  mergeWorkspacePages,
  selectInitialWorkspace,
} from '../src/hooks/useWorkspaces';
import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
  getProjectsStore,
  upsertAgentSessionIntoProjectsStore,
  upsertProjectIntoProjectsStore,
} from '../src/stores/projectsStore';

function createWorkspace(
  workspaceId: string,
  options: Partial<AgentWorkspaceView> = {},
): AgentWorkspaceView {
  return {
    workspaceId,
    tenantId: '100001',
    organizationId: '0',
    ownerUserId: '42',
    name: workspaceId,
    isDefault: false,
    status: 'active',
    version: '1',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
    ...options,
  };
}

function createProject(workspaceId: string, projectId: string): AgentProjectView {
  return {
    projectId,
    workspaceId,
    tenantId: '100001',
    organizationId: '0',
    ownerUserId: '42',
    name: projectId,
    visibility: 'private',
    status: 'active',
    driveAccessMode: 'disabled',
    version: '1',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
    agentSessions: [],
  };
}

function createSession(projectId: string): AgentSessionView {
  return {
    id: 'session-1',
    projectId,
    title: 'Session 1',
    status: 'active',
    hostMode: 'web',
    engineId: 'codex',
    modelId: 'gpt-5',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:01:00.000Z',
    displayTime: 'Just now',
    items: [],
  };
}

describe('Workspace-scoped project inventory', () => {
  it('selects the active default Workspace unless an available preference exists', () => {
    const archivedPreferred = createWorkspace('workspace-archived', {
      status: 'archived',
    });
    const defaultWorkspace = createWorkspace('workspace-default', {
      isDefault: true,
    });
    const preferredWorkspace = createWorkspace('workspace-preferred');
    const workspaces = [archivedPreferred, defaultWorkspace, preferredWorkspace];

    expect(selectInitialWorkspace(workspaces)?.workspaceId).toBe('workspace-default');
    expect(
      selectInitialWorkspace(workspaces, preferredWorkspace.workspaceId)?.workspaceId,
    ).toBe('workspace-preferred');
  });

  it('merges paginated Workspace results by canonical Workspace id', () => {
    const original = createWorkspace('workspace-1', { name: 'Original' });
    const refreshed = createWorkspace('workspace-1', { name: 'Refreshed' });
    const next = createWorkspace('workspace-2');

    expect(mergeWorkspacePages([original], [refreshed, next])).toEqual([
      refreshed,
      next,
    ]);
  });

  it('keeps Project and Session mutations isolated by Workspace and auth session', () => {
    const userScope = '42::session:7';
    const workspaceA = 'workspace-a';
    const workspaceB = 'workspace-b';
    const projectA = createProject(workspaceA, 'project-a');
    const projectB = createProject(workspaceB, 'project-b');
    const scopeA = buildProjectsStoreScopeKey(userScope, workspaceA);
    const scopeB = buildProjectsStoreScopeKey(userScope, workspaceB);

    try {
      upsertProjectIntoProjectsStore(projectA, userScope);
      upsertProjectIntoProjectsStore(projectB, userScope);
      upsertAgentSessionIntoProjectsStore(
        projectA.projectId,
        createSession(projectA.projectId),
        workspaceA,
        userScope,
      );

      expect(getProjectsStore(scopeA).snapshot.projects).toHaveLength(1);
      expect(getProjectsStore(scopeA).snapshot.projects[0]?.agentSessions).toHaveLength(1);
      expect(getProjectsStore(scopeB).snapshot.projects).toEqual([projectB]);
    } finally {
      deleteProjectsStore(scopeA);
      deleteProjectsStore(scopeB);
    }
  });

  it('rejects a Project store scope without a Workspace id', () => {
    expect(() => buildProjectsStoreScopeKey('42::session:7', ' ')).toThrow(
      'Workspace ID is required for the Projects store scope.',
    );
  });
});
