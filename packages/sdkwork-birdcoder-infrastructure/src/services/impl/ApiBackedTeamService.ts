import type { BirdCoderAppAdminApiClient, BirdCoderTeam } from '@sdkwork/birdcoder-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { ITeamService } from '../interfaces/ITeamService.ts';

function mapTeamSummaryToTeam(
  team: Awaited<ReturnType<BirdCoderAppAdminApiClient['listTeams']>>[number],
): BirdCoderTeam {
  return {
    id: team.id,
    uuid: team.uuid,
    tenantId: team.tenantId,
    organizationId: team.organizationId,
    workspaceId: team.workspaceId,
    code: team.code,
    title: team.title,
    name: team.name,
    description: team.description,
    ownerId: team.ownerId,
    leaderId: team.leaderId,
    createdByUserId: team.createdByUserId,
    status: team.status === 'archived' ? 'archived' : 'active',
  };
}

export interface ApiBackedTeamServiceOptions {
  client: BirdCoderAppAdminApiClient;
  identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
}

export class ApiBackedTeamService implements ITeamService {
  private readonly client: BirdCoderAppAdminApiClient;
  private readonly identityProvider?: Pick<IAuthService, 'getCurrentUser'>;

  constructor({ client, identityProvider }: ApiBackedTeamServiceOptions) {
    this.client = client;
    this.identityProvider = identityProvider;
  }

  private async resolveCurrentUserId(): Promise<string | undefined> {
    const user = await this.identityProvider?.getCurrentUser();
    const userId = user?.id?.trim();
    return userId && userId.length > 0 ? userId : undefined;
  }

  async getTeams(workspaceId?: string): Promise<BirdCoderTeam[]> {
    const teams = await this.client.listTeams({
      userId: await this.resolveCurrentUserId(),
      workspaceId,
    });
    return teams.map(mapTeamSummaryToTeam);
  }
}
