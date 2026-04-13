import assert from 'node:assert/strict';
import type { BirdCoderAdminPolicySummary } from '@sdkwork/birdcoder-types';
import type { IAdminPolicyService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IAdminPolicyService.ts';
import { loadAdminPolicies } from '../packages/sdkwork-birdcoder-commons/src/hooks/useAdminPolicies.ts';

const policyFixtures: BirdCoderAdminPolicySummary[] = [
  {
    id: 'admin-policy-consumer-contract-restricted',
    scopeType: 'workspace',
    scopeId: 'workspace-consumer-contract',
    policyCategory: 'terminal',
    targetType: 'engine',
    targetId: 'codex',
    approvalPolicy: 'Restricted',
    status: 'active',
    updatedAt: '2026-04-11T16:40:00.000Z',
  },
  {
    id: 'admin-policy-consumer-contract-on-request',
    scopeType: 'workspace',
    scopeId: 'workspace-consumer-contract',
    policyCategory: 'terminal',
    targetType: 'engine',
    targetId: 'claude-code',
    approvalPolicy: 'OnRequest',
    status: 'active',
    updatedAt: '2026-04-11T16:39:00.000Z',
  },
];

let getPoliciesCalls = 0;

const policyService: IAdminPolicyService = {
  async getPolicies() {
    getPoliciesCalls += 1;
    return policyFixtures;
  },
};

const policies = await loadAdminPolicies(policyService);

assert.deepEqual(
  policies,
  policyFixtures,
  'admin policy consumer loader must return the shared admin policy service payload unchanged.',
);

assert.equal(
  getPoliciesCalls,
  1,
  'admin policy consumer loader must issue exactly one read against IAdminPolicyService.getPolicies().',
);

console.log('admin policy consumer contract passed.');
