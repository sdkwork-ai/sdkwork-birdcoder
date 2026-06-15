import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-pc-types';

export interface IDocumentService {
  getDocuments(): Promise<BirdCoderProjectDocumentSummary[]>;
}
