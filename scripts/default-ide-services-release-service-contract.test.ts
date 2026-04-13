import assert from 'node:assert/strict';
import type { BirdCoderAppAdminApiClient, BirdCoderReleaseSummary } from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';

const releaseFixtures: BirdCoderReleaseSummary[] = [
  {
    id: 'release-contract-1',
    releaseVersion: '0.3.0-contract',
    releaseKind: 'formal',
    rolloutStage: 'production',
    status: 'ready',
  },
];

let listReleasesCalls = 0;

const appAdminClient: BirdCoderAppAdminApiClient = {
  async listAdminDeployments() {
    return [];
  },
  async listAdminTeams() {
    return [];
  },
  async listAuditEvents() {
    return [];
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
    listReleasesCalls += 1;
    return releaseFixtures;
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

const releases = await services.releaseService.getReleases();

assert.deepEqual(
  releases,
  releaseFixtures,
  'default IDE services must expose release reads through the shared app/admin facade.',
);

assert.equal(
  listReleasesCalls,
  1,
  'releaseService must delegate exactly one read to BirdCoderAppAdminApiClient.listReleases().',
);

console.log('default IDE services release service contract passed.');
