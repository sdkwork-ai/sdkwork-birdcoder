import {
  createBirdCoderTableRecordRepository,
  type BirdCoderStorageAccess,
  type BirdCoderTableRecordRepository,
} from './dataKernel.ts';
import { coerceBirdCoderSqlEntityRow } from './sqlRowCodec.ts';
import {
  BIRDCODER_GOVERNANCE_POLICY_STORAGE_BINDING,
  BIRDCODER_DEPLOYMENT_TARGET_STORAGE_BINDING,
  BIRDCODER_DEPLOYMENT_RECORD_STORAGE_BINDING,
  BIRDCODER_PROJECT_STORAGE_BINDING,
  BIRDCODER_PROJECT_DOCUMENT_STORAGE_BINDING,
  BIRDCODER_RELEASE_RECORD_STORAGE_BINDING,
  BIRDCODER_AUDIT_EVENT_STORAGE_BINDING,
  BIRDCODER_TEAM_STORAGE_BINDING,
  BIRDCODER_TEAM_MEMBER_STORAGE_BINDING,
  BIRDCODER_WORKSPACE_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
  type BirdCoderDatabaseProviderId,
} from '@sdkwork/birdcoder-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sortByUpdatedAtDescending<
  TRecord extends {
    id: string;
    updatedAt: string;
  },
>(left: TRecord, right: TRecord): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

const DEFAULT_LOCAL_OWNER_USER_ID = '100000000000000001';
const DEFAULT_LOCAL_TENANT_ID = '0';
const DEFAULT_LOCAL_ORGANIZATION_ID = '0';
const DEFAULT_PRIVATE_DATA_SCOPE = 'PRIVATE';
const DEFAULT_TREE_ROOT_ID = '0';
const DEFAULT_TREE_ROOT_UUID = '0';

export interface BirdCoderWorkspaceRecord {
  createdAt: string;
  description?: string;
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  dataScope?: string;
  code?: string;
  title?: string;
  name: string;
  icon?: string;
  color?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  maxMembers?: number;
  currentMembers?: number;
  memberCount?: number;
  maxStorage?: number;
  usedStorage?: number;
  settings?: Record<string, unknown>;
  isPublic?: boolean;
  isTemplate?: boolean;
  status: string;
  updatedAt: string;
}

export interface BirdCoderRepresentativeProjectRecord {
  createdAt: string;
  description?: string;
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  dataScope?: string;
  name: string;
  workspaceUuid?: string;
  userId?: string;
  parentId?: string;
  parentUuid?: string;
  parentMetadata?: Record<string, unknown>;
  code?: string;
  title?: string;
  sitePath?: string;
  domainPrefix?: string;
  rootPath?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  author?: string;
  fileId?: string;
  conversationId?: string;
  type?: string;
  coverImage?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  budgetAmount?: number;
  isTemplate?: boolean;
  status: string;
  updatedAt: string;
  workspaceId: string;
}

export interface BirdCoderRepresentativeProjectDocumentRecord {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  documentKind: string;
  slug: string;
  title: string;
  bodyRef?: string;
  status: string;
}

