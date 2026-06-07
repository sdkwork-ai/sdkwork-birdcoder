export interface BirdCoderSkillInstallationSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  packageId: string;
  scopeId: string;
  scopeType: 'workspace' | 'project';
  /** Known values include active and archived. */
  status: string;
  versionId: string;
  installedAt: string;
}
