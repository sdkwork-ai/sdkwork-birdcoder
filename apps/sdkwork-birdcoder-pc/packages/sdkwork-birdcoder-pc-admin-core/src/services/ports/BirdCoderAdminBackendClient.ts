import type {
  BirdCoderDeploymentRecordSummary,
  BirdCoderIamAuditEventSummary,
  BirdCoderIamPolicySummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  BirdCoderCreateIamPolicyRequest,
  BirdCoderUpdateIamPolicyRequest,
} from '@sdkwork/birdcoder-backend-sdk';

export interface BirdCoderAdminBackendClient {
  createPolicy(input: BirdCoderCreateIamPolicyRequest): Promise<BirdCoderIamPolicySummary>;
  deletePolicy(policyId: string): Promise<void>;
  listGovernanceDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listPolicies(): Promise<BirdCoderIamPolicySummary[]>;
  listAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]>;
  updatePolicy(
    policyId: string,
    input: BirdCoderUpdateIamPolicyRequest,
  ): Promise<BirdCoderIamPolicySummary>;
}
