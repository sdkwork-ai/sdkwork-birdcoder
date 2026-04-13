import type {
  BirdCoderAppAdminApiClient,
  BirdCoderProjectDocumentSummary,
} from '@sdkwork/birdcoder-types';
import type { IDocumentService } from '../interfaces/IDocumentService.ts';

export interface ApiBackedDocumentServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedDocumentService implements IDocumentService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedDocumentServiceOptions) {
    this.client = client;
  }

  async getDocuments(): Promise<BirdCoderProjectDocumentSummary[]> {
    return this.client.listDocuments();
  }
}
