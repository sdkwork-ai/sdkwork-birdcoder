import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-types';

export interface IDocumentService {
  getDocuments(): Promise<BirdCoderProjectDocumentSummary[]>;
}
