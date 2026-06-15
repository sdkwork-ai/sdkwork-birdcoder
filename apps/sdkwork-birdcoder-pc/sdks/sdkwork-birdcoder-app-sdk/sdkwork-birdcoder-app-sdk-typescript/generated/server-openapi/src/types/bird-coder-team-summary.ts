export interface BirdCoderTeamSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  workspaceId: string;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
  status: 'active' | 'archived';
}
