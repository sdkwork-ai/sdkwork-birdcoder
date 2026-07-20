import {
  configureSdkworkMembershipAppServiceProvider,
  configureSdkworkMembershipSessionTokenProvider,
  type SdkworkMembershipAppService,
} from '@sdkwork/membership-service';
import assert from 'node:assert/strict';
import { ApiBackedVipMembershipService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedVipMembershipService.ts';
import { createDefaultBirdCoderIdeServices } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts';
import { installBirdCoderTestRuntimeEnv } from './test-birdcoder-runtime-env-fixture.ts';

let currentRetrieveCalls = 0;
let packageGroupsListCalls = 0;

const membershipService = {
  memberships: {
    current: {
      async retrieve() {
        currentRetrieveCalls += 1;
        return {
          benefits: [],
          ownerUserId: 'vip-contract-user',
          planName: 'Pro',
          points: '120',
          status: 'active',
          growthValue: '0',
          totalSpent: '0',
          upgradeGrowthValue: '0',
        };
      },
    },
    packageGroups: {
      async list() {
        packageGroupsListCalls += 1;
        return {
          items: [
            {
              id: 'vip-contract-group',
              name: 'Monthly plans',
              packages: [],
              sortWeight: '1',
            },
          ],
        };
      },
    },
  },
} as unknown as SdkworkMembershipAppService;

configureSdkworkMembershipAppServiceProvider(() => membershipService);
configureSdkworkMembershipSessionTokenProvider(() => ({
  accessToken: 'vip-contract-access-token',
  authToken: 'vip-contract-auth-token',
}));
const restoreRuntimeEnv = installBirdCoderTestRuntimeEnv();

try {
  const service = new ApiBackedVipMembershipService();
  const state = await service.loadMembershipState();

  assert.equal(state.isAuthenticated, true);
  assert.equal(state.current?.ownerUserId, 'vip-contract-user');
  assert.equal(state.current?.planName, 'Pro');
  assert.equal(state.packageGroups.length, 1);
  assert.equal(state.packageGroups[0]?.id, 'vip-contract-group');
  assert.equal(currentRetrieveCalls, 1);
  assert.equal(packageGroupsListCalls, 1);

  const defaultServices = createDefaultBirdCoderIdeServices();
  assert.equal(
    typeof defaultServices.vipMembershipService.loadMembershipState,
    'function',
    'default IDE services must expose vipMembershipService through the canonical service bundle.',
  );
} finally {
  restoreRuntimeEnv();
  configureSdkworkMembershipAppServiceProvider(null);
  configureSdkworkMembershipSessionTokenProvider(null);
}

console.log('default IDE services vip membership service contract passed.');
