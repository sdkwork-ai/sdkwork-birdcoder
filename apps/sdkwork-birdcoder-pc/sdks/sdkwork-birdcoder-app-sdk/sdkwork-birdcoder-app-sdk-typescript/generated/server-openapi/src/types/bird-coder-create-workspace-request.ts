export interface BirdCoderCreateWorkspaceRequest {
  description?: string;
  name: string;
  tenantId?: string;
  organizationId?: string;
  /** DATABASE_SPEC.md standard data scope. */
  dataScope?: 'DEFAULT' | 'PRIVATE' | 'ORGANIZATION' | 'TENANT' | 'PUBLIC';
  code?: string;
  title?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  icon?: string;
  color?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  maxMembers?: number;
  currentMembers?: number;
  memberCount?: number;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  maxStorage?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  usedStorage?: string;
  settings?: Record<string, unknown>;
  isPublic?: boolean;
  isTemplate?: boolean;
}