export interface BirdCoderRepresentativeDeploymentRecord {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  targetId: string;
  releaseRecordId?: string;
  status: string;
  endpointUrl?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BirdCoderRepresentativeDeploymentTargetRecord {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  name: string;
  environmentKey: string;
  runtime: string;
  status: string;
}

export interface BirdCoderRepresentativeTeamRecord {
  createdAt: string;
  description?: string;
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  code?: string;
  title?: string;
  name: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
  status: string;
  updatedAt: string;
  workspaceId: string;
}

export interface BirdCoderRepresentativeTeamMemberRecord {
  createdAt: string;
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  userId: string;
  role: string;
  status: string;
  teamId: string;
  createdByUserId?: string;
  grantedByUserId?: string;
  updatedAt: string;
}

export interface BirdCoderRepresentativeReleaseRecord {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  releaseKind: string;
  releaseVersion: string;
  rolloutStage: string;
  manifest: Record<string, unknown>;
  status: string;
}

export interface BirdCoderRepresentativeAuditRecord {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  scopeId: string;
  scopeType: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface BirdCoderRepresentativePolicyRecord {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  scopeId: string;
  scopeType: string;
  policyCategory: string;
  targetId: string;
  targetType: string;
  approvalPolicy: string;
  rationale?: string;
  status: string;
}

export interface BirdCoderRepresentativeAppAdminRepositories {
  audits: BirdCoderTableRecordRepository<BirdCoderRepresentativeAuditRecord>;
  deployments: BirdCoderTableRecordRepository<BirdCoderRepresentativeDeploymentRecord>;
  targets: BirdCoderTableRecordRepository<BirdCoderRepresentativeDeploymentTargetRecord>;
  documents: BirdCoderTableRecordRepository<BirdCoderRepresentativeProjectDocumentRecord>;
  members: BirdCoderTableRecordRepository<BirdCoderRepresentativeTeamMemberRecord>;
  policies: BirdCoderTableRecordRepository<BirdCoderRepresentativePolicyRecord>;
  projects: BirdCoderTableRecordRepository<BirdCoderRepresentativeProjectRecord>;
  releases: BirdCoderTableRecordRepository<BirdCoderRepresentativeReleaseRecord>;
  teams: BirdCoderTableRecordRepository<BirdCoderRepresentativeTeamRecord>;
}

export interface BirdCoderConsoleRepositories
  extends BirdCoderRepresentativeAppAdminRepositories {
  workspaces: BirdCoderTableRecordRepository<BirdCoderWorkspaceRecord>;
}

export interface CreateBirdCoderRepresentativeAppAdminRepositoriesOptions {
  providerId: BirdCoderDatabaseProviderId;
  storage: BirdCoderStorageAccess;
}

function normalizeCanonicalOwnerId(
  value: Partial<{
    ownerId: string;
  }>,
  fallback = DEFAULT_LOCAL_OWNER_USER_ID,
): string {
  const canonicalOwnerId =
    typeof value.ownerId === 'string' && value.ownerId.trim().length > 0
      ? value.ownerId.trim()
      : fallback;
  return canonicalOwnerId;
}

function normalizeCanonicalCreatedByUserId(
  value: Partial<{
    createdByUserId: string;
  }>,
  fallbackOwnerId: string,
): string {
  if (typeof value.createdByUserId === 'string' && value.createdByUserId.trim().length > 0) {
    return value.createdByUserId.trim();
  }
  return fallbackOwnerId;
}

function normalizeOptionalTextValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeOptionalNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function normalizeOptionalBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true' || normalizedValue === '1') {
      return true;
    }
    if (normalizedValue === 'false' || normalizedValue === '0') {
      return false;
    }
  }

  return undefined;
}

function normalizeOptionalJsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(value);
    return isRecord(parsedValue) ? parsedValue : undefined;
  } catch {
    return undefined;
  }
}

