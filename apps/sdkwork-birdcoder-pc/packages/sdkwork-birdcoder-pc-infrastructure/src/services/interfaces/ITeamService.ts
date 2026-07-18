import type { BirdCoderTeam } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface ITeamService {
  getTeams(workspaceId?: string): Promise<BirdCoderTeam[]>;
}
