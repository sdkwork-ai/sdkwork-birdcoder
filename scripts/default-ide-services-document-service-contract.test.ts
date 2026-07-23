import assert from 'node:assert/strict';

import type { AgentProjectCompositionSlotRecord } from '@sdkwork/agents-app-sdk';
import type { SdkworkDocumentsAppClient } from '@sdkwork/documents-app-sdk';
import {
  AgentsDocumentsProjectDocumentService,
  ProjectDocumentCompositionError,
  type AgentsDocumentsProjectDocumentServiceOptions,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/AgentsDocumentsProjectDocumentService.ts';

const projectId = 'project-contract-1';
const documentId = 'document-contract-1';
const pageInfo = {
  mode: 'offset' as const,
  page: 1,
  pageSize: 200,
  totalItems: '1',
  totalPages: 1,
  hasMore: false,
};
const slot: AgentProjectCompositionSlotRecord = {
  id: '501',
  tenantId: '101',
  organizationId: '201',
  projectId,
  slotId: 'document.architecture',
  slotKind: 'document',
  targetModule: 'documents',
  targetRef: documentId,
  targetVersionRef: 'document-version-3',
  priority: 100,
  enabled: true,
  policyJson: '{}',
  createdBy: '301',
  updatedBy: '301',
  version: '3',
  createdAt: '2026-04-11T14:00:00.000Z',
  updatedAt: '2026-04-11T14:01:00.000Z',
};

let listedProjectId = '';
let listedPage = 0;
let listedPageSize = 0;
let listedSlotKind = '';
let listedEnabled: boolean | undefined;
const projectCompositionSlots: AgentsDocumentsProjectDocumentServiceOptions['projectCompositionSlots'] = {
  async list(requestedProjectId, options) {
    listedProjectId = requestedProjectId;
    listedPage = options?.page ?? 0;
    listedPageSize = options?.pageSize ?? 0;
    listedSlotKind = options?.slotKind ?? '';
    listedEnabled = options?.enabled;
    return { items: [slot], pageInfo };
  },
};

const retrievedDocumentIds: string[] = [];
const documentsClient = {
  documents: {
    async retrieve(requestedDocumentId: string) {
      retrievedDocumentIds.push(requestedDocumentId);
      return {
        id: requestedDocumentId,
        title: 'Document Contract Architecture',
        status: 'active',
        body: '# Architecture',
      };
    },
  },
} as unknown as SdkworkDocumentsAppClient;

let documentsClientResolutionCount = 0;
const service = new AgentsDocumentsProjectDocumentService({
  projectCompositionSlots,
  resolveDocumentsClient: () => {
    documentsClientResolutionCount += 1;
    return documentsClient.documents;
  },
});
const page = await service.getDocuments({
  projectId: ` ${projectId} `,
  page: 0,
  pageSize: 500,
});

assert.deepEqual(page, {
  items: [{
    projectId,
    compositionSlotId: slot.slotId,
    compositionVersion: slot.version,
    documentId,
    documentVersionRef: slot.targetVersionRef,
    title: 'Document Contract Architecture',
    status: 'active',
    body: '# Architecture',
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
  }],
  pageInfo,
});
assert.equal(listedProjectId, projectId);
assert.equal(listedPage, 1, 'composition reads must normalize page to the API minimum.');
assert.equal(listedPageSize, 200, 'composition reads must enforce the API page-size limit.');
assert.equal(listedSlotKind, 'document');
assert.equal(listedEnabled, true);
assert.equal(documentsClientResolutionCount, 1);
assert.deepEqual(retrievedDocumentIds, [documentId]);

let emptyPageClientResolved = false;
const emptyPageService = new AgentsDocumentsProjectDocumentService({
  projectCompositionSlots: {
    async list() {
      return { items: [], pageInfo: { ...pageInfo, totalItems: '0', totalPages: 0 } };
    },
  },
  resolveDocumentsClient: () => {
    emptyPageClientResolved = true;
    return documentsClient.documents;
  },
});
assert.deepEqual(
  (await emptyPageService.getDocuments({ projectId })).items,
  [],
);
assert.equal(
  emptyPageClientResolved,
  false,
  'Documents SDK construction must stay lazy until a canonical document slot exists.',
);

const invalidPairService = new AgentsDocumentsProjectDocumentService({
  projectCompositionSlots: {
    async list() {
      return {
        items: [{ ...slot, targetModule: 'drive' }],
        pageInfo,
      };
    },
  },
  resolveDocumentsClient: () => documentsClient.documents,
});
await assert.rejects(
  () => invalidPairService.getDocuments({ projectId }),
  ProjectDocumentCompositionError,
  'The PC adapter must fail closed before reading Documents for an invalid slot pair.',
);

console.log('Agents + Documents project composition service contract passed.');
