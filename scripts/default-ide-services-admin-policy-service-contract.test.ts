import type { BirdCoderBackendSdkApiClient } from '../packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderAdminPolicySummary,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { createBackendSdkClientContractStub } from './split-sdk-client-contract-stub.ts';

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

const backendClient: BirdCoderBackendSdkApiClient = createBackendSdkClientContractStub({
  async listPolicies() {
    listPoliciesCalls += 1;
    return policyFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  backendClient,
});

const policies = await services.adminPolicyService.getPolicies();

assert.deepEqual(
  policies,
  policyFixtures,
  'default IDE services must expose admin policy reads through the backend SDK client.',
);

assert.equal(
  listPoliciesCalls,
  1,
  'adminPolicyService must delegate exactly one read to BirdCoderBackendSdkApiClient.listPolicies().',
);

console.log('default IDE services admin policy service contract passed.');
