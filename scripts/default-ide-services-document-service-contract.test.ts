import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderProjectDocumentSummary,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { createAppAdminClientContractStub } from './app-admin-client-contract-stub.ts';

const documentFixtures: BirdCoderProjectDocumentSummary[] = [
  {
    id: 'doc-contract-1',
    projectId: 'project-contract-1',
    documentKind: 'architecture',
    title: 'Document Contract Architecture',
    slug: 'document-contract-architecture',
    status: 'active',
    updatedAt: '2026-04-11T14:00:00.000Z',
  },
];

let listDocumentsCalls = 0;

const appAdminClient: BirdCoderAppAdminApiClient = createAppAdminClientContractStub({
  async listDocuments() {
    listDocumentsCalls += 1;
    return documentFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  appAdminClient,
});

const documents = await services.documentService.getDocuments();

assert.deepEqual(
  documents,
  documentFixtures,
  'default IDE services must expose document reads through the shared app/admin facade.',
);

assert.equal(
  listDocumentsCalls,
  1,
  'documentService must delegate exactly one read to BirdCoderAppAdminApiClient.listDocuments().',
);

console.log('default IDE services document service contract passed.');
