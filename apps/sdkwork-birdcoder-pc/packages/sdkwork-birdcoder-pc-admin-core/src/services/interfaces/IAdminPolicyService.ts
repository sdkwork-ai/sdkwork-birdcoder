import type { BirdCoderIamPolicySummary } from '@sdkwork/birdcoder-pc-types';

export interface IAdminPolicyService {
  getPolicies(): Promise<BirdCoderIamPolicySummary[]>;
}
