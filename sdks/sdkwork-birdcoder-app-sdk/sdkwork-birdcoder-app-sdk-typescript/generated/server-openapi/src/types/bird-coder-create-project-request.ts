export interface BirdCoderCreateProjectRequest {
  description?: string;
  name: string;
  workspaceUuid?: string;
  tenantId?: string;
  organizationId?: string;
  /** DATABASE_SPEC.md standard data scope. */
  dataScope?: 'workspace' | 'project' | 'user' | 'team' | 'organization';
  userId?: string;
  parentId?: string;
  parentUuid?: string;
  parentMetadata?: Record<string, unknown>;
  code?: string;
  title?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  author?: string;
  type?: string;
  rootPath?: string;
  sitePath?: string;
  domainPrefix?: string;
  fileId?: string;
  conversationId?: string;
  startTime?: string;
  endTime?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  budgetAmount?: string;
  coverImage?: Record<string, unknown>;
  isTemplate?: boolean;
  appTemplateVersionId?: string;
  templatePresetKey?: string;
  status?: 'active' | 'archived';
  workspaceId: string;
}
