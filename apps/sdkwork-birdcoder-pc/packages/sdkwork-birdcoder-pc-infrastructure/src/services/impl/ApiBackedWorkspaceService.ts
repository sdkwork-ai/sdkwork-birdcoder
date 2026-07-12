import type { BirdCoderWorkspaceSummary, IWorkspace } from '@sdkwork/birdcoder-pc-types';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type {
  BirdCoderServiceListPage,
  BirdCoderServiceListPagination,
  BirdCoderServicePageRequest,
} from '../interfaces/IProjectService.ts';
import type { IWorkspaceService } from '../interfaces/IWorkspaceService.ts';
import {
  isBirdCoderTransientApiError,
  retryBirdCoderTransientApiTask,
} from '../runtimeApiRetry.ts';
import {
  CurrentUserScopeResolver,
  type CurrentUserScope,
} from '../currentUserScope.ts';
import {
  createBirdCoderServiceOffsetPageInfo,
  resolveBirdCoderServicePageRequest,
} from '../servicePagination.ts';

export interface ApiBackedWorkspaceServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  currentUserProvider?: Pick<IAuthService, 'getCurrentUser'>;
  workspaceMirror?: {
    syncWorkspaceSummary(summary: BirdCoderWorkspaceSummary): Promise<IWorkspace>;
  };
  writeService: IWorkspaceService;
}

interface WorkspaceCacheEntry<T> {
  expiresAt: number;
  inflight: Promise<T> | null;
  value?: T;
}

const WORKSPACE_LIST_CACHE_TTL_MS = 10_000;
const INFLIGHT_ONLY_TTL_MS = 0;

function resolveLocalWorkspaceUserScope(workspace: IWorkspace): string | undefined {
  const userScopeCandidates = [
    workspace.ownerId,
    workspace.leaderId,
    workspace.createdByUserId,
  ];

  for (const candidate of userScopeCandidates) {
    const normalizedCandidate = candidate?.trim();
    if (normalizedCandidate) {
      return normalizedCandidate;
    }
  }

  return undefined;
}

function isLocalWorkspaceVisibleForUser(
  workspace: IWorkspace,
  userId?: string,
): boolean {
  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) {
    return false;
  }

  return resolveLocalWorkspaceUserScope(workspace) === normalizedUserId;
}

function filterLocalWorkspacesForUser(
  workspaces: readonly IWorkspace[],
  userId?: string,
): IWorkspace[] {
  return workspaces.filter((workspace) => isLocalWorkspaceVisibleForUser(workspace, userId));
}

function buildWorkspacePageFromLocalMirror(
  request: BirdCoderServicePageRequest,
  localPage: BirdCoderServiceListPage<IWorkspace>,
  visibleWorkspaces: IWorkspace[],
): BirdCoderServiceListPage<IWorkspace> {
  const sourcePageInfoMatchesRequest =
    localPage.pageInfo.mode === 'offset' &&
    localPage.pageInfo.page === request.page &&
    localPage.pageInfo.pageSize === request.pageSize &&
    localPage.items.length <= request.pageSize;

  if (visibleWorkspaces.length === localPage.items.length && sourcePageInfoMatchesRequest) {
    return {
      items: visibleWorkspaces,
      pageInfo: localPage.pageInfo,
    };
  }

  // Do not reuse a total that may include records belonging to another user.
  // The requested page remains stable, while the total reflects only the
  // bounded range observed in this local fallback read.
  const resolvedRequest = resolveBirdCoderServicePageRequest(request);
  const conservativeTotal = localPage.pageInfo.hasMore
    ? resolvedRequest.offset + resolvedRequest.pageSize + 1
    : resolvedRequest.offset + visibleWorkspaces.length;
  return {
    items: visibleWorkspaces,
    pageInfo: createBirdCoderServiceOffsetPageInfo(
      request,
      conservativeTotal,
    ),
  };
}

function mapWorkspaceSummaryToWorkspace(
  workspace: Awaited<ReturnType<BirdCoderAppSdkApiClient['listWorkspaces']>>[number],
): IWorkspace {
  return {
    id: workspace.id,
    uuid: workspace.uuid,
    tenantId: workspace.tenantId,
    organizationId: workspace.organizationId,
    dataScope: workspace.dataScope,
    code: workspace.code,
    title: workspace.title,
    name: workspace.name,
    description: workspace.description,
    icon: workspace.icon ?? 'Folder',
    color: workspace.color,
    ownerId: workspace.ownerId,
    leaderId: workspace.leaderId,
    createdByUserId: workspace.createdByUserId,
    type: workspace.type,
    status: workspace.status,
    startTime: workspace.startTime,
    endTime: workspace.endTime,
    maxMembers: workspace.maxMembers,
    currentMembers: workspace.currentMembers,
    memberCount: workspace.memberCount,
    maxStorage: workspace.maxStorage,
    usedStorage: workspace.usedStorage,
    settings: workspace.settings,
    isPublic: workspace.isPublic,
    isTemplate: workspace.isTemplate,
    viewerRole: workspace.viewerRole,
  };
}

