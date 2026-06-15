import type { BirdCoderBackendSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderDeploymentRecordSummary,
} from '@sdkwork/birdcoder-pc-types';
import { createDefaultBirdCoderIdeServices } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts';
import { createBackendSdkClientContractStub } from './split-sdk-client-contract-stub.ts';

const deploymentFixtures: BirdCoderDeploymentRecordSummary[] = [
  {
    id: 'admin-deployment-contract-1',
    projectId: 'project-contract-1',
    targetId: 'target-contract-1',
    status: 'running',
    startedAt: '2026-04-11T16:20:00.000Z',
  },
];

let listGovernanceDeploymentsCalls = 0;

const backendClient: BirdCoderBackendSdkApiClient = createBackendSdkClientContractStub({
  async listGovernanceDeployments() {
    listGovernanceDeploymentsCalls += 1;
    return deploymentFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  backendClient,
});

const deployments = await services.adminDeploymentService.getDeployments();

assert.deepEqual(
  deployments,
  deploymentFixtures,
  'default IDE services must expose admin deployment reads through the backend SDK client.',
);

assert.equal(
  listGovernanceDeploymentsCalls,
  1,
  'adminDeploymentService must delegate exactly one read to BirdCoderBackendSdkApiClient.listGovernanceDeployments().',
);

console.log('default IDE services admin deployment service contract passed.');