function normalizeWorkspaceRecord(value: unknown): BirdCoderWorkspaceRecord | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string') {
    const ownerId = normalizeCanonicalOwnerId(value);
    return {
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      description: typeof value.description === 'string' ? value.description : undefined,
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId:
        typeof value.tenantId === 'string' ? value.tenantId : DEFAULT_LOCAL_TENANT_ID,
      organizationId:
        typeof value.organizationId === 'string'
          ? value.organizationId
          : DEFAULT_LOCAL_ORGANIZATION_ID,
      dataScope:
        typeof value.dataScope === 'string' ? value.dataScope : DEFAULT_PRIVATE_DATA_SCOPE,
      code: typeof value.code === 'string' ? value.code : undefined,
      title: typeof value.title === 'string' ? value.title : undefined,
      name: value.name,
      icon: normalizeOptionalTextValue(value.icon),
      color: normalizeOptionalTextValue(value.color),
      ownerId,
      leaderId:
        typeof value.leaderId === 'string' && value.leaderId.trim().length > 0
          ? value.leaderId
          : ownerId,
      createdByUserId: normalizeCanonicalCreatedByUserId(value, ownerId),
      type: typeof value.type === 'string' ? value.type : undefined,
      startTime: normalizeOptionalTextValue(value.startTime),
      endTime: normalizeOptionalTextValue(value.endTime),
      maxMembers: normalizeOptionalNumberValue(value.maxMembers),
      currentMembers: normalizeOptionalNumberValue(value.currentMembers),
      memberCount: normalizeOptionalNumberValue(value.memberCount),
      maxStorage: normalizeOptionalNumberValue(value.maxStorage),
      usedStorage: normalizeOptionalNumberValue(value.usedStorage),
      settings: normalizeOptionalJsonRecord(value.settings),
      isPublic: normalizeOptionalBooleanValue(value.isPublic),
      isTemplate: normalizeOptionalBooleanValue(value.isTemplate),
      status: typeof value.status === 'string' ? value.status : 'active',
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('workspace'), value);
  if (!row || typeof row.name !== 'string') {
    return null;
  }

  const ownerId = normalizeCanonicalOwnerId({
    ownerId: typeof row.owner_id === 'string' ? row.owner_id : undefined,
  });

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId:
      typeof row.tenant_id === 'string' ? row.tenant_id : DEFAULT_LOCAL_TENANT_ID,
    organizationId:
      typeof row.organization_id === 'string'
        ? row.organization_id
        : DEFAULT_LOCAL_ORGANIZATION_ID,
    dataScope:
      typeof (row as { data_scope?: unknown }).data_scope === 'string'
        ? String((row as { data_scope: unknown }).data_scope)
        : DEFAULT_PRIVATE_DATA_SCOPE,
    code: typeof row.code === 'string' ? row.code : undefined,
    title: typeof row.title === 'string' ? row.title : undefined,
    name: String(row.name),
    description: typeof row.description === 'string' ? row.description : undefined,
    icon: normalizeOptionalTextValue(row.icon),
    color: normalizeOptionalTextValue(row.color),
    ownerId,
    leaderId:
      typeof row.leader_id === 'string' && row.leader_id.trim().length > 0
        ? row.leader_id
        : ownerId,
    createdByUserId: normalizeCanonicalCreatedByUserId(
      {
        createdByUserId:
          typeof (row as { created_by_user_id?: unknown }).created_by_user_id === 'string'
            ? String((row as { created_by_user_id: unknown }).created_by_user_id)
            : undefined,
      },
      ownerId,
    ),
    type: typeof row.type === 'string' ? row.type : undefined,
    startTime: normalizeOptionalTextValue(row.start_time),
    endTime: normalizeOptionalTextValue(row.end_time),
    maxMembers: normalizeOptionalNumberValue(row.max_members),
    currentMembers: normalizeOptionalNumberValue(row.current_members),
    memberCount: normalizeOptionalNumberValue(row.member_count),
    maxStorage: normalizeOptionalNumberValue(row.max_storage),
    usedStorage: normalizeOptionalNumberValue(row.used_storage),
    settings: normalizeOptionalJsonRecord((row as { settings_json?: unknown }).settings_json),
    isPublic: normalizeOptionalBooleanValue((row as { is_public?: unknown }).is_public),
    isTemplate: normalizeOptionalBooleanValue((row as { is_template?: unknown }).is_template),
    status: typeof row.status === 'string' ? row.status : 'active',
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function workspaceToRow(value: BirdCoderWorkspaceRecord): Record<string, unknown> {
  const ownerId = normalizeCanonicalOwnerId(value);
  const createdByUserId = normalizeCanonicalCreatedByUserId(value, ownerId);
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? DEFAULT_LOCAL_TENANT_ID,
    organization_id: value.organizationId ?? DEFAULT_LOCAL_ORGANIZATION_ID,
    data_scope: value.dataScope ?? DEFAULT_PRIVATE_DATA_SCOPE,
    name: value.name,
    code: value.code ?? null,
    title: value.title ?? value.name,
    description: value.description ?? null,
    icon: value.icon ?? null,
    color: value.color ?? null,
    owner_id: ownerId,
    leader_id: value.leaderId ?? value.ownerId ?? ownerId,
    created_by_user_id: createdByUserId,
    type: value.type ?? 'DEFAULT',
    start_time: value.startTime ?? null,
    end_time: value.endTime ?? null,
    max_members: value.maxMembers ?? null,
    current_members: value.currentMembers ?? null,
    member_count: value.memberCount ?? null,
    max_storage: value.maxStorage ?? null,
    used_storage: value.usedStorage ?? null,
    settings_json: value.settings ? JSON.stringify(value.settings) : null,
    is_public: value.isPublic ?? false,
    is_template: value.isTemplate ?? false,
    status: value.status,
  };
}

