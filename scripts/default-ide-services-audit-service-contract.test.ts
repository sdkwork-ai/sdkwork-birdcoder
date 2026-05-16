import type { BirdCoderBackendSdkApiClient } from '../packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderAdminAuditEventSummary,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { createBackendSdkClientContractStub } from './split-sdk-client-contract-stub.ts';

const auditFixtures: BirdCoderAdminAuditEventSummary[] = [
  {
    id: 'audit-contract-1',
    scopeType: 'workspace',
    scopeId: 'workspace-contract-1',
    eventType: 'release.promoted',
    createdAt: '2026-04-11T15:10:00.000Z',
    payload: {
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
  'default IDE services must expose audit reads through the backend SDK client.',
);

assert.equal(
  listAuditEventsCalls,
  1,
  'auditService must delegate exactly one read to BirdCoderBackendSdkApiClient.listAuditEvents().',
);

console.log('default IDE services audit service contract passed.');
