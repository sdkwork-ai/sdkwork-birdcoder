import type { IWorkspace } from '@sdkwork/birdcoder-types';
import type { BirdCoderAppAdminApiClient } from '@sdkwork/birdcoder-types';
import type { IWorkspaceService } from '../interfaces/IWorkspaceService.ts';

export interface ApiBackedWorkspaceServiceOptions {
  client: BirdCoderAppAdminApiClient;
  writeService: IWorkspaceService;
}

function mapWorkspaceSummaryToWorkspace(
  workspace: Awaited<ReturnType<BirdCoderAppAdminApiClient['listWorkspaces']>>[number],
): IWorkspace {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    icon: 'Folder',
  };
}

export class ApiBackedWorkspaceService implements IWorkspaceService {
  private readonly client: BirdCoderAppAdminApiClient;
  private readonly writeService: IWorkspaceService;

  constructor({ client, writeService }: ApiBackedWorkspaceServiceOptions) {
    this.client = client;
    this.writeService = writeService;
  }

  async getWorkspaces(): Promise<IWorkspace[]> {
    const workspaces = await this.client.listWorkspaces();
    return workspaces.map(mapWorkspaceSummaryToWorkspace);
  }

  async createWorkspace(name: string, description?: string): Promise<IWorkspace> {
    return this.writeService.createWorkspace(name, description);
  }

  async updateWorkspace(id: string, name: string): Promise<IWorkspace> {
    return this.writeService.updateWorkspace(id, name);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.writeService.deleteWorkspace(id);
  }
}
