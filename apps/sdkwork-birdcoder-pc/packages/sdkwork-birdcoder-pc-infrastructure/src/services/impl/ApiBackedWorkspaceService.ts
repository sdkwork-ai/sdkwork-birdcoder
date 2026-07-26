import type {
  AgentWorkspaceRecord,
  AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { AgentWorkspaceView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

import type {
  AgentWorkspacePageRequest,
  AgentWorkspaceViewPage,
  IWorkspaceService,
} from '../interfaces/IWorkspaceService.ts';

type AgentsWorkspacesSdkApi = AgentsAppSdkClient['ai']['agents']['workspaces'];

export type AgentWorkspacesSdkPort = Pick<
  AgentsWorkspacesSdkApi,
  'archive' | 'create' | 'delete' | 'list' | 'retrieve' | 'update'
> & {
  default: Pick<AgentsWorkspacesSdkApi['default'], 'create'>;
};

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function mapWorkspace(workspace: AgentWorkspaceRecord): AgentWorkspaceView {
  return {
    workspaceId: workspace.workspaceId,
    tenantId: workspace.tenantId,
    organizationId: workspace.organizationId,
    ownerUserId: workspace.ownerUserId,
    name: workspace.name,
    ...(workspace.description == null ? {} : { description: workspace.description }),
    isDefault: workspace.isDefault,
    status: workspace.status,
    version: workspace.version,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    ...(workspace.archivedAt ? { archivedAt: workspace.archivedAt } : {}),
  };
}

export class ApiBackedWorkspaceService implements IWorkspaceService {
  constructor(private readonly workspaces: AgentWorkspacesSdkPort) {}

  async ensureDefaultWorkspace(name?: string): Promise<AgentWorkspaceView> {
    const workspace = await this.workspaces.default.create({
      ...(name?.trim() ? { name: name.trim() } : {}),
    });
    return mapWorkspace(workspace);
  }

  async createWorkspace(name: string, description?: string): Promise<AgentWorkspaceView> {
    const workspace = await this.workspaces.create({
      name: normalizeRequired(name, 'Workspace name'),
      ...(description === undefined ? {} : { description }),
    });
    return mapWorkspace(workspace);
  }

  async getWorkspaceById(workspaceId: string): Promise<AgentWorkspaceView> {
    return mapWorkspace(await this.workspaces.retrieve(
      normalizeRequired(workspaceId, 'Workspace ID'),
    ));
  }

  async updateWorkspace(
    workspaceId: string,
    expectedVersion: string,
    updates: { name?: string; description?: string | null },
  ): Promise<AgentWorkspaceView> {
    const workspace = await this.workspaces.update(
      normalizeRequired(workspaceId, 'Workspace ID'),
      {
        expectedVersion: normalizeRequired(expectedVersion, 'Workspace version'),
        ...(updates.name === undefined
          ? {}
          : { name: normalizeRequired(updates.name, 'Workspace name') }),
        ...(updates.description === undefined ? {} : { description: updates.description }),
      },
    );
    return mapWorkspace(workspace);
  }

  async archiveWorkspace(
    workspaceId: string,
    expectedVersion: string,
  ): Promise<AgentWorkspaceView> {
    return mapWorkspace(await this.workspaces.archive(
      normalizeRequired(workspaceId, 'Workspace ID'),
      { expectedVersion: normalizeRequired(expectedVersion, 'Workspace version') },
    ));
  }

  async deleteWorkspace(workspaceId: string, expectedVersion: string): Promise<void> {
    await this.workspaces.delete(
      normalizeRequired(workspaceId, 'Workspace ID'),
      { expectedVersion: normalizeRequired(expectedVersion, 'Workspace version') },
    );
  }

  async getWorkspacesPage(
    request: AgentWorkspacePageRequest,
  ): Promise<AgentWorkspaceViewPage> {
    const pagination = normalizeOffsetListQuery({
      page: request.page,
      page_size: request.pageSize,
    });
    const response = await this.workspaces.list({
      page: pagination.page,
      pageSize: pagination.page_size,
      ...(request.status ? { status: request.status } : {}),
      ...(request.includeDeleted === undefined
        ? {}
        : { includeDeleted: request.includeDeleted }),
    });
    return {
      items: response.items.map(mapWorkspace),
      pageInfo: response.pageInfo,
    };
  }
}
