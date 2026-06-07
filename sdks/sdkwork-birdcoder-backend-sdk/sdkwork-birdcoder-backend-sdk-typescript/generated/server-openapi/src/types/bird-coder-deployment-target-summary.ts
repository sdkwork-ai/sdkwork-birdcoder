export interface BirdCoderDeploymentTargetSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId: string;
  name: string;
  /** Known values include dev, test, staging, and prod. */
  environmentKey: string;
  /** Known values include web, desktop, server, container, and kubernetes. */
  runtime: string;
  status: 'active' | 'archived';
}
