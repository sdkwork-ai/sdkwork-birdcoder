import { describe, expect, it, vi } from 'vitest';
import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionSummary,
  BirdCoderListCodingSessionsRequest,
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { ApiBackedProjectService } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedProjectService.ts';
import { ApiBackedAppRuntimeReadService } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts';
import type { IProjectService } from '../../sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectService.ts';
import type {
  BirdCoderAppRuntimeReadSdkApiClient,
  BirdCoderAppSdkApiClient,
  BirdCoderPage,
} from '../../sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import {
  listAuthorityBackedCodingSessionInventoryPage,
} from '../src/workbench/sessionInventory.ts';
import {
  synchronizeProjectSessionsFromAuthority,
} from '../src/workbench/projectSessionSynchronization.ts';

const workspaceId = '1';
const projectId = '12';
const runtimeLocationId = 'runtime-location-12';
const baseTimestamp = Date.parse('2026-07-22T00:00:00.000Z');

function buildSummary(
  index: number,
  overrides: Partial<BirdCoderCodingSessionSummary> = {},
): BirdCoderCodingSessionSummary {
  const timestamp = new Date(baseTimestamp + index).toISOString();
  return {
    id: `session-${index}`,
    workspaceId,
    projectId,
    runtimeLocationId,
    title: `Session ${index}`,
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5',
    nativeSessionId: `native-session-${index}`,
    nativeAttributes: {
      schemaVersion: 1,
      source: 'codex-session-file',
      isEphemeral: false,
      isSidechain: false,
      metadata: { index },
    },
    runtimeStatus: 'completed',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastTurnAt: timestamp,
    sortTimestamp: String(baseTimestamp + index),
    transcriptUpdatedAt: timestamp,
    ...overrides,
  };
}

function toCodingSession(summary: BirdCoderCodingSessionSummary): BirdCoderCodingSession {
  return {
    ...summary,
    displayTime: '',
    messages: [],
  };
}

function buildProject(
  codingSessions: readonly BirdCoderCodingSession[] = [],
): BirdCoderProject {
  return {
    id: projectId,
    workspaceId,
    name: 'Numeric String Scope Project',
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:01.000Z',
    codingSessions: [...codingSessions],
  };
}

const projectSummary: BirdCoderProjectSummary = {
  id: projectId,
  workspaceId,
  name: 'Numeric String Scope Project',
  status: 'active',
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:01.000Z',
};

function createApiBackedProjectService(options: {
  localProject?: BirdCoderProject;
  runtimeClient: BirdCoderAppRuntimeReadSdkApiClient;
}): ApiBackedProjectService {
  const localProject = options.localProject ?? buildProject();
  const appClient = {
    async getProject(requestedProjectId: string) {
      expect(requestedProjectId).toBe(projectId);
      return projectSummary;
    },
  } as unknown as BirdCoderAppSdkApiClient;
  const writeService = {
    async getProjectById(requestedProjectId: string) {
      expect(requestedProjectId).toBe(projectId);
      return structuredClone(localProject);
    },
    async getProjects(requestedWorkspaceId?: string) {
      expect(requestedWorkspaceId).toBe(workspaceId);
      return [structuredClone(localProject)];
    },
  } as unknown as IProjectService;
  return new ApiBackedProjectService({
    appClient,
    codingRuntimeClient: options.runtimeClient,
    writeService,
  });
}

function buildPage<T>(options: {
  hasMore: boolean;
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
}): BirdCoderPage<T> {
  return {
    items: options.items,
    pageInfo: {
      hasMore: options.hasMore,
      mode: 'offset',
      page: options.page,
      pageSize: options.pageSize,
      totalItems: String(options.totalItems),
      totalPages: Math.max(1, Math.ceil(options.totalItems / options.pageSize)),
    },
  };
}

