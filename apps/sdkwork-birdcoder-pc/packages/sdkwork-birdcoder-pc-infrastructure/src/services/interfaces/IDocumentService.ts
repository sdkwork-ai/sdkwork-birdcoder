import type { ProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';

export interface DocumentListOptions {
  projectId: string;
  page?: number;
  pageSize?: number;
}

export interface IDocumentService {
  getDocuments(options: DocumentListOptions): Promise<ProjectDocumentSummary[]>;
}
