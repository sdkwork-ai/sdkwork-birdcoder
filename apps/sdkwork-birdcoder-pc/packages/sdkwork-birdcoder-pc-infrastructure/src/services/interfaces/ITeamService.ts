import type { BirdCoderTeam } from '@sdkwork/birdcoder-pc-types';

export interface ITeamService {
  getTeams(workspaceId?: string): Promise<BirdCoderTeam[]>;
}