describe('authoritative coding session reads', () => {
  it('hydrates every page and preserves string scopes plus native metadata', async () => {
    const summaries = Array.from({ length: 25 }, (_, index) => buildSummary(index));
    const receivedOffsets: number[] = [];
    const receivedLimits: number[] = [];
    const runtimeClient = {
      async listCodingSessionPage(request: BirdCoderListCodingSessionsRequest = {}) {
        expect(request.workspaceId).toBe('1');
        expect(request.projectId).toBe('12');
        const offset = request.offset ?? 0;
        receivedOffsets.push(offset);
        receivedLimits.push(request.limit ?? 0);
        const responsePageSize = 20;
        const items: BirdCoderCodingSessionSummary[] = [];
        const endOffset = Math.min(summaries.length, offset + responsePageSize);
        for (let index = offset; index < endOffset; index += 1) {
          const summary = summaries[index];
          if (summary) {
            items.push(summary);
          }
        }
        return buildPage({
          hasMore: offset + items.length < summaries.length,
          items,
          page: Math.floor(offset / responsePageSize) + 1,
          pageSize: responsePageSize,
          totalItems: summaries.length,
        });
      },
      async listCodingSessions(): Promise<never> {
        throw new Error('project hydration must use the page-aware SDK method');
      },
    } as unknown as BirdCoderAppRuntimeReadSdkApiClient;

    const project = await createApiBackedProjectService({ runtimeClient })
      .getProjectById(projectId);

    expect(receivedOffsets).toEqual([0, 20]);
    expect(receivedLimits).toEqual([200, 20]);
    expect(project?.codingSessions).toHaveLength(25);
    expect(project?.codingSessions.find((session) => session.id === 'session-0'))
      .toMatchObject({
        projectId: '12',
        runtimeLocationId,
        workspaceId: '1',
        nativeAttributes: summaries[0]?.nativeAttributes,
      });
  });

  it('returns the server total for a bounded session page', async () => {
    const pageItems = Array.from({ length: 3 }, (_, index) => buildSummary(index + 20));
    const listCodingSessionPage = vi.fn(async (request = {}) => {
      expect(request).toMatchObject({
        limit: 20,
        offset: 20,
        projectId: '12',
        workspaceId: '1',
      });
      return buildPage({
        hasMore: false,
        items: pageItems,
        page: 2,
        pageSize: 20,
        totalItems: 23,
      });
    });
    const runtimeClient = {
      listCodingSessionPage,
      async listCodingSessions(): Promise<never> {
        throw new Error('bounded reads must retain page metadata');
      },
    } as unknown as BirdCoderAppRuntimeReadSdkApiClient;

    const result = await createApiBackedProjectService({ runtimeClient })
      .listCodingSessions({
        limit: 20,
        offset: 20,
        projectId,
        workspaceId,
      });

    expect(listCodingSessionPage).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(23);
    expect(result.items[0]?.nativeAttributes).toEqual(pageItems[0]?.nativeAttributes);
  });

  it('stops project hydration on empty and repeated pages that still claim hasMore', async () => {
    const emptyPageRead = vi.fn(async () => buildPage({
      hasMore: true,
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 1,
    }));
    const emptyProject = await createApiBackedProjectService({
      runtimeClient: {
        listCodingSessionPage: emptyPageRead,
      } as unknown as BirdCoderAppRuntimeReadSdkApiClient,
    }).getProjectById(projectId);
    expect(emptyPageRead).toHaveBeenCalledTimes(1);
    expect(emptyProject?.codingSessions).toEqual([]);

    const repeatedSummary = buildSummary(1);
    const repeatedPageRead = vi.fn(async (request = {}) => buildPage({
      hasMore: true,
      items: [repeatedSummary],
      page: Math.floor((request.offset ?? 0) / 20) + 1,
      pageSize: 20,
      totalItems: 3,
    }));
    const repeatedProject = await createApiBackedProjectService({
      runtimeClient: {
        listCodingSessionPage: repeatedPageRead,
      } as unknown as BirdCoderAppRuntimeReadSdkApiClient,
    }).getProjectById(projectId);
    expect(repeatedPageRead).toHaveBeenCalledTimes(2);
    expect(repeatedProject?.codingSessions.map((session) => session.id))
      .toEqual([repeatedSummary.id]);
  });
});

