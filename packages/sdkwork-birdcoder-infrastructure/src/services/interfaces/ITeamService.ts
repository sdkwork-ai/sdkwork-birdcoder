import type { BirdCoderTeam } from '@sdkwork/birdcoder-types';

export interface ITeamService {
  getTeams(workspaceId?: string): Promise<BirdCoderTeam[]>;
}
