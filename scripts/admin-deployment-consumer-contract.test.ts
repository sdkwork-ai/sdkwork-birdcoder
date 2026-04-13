import assert from 'node:assert/strict';
import type { BirdCoderDeploymentRecordSummary } from '@sdkwork/birdcoder-types';
import type { IAdminDeploymentService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IAdminDeploymentService.ts';
import { loadAdminDeployments } from '../packages/sdkwork-birdcoder-commons/src/hooks/useAdminDeployments.ts';

const deploymentFixtures: BirdCoderDeploymentRecordSummary[] = [
  {
    id: 'admin-deployment-consumer-contract-running',
    projectId: 'project-consumer-contract',
    targetId: 'target-consumer-contract',
    status: 'running',
    startedAt: '2026-04-11T16:25:00.000Z',
  },
  {
    id: 'admin-deployment-consumer-contract-succeeded',
    projectId: 'project-consumer-contract',
    targetId: 'target-consumer-contract',
    status: 'succeeded',
    startedAt: '2026-04-11T16:24:00.000Z',
    completedAt: '2026-04-11T16:26:00.000Z',
  },
];

let getDeploymentsCalls = 0;

const deploymentService: IAdminDeploymentService = {
  async getDeployments() {
    getDeploymentsCalls += 1;
    return deploymentFixtures;
  },
};

const deployments = await loadAdminDeployments(deploymentService);

assert.deepEqual(
  deployments,
  deploymentFixtures,
  'admin deployment consumer loader must return the shared admin deployment service payload unchanged.',
);

assert.equal(
  getDeploymentsCalls,
  1,
  'admin deployment consumer loader must issue exactly one read against IAdminDeploymentService.getDeployments().',
);

console.log('admin deployment consumer contract passed.');
