import type { ProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';

import type {
  DocumentListOptions,
  IDocumentService,
} from '../interfaces/IDocumentService.ts';

export class ProjectDocumentCompositionUnavailableError extends Error {
  readonly code = 'agents_project_document_composition_unavailable';
  readonly projectId: string;

  constructor(projectId: string) {
    super(
      'Project documents are unavailable until sdkwork-agents defines a canonical document composition slot.',
    );
    this.name = 'ProjectDocumentCompositionUnavailableError';
    this.projectId = projectId;
  }
}

export class UnavailableProjectDocumentService implements IDocumentService {
  getDocuments(
    options: DocumentListOptions,
  ): Promise<ProjectDocumentSummary[]> {
    const projectId = options.projectId.trim();
    if (!projectId) {
      return Promise.reject(new Error('Project ID is required to list project documents.'));
    }
    return Promise.reject(new ProjectDocumentCompositionUnavailableError(projectId));
  }
}
