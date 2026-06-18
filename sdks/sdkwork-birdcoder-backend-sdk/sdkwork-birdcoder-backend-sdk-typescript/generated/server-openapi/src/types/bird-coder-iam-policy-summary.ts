export interface BirdCoderIamPolicySummary {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  policy: Record<string, unknown>;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}
