import type { BirdCoderBackendSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderIamPolicySummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { createDefaultBirdCoderIdeServices } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts';
import { createBackendSdkClientContractStub } from './split-sdk-client-contract-stub.ts';
import { installBirdCoderTestRuntimeEnv } from './test-birdcoder-runtime-env-fixture.ts';

const policyFixtures: BirdCoderIamPolicySummary[] = [
  {
    id: 'admin-policy-contract-1',
    tenantId: '0',
    code: 'terminal.engine.codex',
    name: 'Codex terminal approval policy',
    policy: {
      approvalPolicy: 'Restricted',
      policyCategory: 'terminal',
      scopeId: 'workspace-contract-1',
      scopeType: 'workspace',
      targetId: 'codex',
      targetType: 'engine',
    },
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

const restoreRuntimeEnv = installBirdCoderTestRuntimeEnv();
const services = createDefaultBirdCoderIdeServices({
  backendClient,
});

const policies = await services.adminPolicyService.getPolicies();

assert.deepEqual(
  policies,
  policyFixtures,
  'default IDE services must expose IAM policy reads through the backend SDK client.',
);

assert.equal(
  listPoliciesCalls,
  1,
  'adminPolicyService must delegate exactly one read to BirdCoderBackendSdkApiClient.listPolicies().',
);

restoreRuntimeEnv();
console.log('default IDE services admin policy service contract passed.');
