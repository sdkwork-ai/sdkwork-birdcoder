export interface BirdCoderProjectSummary {
  id: string;
  uuid: string;
  tenantId: string;
  organizationId: string;
  workspaceId: string;
  ownerUserId: string;
  createdByUserId: string;
  code: string;
  name: string;
  description: string | null;
  projectKind: string;
  /** Stable sdkwork-agents project identifier; no cross-domain foreign key is created. */
  defaultAgentProjectId: string | null;
  status: 'active' | 'archived';
  /** Optimistic concurrency version used with the If-Match request header. */
  version: string;
  createdAt: string;
  updatedAt: string;
}
