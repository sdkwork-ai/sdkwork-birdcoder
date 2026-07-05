import type {
  BirdCoderProjectDocumentSummary,
} from '@sdkwork/birdcoder-pc-types';
import type { DocumentListOptions, IDocumentService } from '../interfaces/IDocumentService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedDocumentServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
}

const DEFAULT_DOCUMENT_LIST_LIMIT = 200;

export class ApiBackedDocumentService implements IDocumentService {
  private readonly appClient: BirdCoderAppSdkApiClient;

  constructor({ appClient }: ApiBackedDocumentServiceOptions) {
    this.appClient = appClient;
  }

  async getDocuments(
    options: DocumentListOptions = {},
  ): Promise<BirdCoderProjectDocumentSummary[]> {
    return this.appClient.listDocuments({
      ...options,
      limit: options.limit ?? DEFAULT_DOCUMENT_LIST_LIMIT,
    });
  }
}
