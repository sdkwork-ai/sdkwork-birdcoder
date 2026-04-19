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

export interface BirdCoderWorkspaceRecord {
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
  type?: string;
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
  name: string;
  workspaceUuid?: string;
  code?: string;
  title?: string;
  rootPath?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  author?: string;
  type?: string;
  status: string;
  updatedAt: string;
  workspaceId: string;
}

export interface BirdCoderRepresentativeProjectDocumentRecord {
  createdAt: string;
  documentKind: string;
  id: string;
  projectId: string;
  slug: string;
  status: string;
  title: string;
  updatedAt: string;
}

export interface BirdCoderRepresentativeDeploymentRecord {
  completedAt?: string;
  createdAt: string;
  endpointUrl?: string;
  id: string;
  projectId: string;
  releaseRecordId?: string;
  startedAt?: string;
  status: string;
  targetId: string;
  updatedAt: string;
}

export interface BirdCoderRepresentativeDeploymentTargetRecord {
  createdAt: string;
  environmentKey: string;
  id: string;
  name: string;
  projectId: string;
  runtime: string;
  status: string;
  updatedAt: string;
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
  status: string;
  updatedAt: string;
  workspaceId: string;
}

export interface BirdCoderRepresentativeTeamMemberRecord {
  createdAt: string;
  id: string;
  userId: string;
  role: string;
  status: string;
  teamId: string;
  updatedAt: string;
}

export interface BirdCoderRepresentativeReleaseRecord {
  createdAt: string;
  id: string;
  manifest: Record<string, unknown>;
  releaseKind: string;
  releaseVersion: string;
  rolloutStage: string;
  status: string;
  updatedAt: string;
}

export interface BirdCoderRepresentativeAuditRecord {
  createdAt: string;
  eventType: string;
  id: string;
  payload: Record<string, unknown>;
  scopeId: string;
  scopeType: string;
  updatedAt: string;
}

