import type {
  BirdCoderProjectCollaboratorSummary,
  BirdCoderUpsertProjectCollaboratorRequest,
  BirdCoderUpsertWorkspaceMemberRequest,
  BirdCoderWorkspaceMemberSummary,
} from '@sdkwork/birdcoder-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { ICollaborationService } from '../interfaces/ICollaborationService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedCollaborationServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  currentUserProvider?: Pick<IAuthService, 'getCurrentUser'>;
}

export class ApiBackedCollaborationService implements ICollaborationService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly currentUserProvider?: Pick<IAuthService, 'getCurrentUser'>;

  constructor({ appClient, currentUserProvider }: ApiBackedCollaborationServiceOptions) {
    this.appClient = appClient;
    this.currentUserProvider = currentUserProvider;
  }

  private async resolveCurrentUserId(): Promise<string | undefined> {
    const user = await this.currentUserProvider?.getCurrentUser();
    const userId = user?.id?.trim();
    return userId && userId.length > 0 ? userId : undefined;
  }

  async listProjectCollaborators(projectId: string): Promise<BirdCoderProjectCollaboratorSummary[]> {
    return this.appClient.listProjectCollaborators(projectId);
  }

  async listWorkspaceMembers(workspaceId: string): Promise<BirdCoderWorkspaceMemberSummary[]> {
    return this.appClient.listWorkspaceMembers(workspaceId);
  }

  async upsertProjectCollaborator(
    projectId: string,
    request: BirdCoderUpsertProjectCollaboratorRequest,
  ): Promise<BirdCoderProjectCollaboratorSummary> {
    const currentUserId = await this.resolveCurrentUserId();
    return this.appClient.upsertProjectCollaborator(projectId, {
      ...request,
      createdByUserId: request.createdByUserId ?? currentUserId,
      grantedByUserId:
        request.grantedByUserId ?? request.createdByUserId ?? currentUserId,
    });
  }

  async upsertWorkspaceMember(
    workspaceId: string,
    request: BirdCoderUpsertWorkspaceMemberRequest,
  ): Promise<BirdCoderWorkspaceMemberSummary> {
    const currentUserId = await this.resolveCurrentUserId();
    return this.appClient.upsertWorkspaceMember(workspaceId, {
      ...request,
      createdByUserId: request.createdByUserId ?? currentUserId,
      grantedByUserId:
        request.grantedByUserId ?? request.createdByUserId ?? currentUserId,
    });
  }
}
