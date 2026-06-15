export interface BirdCoderUpdateProjectRequest {
  description?: string;
  /** DATABASE_SPEC.md standard data scope. */
  dataScope?: 'DEFAULT' | 'PRIVATE' | 'ORGANIZATION' | 'TENANT' | 'PUBLIC';
  userId?: string;
  parentId?: string;
  parentUuid?: string;
  parentMetadata?: Record<string, unknown>;
  code?: string;
  title?: string;
  name?: string;
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
  status?: 'active' | 'archived';
}
