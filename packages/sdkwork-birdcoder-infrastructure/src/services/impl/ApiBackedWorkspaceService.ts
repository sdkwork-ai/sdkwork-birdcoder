import type { BirdCoderAppAdminApiClient, BirdCoderWorkspaceSummary, IWorkspace } from '@sdkwork/birdcoder-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { IWorkspaceService } from '../interfaces/IWorkspaceService.ts';

export interface ApiBackedWorkspaceServiceOptions {
  client: BirdCoderAppAdminApiClient;
  identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
  preferRemoteWrites?: boolean;
  workspaceMirror?: {
    syncWorkspaceSummary(summary: BirdCoderWorkspaceSummary): Promise<IWorkspace>;
  };
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
    ownerIdentityId: workspace.ownerIdentityId,
    createdByIdentityId: workspace.createdByIdentityId,
    viewerRole: workspace.viewerRole,
  };
}

function shouldFallbackToLocalWorkspaces(
  preferRemoteWrites: boolean,
  error: unknown,
): boolean {
  if (preferRemoteWrites || !(error instanceof Error)) {
    return false;
  }

  return error.message.includes(
    'App/admin service requires a bound coding-server runtime or an injected appAdminClient.',
  );
}

export class ApiBackedWorkspaceService implements IWorkspaceService {
  private readonly client: BirdCoderAppAdminApiClient;
  private readonly identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
  private readonly preferRemoteWrites: boolean;
  private readonly workspaceMirror?: {
    syncWorkspaceSummary(summary: BirdCoderWorkspaceSummary): Promise<IWorkspace>;
  };
  private readonly writeService: IWorkspaceService;

  constructor({
    client,
    identityProvider,
    preferRemoteWrites = false,
    workspaceMirror,
    writeService,
  }: ApiBackedWorkspaceServiceOptions) {
    this.client = client;
    this.identityProvider = identityProvider;
    this.preferRemoteWrites = preferRemoteWrites;
    this.workspaceMirror = workspaceMirror;
    this.writeService = writeService;
  }

  private async resolveCurrentIdentityId(): Promise<string | undefined> {
    const user = await this.identityProvider?.getCurrentUser();
    const identityId = user?.id?.trim();
    return identityId && identityId.length > 0 ? identityId : undefined;
  }

  async getWorkspaces(): Promise<IWorkspace[]> {
    try {
      const workspaces = await this.client.listWorkspaces({
        identityId: await this.resolveCurrentIdentityId(),
      });
      return workspaces.map(mapWorkspaceSummaryToWorkspace);
    } catch (error) {
      if (!shouldFallbackToLocalWorkspaces(this.preferRemoteWrites, error)) {
        throw error;
      }

      return this.writeService.getWorkspaces();
    }
  }

  async createWorkspace(name: string, description?: string): Promise<IWorkspace> {
    if (this.preferRemoteWrites && this.client.createWorkspace) {
      const currentIdentityId = await this.resolveCurrentIdentityId();
      const summary = await this.client.createWorkspace({
        name,
        description,
        ownerIdentityId: currentIdentityId,
        createdByIdentityId: currentIdentityId,
      });
      return this.workspaceMirror?.syncWorkspaceSummary(summary) ?? mapWorkspaceSummaryToWorkspace(summary);
    }

    return this.writeService.createWorkspace(name, description);
  }

  async updateWorkspace(id: string, name: string): Promise<IWorkspace> {
    if (this.preferRemoteWrites && this.client.updateWorkspace) {
      const summary = await this.client.updateWorkspace(id, {
        name,
      });
      return this.workspaceMirror?.syncWorkspaceSummary(summary) ?? mapWorkspaceSummaryToWorkspace(summary);
    }

    return this.writeService.updateWorkspace(id, name);
  }

  async deleteWorkspace(id: string): Promise<void> {
    if (this.preferRemoteWrites && this.client.deleteWorkspace) {
      await this.client.deleteWorkspace(id);
    }

    await this.writeService.deleteWorkspace(id);
  }
}
