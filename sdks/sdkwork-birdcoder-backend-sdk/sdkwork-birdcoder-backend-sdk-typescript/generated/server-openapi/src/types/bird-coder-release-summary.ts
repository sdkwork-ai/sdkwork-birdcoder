export interface BirdCoderReleaseSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  releaseVersion: string;
  /** Known values include formal, canary, hotfix, rollback. */
  releaseKind: string;
  rolloutStage: string;
  manifest?: Record<string, unknown>;
  /** Known values include pending, ready, running, succeeded, failed, rolled_back. */
  status: string;
}
