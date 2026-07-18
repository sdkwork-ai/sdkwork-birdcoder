import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderDeploymentRecordSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { createDefaultBirdCoderIdeServices } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts';
import { createAppSdkClientContractStub, createBackendSdkClientContractStub } from './split-sdk-client-contract-stub.ts';

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

const appClient: BirdCoderAppSdkApiClient = createAppSdkClientContractStub({
  async listDeployments() {
    listDeploymentsCalls += 1;
    return deploymentFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  appClient,
});

const deployments = await services.deploymentService.getDeployments();

assert.deepEqual(
  deployments,
  deploymentFixtures,
  'default IDE services must expose deployment reads through the shared app SDK facade.',
);

assert.equal(
  listDeploymentsCalls,
  1,
  'deploymentService must delegate exactly one read to BirdCoderAppSdkApiClient.listDeployments().',
);

console.log('default IDE services deployment service contract passed.');
