import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { BirdCoderProjectDocumentBinding } from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';
import type {
  Document,
  SdkworkDocumentsAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/documents-app';
import { chunk } from '@sdkwork/utils/collection';
import { normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

import type { BirdCoderAppSdkApiClient } from '../birdCoderSdkClient.ts';
import type {
  DocumentListOptions,
  IDocumentService,
} from '../interfaces/IDocumentService.ts';

const DOCUMENT_READ_CONCURRENCY = 8;

export interface DocumentsSdkProjectDocumentServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  documentsClient: SdkworkDocumentsAppClient;
}

function requireProjectId(projectId: string): string {
  const normalized = projectId.trim();
  if (!normalized) {
    throw new Error('Project ID is required to list bound documents.');
  }
  return normalized;
}

function toProjectDocumentSummary(
  binding: BirdCoderProjectDocumentBinding,
  document: Document,
): BirdCoderProjectDocumentSummary {
  if (binding.documentId !== document.id) {
    throw new Error('Documents SDK returned a document that does not match its project binding.');
  }

  return {
    bindingId: binding.id,
    projectId: binding.projectId,
    documentId: document.id,
    bindingKind: binding.bindingKind,
    bindingVersion: binding.version,
    title: document.title,
    status: document.status,
    ...(document.body === undefined ? {} : { body: document.body }),
    createdAt: binding.createdAt,
    updatedAt: binding.updatedAt,
  };
}

export class DocumentsSdkProjectDocumentService implements IDocumentService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly documentsClient: SdkworkDocumentsAppClient;

  constructor(options: DocumentsSdkProjectDocumentServiceOptions) {
    this.appClient = options.appClient;
    this.documentsClient = options.documentsClient;
  }

  async getDocuments(
    options: DocumentListOptions,
  ): Promise<BirdCoderProjectDocumentSummary[]> {
    const projectId = requireProjectId(options.projectId);
    const pagination = normalizeOffsetListQuery({
      page: options.page,
      page_size: options.pageSize,
    });
    const bindingPage = await this.appClient.intelligence.projects.documentBindings.list(
      projectId,
      {
        page: pagination.page,
        pageSize: pagination.page_size,
      },
    );

    const documentById = new Map<string, Document>();
    const documentIds = [...new Set(bindingPage.items.map((binding) => binding.documentId))];
    for (const documentIdBatch of chunk(documentIds, DOCUMENT_READ_CONCURRENCY)) {
      const documents = await Promise.all(
        documentIdBatch.map((documentId) => this.documentsClient.documents.retrieve(documentId)),
      );
      for (const document of documents) {
        documentById.set(document.id, document);
      }
    }

    return bindingPage.items.map((binding) => {
      const document = documentById.get(binding.documentId);
      if (!document) {
        throw new Error(`Bound document is unavailable: ${binding.documentId}`);
      }
      return toProjectDocumentSummary(binding, document);
    });
  }
}
