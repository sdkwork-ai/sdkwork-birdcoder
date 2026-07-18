import type { BirdCoderBackendSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderIamAuditEventSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { createDefaultBirdCoderIdeServices } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts';
import { createBackendSdkClientContractStub } from './split-sdk-client-contract-stub.ts';

const auditFixtures: BirdCoderIamAuditEventSummary[] = [
  {
    id: 'audit-contract-1',
    tenantId: '0',
    action: 'release.promoted',
    resourceType: 'workspace',
    resourceId: 'workspace-contract-1',
    createdAt: '2026-04-11T15:10:00.000Z',
    detail: {
      actor: 'release-bot',
      stage: 'stable',
    },
  },
];

let listAuditEventsCalls = 0;

const backendClient: BirdCoderBackendSdkApiClient = createBackendSdkClientContractStub({
  async listAuditEvents() {
    listAuditEventsCalls += 1;
    return auditFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  backendClient,
});

const auditEvents = await services.auditService.getAuditEvents();

assert.deepEqual(
  auditEvents,
  auditFixtures,
  'default IDE services must expose IAM audit reads through the backend SDK client.',
);

assert.equal(
  listAuditEventsCalls,
  1,
  'auditService must delegate exactly one read to BirdCoderBackendSdkApiClient.listAuditEvents().',
);

console.log('default IDE services audit service contract passed.');
