import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderDeploymentRecordSummary,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { createAppAdminClientContractStub } from './app-admin-client-contract-stub.ts';

const deploymentFixtures: BirdCoderDeploymentRecordSummary[] = [
  {
    id: 'admin-deployment-contract-1',
    projectId: 'project-contract-1',
    targetId: 'target-contract-1',
    status: 'running',
    startedAt: '2026-04-11T16:20:00.000Z',
  },
];

let listAdminDeploymentsCalls = 0;

const appAdminClient: BirdCoderAppAdminApiClient = createAppAdminClientContractStub({
  async listAdminDeployments() {
    listAdminDeploymentsCalls += 1;
    return deploymentFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  appAdminClient,
});

const deployments = await services.adminDeploymentService.getDeployments();

assert.deepEqual(
  deployments,
  deploymentFixtures,
  'default IDE services must expose admin deployment reads through the shared app/admin facade.',
);

assert.equal(
  listAdminDeploymentsCalls,
  1,
  'adminDeploymentService must delegate exactly one read to BirdCoderAppAdminApiClient.listAdminDeployments().',
);

console.log('default IDE services admin deployment service contract passed.');
