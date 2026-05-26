import type { BirdCoderIamPolicySummary } from '@sdkwork/birdcoder-types';

export interface IAdminPolicyService {
  getPolicies(): Promise<BirdCoderIamPolicySummary[]>;
}
