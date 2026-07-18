import type { BirdCoderIamPolicySummary } from '@sdkwork/birdcoder-pc-contracts-commons';

export type CodeEngineSandboxAccessMode = 'all-drives' | 'directories' | 'read-only';
export type CodeEngineSandboxScopeType = 'tenant' | 'user';

export interface SaveCodeEngineSandboxPolicyInput {
  accessMode: CodeEngineSandboxAccessMode;
  allowedDirectories?: string[];
  policyId?: string;
  scopeId: string;
  scopeType: CodeEngineSandboxScopeType;
}

export interface IAdminPolicyService {
  deleteSandboxPolicy(policyId: string): Promise<void>;
  getPolicies(): Promise<BirdCoderIamPolicySummary[]>;
  saveSandboxPolicy(input: SaveCodeEngineSandboxPolicyInput): Promise<BirdCoderIamPolicySummary>;
}