describe('workbench coding session inventory guards', () => {
  it('exposes the unified coding-session inventory authority', () => {
    const methodNames = Object.getOwnPropertyNames(ApiBackedAppRuntimeReadService.prototype);
    expect(methodNames).toEqual(expect.arrayContaining([
      'getCodingSession',
      'listCodingSessionPage',
      'listCodingSessions',
    ]));
  });

  it('terminates empty and repeated hasMore pages without reporting phantom pages', async () => {
    const emptyPageRead = vi.fn(async () => ({
      items: [],
      pageInfo: { hasMore: true },
    }));
    const emptyPage = await listAuthorityBackedCodingSessionInventoryPage({
      appRuntimeReadService: {
        listCodingSessionPage: emptyPageRead,
      } as never,
      limit: 2,
      projectId,
      workspaceId,
    });
    expect(emptyPageRead).toHaveBeenCalledTimes(1);
    expect(emptyPage).toMatchObject({ hasMore: false, items: [] });

    const repeatedSummary = buildSummary(1);
    const repeatedPageRead = vi.fn(async () => ({
      items: [repeatedSummary],
      pageInfo: { hasMore: true },
    }));
    const repeatedPage = await listAuthorityBackedCodingSessionInventoryPage({
      appRuntimeReadService: {
        listCodingSessionPage: repeatedPageRead,
      } as never,
      limit: 2,
      projectId,
      workspaceId,
    });
    expect(repeatedPageRead).toHaveBeenCalledTimes(2);
    expect(repeatedPage.hasMore).toBe(false);
    expect(repeatedPage.items.map((session) => session.id))
      .toEqual([repeatedSummary.id]);
  });

  it('reuses complete unbound projections and scopes only unified runtime reads', async () => {
    const authoritativeSessions = Array.from({ length: 25 }, (_, index) =>
      toCodingSession(buildSummary(index))
    );
    const authoritativeSession = authoritativeSessions[0]!;
    const unboundAuthoritativeSessions = authoritativeSessions.map((session) => ({
      ...session,
      runtimeLocationId: undefined,
    }));
    const projectionRead = vi.fn(async (): Promise<never> => {
      throw new Error('the project projection was already read');
    });
    const synchronized = await synchronizeProjectSessionsFromAuthority({
      appRuntimeReadService: {
        listCodingSessionPage: projectionRead,
      } as never,
      authoritativeCodingSessions: unboundAuthoritativeSessions,
      project: buildProject(unboundAuthoritativeSessions),
      projectService: {
        async upsertCodingSession() {},
      } as unknown as IProjectService,
    });

    expect(projectionRead).not.toHaveBeenCalled();
    expect(synchronized.project.codingSessions).toHaveLength(25);
    expect(
      synchronized.project.codingSessions.find(
        (session) => session.id === authoritativeSession.id,
      ),
    ).toMatchObject({ nativeAttributes: authoritativeSession.nativeAttributes });

    const unifiedPageRead = vi.fn(async (request) => {
      expect(request).toMatchObject({
        projectId: '12',
        runtimeLocationId,
        workspaceId: '1',
      });
      return {
        items: [authoritativeSession],
        pageInfo: { hasMore: false },
      };
    });
    await synchronizeProjectSessionsFromAuthority({
      appRuntimeReadService: {
        listCodingSessionPage: unifiedPageRead,
      } as never,
      project: buildProject([authoritativeSession]),
      projectService: {
        async upsertCodingSession() {},
      } as unknown as IProjectService,
    });
    expect(unifiedPageRead).toHaveBeenCalledTimes(1);

    const ambiguousUnifiedRead = vi.fn(async (request) => {
      expect(request.runtimeLocationId).toBeUndefined();
      return {
        items: [],
        pageInfo: { hasMore: false },
      };
    });
    const secondRuntimeSession = toCodingSession(buildSummary(2, {
      runtimeLocationId: 'runtime-location-other',
    }));
    await synchronizeProjectSessionsFromAuthority({
      appRuntimeReadService: {
        listCodingSessionPage: ambiguousUnifiedRead,
      } as never,
      project: buildProject([authoritativeSession, secondRuntimeSession]),
      projectService: {
        async upsertCodingSession() {},
      } as unknown as IProjectService,
    });
    expect(ambiguousUnifiedRead).toHaveBeenCalledTimes(1);
  });
});
