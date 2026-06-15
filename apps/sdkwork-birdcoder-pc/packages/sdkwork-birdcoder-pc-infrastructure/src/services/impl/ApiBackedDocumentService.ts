import type {
  BirdCoderProjectDocumentSummary,
} from '@sdkwork/birdcoder-pc-types';
import type { IDocumentService } from '../interfaces/IDocumentService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedDocumentServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
}

export class ApiBackedDocumentService implements IDocumentService {
  private readonly appClient: BirdCoderAppSdkApiClient;

  constructor({ appClient }: ApiBackedDocumentServiceOptions) {
    this.appClient = appClient;
  }

  async getDocuments(): Promise<BirdCoderProjectDocumentSummary[]> {
    return this.appClient.listDocuments();
  }
}
