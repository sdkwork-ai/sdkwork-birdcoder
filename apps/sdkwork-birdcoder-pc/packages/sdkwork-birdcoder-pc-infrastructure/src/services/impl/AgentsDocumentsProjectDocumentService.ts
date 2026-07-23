import type { ProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  AgentProjectCompositionSlotRecord,
  AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type {
  Document,
  SdkworkDocumentsAppClient,
} from '@sdkwork/birdcoder-pc-core/sdk/documents-app';
import { chunk } from '@sdkwork/utils/collection';
import { normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

import type {
  DocumentListOptions,
  IDocumentService,
  ProjectDocumentPage,
} from '../interfaces/IDocumentService.ts';

const DOCUMENT_READ_CONCURRENCY = 8;

type ProjectCompositionSlotsClient = Pick<
  AgentsAppSdkClient['ai']['agents']['projectCompositionSlots'],
  'list'
>;

type DocumentsResourceClient = Pick<SdkworkDocumentsAppClient['documents'], 'retrieve'>;

export interface AgentsDocumentsProjectDocumentServiceOptions {
  projectCompositionSlots: ProjectCompositionSlotsClient;
  resolveDocumentsClient: () => DocumentsResourceClient;
}

export class ProjectDocumentCompositionError extends Error {
  readonly code = 'agents_project_document_composition_invalid';

  constructor(detail: string) {
    super(`Invalid Agents project document composition: ${detail}`);
    this.name = 'ProjectDocumentCompositionError';
  }
}

function requireProjectId(projectId: string): string {
  const normalized = projectId.trim();
  if (!normalized) {
    throw new ProjectDocumentCompositionError('projectId is required');
  }
  return normalized;
}

function requireDocumentSlot(
  slot: AgentProjectCompositionSlotRecord,
  projectId: string,
): AgentProjectCompositionSlotRecord {
  if (slot.projectId !== projectId) {
    throw new ProjectDocumentCompositionError('slot projectId does not match the requested project');
  }
  if (slot.slotKind !== 'document' || slot.targetModule !== 'documents') {
    throw new ProjectDocumentCompositionError(
      'slotKind=document must pair with targetModule=documents',
    );
  }
  if (!slot.enabled) {
    throw new ProjectDocumentCompositionError('the returned slot is disabled');
  }
  if (!slot.slotId.trim() || !slot.targetRef.trim()) {
    throw new ProjectDocumentCompositionError('slotId and targetRef must be non-blank');
  }
  return slot;
}

function toProjectDocumentSummary(
  slot: AgentProjectCompositionSlotRecord,
  document: Document,
): ProjectDocumentSummary {
  if (slot.targetRef !== document.id) {
    throw new ProjectDocumentCompositionError(
      'Documents SDK returned a resource that does not match targetRef',
    );
  }

  return {
    projectId: slot.projectId,
    compositionSlotId: slot.slotId,
    compositionVersion: slot.version,
    documentId: document.id,
    ...(slot.targetVersionRef == null
      ? {}
      : { documentVersionRef: slot.targetVersionRef }),
    title: document.title,
    status: document.status,
    ...(document.body === undefined ? {} : { body: document.body }),
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  };
}

export class AgentsDocumentsProjectDocumentService implements IDocumentService {
  private readonly projectCompositionSlots: ProjectCompositionSlotsClient;
  private readonly resolveDocumentsClient: () => DocumentsResourceClient;

  constructor(options: AgentsDocumentsProjectDocumentServiceOptions) {
    this.projectCompositionSlots = options.projectCompositionSlots;
    this.resolveDocumentsClient = options.resolveDocumentsClient;
  }

  async getDocuments(options: DocumentListOptions): Promise<ProjectDocumentPage> {
    const projectId = requireProjectId(options.projectId);
    const pagination = normalizeOffsetListQuery({
      page: options.page,
      page_size: options.pageSize,
    });
    const compositionPage = await this.projectCompositionSlots.list(projectId, {
      enabled: true,
      page: pagination.page,
      pageSize: pagination.page_size,
      slotKind: 'document',
    });
    const slots = (compositionPage.items as AgentProjectCompositionSlotRecord[])
      .map((slot) => requireDocumentSlot(slot, projectId));
    if (slots.length === 0) {
      return { items: [], pageInfo: compositionPage.pageInfo };
    }

    const documentsClient = this.resolveDocumentsClient();
    const documentById = new Map<string, Document>();
    const documentIds = [...new Set(slots.map((slot) => slot.targetRef))];
    for (const documentIdBatch of chunk(documentIds, DOCUMENT_READ_CONCURRENCY)) {
      const documents = await Promise.all(
        documentIdBatch.map((documentId) => documentsClient.retrieve(documentId)),
      );
      for (const document of documents) {
        documentById.set(document.id, document);
      }
    }

    return {
      items: slots.map((slot) => {
        const document = documentById.get(slot.targetRef);
        if (!document) {
          throw new ProjectDocumentCompositionError(
            `document is unavailable for targetRef=${slot.targetRef}`,
          );
        }
        return toProjectDocumentSummary(slot, document);
      }),
      pageInfo: compositionPage.pageInfo,
    };
  }
}