function normalizeProjectRecord(value: unknown): BirdCoderRepresentativeProjectRecord | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.workspaceId === 'string') {
    const ownerId = normalizeCanonicalOwnerId(value);
    const createdByUserId = normalizeCanonicalCreatedByUserId(value, ownerId);
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId:
        typeof value.tenantId === 'string' ? value.tenantId : DEFAULT_LOCAL_TENANT_ID,
      organizationId:
        typeof value.organizationId === 'string'
          ? value.organizationId
          : DEFAULT_LOCAL_ORGANIZATION_ID,
      dataScope:
        typeof value.dataScope === 'string' ? value.dataScope : DEFAULT_PRIVATE_DATA_SCOPE,
      workspaceId: value.workspaceId,
      workspaceUuid:
        typeof value.workspaceUuid === 'string' ? value.workspaceUuid : undefined,
      userId:
        typeof value.userId === 'string' && value.userId.trim().length > 0
          ? value.userId
          : createdByUserId,
      parentId:
        typeof value.parentId === 'string' && value.parentId.trim().length > 0
          ? value.parentId
          : DEFAULT_TREE_ROOT_ID,
      parentUuid:
        typeof value.parentUuid === 'string' && value.parentUuid.trim().length > 0
          ? value.parentUuid
          : DEFAULT_TREE_ROOT_UUID,
      parentMetadata: normalizeOptionalJsonRecord(value.parentMetadata),
      name: typeof value.name === 'string' ? value.name : value.id,
      code: typeof value.code === 'string' ? value.code : undefined,
      title: typeof value.title === 'string' ? value.title : undefined,
      description: typeof value.description === 'string' ? value.description : undefined,
      sitePath: normalizeOptionalTextValue(value.sitePath),
      domainPrefix: normalizeOptionalTextValue(value.domainPrefix),
      rootPath: typeof value.rootPath === 'string' ? value.rootPath : undefined,
      ownerId,
      leaderId:
        typeof value.leaderId === 'string' && value.leaderId.trim().length > 0
          ? value.leaderId
          : ownerId,
      createdByUserId,
      author:
        typeof value.author === 'string' && value.author.trim().length > 0
          ? value.author
          : createdByUserId,
      fileId: normalizeOptionalTextValue(value.fileId),
      conversationId: normalizeOptionalTextValue(value.conversationId),
      type: typeof value.type === 'string' ? value.type : undefined,
      coverImage: normalizeOptionalJsonRecord(value.coverImage),
      startTime: normalizeOptionalTextValue(value.startTime),
      endTime: normalizeOptionalTextValue(value.endTime),
      budgetAmount: normalizeOptionalNumberValue(value.budgetAmount),
      isTemplate: normalizeOptionalBooleanValue(value.isTemplate),
      status: typeof value.status === 'string' ? value.status : 'active',
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('project'), value);
  if (!row || typeof row.workspace_id !== 'string' || typeof row.name !== 'string') {
    return null;
  }

  const ownerId = normalizeCanonicalOwnerId({
    ownerId: typeof row.owner_id === 'string' ? row.owner_id : undefined,
  });
  const createdByUserId = normalizeCanonicalCreatedByUserId(
    {
      createdByUserId:
        typeof (row as { created_by_user_id?: unknown }).created_by_user_id === 'string'
          ? String((row as { created_by_user_id: unknown }).created_by_user_id)
          : undefined,
    },
    ownerId,
  );

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId:
      typeof row.tenant_id === 'string' ? row.tenant_id : DEFAULT_LOCAL_TENANT_ID,
    organizationId:
      typeof row.organization_id === 'string'
        ? row.organization_id
        : DEFAULT_LOCAL_ORGANIZATION_ID,
    dataScope:
      typeof (row as { data_scope?: unknown }).data_scope === 'string'
        ? String((row as { data_scope: unknown }).data_scope)
        : DEFAULT_PRIVATE_DATA_SCOPE,
    workspaceId: String(row.workspace_id),
    workspaceUuid: typeof row.workspace_uuid === 'string' ? row.workspace_uuid : undefined,
    userId:
      typeof (row as { user_id?: unknown }).user_id === 'string'
        ? String((row as { user_id: unknown }).user_id)
        : createdByUserId,
    parentId:
      typeof (row as { parent_id?: unknown }).parent_id === 'string'
        ? String((row as { parent_id: unknown }).parent_id)
        : DEFAULT_TREE_ROOT_ID,
    parentUuid:
      typeof (row as { parent_uuid?: unknown }).parent_uuid === 'string'
        ? String((row as { parent_uuid: unknown }).parent_uuid)
        : DEFAULT_TREE_ROOT_UUID,
    parentMetadata: normalizeOptionalJsonRecord(
      (row as { parent_metadata?: unknown }).parent_metadata,
    ),
    name: String(row.name),
    code: typeof row.code === 'string' ? row.code : undefined,
    title: typeof row.title === 'string' ? row.title : undefined,
    description: typeof row.description === 'string' ? row.description : undefined,
    sitePath: normalizeOptionalTextValue((row as { site_path?: unknown }).site_path),
    domainPrefix: normalizeOptionalTextValue((row as { domain_prefix?: unknown }).domain_prefix),
    rootPath: typeof row.root_path === 'string' ? row.root_path : undefined,
    ownerId,
    leaderId:
      typeof row.leader_id === 'string' && row.leader_id.trim().length > 0
        ? row.leader_id
        : ownerId,
    createdByUserId,
    author:
      typeof row.author === 'string' && row.author.trim().length > 0
        ? row.author
        : createdByUserId,
    fileId: normalizeOptionalTextValue((row as { file_id?: unknown }).file_id),
    conversationId: normalizeOptionalTextValue(
      (row as { conversation_id?: unknown }).conversation_id,
    ),
    type: typeof row.type === 'string' ? row.type : undefined,
    coverImage: normalizeOptionalJsonRecord(
      (row as { cover_image_json?: unknown }).cover_image_json,
    ),
    startTime: normalizeOptionalTextValue((row as { start_time?: unknown }).start_time),
    endTime: normalizeOptionalTextValue((row as { end_time?: unknown }).end_time),
    budgetAmount: normalizeOptionalNumberValue((row as { budget_amount?: unknown }).budget_amount),
    isTemplate: normalizeOptionalBooleanValue((row as { is_template?: unknown }).is_template),
    status: String(row.status ?? 'active'),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function projectToRow(value: BirdCoderRepresentativeProjectRecord): Record<string, unknown> {
  const ownerId = normalizeCanonicalOwnerId(value, '');
  const createdByUserId = normalizeCanonicalCreatedByUserId(value, ownerId);
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? DEFAULT_LOCAL_TENANT_ID,
    organization_id: value.organizationId ?? DEFAULT_LOCAL_ORGANIZATION_ID,
    data_scope: value.dataScope ?? DEFAULT_PRIVATE_DATA_SCOPE,
    workspace_id: value.workspaceId,
    workspace_uuid: value.workspaceUuid ?? null,
    user_id: (value.userId ?? createdByUserId) || null,
    parent_id: value.parentId ?? DEFAULT_TREE_ROOT_ID,
    parent_uuid: value.parentUuid ?? DEFAULT_TREE_ROOT_UUID,
    parent_metadata: value.parentMetadata ? JSON.stringify(value.parentMetadata) : null,
    name: value.name,
    code: value.code ?? null,
    title: value.title ?? value.name,
    description: value.description ?? null,
    site_path: value.sitePath ?? null,
    domain_prefix: value.domainPrefix ?? null,
    root_path: value.rootPath ?? null,
    cover_image_json: value.coverImage ? JSON.stringify(value.coverImage) : null,
    owner_id: ownerId || null,
    leader_id: (value.leaderId ?? value.ownerId ?? ownerId) || null,
    created_by_user_id: createdByUserId || null,
    author: (value.author ?? createdByUserId ?? ownerId) || null,
    file_id: value.fileId ?? null,
    conversation_id: value.conversationId ?? null,
    type: value.type ?? 'CODE',
    start_time: value.startTime ?? null,
    end_time: value.endTime ?? null,
    budget_amount: value.budgetAmount ?? null,
    is_template: value.isTemplate ?? false,
    status: value.status,
  };
}