export interface BirdCoderRepresentativePolicyRecord {
  approvalPolicy: string;
  createdAt: string;
  id: string;
  policyCategory: string;
  rationale?: string;
  scopeId: string;
  scopeType: string;
  status: string;
  targetId: string;
  targetType: string;
  updatedAt: string;
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
  fallback = 'local-owner',
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

function normalizeWorkspaceRecord(value: unknown): BirdCoderWorkspaceRecord | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string') {
    const ownerId = normalizeCanonicalOwnerId(value);
    return {
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      description: typeof value.description === 'string' ? value.description : undefined,
      id: value.id,
      uuid: typeof value.uuid === 'string' ? value.uuid : undefined,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId:
        typeof value.organizationId === 'string' ? value.organizationId : undefined,
      code: typeof value.code === 'string' ? value.code : undefined,
      title: typeof value.title === 'string' ? value.title : undefined,
      name: value.name,
      ownerId,
      leaderId:
        typeof value.leaderId === 'string' && value.leaderId.trim().length > 0
          ? value.leaderId
          : ownerId,
      createdByUserId: normalizeCanonicalCreatedByUserId(value, ownerId),
      type: typeof value.type === 'string' ? value.type : undefined,
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
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId:
      typeof row.organization_id === 'string' ? row.organization_id : undefined,
    code: typeof row.code === 'string' ? row.code : undefined,
    title: typeof row.title === 'string' ? row.title : undefined,
    name: String(row.name),
    description: typeof row.description === 'string' ? row.description : undefined,
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
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    name: value.name,
    code: value.code ?? null,
    title: value.title ?? value.name,
    description: value.description ?? null,
    owner_id: ownerId,
    leader_id: value.leaderId ?? value.ownerId ?? ownerId,
    created_by_user_id: createdByUserId,
    type: value.type ?? 'DEFAULT',
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
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId:
        typeof value.organizationId === 'string' ? value.organizationId : undefined,
      workspaceId: value.workspaceId,
      workspaceUuid:
        typeof value.workspaceUuid === 'string' ? value.workspaceUuid : undefined,
      name: typeof value.name === 'string' ? value.name : value.id,
      code: typeof value.code === 'string' ? value.code : undefined,
      title: typeof value.title === 'string' ? value.title : undefined,
      description: typeof value.description === 'string' ? value.description : undefined,
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
      type: typeof value.type === 'string' ? value.type : undefined,
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
    tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
    organizationId:
      typeof row.organization_id === 'string' ? row.organization_id : undefined,
    workspaceId: String(row.workspace_id),
    workspaceUuid: typeof row.workspace_uuid === 'string' ? row.workspace_uuid : undefined,
    name: String(row.name),
    code: typeof row.code === 'string' ? row.code : undefined,
    title: typeof row.title === 'string' ? row.title : undefined,
    description: typeof row.description === 'string' ? row.description : undefined,
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
    type: typeof row.type === 'string' ? row.type : undefined,
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
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    workspace_id: value.workspaceId,
    workspace_uuid: value.workspaceUuid ?? null,
    name: value.name,
    code: value.code ?? null,
    title: value.title ?? value.name,
    description: value.description ?? null,
    root_path: value.rootPath ?? null,
    owner_id: ownerId || null,
    leader_id: (value.leaderId ?? value.ownerId ?? ownerId) || null,
    created_by_user_id: createdByUserId || null,
    author: (value.author ?? createdByUserId ?? ownerId) || null,
    type: value.type ?? 'CODE',
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
    return value as unknown as BirdCoderRepresentativeProjectDocumentRecord;
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
    projectId: String(row.project_id),
    documentKind: String(row.document_kind),
    title: String(row.title),
    slug: String(row.slug),
    status: String(row.status ?? 'active'),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function documentToRow(value: BirdCoderRepresentativeProjectDocumentRecord): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    project_id: value.projectId,
    document_kind: value.documentKind,
    title: value.title,
    slug: value.slug,
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
      projectId: value.projectId,
      targetId: value.targetId,
      releaseRecordId:
        typeof value.releaseRecordId === 'string' ? value.releaseRecordId : undefined,
      endpointUrl: typeof value.endpointUrl === 'string' ? value.endpointUrl : undefined,
      status: typeof value.status === 'string' ? value.status : 'planned',
      startedAt: typeof value.startedAt === 'string' ? value.startedAt : undefined,
      completedAt: typeof value.completedAt === 'string' ? value.completedAt : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('deployment_record'), value);
  if (!row || typeof row.project_id !== 'string' || typeof row.target_id !== 'string') {
    return null;
  }

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    targetId: String(row.target_id),
    releaseRecordId:
      typeof row.release_record_id === 'string' ? row.release_record_id : undefined,
    endpointUrl: typeof row.endpoint_url === 'string' ? row.endpoint_url : undefined,
    status: String(row.status ?? 'planned'),
    startedAt: typeof row.started_at === 'string' ? row.started_at : undefined,
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : undefined,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function deploymentToRow(value: BirdCoderRepresentativeDeploymentRecord): Record<string, unknown> {
  return {
    id: value.id,
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
      projectId: value.projectId,
      name: value.name,
      environmentKey:
        typeof value.environmentKey === 'string' ? value.environmentKey : 'dev',
      runtime: typeof value.runtime === 'string' ? value.runtime : 'web',
      status: typeof value.status === 'string' ? value.status : 'active',
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
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
    projectId: String(row.project_id),
    name: String(row.name),
    environmentKey: String(row.environment_key ?? 'dev'),
    runtime: String(row.runtime ?? 'web'),
    status: String(row.status ?? 'active'),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
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
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    workspace_id: value.workspaceId,
    name: value.name,
    code: value.code ?? null,
    title: value.title ?? value.name,
    description: value.description ?? null,
    owner_id: ownerId || null,
    leader_id: (value.leaderId ?? value.ownerId ?? ownerId) || null,
    created_by_user_id: createdByUserId || null,
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
      teamId: value.teamId,
      userId: value.userId,
      role: typeof value.role === 'string' ? value.role : 'member',
      status: typeof value.status === 'string' ? value.status : 'active',
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
    teamId: String(row.team_id),
    userId: String(row.user_id),
    role: String(row.role ?? 'member'),
    status: String(row.status ?? 'active'),
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
    team_id: value.teamId,
    user_id: value.userId,
    role: value.role,
    status: value.status,
  };
}

function normalizeReleaseRecord(value: unknown): BirdCoderRepresentativeReleaseRecord | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.releaseVersion === 'string') {
    return value as unknown as BirdCoderRepresentativeReleaseRecord;
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('release_record'), value);
  if (!row || typeof row.release_version !== 'string' || typeof row.release_kind !== 'string') {
    return null;
  }

  return {
    id: String(row.id),
    releaseVersion: String(row.release_version),
    releaseKind: String(row.release_kind),
    rolloutStage: String(row.rollout_stage ?? 'canary'),
    manifest: isRecord(row.manifest_json) ? row.manifest_json : {},
    status: String(row.status ?? 'ready'),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function releaseToRow(value: BirdCoderRepresentativeReleaseRecord): Record<string, unknown> {
  return {
    id: value.id,
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
      scopeType: value.scopeType,
      scopeId: value.scopeId,
      eventType: value.eventType,
      payload: isRecord(value.payload) ? value.payload : {},
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
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
    scopeType: String(row.scope_type),
    scopeId: String(row.scope_id),
    eventType: String(row.event_type),
    payload: isRecord(row.payload_json) ? row.payload_json : {},
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function auditToRow(value: BirdCoderRepresentativeAuditRecord): Record<string, unknown> {
  return {
    id: value.id,
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
      scopeType: value.scopeType,
      scopeId: value.scopeId,
      policyCategory: value.policyCategory,
      targetType: value.targetType,
      targetId: value.targetId,
      approvalPolicy: value.approvalPolicy,
      rationale: typeof value.rationale === 'string' ? value.rationale : undefined,
      status: typeof value.status === 'string' ? value.status : 'active',
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
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
    scopeType: String(row.scope_type),
    scopeId: String(row.scope_id),
    policyCategory: String(row.policy_category),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    approvalPolicy: String(row.approval_policy),
    rationale: typeof row.rationale === 'string' ? row.rationale : undefined,
    status: String(row.status ?? 'active'),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

function policyToRow(value: BirdCoderRepresentativePolicyRecord): Record<string, unknown> {
  return {
    id: value.id,
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
