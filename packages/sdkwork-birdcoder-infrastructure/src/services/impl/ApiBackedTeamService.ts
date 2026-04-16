import type { BirdCoderAppAdminApiClient, BirdCoderTeam } from '@sdkwork/birdcoder-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { ITeamService } from '../interfaces/ITeamService.ts';

function mapTeamSummaryToTeam(
  team: Awaited<ReturnType<BirdCoderAppAdminApiClient['listTeams']>>[number],
): BirdCoderTeam {
  return {
    id: team.id,
    workspaceId: team.workspaceId,
    name: team.name,
    description: team.description,
    ownerIdentityId: team.ownerIdentityId,
    createdByIdentityId: team.createdByIdentityId,
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

  private async resolveCurrentIdentityId(): Promise<string | undefined> {
    const user = await this.identityProvider?.getCurrentUser();
    const identityId = user?.id?.trim();
    return identityId && identityId.length > 0 ? identityId : undefined;
  }

  async getTeams(workspaceId?: string): Promise<BirdCoderTeam[]> {
    const teams = await this.client.listTeams({
      identityId: await this.resolveCurrentIdentityId(),
      workspaceId,
    });
    return teams.map(mapTeamSummaryToTeam);
  }
}