function normalizeDocumentRecord(value: unknown): BirdCoderRepresentativeProjectDocumentRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.documentKind === 'string' &&
    typeof value.title === 'string' &&
    typeof value.slug === 'string'
  ) {
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
      projectId: value.projectId,
      documentKind: value.documentKind,
      title: value.title,
      slug: value.slug,
      bodyRef: typeof value.bodyRef === 'string' ? value.bodyRef : undefined,
      status: typeof value.status === 'string' ? value.status : 'active',
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('project_document'), value);
  if (
    !row ||
    typeof row.project_id !== 'string' ||
    typeof row.document_kind !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.slug !== 'string'
  ) {
    return null;
  }

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId: typeof row.organization_id === 'string' ? row.organization_id : undefined,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    projectId: String(row.project_id),
    documentKind: String(row.document_kind),
    title: String(row.title),
    slug: String(row.slug),
    bodyRef: typeof row.body_ref === 'string' ? row.body_ref : undefined,
    status: String(row.status ?? 'active'),
  };
}

function documentToRow(value: BirdCoderRepresentativeProjectDocumentRecord): Record<string, unknown> {
  return {
    id: value.id,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    project_id: value.projectId,
    document_kind: value.documentKind,
    title: value.title,
    slug: value.slug,
    body_ref: value.bodyRef ?? null,
    status: value.status,
  };
}

function normalizeDeploymentRecord(
  value: unknown,
): BirdCoderRepresentativeDeploymentRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.targetId === 'string'
  ) {
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
      projectId: value.projectId,
      targetId: value.targetId,
      releaseRecordId:
        typeof value.releaseRecordId === 'string' ? value.releaseRecordId : undefined,
      endpointUrl: typeof value.endpointUrl === 'string' ? value.endpointUrl : undefined,
      status: typeof value.status === 'string' ? value.status : 'planned',
      startedAt: typeof value.startedAt === 'string' ? value.startedAt : undefined,
      completedAt: typeof value.completedAt === 'string' ? value.completedAt : undefined,
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('deployment_record'), value);
  if (!row || typeof row.project_id !== 'string' || typeof row.target_id !== 'string') {
    return null;
  }

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId: typeof row.organization_id === 'string' ? row.organization_id : undefined,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    projectId: String(row.project_id),
    targetId: String(row.target_id),
    releaseRecordId:
      typeof row.release_record_id === 'string' ? row.release_record_id : undefined,
    endpointUrl: typeof row.endpoint_url === 'string' ? row.endpoint_url : undefined,
    status: String(row.status ?? 'planned'),
    startedAt: typeof row.started_at === 'string' ? row.started_at : undefined,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : undefined,
  };
}

