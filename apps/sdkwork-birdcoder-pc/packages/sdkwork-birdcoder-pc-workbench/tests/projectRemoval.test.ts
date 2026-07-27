import { describe, expect, it } from 'vitest';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  buildProjectsStoreScopeKey,
  deleteProjectsStore,
  filterProjectsForInventoryStore,
  getProjectsStore,
  removeProjectFromProjectsStore,
  updateProjectsStoreSnapshot,
} from '../src/stores/projectsStore';

function createProject(
  projectId: string,
  status: AgentProjectView['status'] = 'active',
): AgentProjectView {
  return {
    projectId,
    workspaceId: 'workspace-project-removal',
    tenantId: '100001',
    organizationId: '0',
    ownerUserId: '42',
    name: projectId,
    visibility: 'private',
    status,
    driveAccessMode: 'disabled',
    version: '1',
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    agentSessions: [],
  };
}

describe('Project removal inventory', () => {
  it('removes the project immediately and keeps stale inventory responses from restoring it', () => {
    const scopeKey = buildProjectsStoreScopeKey(
      '42::session:project-removal',
      'workspace-project-removal',
    );
    const removedProject = createProject('project-removed');
    const remainingProject = createProject('project-remaining');
    const deletedProject = createProject('project-deleted', 'deleted');

    try {
      const store = getProjectsStore(scopeKey);
      updateProjectsStoreSnapshot(store, (snapshot) => ({
        ...snapshot,
        hasFetched: true,
        projects: [removedProject, remainingProject],
      }));

      removeProjectFromProjectsStore(scopeKey, removedProject.projectId);

      expect(store.snapshot.projects).toEqual([remainingProject]);
      expect(store.inventoryVersion).toBe(1);
      expect(
        filterProjectsForInventoryStore(store, [
          removedProject,
          remainingProject,
          deletedProject,
        ]),
      ).toEqual([remainingProject]);
    } finally {
      deleteProjectsStore(scopeKey);
    }
  });
});
