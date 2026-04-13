import type { BirdCoderAppAdminApiClient, BirdCoderTeam } from '@sdkwork/birdcoder-types';
import type { ITeamService } from '../interfaces/ITeamService.ts';

function mapTeamSummaryToTeam(
  team: Awaited<ReturnType<BirdCoderAppAdminApiClient['listTeams']>>[number],
): BirdCoderTeam {
  return {
    id: team.id,
    workspaceId: team.workspaceId,
    name: team.name,
    description: team.description,
    status: team.status === 'archived' ? 'archived' : 'active',
  };
}

export interface ApiBackedTeamServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedTeamService implements ITeamService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedTeamServiceOptions) {
    this.client = client;
  }

  async getTeams(workspaceId?: string): Promise<BirdCoderTeam[]> {
    const teams = await this.client.listTeams({ workspaceId });
    return teams.map(mapTeamSummaryToTeam);
  }
}
