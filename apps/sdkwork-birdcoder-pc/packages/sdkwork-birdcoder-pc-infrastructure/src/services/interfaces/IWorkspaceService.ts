import type { PageInfo } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { AgentWorkspaceView } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface AgentWorkspacePageRequest {
  includeDeleted?: boolean;
  page: number;
  pageSize: number;
  status?: AgentWorkspaceView['status'];
}

export interface AgentWorkspaceViewPage {
  items: AgentWorkspaceView[];
  pageInfo: PageInfo;
}

export interface IWorkspaceService {
  ensureDefaultWorkspace(name?: string): Promise<AgentWorkspaceView>;
  createWorkspace(name: string, description?: string): Promise<AgentWorkspaceView>;
  getWorkspaceById(workspaceId: string): Promise<AgentWorkspaceView>;
  updateWorkspace(
    workspaceId: string,
    expectedVersion: string,
    updates: { name?: string; description?: string | null },
  ): Promise<AgentWorkspaceView>;
  archiveWorkspace(
    workspaceId: string,
    expectedVersion: string,
  ): Promise<AgentWorkspaceView>;
  deleteWorkspace(workspaceId: string, expectedVersion: string): Promise<void>;
  getWorkspacesPage(request: AgentWorkspacePageRequest): Promise<AgentWorkspaceViewPage>;
}
