// @vitest-environment jsdom

import { act } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  AgentProjectPageRequest,
  AgentProjectViewPage,
  IProjectService,
} from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IProjectService';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useProjects } from '../src/hooks/useProjects.ts';

const mocks = vi.hoisted(() => ({
  auth: {
    sessionRevision: 0,
    user: { email: 'search@example.com', id: 'search-user', name: 'Search User' },
  },
  getProjectsPage: vi.fn(),
}));

vi.mock('../src/context/AuthContext.ts', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../src/context/IDEContext.ts', () => ({
  useIDEServices: () => ({
    agentSessionService: {},
    projectService: {
      getProjectsPage: mocks.getProjectsPage,
    },
  }),
}));

vi.mock('../src/hooks/useWorkspaceSessionInboxSynchronization.ts', () => ({
  useWorkspaceSessionInboxSynchronization: () => undefined,
}));

vi.mock('../src/workbench/workspaceSessionInboxCoordinator.ts', () => ({
  invalidateWorkspaceSessionInboxSynchronization: vi.fn().mockResolvedValue(undefined),
}));

function createProject(projectId: string, workspaceId: string): AgentProjectView {
  return {
    agentSessions: [],
    createdAt: '2026-07-30T00:00:00.000Z',
    driveAccessMode: 'disabled',
    name: projectId,
    organizationId: 'organization.search',
    ownerUserId: 'search-user',
    projectId,
    status: 'active',
    tenantId: 'tenant.search',
    updatedAt: '2026-07-30T00:00:00.000Z',
    version: '1',
    visibility: 'private',
    workspaceId,
  };
}

function createPage(
  items: AgentProjectView[],
  request: AgentProjectPageRequest,
  hasMore = false,
): AgentProjectViewPage {
  return {
    items,
    pageInfo: {
      hasMore,
      mode: 'offset',
      page: request.page,
      pageSize: request.pageSize,
      totalItems: String(items.length + (hasMore ? 1 : 0)),
      totalPages: hasMore ? request.page + 1 : request.page,
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useProjects server-backed search', () => {
  it('keeps default inventory separate while paging search results', async () => {
    const workspaceId = 'workspace.search-pagination';
    const defaultProject = createProject('project.default', workspaceId);
    const firstSearchProject = createProject('project.alpha-one', workspaceId);
    const secondSearchProject = createProject('project.alpha-two', workspaceId);
    mocks.getProjectsPage.mockImplementation((request: AgentProjectPageRequest) => {
      if (!request.q) {
        return Promise.resolve(createPage([defaultProject], request));
      }
      if (request.q === 'alpha' && request.page === 1) {
        return Promise.resolve(createPage([firstSearchProject], request, true));
      }
      if (request.q === 'alpha' && request.page === 2) {
        return Promise.resolve(createPage([secondSearchProject], request));
      }
      throw new Error(`Unexpected Project request: ${JSON.stringify(request)}`);
    });

    const { result } = renderHook(() => useProjects({ workspaceId }));
    await waitFor(() => {
      expect(result.current.filteredProjects.map((project) => project.projectId))
        .toEqual(['project.default']);
    });

    act(() => result.current.setSearchQuery('  Alpha  '));
    await waitFor(() => {
      expect(result.current.filteredProjects.map((project) => project.projectId))
        .toEqual(['project.alpha-one']);
      expect(result.current.hasMore).toBe(true);
    });

    await act(async () => {
      await result.current.loadMoreProjects();
    });
    expect(result.current.filteredProjects.map((project) => project.projectId))
      .toEqual(['project.alpha-one', 'project.alpha-two']);

    act(() => result.current.setSearchQuery(''));
    await waitFor(() => {
      expect(result.current.filteredProjects.map((project) => project.projectId))
        .toEqual(['project.default']);
    });

    expect(mocks.getProjectsPage).toHaveBeenCalledTimes(3);
    expect(mocks.getProjectsPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 1, q: 'alpha', workspaceId }),
    );
    expect(mocks.getProjectsPage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ page: 2, q: 'alpha', workspaceId }),
    );
  });

  it('aborts the previous SDK request when the search scope changes', async () => {
    const workspaceId = 'workspace.search-cancellation';
    const fastProject = createProject('project.fast', workspaceId);
    let slowSignal: AbortSignal | undefined;
    mocks.getProjectsPage.mockImplementation((request: AgentProjectPageRequest) => {
      if (!request.q) {
        return Promise.resolve(createPage([], request));
      }
      if (request.q === 'slow') {
        slowSignal = request.signal;
        return new Promise<AgentProjectViewPage>((_resolve, reject) => {
          request.signal?.addEventListener('abort', () => {
            reject(request.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
      }
      if (request.q === 'fast') {
        return Promise.resolve(createPage([fastProject], request));
      }
      throw new Error(`Unexpected Project request: ${JSON.stringify(request)}`);
    });

    const { result } = renderHook(() => useProjects({ workspaceId }));
    await waitFor(() => expect(result.current.hasFetched).toBe(true));

    act(() => result.current.setSearchQuery('slow'));
    await waitFor(() => expect(slowSignal).toBeDefined());
    act(() => result.current.setSearchQuery('fast'));

    await waitFor(() => {
      expect(slowSignal?.aborted).toBe(true);
      expect(result.current.filteredProjects.map((project) => project.projectId))
        .toEqual(['project.fast']);
    });
  });
});
