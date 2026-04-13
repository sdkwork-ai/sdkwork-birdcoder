import type { BirdCoderAppAdminApiClient, BirdCoderReleaseSummary } from '@sdkwork/birdcoder-types';
import type { IReleaseService } from '../interfaces/IReleaseService.ts';

export interface ApiBackedReleaseServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedReleaseService implements IReleaseService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedReleaseServiceOptions) {
    this.client = client;
  }

  async getReleases(): Promise<BirdCoderReleaseSummary[]> {
    return this.client.listReleases();
  }
}
