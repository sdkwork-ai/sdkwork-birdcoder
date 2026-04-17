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

  private async resolveCurrentIdentityId(): Promise<string | undefined> {
    const user = await this.identityProvider?.getCurrentUser();
    const identityId = user?.id?.trim();
    return identityId && identityId.length > 0 ? identityId : undefined;
  }

  async listProjectCollaborators(projectId: string): Promise<BirdCoderProjectCollaboratorSummary[]> {
    const method = this.client.listProjectCollaborators;
    if (typeof method !== 'function') {
      throw new Error('Project collaborator API is unavailable for the current coding-server runtime.');
    }
    return method.call(this.client, projectId);
  }

  async listWorkspaceMembers(workspaceId: string): Promise<BirdCoderWorkspaceMemberSummary[]> {
    const method = this.client.listWorkspaceMembers;
    if (typeof method !== 'function') {
      throw new Error('Workspace member API is unavailable for the current coding-server runtime.');
    }
    return method.call(this.client, workspaceId);
  }

  async upsertProjectCollaborator(
    projectId: string,
    request: BirdCoderUpsertProjectCollaboratorRequest,
  ): Promise<BirdCoderProjectCollaboratorSummary> {
    const method = this.client.upsertProjectCollaborator;
    if (typeof method !== 'function') {
      throw new Error('Project collaborator API is unavailable for the current coding-server runtime.');
    }

    const currentIdentityId = await this.resolveCurrentIdentityId();
    return method.call(this.client, projectId, {
      ...request,
      createdByIdentityId: request.createdByIdentityId ?? currentIdentityId,
      grantedByIdentityId:
        request.grantedByIdentityId ?? request.createdByIdentityId ?? currentIdentityId,
    });
  }

  async upsertWorkspaceMember(
    workspaceId: string,
    request: BirdCoderUpsertWorkspaceMemberRequest,
  ): Promise<BirdCoderWorkspaceMemberSummary> {
    const method = this.client.upsertWorkspaceMember;
    if (typeof method !== 'function') {
      throw new Error('Workspace member API is unavailable for the current coding-server runtime.');
    }

    const currentIdentityId = await this.resolveCurrentIdentityId();
    return method.call(this.client, workspaceId, {
      ...request,
      createdByIdentityId: request.createdByIdentityId ?? currentIdentityId,
      grantedByIdentityId:
        request.grantedByIdentityId ?? request.createdByIdentityId ?? currentIdentityId,
    });
  }
}
