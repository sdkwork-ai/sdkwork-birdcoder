import assert from 'node:assert/strict';
import type { BirdCoderProjectDocumentSummary } from '@sdkwork/birdcoder-types';
import type { IDocumentService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IDocumentService.ts';
import { loadDocuments } from '../packages/sdkwork-birdcoder-commons/src/hooks/useDocuments.ts';

const documentFixtures: BirdCoderProjectDocumentSummary[] = [
  {
    id: 'doc-consumer-contract-architecture',
    projectId: 'project-consumer-contract',
    documentKind: 'architecture',
    title: 'Consumer Contract Architecture',
    slug: 'consumer-contract-architecture',
    status: 'active',
    updatedAt: '2026-04-11T14:05:00.000Z',
  },
  {
    id: 'doc-consumer-contract-step',
    projectId: 'project-consumer-contract',
    documentKind: 'step',
    title: 'Consumer Contract Step',
    slug: 'consumer-contract-step',
    status: 'active',
    updatedAt: '2026-04-11T14:06:00.000Z',
  },
];

let getDocumentsCalls = 0;

const documentService: IDocumentService = {
  async getDocuments() {
    getDocumentsCalls += 1;
    return documentFixtures;
  },
};

const documents = await loadDocuments(documentService);

assert.deepEqual(
  documents,
  documentFixtures,
  'document consumer loader must return the shared document service payload unchanged.',
);

assert.equal(
  getDocumentsCalls,
  1,
  'document consumer loader must issue exactly one read against IDocumentService.getDocuments().',
);

console.log('document app consumer contract passed.');
