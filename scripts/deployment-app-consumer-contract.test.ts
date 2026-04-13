import assert from 'node:assert/strict';
import type { BirdCoderDeploymentRecordSummary } from '@sdkwork/birdcoder-types';
import type { IDeploymentService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IDeploymentService.ts';
import { loadDeployments } from '../packages/sdkwork-birdcoder-commons/src/hooks/useDeployments.ts';

const deploymentFixtures: BirdCoderDeploymentRecordSummary[] = [
  {
    id: 'deployment-consumer-contract-running',
    projectId: 'project-consumer-contract',
    targetId: 'target-consumer-contract',
    status: 'running',
    startedAt: '2026-04-11T16:05:00.000Z',
  },
  {
    id: 'deployment-consumer-contract-succeeded',
    projectId: 'project-consumer-contract',
    targetId: 'target-consumer-contract',
    status: 'succeeded',
    startedAt: '2026-04-11T16:04:00.000Z',
    completedAt: '2026-04-11T16:06:00.000Z',
  },
];

let getDeploymentsCalls = 0;

const deploymentService: IDeploymentService = {
  async getDeployments() {
    getDeploymentsCalls += 1;
    return deploymentFixtures;
  },
};

const deployments = await loadDeployments(deploymentService);

assert.deepEqual(
  deployments,
  deploymentFixtures,
  'deployment consumer loader must return the shared deployment service payload unchanged.',
);

assert.equal(
  getDeploymentsCalls,
  1,
  'deployment consumer loader must issue exactly one read against IDeploymentService.getDeployments().',
);

console.log('deployment app consumer contract passed.');
