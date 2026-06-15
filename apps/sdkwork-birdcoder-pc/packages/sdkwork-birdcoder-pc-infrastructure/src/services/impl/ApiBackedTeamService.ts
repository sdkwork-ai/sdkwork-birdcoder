import type { BirdCoderTeam } from '@sdkwork/birdcoder-pc-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { ITeamService } from '../interfaces/ITeamService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';
import { CurrentUserScopeResolver } from '../currentUserScope.ts';

function mapTeamSummaryToTeam(
  team: Awaited<ReturnType<BirdCoderAppSdkApiClient['listTeams']>>[number],
): BirdCoderTeam {
  return {
    id: team.id,
    uuid: team.uuid,
    tenantId: team.tenantId,
    organizationId: team.organizationId,
    createdAt: team.createdAt ?? new Date(0).toISOString(),
    updatedAt: team.updatedAt ?? new Date(0).toISOString(),
    workspaceId: team.workspaceId,
    code: team.code,
    title: team.title,
    name: team.name,
    description: team.description,
    ownerId: team.ownerId,
    leaderId: team.leaderId,
    createdByUserId: team.createdByUserId,
    metadata: team.metadata,
    status: team.status === 'archived' ? 'archived' : 'active',
  };
}

export interface ApiBackedTeamServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  currentUserProvider?: Pick<IAuthService, 'getCurrentUser'>;
}

export class ApiBackedTeamService implements ITeamService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly currentUserScopeResolver: CurrentUserScopeResolver;

  constructor({ appClient, currentUserProvider }: ApiBackedTeamServiceOptions) {
    this.appClient = appClient;
    this.currentUserScopeResolver = new CurrentUserScopeResolver({
      currentUserProvider,
    });
  }

  private async resolveCurrentUserId(): Promise<string | undefined> {
    const scope = await this.currentUserScopeResolver.resolve();
    return scope.userId === 'anonymous' ? undefined : scope.userId;
  }

  async getTeams(workspaceId?: string): Promise<BirdCoderTeam[]> {
    const teams = await this.appClient.listTeams({
      userId: await this.resolveCurrentUserId(),
      workspaceId,
    });
    return teams.map(mapTeamSummaryToTeam);
  }
}
