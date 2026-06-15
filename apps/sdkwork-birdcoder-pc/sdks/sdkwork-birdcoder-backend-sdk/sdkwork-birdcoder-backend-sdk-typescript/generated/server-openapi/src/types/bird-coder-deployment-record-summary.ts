export interface BirdCoderDeploymentRecordSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId: string;
  targetId: string;
  releaseRecordId?: string;
  status: 'planned' | 'running' | 'succeeded' | 'failed' | 'rolled_back';
  endpointUrl?: string;
  startedAt?: string;
  completedAt?: string;
}
