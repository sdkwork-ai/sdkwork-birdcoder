import type {
  BirdCoderProjectCollaboratorSummary,
  BirdCoderUpsertProjectCollaboratorRequest,
  BirdCoderUpsertWorkspaceMemberRequest,
  BirdCoderWorkspaceMemberSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { ICollaborationService } from '../interfaces/ICollaborationService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';
import { CurrentUserScopeResolver } from '../currentUserScope.ts';

export interface ApiBackedCollaborationServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  currentUserProvider?: Pick<IAuthService, 'getCurrentUser'>;
}

export class ApiBackedCollaborationService implements ICollaborationService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly currentUserScopeResolver: CurrentUserScopeResolver;

  constructor({ appClient, currentUserProvider }: ApiBackedCollaborationServiceOptions) {
    this.appClient = appClient;
    this.currentUserScopeResolver = new CurrentUserScopeResolver({
      currentUserProvider,
    });
  }

  private async resolveCurrentUserId(): Promise<string | undefined> {
    const scope = await this.currentUserScopeResolver.resolve();
    return scope.userId === 'anonymous' ? undefined : scope.userId;
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
    return this.appClient.upsertProjectCollaborator(projectId, request);
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