export class ApiBackedWorkspaceService implements IWorkspaceService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly currentUserScopeResolver: CurrentUserScopeResolver;
  private readonly pageReadCacheByUserScope = new Map<
    string,
    WorkspaceCacheEntry<BirdCoderServiceListPage<IWorkspace>>
  >();
  private readonly readCacheByUserScope = new Map<string, WorkspaceCacheEntry<IWorkspace[]>>();
  private readonly workspaceMirror?: {
    syncWorkspaceSummary(summary: BirdCoderWorkspaceSummary): Promise<IWorkspace>;
  };
  private readonly writeService: IWorkspaceService;

  constructor({
    appClient,
    currentUserProvider,
    workspaceMirror,
    writeService,
  }: ApiBackedWorkspaceServiceOptions) {
    this.appClient = appClient;
    this.currentUserScopeResolver = new CurrentUserScopeResolver({
      currentUserProvider,
    });
    this.workspaceMirror = workspaceMirror;
    this.writeService = writeService;
  }

  private async resolveCurrentUserScope(): Promise<CurrentUserScope> {
    return this.currentUserScopeResolver.resolve();
  }

  private readThroughCache<T>(
    cache: Map<string, WorkspaceCacheEntry<T>>,
    userScope: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const cacheEntry = cache.get(userScope);

    if (cacheEntry?.inflight) {
      return cacheEntry.inflight;
    }

    if (cacheEntry && ttlMs > 0 && cacheEntry.value !== undefined && cacheEntry.expiresAt > now) {
      return Promise.resolve(cacheEntry.value);
    }

    const request = loader()
      .then((value) => {
        if (ttlMs > 0) {
          cache.set(userScope, {
            expiresAt: Date.now() + ttlMs,
            inflight: null,
            value,
          });
        } else {
          cache.delete(userScope);
        }
        return value;
      })
      .catch((error) => {
        cache.delete(userScope);
        throw error;
      });

    cache.set(userScope, {
      expiresAt: now + ttlMs,
      inflight: request,
      value: cacheEntry?.value,
    });

    return request;
  }

  private invalidateReadCache(): void {
    this.pageReadCacheByUserScope.clear();
    this.readCacheByUserScope.clear();
  }

  async getWorkspacesPage(
    request: BirdCoderServicePageRequest,
  ): Promise<BirdCoderServiceListPage<IWorkspace>> {
    const currentUserScope = await this.resolveCurrentUserScope();
    const userId = currentUserScope.userId === 'anonymous' ? undefined : currentUserScope.userId;
    const canReadUserScopedLocalMirror = currentUserScope.cacheable && Boolean(userId);
    const cacheScopeKey = `${currentUserScope.userId}:${request.page}:${request.pageSize}`;
    return this.readThroughCache(
      this.pageReadCacheByUserScope,
      cacheScopeKey,
      currentUserScope.cacheable ? WORKSPACE_LIST_CACHE_TTL_MS : INFLIGHT_ONLY_TTL_MS,
            async () => {
        try {
          const page = await retryBirdCoderTransientApiTask(() =>
            this.appClient.listWorkspacePage({
              page: request.page,
              pageSize: request.pageSize,
            }),
          );
          const resolvedWorkspaces = this.workspaceMirror
            ? await Promise.all(
                page.items.map((workspace) => this.workspaceMirror!.syncWorkspaceSummary(workspace)),
              )
            : page.items.map(mapWorkspaceSummaryToWorkspace);
          return {
            items: resolvedWorkspaces.sort(
              (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
            ),
            pageInfo: page.pageInfo,
          };
        } catch (error) {
          if (!isBirdCoderTransientApiError(error)) {
            throw error;
          }

          if (!canReadUserScopedLocalMirror) {
            console.warn(
              'Remote workspace page API is temporarily unavailable and current-user scope is unavailable; returning an empty local workspace page.',
              error,
            );
            return {
              items: [],
              pageInfo: createBirdCoderServiceOffsetPageInfo(request, 0),
            };
          }

          const localPage = await this.writeService.getWorkspacesPage(request);
          const visibleWorkspaces = filterLocalWorkspacesForUser(
            localPage.items,
            userId,
          );
          console.warn(
            visibleWorkspaces.length > 0
              ? 'Falling back to the bounded locally mirrored workspace page because the remote workspace API is temporarily unavailable.'
              : 'Remote workspace API is temporarily unavailable and no current-user local workspace page is available; returning an empty page.',
            error,
          );
          return buildWorkspacePageFromLocalMirror(
            request,
            localPage,
            visibleWorkspaces.sort(
              (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
            ),
          );
        }
      },
    );
  }

  async getWorkspaces(
    pagination?: BirdCoderServiceListPagination,
  ): Promise<IWorkspace[]> {
    const currentUserScope = await this.resolveCurrentUserScope();
    const userId = currentUserScope.userId === 'anonymous' ? undefined : currentUserScope.userId;
    const canReadUserScopedLocalMirror = currentUserScope.cacheable && Boolean(userId);
    const cacheScopeKey = `${currentUserScope.userId}:${pagination?.limit ?? ''}:${pagination?.offset ?? ''}`;
    return this.readThroughCache(
      this.readCacheByUserScope,
      cacheScopeKey,
      currentUserScope.cacheable ? WORKSPACE_LIST_CACHE_TTL_MS : INFLIGHT_ONLY_TTL_MS,
      async () => {
        try {
          const workspaces = await retryBirdCoderTransientApiTask(() =>
            this.appClient.listWorkspaces({
              limit: pagination?.limit,
              offset: pagination?.offset,
            }),
          );
          const resolvedWorkspaces = this.workspaceMirror
            ? await Promise.all(
                workspaces.map((workspace) => this.workspaceMirror!.syncWorkspaceSummary(workspace)),
              )
            : workspaces.map(mapWorkspaceSummaryToWorkspace);
          return resolvedWorkspaces.sort(
            (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
          );
        } catch (error) {
          if (!isBirdCoderTransientApiError(error)) {
            throw error;
          }

          if (!canReadUserScopedLocalMirror) {
            console.warn(
              'Remote workspace API is temporarily unavailable and current-user scope is unavailable; returning an empty local workspace fallback.',
              error,
            );
            return [];
          }

          const localWorkspaces = await this.writeService.getWorkspaces();
          const userScopedLocalWorkspaces = filterLocalWorkspacesForUser(
            localWorkspaces,
            userId,
          );
          if (userScopedLocalWorkspaces.length > 0) {
            console.warn(
              'Falling back to locally mirrored workspaces because the remote workspace API is temporarily unavailable.',
              error,
            );
            return userScopedLocalWorkspaces.sort(
              (left, right) =>
                left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
            );
          }
          return [];
        }
      },
    );
  }

  async createWorkspace(name: string, description?: string): Promise<IWorkspace> {
    const currentUserScope = await this.resolveCurrentUserScope();
    const currentUserId =
      currentUserScope.userId === 'anonymous' ? undefined : currentUserScope.userId;
    const summary = await this.appClient.createWorkspace({
      name,
      description,
      dataScope: 'PRIVATE',
      ownerId: currentUserId,
      leaderId: currentUserId,
      createdByUserId: currentUserId,
    });
    const normalizedSummary: BirdCoderWorkspaceSummary = {
      ...summary,
      dataScope: summary.dataScope ?? 'PRIVATE',
      createdByUserId: summary.createdByUserId ?? currentUserId,
      leaderId: summary.leaderId ?? currentUserId,
      ownerId: summary.ownerId ?? currentUserId,
    };
    const workspace =
      (await this.workspaceMirror?.syncWorkspaceSummary(normalizedSummary)) ??
      mapWorkspaceSummaryToWorkspace(normalizedSummary);
    this.invalidateReadCache();
    return workspace;
  }

  async updateWorkspace(id: string, name: string): Promise<IWorkspace> {
    const summary = await this.appClient.updateWorkspace(id, {
      name,
    });
    const workspace =
      (await this.workspaceMirror?.syncWorkspaceSummary(summary)) ??
      mapWorkspaceSummaryToWorkspace(summary);
    this.invalidateReadCache();
    return workspace;
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.appClient.deleteWorkspace(id);
    await this.writeService.deleteWorkspace(id);
    this.invalidateReadCache();
  }
}
