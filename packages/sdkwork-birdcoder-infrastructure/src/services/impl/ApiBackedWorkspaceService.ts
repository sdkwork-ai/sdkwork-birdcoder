import type { BirdCoderAppAdminApiClient, BirdCoderWorkspaceSummary, IWorkspace } from '@sdkwork/birdcoder-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { IWorkspaceService } from '../interfaces/IWorkspaceService.ts';
import {
  isBirdCoderTransientApiError,
  retryBirdCoderTransientApiTask,
} from '../runtimeApiRetry.ts';

export interface ApiBackedWorkspaceServiceOptions {
  client: BirdCoderAppAdminApiClient;
  identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
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
    return true;
  }

  return resolveLocalWorkspaceUserScope(workspace) === normalizedUserId;
}

function filterLocalWorkspacesForUser(
  workspaces: readonly IWorkspace[],
  userId?: string,
): IWorkspace[] {
  return workspaces.filter((workspace) => isLocalWorkspaceVisibleForUser(workspace, userId));
}

function mapWorkspaceSummaryToWorkspace(
  workspace: Awaited<ReturnType<BirdCoderAppAdminApiClient['listWorkspaces']>>[number],
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
  private readonly client: BirdCoderAppAdminApiClient;
  private readonly identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
  private readonly readCacheByUserScope = new Map<string, WorkspaceCacheEntry<IWorkspace[]>>();
  private readonly workspaceMirror?: {
    syncWorkspaceSummary(summary: BirdCoderWorkspaceSummary): Promise<IWorkspace>;
  };
  private readonly writeService: IWorkspaceService;

  constructor({
    client,
    identityProvider,
    workspaceMirror,
    writeService,
  }: ApiBackedWorkspaceServiceOptions) {
    this.client = client;
    this.identityProvider = identityProvider;
    this.workspaceMirror = workspaceMirror;
    this.writeService = writeService;
  }

  private async resolveCurrentUserScope(): Promise<string> {
    const user = await this.identityProvider?.getCurrentUser();
    const userId = user?.id?.trim();
    return userId && userId.length > 0 ? userId : 'anonymous';
  }

  private readThroughCache(
    userScope: string,
    ttlMs: number,
    loader: () => Promise<IWorkspace[]>,
  ): Promise<IWorkspace[]> {
    const now = Date.now();
    const cacheEntry = this.readCacheByUserScope.get(userScope);

    if (cacheEntry?.inflight) {
      return cacheEntry.inflight;
    }

    if (cacheEntry && ttlMs > 0 && cacheEntry.value !== undefined && cacheEntry.expiresAt > now) {
      return Promise.resolve(cacheEntry.value);
    }

    const request = loader()
      .then((value) => {
        if (ttlMs > 0) {
          this.readCacheByUserScope.set(userScope, {
            expiresAt: Date.now() + ttlMs,
            inflight: null,
            value,
          });
        } else {
          this.readCacheByUserScope.delete(userScope);
        }
        return value;
      })
      .catch((error) => {
        this.readCacheByUserScope.delete(userScope);
        throw error;
      });

    this.readCacheByUserScope.set(userScope, {
      expiresAt: now + ttlMs,
      inflight: request,
      value: cacheEntry?.value,
    });

    return request;
  }

  private invalidateReadCache(): void {
    this.readCacheByUserScope.clear();
  }

  async getWorkspaces(): Promise<IWorkspace[]> {
    const userScope = await this.resolveCurrentUserScope();
    const userId = userScope === 'anonymous' ? undefined : userScope;
    return this.readThroughCache(
      userScope,
      WORKSPACE_LIST_CACHE_TTL_MS,
      async () => {
        const localWorkspaces = await this.writeService.getWorkspaces();
        const userScopedLocalWorkspaces = filterLocalWorkspacesForUser(
          localWorkspaces,
          userId,
        );

        try {
          const workspaces = await retryBirdCoderTransientApiTask(() =>
            this.client.listWorkspaces({
              userId,
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
          if (userScopedLocalWorkspaces.length > 0 && isBirdCoderTransientApiError(error)) {
            console.warn(
              'Falling back to locally mirrored workspaces because the remote workspace API is temporarily unavailable.',
              error,
            );
            return userScopedLocalWorkspaces.sort(
              (left, right) =>
                left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
            );
          }
          throw error;
        }
      },
    );
  }

  async createWorkspace(name: string, description?: string): Promise<IWorkspace> {
    const currentUserScope = await this.resolveCurrentUserScope();
    const currentUserId = currentUserScope === 'anonymous' ? undefined : currentUserScope;
    const summary = await this.client.createWorkspace({
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
    const summary = await this.client.updateWorkspace(id, {
      name,
    });
    const workspace =
      (await this.workspaceMirror?.syncWorkspaceSummary(summary)) ??
      mapWorkspaceSummaryToWorkspace(summary);
    this.invalidateReadCache();
    return workspace;
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.client.deleteWorkspace(id);
    await this.writeService.deleteWorkspace(id);
    this.invalidateReadCache();
  }
}
