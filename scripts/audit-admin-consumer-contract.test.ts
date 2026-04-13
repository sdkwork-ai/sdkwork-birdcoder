import assert from 'node:assert/strict';
import type { BirdCoderAdminAuditEventSummary } from '@sdkwork/birdcoder-types';
import type { IAuditService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IAuditService.ts';
import { loadAuditEvents } from '../packages/sdkwork-birdcoder-commons/src/hooks/useAuditEvents.ts';

const auditFixtures: BirdCoderAdminAuditEventSummary[] = [
  {
    id: 'audit-consumer-contract-release',
    scopeType: 'workspace',
    scopeId: 'workspace-consumer-contract',
    eventType: 'release.promoted',
    createdAt: '2026-04-11T15:15:00.000Z',
    payload: {
      actor: 'release-bot',
      stage: 'stable',
    },
  },
  {
    id: 'audit-consumer-contract-policy',
    scopeType: 'workspace',
    scopeId: 'workspace-consumer-contract',
    eventType: 'policy.updated',
    createdAt: '2026-04-11T15:16:00.000Z',
    payload: {
      actor: 'admin-user',
      policyId: 'policy-1',
    },
  },
];

let getAuditEventsCalls = 0;

const auditService: IAuditService = {
  async getAuditEvents() {
    getAuditEventsCalls += 1;
    return auditFixtures;
  },
};

const auditEvents = await loadAuditEvents(auditService);

assert.deepEqual(
  auditEvents,
  auditFixtures,
  'audit consumer loader must return the shared audit service payload unchanged.',
);

assert.equal(
  getAuditEventsCalls,
  1,
  'audit consumer loader must issue exactly one read against IAuditService.getAuditEvents().',
);

console.log('audit admin consumer contract passed.');
