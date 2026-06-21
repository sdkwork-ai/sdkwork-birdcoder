import type { User } from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderVipMembershipState,
  IVipMembershipService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export type {
  BirdCoderVipBenefit,
  BirdCoderVipCurrentMembership,
  BirdCoderVipMembershipState,
  BirdCoderVipPackage,
  BirdCoderVipPackageGroup,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

export type BirdCoderVipState = BirdCoderVipMembershipState;

export interface BirdCoderVipController {
  load(): Promise<BirdCoderVipState>;
  user: User | null;
}

export interface CreateBirdCoderVipControllerOptions {
  user: User | null;
  vipMembershipService: IVipMembershipService;
}

const EMPTY_VIP_STATE: BirdCoderVipState = {
  current: null,
  isAuthenticated: false,
  packageGroups: [],
};

export function createBirdCoderVipController({
  user,
  vipMembershipService,
}: CreateBirdCoderVipControllerOptions): BirdCoderVipController {
  return {
    user,
    async load() {
      if (!user) {
        return EMPTY_VIP_STATE;
      }

      return vipMembershipService.loadMembershipState();
    },
  };
}
