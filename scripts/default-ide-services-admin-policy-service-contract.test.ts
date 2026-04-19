import assert from 'node:assert/strict';
import type {
  BirdCoderAdminPolicySummary,
  BirdCoderAppAdminApiClient,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { createAppAdminClientContractStub } from './app-admin-client-contract-stub.ts';

const policyFixtures: BirdCoderAdminPolicySummary[] = [
  {
    id: 'admin-policy-contract-1',
    scopeType: 'workspace',
    scopeId: 'workspace-contract-1',
    policyCategory: 'terminal',
    targetType: 'engine',
    targetId: 'codex',
    approvalPolicy: 'Restricted',
    status: 'active',
    updatedAt: '2026-04-11T16:35:00.000Z',
  },
];

let listPoliciesCalls = 0;

const appAdminClient: BirdCoderAppAdminApiClient = createAppAdminClientContractStub({
  async listPolicies() {
    listPoliciesCalls += 1;
    return policyFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  appAdminClient,
});

const policies = await services.adminPolicyService.getPolicies();

assert.deepEqual(
  policies,
  policyFixtures,
  'default IDE services must expose admin policy reads through the shared app/admin facade.',
);

assert.equal(
  listPoliciesCalls,
  1,
  'adminPolicyService must delegate exactly one read to BirdCoderAppAdminApiClient.listPolicies().',
);

console.log('default IDE services admin policy service contract passed.');
