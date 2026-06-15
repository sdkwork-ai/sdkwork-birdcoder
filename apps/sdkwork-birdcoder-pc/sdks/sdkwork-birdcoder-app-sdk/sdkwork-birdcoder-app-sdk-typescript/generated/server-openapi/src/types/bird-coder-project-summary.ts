export interface BirdCoderProjectSummary {
  createdAt: string;
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  /** DATABASE_SPEC.md standard data scope. */
  dataScope?: 'DEFAULT' | 'PRIVATE' | 'ORGANIZATION' | 'TENANT' | 'PUBLIC';
  workspaceId: string;
  workspaceUuid?: string;
  userId?: string;
  parentId?: string;
  parentUuid?: string;
  parentMetadata?: Record<string, unknown>;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  rootPath?: string;
  sitePath?: string;
  domainPrefix?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  author?: string;
  fileId?: string;
  conversationId?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  budgetAmount?: string;
  coverImage?: Record<string, unknown>;
  isTemplate?: boolean;
  collaboratorCount?: number;
  status: 'active' | 'archived';
  updatedAt: string;
  viewerRole?: 'owner' | 'admin' | 'member' | 'viewer';
}
