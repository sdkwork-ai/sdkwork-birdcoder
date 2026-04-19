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

function mapWorkspaceSummaryToWorkspace(
  workspace: Awaited<ReturnType<BirdCoderAppAdminApiClient['listWorkspaces']>>[number],
): IWorkspace {
  return {
    id: workspace.id,
    uuid: workspace.uuid,
    tenantId: workspace.tenantId,
    organizationId: workspace.organizationId,
    code: workspace.code,
    title: workspace.title,
    name: workspace.name,
    description: workspace.description,
    icon: 'Folder',
    ownerId: workspace.ownerId,
    leaderId: workspace.leaderId,
    createdByUserId: workspace.createdByUserId,
    type: workspace.type,
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

  private commitReadCache(
    userScope: string,
    nextEntry: WorkspaceCacheEntry<IWorkspace[]> | null,
  ): void {
    if (nextEntry) {
      this.readCacheByUserScope.set(userScope, nextEntry);
      return;
    }

    this.readCacheByUserScope.delete(userScope);
  }

  private upsertCachedWorkspace(userScope: string, workspace: IWorkspace): void {
    const cachedWorkspaces = this.readCacheByUserScope.get(userScope)?.value;
    if (!cachedWorkspaces) {
      return;
    }

    const nextWorkspaces = [
      ...cachedWorkspaces.filter((candidateWorkspace) => candidateWorkspace.id !== workspace.id),
      workspace,
    ].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    this.commitReadCache(userScope, {
      expiresAt: Date.now() + WORKSPACE_LIST_CACHE_TTL_MS,
      inflight: null,
      value: nextWorkspaces,
    });
  }

  private removeCachedWorkspace(workspaceId: string): void {
    for (const [userScope, entry] of this.readCacheByUserScope.entries()) {
      const cachedWorkspaces = entry.value;
      if (!cachedWorkspaces) {
        continue;
      }

      this.commitReadCache(userScope, {
        expiresAt: Date.now() + WORKSPACE_LIST_CACHE_TTL_MS,
        inflight: null,
        value: cachedWorkspaces.filter((workspace) => workspace.id !== workspaceId),
      });
    }
  }

  async getWorkspaces(): Promise<IWorkspace[]> {
    const userScope = await this.resolveCurrentUserScope();
    const userId = userScope === 'anonymous' ? undefined : userScope;
    return this.readThroughCache(
      userScope,
      WORKSPACE_LIST_CACHE_TTL_MS,
      async () => {
        const localWorkspaces = await this.writeService.getWorkspaces();

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
          if (localWorkspaces.length > 0 && isBirdCoderTransientApiError(error)) {
            console.warn(
              'Falling back to locally mirrored workspaces because the remote workspace API is temporarily unavailable.',
              error,
            );
            return localWorkspaces.sort(
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
      ownerId: currentUserId,
      leaderId: currentUserId,
      createdByUserId: currentUserId,
    });
    const workspace =
      (await this.workspaceMirror?.syncWorkspaceSummary(summary)) ??
      mapWorkspaceSummaryToWorkspace(summary);
    this.upsertCachedWorkspace(currentUserScope, workspace);
    return workspace;
  }

  async updateWorkspace(id: string, name: string): Promise<IWorkspace> {
    const currentUserScope = await this.resolveCurrentUserScope();
    const summary = await this.client.updateWorkspace(id, {
      name,
    });
    const workspace =
      (await this.workspaceMirror?.syncWorkspaceSummary(summary)) ??
      mapWorkspaceSummaryToWorkspace(summary);
    this.upsertCachedWorkspace(currentUserScope, workspace);
    return workspace;
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.client.deleteWorkspace(id);
    await this.writeService.deleteWorkspace(id);
    this.removeCachedWorkspace(id);
  }
}
