import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderProjectDocumentSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { createDefaultBirdCoderIdeServices } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts';
import { createAppSdkClientContractStub, createBackendSdkClientContractStub } from './split-sdk-client-contract-stub.ts';
import { installBirdCoderTestRuntimeEnv } from './test-birdcoder-runtime-env-fixture.ts';

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

const appClient: BirdCoderAppSdkApiClient = createAppSdkClientContractStub({
  async listDocuments() {
    listDocumentsCalls += 1;
    return documentFixtures;
  },
});

const restoreRuntimeEnv = installBirdCoderTestRuntimeEnv();
const services = createDefaultBirdCoderIdeServices({
  appClient,
});

const documents = await services.documentService.getDocuments();

assert.deepEqual(
  documents,
  documentFixtures,
  'default IDE services must expose document reads through the shared app SDK facade.',
);

assert.equal(
  listDocumentsCalls,
  1,
  'documentService must delegate exactly one read to BirdCoderAppSdkApiClient.listDocuments().',
);

restoreRuntimeEnv();
console.log('default IDE services document service contract passed.');
