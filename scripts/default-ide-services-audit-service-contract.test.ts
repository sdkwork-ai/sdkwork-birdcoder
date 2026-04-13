import assert from 'node:assert/strict';
import type {
  BirdCoderAdminAuditEventSummary,
  BirdCoderAppAdminApiClient,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';

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

const appAdminClient: BirdCoderAppAdminApiClient = {
  async listAdminDeployments() {
    return [];
  },
  async listAdminTeams() {
    return [];
  },
  async listAuditEvents() {
    listAuditEventsCalls += 1;
    return auditFixtures;
  },
  async listDeploymentTargets() {
    return [];
  },
  async listDeployments() {
    return [];
  },
  async listDocuments() {
    return [];
  },
  async listPolicies() {
    return [];
  },
  async listProjects() {
    return [];
  },
  async listReleases() {
    return [];
  },
  async listTeamMembers() {
    return [];
  },
  async listTeams() {
    return [];
  },
  async listWorkspaces() {
    return [];
  },
};

const services = createDefaultBirdCoderIdeServices({
  appAdminClient,
});

const auditEvents = await services.auditService.getAuditEvents();

assert.deepEqual(
  auditEvents,
  auditFixtures,
  'default IDE services must expose audit reads through the shared app/admin facade.',
);

assert.equal(
  listAuditEventsCalls,
  1,
  'auditService must delegate exactly one read to BirdCoderAppAdminApiClient.listAuditEvents().',
);

console.log('default IDE services audit service contract passed.');
