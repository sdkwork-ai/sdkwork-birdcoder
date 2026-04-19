import type {
  BirdCoderAppAdminApiClient,
  BirdCoderProjectCollaboratorSummary,
  BirdCoderUpsertProjectCollaboratorRequest,
  BirdCoderUpsertWorkspaceMemberRequest,
  BirdCoderWorkspaceMemberSummary,
} from '@sdkwork/birdcoder-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { ICollaborationService } from '../interfaces/ICollaborationService.ts';

export interface ApiBackedCollaborationServiceOptions {
  client: BirdCoderAppAdminApiClient;
  identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
}

export class ApiBackedCollaborationService implements ICollaborationService {
  private readonly client: BirdCoderAppAdminApiClient;
  private readonly identityProvider?: Pick<IAuthService, 'getCurrentUser'>;

  constructor({ client, identityProvider }: ApiBackedCollaborationServiceOptions) {
    this.client = client;
    this.identityProvider = identityProvider;
  }

  private async resolveCurrentUserId(): Promise<string | undefined> {
    const user = await this.identityProvider?.getCurrentUser();
    const userId = user?.id?.trim();
    return userId && userId.length > 0 ? userId : undefined;
  }

  async listProjectCollaborators(projectId: string): Promise<BirdCoderProjectCollaboratorSummary[]> {
    return this.client.listProjectCollaborators(projectId);
  }

  async listWorkspaceMembers(workspaceId: string): Promise<BirdCoderWorkspaceMemberSummary[]> {
    return this.client.listWorkspaceMembers(workspaceId);
  }

  async upsertProjectCollaborator(
    projectId: string,
    request: BirdCoderUpsertProjectCollaboratorRequest,
  ): Promise<BirdCoderProjectCollaboratorSummary> {
    const currentUserId = await this.resolveCurrentUserId();
    return this.client.upsertProjectCollaborator(projectId, {
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
    return this.client.upsertWorkspaceMember(workspaceId, {
      ...request,
      createdByUserId: request.createdByUserId ?? currentUserId,
      grantedByUserId:
        request.grantedByUserId ?? request.createdByUserId ?? currentUserId,
    });
  }
}
