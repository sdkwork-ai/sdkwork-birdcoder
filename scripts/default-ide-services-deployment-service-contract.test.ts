import assert from 'node:assert/strict';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderDeploymentRecordSummary,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { createAppAdminClientContractStub } from './app-admin-client-contract-stub.ts';

const deploymentFixtures: BirdCoderDeploymentRecordSummary[] = [
  {
    id: 'deployment-contract-1',
    projectId: 'project-contract-1',
    targetId: 'target-contract-1',
    status: 'running',
    startedAt: '2026-04-11T16:00:00.000Z',
  },
];

let listDeploymentsCalls = 0;

const appAdminClient: BirdCoderAppAdminApiClient = createAppAdminClientContractStub({
  async listDeployments() {
    listDeploymentsCalls += 1;
    return deploymentFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  appAdminClient,
});

const deployments = await services.deploymentService.getDeployments();

assert.deepEqual(
  deployments,
  deploymentFixtures,
  'default IDE services must expose deployment reads through the shared app/admin facade.',
);

assert.equal(
  listDeploymentsCalls,
  1,
  'deploymentService must delegate exactly one read to BirdCoderAppAdminApiClient.listDeployments().',
);

console.log('default IDE services deployment service contract passed.');
