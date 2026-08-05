import type { BirdCoderIamPolicySummary } from '@sdkwork/birdcoder-pc-contracts-commons';

export type AgentEngineSandboxAccessMode = 'all-drives' | 'directories' | 'read-only';
export type AgentEngineSandboxScopeType = 'tenant' | 'user';

export interface SaveAgentEngineSandboxPolicyInput {
  accessMode: AgentEngineSandboxAccessMode;
  allowedDirectories?: string[];
  policyId?: string;
  scopeId: string;
  scopeType: AgentEngineSandboxScopeType;
}

export interface IAdminPolicyService {
  deleteSandboxPolicy(policyId: string): Promise<void>;
  getPolicies(): Promise<BirdCoderIamPolicySummary[]>;
  saveSandboxPolicy(input: SaveAgentEngineSandboxPolicyInput): Promise<BirdCoderIamPolicySummary>;
}