function deploymentToRow(value: BirdCoderRepresentativeDeploymentRecord): Record<string, unknown> {
  return {
    id: value.id,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    project_id: value.projectId,
    target_id: value.targetId,
    release_record_id: value.releaseRecordId ?? null,
    status: value.status,
    endpoint_url: value.endpointUrl ?? null,
    started_at: value.startedAt ?? null,
    completed_at: value.completedAt ?? null,
  };
}

function normalizeDeploymentTargetRecord(
  value: unknown,
): BirdCoderRepresentativeDeploymentTargetRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.name === 'string'
  ) {
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
      projectId: value.projectId,
      name: value.name,
      environmentKey:
        typeof value.environmentKey === 'string' ? value.environmentKey : 'dev',
      runtime: typeof value.runtime === 'string' ? value.runtime : 'web',
      status: typeof value.status === 'string' ? value.status : 'active',
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('deployment_target'), value);
  if (
    !row ||
    typeof row.project_id !== 'string' ||
    typeof row.name !== 'string'
  ) {
    return null;
  }

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId: typeof row.organization_id === 'string' ? row.organization_id : undefined,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    projectId: String(row.project_id),
    name: String(row.name),
    environmentKey: String(row.environment_key ?? 'dev'),
    runtime: String(row.runtime ?? 'web'),
    status: String(row.status ?? 'active'),
  };
}

function deploymentTargetToRow(
  value: BirdCoderRepresentativeDeploymentTargetRecord,
): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    project_id: value.projectId,
    name: value.name,
    environment_key: value.environmentKey,
    runtime: value.runtime,
    status: value.status,
  };
}

function normalizeTeamRecord(value: unknown): BirdCoderRepresentativeTeamRecord | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.workspaceId === 'string') {
    const ownerId = normalizeCanonicalOwnerId(value, '');
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId:
        typeof value.organizationId === 'string' ? value.organizationId : undefined,
      workspaceId: value.workspaceId,
      code: typeof value.code === 'string' ? value.code : undefined,
      title: typeof value.title === 'string' ? value.title : undefined,
      name: typeof value.name === 'string' ? value.name : value.id,
      description: typeof value.description === 'string' ? value.description : undefined,
      ownerId: ownerId || undefined,
      leaderId:
        typeof value.leaderId === 'string' && value.leaderId.trim().length > 0
          ? value.leaderId
          : ownerId || undefined,
      createdByUserId: normalizeCanonicalCreatedByUserId(value, ownerId) || undefined,
      metadata: isRecord(value.metadata) ? value.metadata : undefined,
      status: typeof value.status === 'string' ? value.status : 'active',
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('team'), value);
  if (!row || typeof row.workspace_id !== 'string' || typeof row.name !== 'string') {
    return null;
  }

  const ownerId = normalizeCanonicalOwnerId({
    ownerId: typeof row.owner_id === 'string' ? row.owner_id : undefined,
  }, '');

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId:
      typeof row.organization_id === 'string' ? row.organization_id : undefined,
    workspaceId: String(row.workspace_id),
    code: typeof row.code === 'string' ? row.code : undefined,
    title: typeof row.title === 'string' ? row.title : undefined,
    name: String(row.name),
    description: typeof row.description === 'string' ? row.description : undefined,
    ownerId: ownerId || undefined,
    leaderId:
      typeof row.leader_id === 'string' && row.leader_id.trim().length > 0
        ? row.leader_id
        : ownerId || undefined,
    createdByUserId:
      normalizeCanonicalCreatedByUserId(
        {
          createdByUserId:
            typeof (row as { created_by_user_id?: unknown }).created_by_user_id === 'string'
              ? String((row as { created_by_user_id: unknown }).created_by_user_id)
              : undefined,
        },
        ownerId,
      ) || undefined,
    metadata:
      isRecord((row as { metadata_json?: unknown }).metadata_json) &&
      (row as { metadata_json: unknown }).metadata_json !== null
        ? ((row as { metadata_json: unknown }).metadata_json as Record<string, unknown>)
        : undefined,
    status: String(row.status ?? 'active'),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function teamToRow(value: BirdCoderRepresentativeTeamRecord): Record<string, unknown> {
  const ownerId = normalizeCanonicalOwnerId(value, '');
  const createdByUserId = normalizeCanonicalCreatedByUserId(value, ownerId);
  return {
    id: value.id,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    workspace_id: value.workspaceId,
    name: value.name,
    code: value.code ?? null,
    title: value.title ?? value.name,
    description: value.description ?? null,
    owner_id: ownerId || null,
    leader_id: (value.leaderId ?? value.ownerId ?? ownerId) || null,
    created_by_user_id: createdByUserId || null,
    metadata_json: value.metadata ?? null,
    status: value.status,
  };
}

