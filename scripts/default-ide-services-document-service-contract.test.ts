import assert from 'node:assert/strict';

import type { SdkworkDocumentsAppClient } from '@sdkwork/documents-app-sdk';
import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/birdCoderSdkClient.ts';
import { DocumentsSdkProjectDocumentService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/DocumentsSdkProjectDocumentService.ts';

const binding = {
  id: 'binding-contract-1',
  uuid: 'binding-contract-uuid-1',
  projectId: 'project-contract-1',
  documentId: 'document-contract-1',
  bindingKind: 'architecture',
  version: '3',
  createdAt: '2026-04-11T14:00:00.000Z',
  updatedAt: '2026-04-11T14:01:00.000Z',
};

let listedProjectId = '';
let listedPage = 0;
let listedPageSize = 0;
const appClient = {
  platform: {
    projects: {
      documentBindings: {
        async list(projectId: string, options: { page?: number; pageSize?: number }) {
          listedProjectId = projectId;
          listedPage = options.page ?? 0;
          listedPageSize = options.pageSize ?? 0;
          return {
            items: [binding],
            pageInfo: { page: 1, pageSize: 200, total: '1', totalPages: 1 },
          };
        },
      },
    },
  },
} as unknown as BirdCoderAppSdkApiClient;

const retrievedDocumentIds: string[] = [];
const documentsClient = {
  documents: {
    async retrieve(documentId: string) {
      retrievedDocumentIds.push(documentId);
      return {
        id: documentId,
        title: 'Document Contract Architecture',
        status: 'active',
        body: '# Architecture',
      };
    },
  },
} as unknown as SdkworkDocumentsAppClient;

const service = new DocumentsSdkProjectDocumentService({ appClient, documentsClient });
const documents = await service.getDocuments({
  projectId: ' project-contract-1 ',
  page: 0,
  pageSize: 500,
});

assert.deepEqual(documents, [{
  bindingId: binding.id,
  projectId: binding.projectId,
  documentId: binding.documentId,
  bindingKind: binding.bindingKind,
  bindingVersion: binding.version,
  title: 'Document Contract Architecture',
  status: 'active',
  body: '# Architecture',
  createdAt: binding.createdAt,
  updatedAt: binding.updatedAt,
}]);
assert.equal(listedProjectId, binding.projectId);
assert.equal(listedPage, 1, 'document binding reads must normalize page to the API minimum.');
assert.equal(listedPageSize, 200, 'document binding reads must enforce the API page-size limit.');
assert.deepEqual(retrievedDocumentIds, [binding.documentId]);

console.log('Documents SDK project binding service contract passed.');
