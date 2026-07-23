export interface BirdCoderWorkspaceSummary {
  id: string;
  uuid: string;
  tenantId: string;
  organizationId: string;
  ownerUserId: string;
  createdByUserId: string;
  code: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  color: string | null;
  visibility: 'private' | 'organization';
  status: 'active' | 'archived';
  /** Optimistic concurrency version used with the If-Match request header. */
  version: string;
  createdAt: string;
  updatedAt: string;
}
