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
