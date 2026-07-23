import type { BirdCoderWorkspaceSummary } from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';
import type { IWorkspace } from '@sdkwork/birdcoder-pc-contracts-commons';

import type { BirdCoderAppSdkApiClient } from '../birdCoderSdkClient.ts';
import type {
  BirdCoderServiceListPage,
  BirdCoderServicePageRequest,
} from '../interfaces/IProjectService.ts';
import type { IWorkspaceService } from '../interfaces/IWorkspaceService.ts';
import { resolveBirdCoderServicePageRequest } from '../servicePagination.ts';

export interface ApiBackedWorkspaceServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
}

function mapWorkspace(summary: BirdCoderWorkspaceSummary): IWorkspace {
  return {
    id: summary.id,
    uuid: summary.uuid,
    tenantId: summary.tenantId,
    organizationId: summary.organizationId,
    code: summary.code,
    title: summary.name,
    name: summary.name,
    description: summary.description ?? undefined,
    icon: summary.iconUrl ?? 'Folder',
    color: summary.color ?? undefined,
    ownerId: summary.ownerUserId,
    createdByUserId: summary.createdByUserId,
    status: summary.status,
    isPublic: summary.visibility === 'organization',
    viewerRole: 'owner',
  };
}

export class ApiBackedWorkspaceService implements IWorkspaceService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly versions = new Map<string, string>();

  constructor({ appClient }: ApiBackedWorkspaceServiceOptions) {
    this.appClient = appClient;
  }

  async getWorkspacesPage(
    request: BirdCoderServicePageRequest,
  ): Promise<BirdCoderServiceListPage<IWorkspace>> {
    resolveBirdCoderServicePageRequest(request);
    const response = await this.appClient.intelligence.workspaces.list({
      page: request.page,
      pageSize: request.pageSize,
    });
    for (const workspace of response.items) {
      this.versions.set(workspace.id, workspace.version);
    }
    const items = response.items.map(mapWorkspace);
    const page = response.pageInfo.page ?? request.page;
    const pageSize = response.pageInfo.pageSize ?? request.pageSize;
    const totalItems = response.pageInfo.totalItems ?? String(items.length);
    const totalPages = response.pageInfo.totalPages ?? (items.length > 0 ? page : 0);
    return {
      items,
      pageInfo: {
        mode: 'offset',
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: response.pageInfo.hasMore ?? page < totalPages,
      },
    };
  }

  async createWorkspace(name: string, description?: string): Promise<IWorkspace> {
    const workspace = await this.appClient.intelligence.workspaces.create({
      name,
      description: description ?? null,
    });
    this.versions.set(workspace.id, workspace.version);
    return mapWorkspace(workspace);
  }

  async updateWorkspace(id: string, name: string): Promise<IWorkspace> {
    const workspace = await this.appClient.intelligence.workspaces.update(
      id,
      { name },
      { ifMatch: await this.resolveVersion(id) },
    );
    this.versions.set(workspace.id, workspace.version);
    return mapWorkspace(workspace);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.appClient.intelligence.workspaces.delete(id, {
      ifMatch: await this.resolveVersion(id),
    });
    this.versions.delete(id);
  }

  private async resolveVersion(workspaceId: string): Promise<string> {
    const knownVersion = this.versions.get(workspaceId);
    if (knownVersion) {
      return knownVersion;
    }
    const workspace = await this.appClient.intelligence.workspaces.retrieve(workspaceId);
    this.versions.set(workspace.id, workspace.version);
    return workspace.version;
  }
}
