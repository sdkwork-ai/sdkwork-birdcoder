import type { BirdCoderReleaseSummary } from '@sdkwork/birdcoder-types';
import type { IReleaseService } from '../interfaces/IReleaseService.ts';
import type { BirdCoderBackendSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedReleaseServiceOptions {
  backendClient: BirdCoderBackendSdkApiClient;
}

export class ApiBackedReleaseService implements IReleaseService {
  private readonly backendClient: BirdCoderBackendSdkApiClient;

  constructor({ backendClient }: ApiBackedReleaseServiceOptions) {
    this.backendClient = backendClient;
  }

  async getReleases(): Promise<BirdCoderReleaseSummary[]> {
    return this.backendClient.listReleases();
  }
}