function normalizeTeamMemberRecord(
  value: unknown,
): BirdCoderRepresentativeTeamMemberRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.teamId === 'string' &&
    typeof value.userId === 'string'
  ) {
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId:
        typeof value.organizationId === 'string' ? value.organizationId : undefined,
      teamId: value.teamId,
      userId: value.userId,
      role: typeof value.role === 'string' ? value.role : 'member',
      status: typeof value.status === 'string' ? value.status : 'active',
      createdByUserId:
        typeof value.createdByUserId === 'string' ? value.createdByUserId : undefined,
      grantedByUserId:
        typeof value.grantedByUserId === 'string' ? value.grantedByUserId : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('team_member'), value);
  if (
    !row ||
    typeof row.team_id !== 'string' ||
    typeof row.user_id !== 'string'
  ) {
    return null;
  }

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId:
      typeof row.organization_id === 'string' ? row.organization_id : undefined,
    teamId: String(row.team_id),
    userId: String(row.user_id),
    role: String(row.role ?? 'member'),
    status: String(row.status ?? 'active'),
    createdByUserId:
      typeof (row as { created_by_user_id?: unknown }).created_by_user_id === 'string'
        ? String((row as { created_by_user_id: unknown }).created_by_user_id)
        : undefined,
    grantedByUserId:
      typeof (row as { granted_by_user_id?: unknown }).granted_by_user_id === 'string'
        ? String((row as { granted_by_user_id: unknown }).granted_by_user_id)
        : undefined,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function teamMemberToRow(value: BirdCoderRepresentativeTeamMemberRecord): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    team_id: value.teamId,
    user_id: value.userId,
    role: value.role,
    created_by_user_id: value.createdByUserId ?? null,
    granted_by_user_id: value.grantedByUserId ?? null,
    status: value.status,
  };
}

function normalizeReleaseRecord(value: unknown): BirdCoderRepresentativeReleaseRecord | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.releaseVersion === 'string') {
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
      releaseVersion: value.releaseVersion,
      releaseKind: typeof value.releaseKind === 'string' ? value.releaseKind : 'formal',
      rolloutStage: typeof value.rolloutStage === 'string' ? value.rolloutStage : 'canary',
      manifest: isRecord(value.manifest) ? value.manifest : {},
      status: typeof value.status === 'string' ? value.status : 'ready',
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('release_record'), value);
  if (!row || typeof row.release_version !== 'string' || typeof row.release_kind !== 'string') {
    return null;
  }

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId: typeof row.organization_id === 'string' ? row.organization_id : undefined,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    releaseVersion: String(row.release_version),
    releaseKind: String(row.release_kind),
    rolloutStage: String(row.rollout_stage ?? 'canary'),
    manifest: isRecord(row.manifest_json) ? row.manifest_json : {},
    status: String(row.status ?? 'ready'),
  };
}

function releaseToRow(value: BirdCoderRepresentativeReleaseRecord): Record<string, unknown> {
  return {
    id: value.id,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    release_version: value.releaseVersion,
    release_kind: value.releaseKind,
    rollout_stage: value.rolloutStage,
    manifest_json: value.manifest,
    status: value.status,
  };
}

function normalizeAuditRecord(value: unknown): BirdCoderRepresentativeAuditRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.scopeType === 'string' &&
    typeof value.scopeId === 'string' &&
    typeof value.eventType === 'string'
  ) {
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
      scopeType: value.scopeType,
      scopeId: value.scopeId,
      eventType: value.eventType,
      payload: isRecord(value.payload) ? value.payload : {},
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('audit_event'), value);
  if (
    !row ||
    typeof row.scope_type !== 'string' ||
    typeof row.scope_id !== 'string' ||
    typeof row.event_type !== 'string'
  ) {
    return null;
  }

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId: typeof row.organization_id === 'string' ? row.organization_id : undefined,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    scopeType: String(row.scope_type),
    scopeId: String(row.scope_id),
    eventType: String(row.event_type),
    payload: isRecord(row.payload_json) ? row.payload_json : {},
  };
}

function auditToRow(value: BirdCoderRepresentativeAuditRecord): Record<string, unknown> {
  return {
    id: value.id,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    scope_type: value.scopeType,
    scope_id: value.scopeId,
    event_type: value.eventType,
    payload_json: value.payload,
  };
}

