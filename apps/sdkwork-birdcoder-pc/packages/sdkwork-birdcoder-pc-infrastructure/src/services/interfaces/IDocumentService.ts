import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface DocumentListOptions {
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface IDocumentService {
  getDocuments(options?: DocumentListOptions): Promise<BirdCoderProjectDocumentSummary[]>;
}
