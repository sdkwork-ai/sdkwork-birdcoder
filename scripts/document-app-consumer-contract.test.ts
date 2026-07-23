import assert from 'node:assert/strict';

import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  DocumentListOptions,
  IDocumentService,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IDocumentService.ts';
import { loadDocuments } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useDocuments.ts';

const documentFixtures: BirdCoderProjectDocumentSummary[] = [{
  bindingId: 'binding-consumer-contract-architecture',
  projectId: 'project-consumer-contract',
  documentId: 'document-consumer-contract-architecture',
  bindingKind: 'architecture',
  bindingVersion: '2',
  title: 'Consumer Contract Architecture',
  status: 'active',
  createdAt: '2026-04-11T14:05:00.000Z',
  updatedAt: '2026-04-11T14:06:00.000Z',
}];

let receivedOptions: DocumentListOptions | null = null;
const documentService: IDocumentService = {
  async getDocuments(options) {
    receivedOptions = options;
    return documentFixtures;
  },
};

const options: DocumentListOptions = {
  projectId: 'project-consumer-contract',
  page: 2,
  pageSize: 50,
};
const documents = await loadDocuments(documentService, options);

assert.deepEqual(documents, documentFixtures);
assert.deepEqual(
  receivedOptions,
  options,
  'document consumer loader must preserve the project-scoped pagination request.',
);

console.log('document app consumer contract passed.');
