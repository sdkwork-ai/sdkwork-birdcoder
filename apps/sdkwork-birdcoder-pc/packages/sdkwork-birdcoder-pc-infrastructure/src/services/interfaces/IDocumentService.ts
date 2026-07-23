import type { ProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { PageInfo } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

export interface DocumentListOptions {
  projectId: string;
  page?: number;
  pageSize?: number;
}

export interface ProjectDocumentPage {
  items: ProjectDocumentSummary[];
  pageInfo: PageInfo;
}

export interface IDocumentService {
  getDocuments(options: DocumentListOptions): Promise<ProjectDocumentPage>;
}
