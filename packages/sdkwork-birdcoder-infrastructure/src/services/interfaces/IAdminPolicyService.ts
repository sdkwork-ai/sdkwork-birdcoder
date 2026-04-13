import type { BirdCoderAdminPolicySummary } from '@sdkwork/birdcoder-types';

export interface IAdminPolicyService {
  getPolicies(): Promise<BirdCoderAdminPolicySummary[]>;
}