function normalizePolicyRecord(value: unknown): BirdCoderRepresentativePolicyRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.scopeType === 'string' &&
    typeof value.scopeId === 'string' &&
    typeof value.policyCategory === 'string' &&
    typeof value.targetType === 'string' &&
    typeof value.targetId === 'string' &&
    typeof value.approvalPolicy === 'string'
  ) {
    return {
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId: typeof value.organizationId === 'string' ? value.organizationId : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
      scopeType: value.scopeType,
      scopeId: value.scopeId,
      policyCategory: value.policyCategory,
      targetType: value.targetType,
      targetId: value.targetId,
      approvalPolicy: value.approvalPolicy,
      rationale: typeof value.rationale === 'string' ? value.rationale : undefined,
      status: typeof value.status === 'string' ? value.status : 'active',
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('governance_policy'), value);
  if (
    !row ||
    typeof row.scope_type !== 'string' ||
    typeof row.scope_id !== 'string' ||
    typeof row.policy_category !== 'string' ||
    typeof row.target_type !== 'string' ||
    typeof row.target_id !== 'string' ||
    typeof row.approval_policy !== 'string'
  ) {
    return null;
  }

  return {
    id: String(row.id),
    uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId: typeof row.organization_id === 'string' ? row.organization_id : undefined,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    scopeType: String(row.scope_type),
    scopeId: String(row.scope_id),
    policyCategory: String(row.policy_category),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    approvalPolicy: String(row.approval_policy),
    rationale: typeof row.rationale === 'string' ? row.rationale : undefined,
    status: String(row.status ?? 'active'),
  };
}

function policyToRow(value: BirdCoderRepresentativePolicyRecord): Record<string, unknown> {
  return {
    id: value.id,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    scope_type: value.scopeType,
    scope_id: value.scopeId,
    policy_category: value.policyCategory,
    target_type: value.targetType,
    target_id: value.targetId,
    approval_policy: value.approvalPolicy,
    rationale: value.rationale ?? null,
    status: value.status,
  };
}

export function createBirdCoderWorkspaceRepository({
  providerId,
  storage,
}: CreateBirdCoderRepresentativeAppAdminRepositoriesOptions): BirdCoderTableRecordRepository<BirdCoderWorkspaceRecord> {
  return createBirdCoderTableRecordRepository({
    binding: BIRDCODER_WORKSPACE_STORAGE_BINDING,
    definition: getBirdCoderEntityDefinition('workspace'),
    providerId,
    storage,
    identify(value) {
      return value.id;
    },
    normalize: normalizeWorkspaceRecord,
    sort: sortByUpdatedAtDescending,
    toRow: workspaceToRow,
  });
}

export function createBirdCoderRepresentativeAppAdminRepositories({
  providerId,
  storage,
}: CreateBirdCoderRepresentativeAppAdminRepositoriesOptions): BirdCoderRepresentativeAppAdminRepositories {
  return {
    audits: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_AUDIT_EVENT_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('audit_event'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeAuditRecord,
      sort: sortByUpdatedAtDescending,
      toRow: auditToRow,
    }),
    deployments: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_DEPLOYMENT_RECORD_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('deployment_record'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeDeploymentRecord,
      sort: sortByUpdatedAtDescending,
      toRow: deploymentToRow,
    }),
    targets: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_DEPLOYMENT_TARGET_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('deployment_target'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeDeploymentTargetRecord,
      sort: sortByUpdatedAtDescending,
      toRow: deploymentTargetToRow,
    }),
    documents: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_PROJECT_DOCUMENT_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('project_document'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeDocumentRecord,
      sort: sortByUpdatedAtDescending,
      toRow: documentToRow,
    }),
    members: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_TEAM_MEMBER_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('team_member'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeTeamMemberRecord,
      sort: sortByUpdatedAtDescending,
      toRow: teamMemberToRow,
    }),
    policies: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_GOVERNANCE_POLICY_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('governance_policy'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizePolicyRecord,
      sort: sortByUpdatedAtDescending,
      toRow: policyToRow,
    }),
    projects: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_PROJECT_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('project'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeProjectRecord,
      sort: sortByUpdatedAtDescending,
      toRow: projectToRow,
    }),
    teams: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_TEAM_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('team'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeTeamRecord,
      sort: sortByUpdatedAtDescending,
      toRow: teamToRow,
    }),
    releases: createBirdCoderTableRecordRepository({
      binding: BIRDCODER_RELEASE_RECORD_STORAGE_BINDING,
      definition: getBirdCoderEntityDefinition('release_record'),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeReleaseRecord,
      sort: sortByUpdatedAtDescending,
      toRow: releaseToRow,
    }),
  };
}

export function createBirdCoderConsoleRepositories(
  options: CreateBirdCoderRepresentativeAppAdminRepositoriesOptions,
): BirdCoderConsoleRepositories {
  const representativeRepositories = createBirdCoderRepresentativeAppAdminRepositories(options);
  return {
    ...representativeRepositories,
    workspaces: createBirdCoderWorkspaceRepository(options),
  };
}
