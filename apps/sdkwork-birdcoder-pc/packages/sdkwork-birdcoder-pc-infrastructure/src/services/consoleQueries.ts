import { isBlank } from '@sdkwork/utils/string';
import { MAX_LIST_PAGE_SIZE } from '@sdkwork/utils/pagination';
import type {
  BirdCoderCreateProjectRequest,
  BirdCoderCreateWorkspaceRequest,
  BirdCoderLongIntegerString,
  BirdCoderUpdateProjectRequest,
  BirdCoderUpdateWorkspaceRequest,
} from '@sdkwork/birdcoder-pc-types';
import {
  buildBirdCoderProjectBusinessCode,
  buildBirdCoderProjectBusinessName,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderConsoleRepositories,
  BirdCoderRepresentativeAuditRecord,
  BirdCoderRepresentativeDeploymentRecord,
  BirdCoderRepresentativeDeploymentTargetRecord,
  BirdCoderRepresentativePolicyRecord,
  BirdCoderProjectListPage,
  BirdCoderRepresentativeProjectDocumentRecord,
  BirdCoderRepresentativeProjectRecord,
  BirdCoderRepresentativeReleaseRecord,
  BirdCoderRepresentativeTeamMemberRecord,
  BirdCoderRepresentativeTeamRecord,
  BirdCoderWorkspaceRecord,
} from '../storage/appConsoleRepository.ts';
import {
  BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
  BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID,
  BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
  ensureBirdCoderBootstrapWorkspace,
} from '../storage/bootstrapConsoleCatalog.ts';
import { createBirdCoderLocalBusinessUuid } from './localBusinessUuid.ts';
import { createBirdCoderLocalEntityId } from './localEntityId.ts';

export interface BirdCoderConsoleQueries {
  createProject(
    request: BirdCoderCreateProjectRequest,
  ): Promise<BirdCoderRepresentativeProjectRecord>;
  createWorkspace(
    request: BirdCoderCreateWorkspaceRequest,
  ): Promise<BirdCoderWorkspaceRecord>;
  deleteProject(projectId: string): Promise<{
    id: string;
  }>;
  deleteWorkspace(workspaceId: string): Promise<{
    id: string;
  }>;
  listAuditEvents(): Promise<BirdCoderRepresentativeAuditRecord[]>;
  listDeployments(): Promise<BirdCoderRepresentativeDeploymentRecord[]>;
  listDeploymentTargets(options?: {
    projectId?: string;
  }): Promise<BirdCoderRepresentativeDeploymentTargetRecord[]>;
  listDocuments(): Promise<BirdCoderRepresentativeProjectDocumentRecord[]>;
  listPolicies(): Promise<BirdCoderRepresentativePolicyRecord[]>;
  getProject(projectId: string): Promise<BirdCoderRepresentativeProjectRecord | null>;
  listProjectPage(options: {
    page: number;
    pageSize: number;
    workspaceId?: string;
  }): Promise<BirdCoderProjectListPage>;
  listReleases(): Promise<BirdCoderRepresentativeReleaseRecord[]>;
  listTeamMembers(options?: {
    teamId?: string;
  }): Promise<BirdCoderRepresentativeTeamMemberRecord[]>;
  listTeams(options?: {
    workspaceId?: string;
  }): Promise<BirdCoderRepresentativeTeamRecord[]>;
  listWorkspacePage(options: {
    page: number;
    pageSize: number;
  }): Promise<{
    items: BirdCoderWorkspaceRecord[];
    total: number;
  }>;
  listWorkspaces(): Promise<BirdCoderWorkspaceRecord[]>;
  updateProject(
    projectId: string,
    request: BirdCoderUpdateProjectRequest,
  ): Promise<BirdCoderRepresentativeProjectRecord>;
  updateWorkspace(
    workspaceId: string,
    request: BirdCoderUpdateWorkspaceRequest,
  ): Promise<BirdCoderWorkspaceRecord>;
}

export interface CreateBirdCoderConsoleQueriesOptions {
  repositories: BirdCoderConsoleRepositories;
}

function filterByWorkspaceId<
  TRecord extends {
    workspaceId: string;
  },
>(records: readonly TRecord[], workspaceId: string | undefined): TRecord[] {
  const normalizedWorkspaceId = workspaceId?.trim();
  if (!normalizedWorkspaceId) {
    return [...records];
  }

  return records.filter((record) => record.workspaceId === normalizedWorkspaceId);
}

function filterByTeamId<
  TRecord extends {
    teamId: string;
  },
>(records: readonly TRecord[], teamId: string | undefined): TRecord[] {
  const normalizedTeamId = teamId?.trim();
  if (!normalizedTeamId) {
    return [...records];
  }

  return records.filter((record) => record.teamId === normalizedTeamId);
}

function filterByProjectId<
  TRecord extends {
    projectId: string;
  },
>(records: readonly TRecord[], projectId: string | undefined): TRecord[] {
  const normalizedProjectId = projectId?.trim();
  if (!normalizedProjectId) {
    return [...records];
  }

  return records.filter((record) => record.projectId === normalizedProjectId);
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function createUuid(): string {
  return createBirdCoderLocalBusinessUuid();
}

const MAX_PROJECT_LIST_OFFSET = 200_000;

function resolveProjectPageOffset(page: number, pageSize: number): number {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error('Project list page must be a positive integer.');
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_LIST_PAGE_SIZE) {
    throw new Error(`Project list pageSize must be between 1 and ${MAX_LIST_PAGE_SIZE}.`);
  }

  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > MAX_PROJECT_LIST_OFFSET) {
    throw new Error('Project list page exceeds the supported offset range.');
  }
  return offset;
}

async function loadRepresentativeProjectsPage(
  repositories: BirdCoderConsoleRepositories,
  workspaceId: string | undefined,
  offset: number,
  pageSize: number,
): Promise<BirdCoderProjectListPage> {
  const normalizedWorkspaceId = workspaceId?.trim();

  if (normalizedWorkspaceId) {
    if (!repositories.projects.listProjectsByWorkspaceIds) {
      throw new Error(
        'Workspace-scoped project listing requires a repository that pushes the workspace predicate into storage.',
      );
    }

    return repositories.projects.listProjectsByWorkspaceIds(
      [normalizedWorkspaceId],
      { offset, limit: pageSize },
    );
  }

  if (repositories.projects.listProjectRecordsPage) {
    return repositories.projects.listProjectRecordsPage({ offset, limit: pageSize });
  }

  throw new Error(
    'Representative project listing requires SQL-backed listProjectsByWorkspaceIds or listProjectRecordsPage.',
  );
}

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : undefined;
}

function normalizeOptionalNumber(
  value: number | null | undefined,
  fieldName: string,
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`BirdCoder console int field ${fieldName} must be an integer.`);
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `BirdCoder console int field ${fieldName} received an unsafe JavaScript number; pass a safe integer instead.`,
    );
  }

  return value;
}

function normalizeOptionalLongInteger(
  fieldName: string,
  value: unknown,
): BirdCoderLongIntegerString | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' && isBlank(value)) {
    return undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error(`BirdCoder console Long field ${fieldName} must be an exact decimal string.`);
  }

  try {
    return stringifyBirdCoderLongInteger(value);
  } catch (error) {
    throw new Error(
      `BirdCoder console Long field ${fieldName} is invalid: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function normalizeOptionalBoolean(value: boolean | null | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeOptionalObject(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? { ...value } : undefined;
}

function normalizeRequiredText(value: string | null | undefined, fieldName: string): string {
  const normalizedValue = normalizeOptionalText(value);
  if (!normalizedValue) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalizedValue;
}

async function deleteProjectsForWorkspace(
  repositories: BirdCoderConsoleRepositories,
  workspaceId: string,
): Promise<void> {
  const projects = (await repositories.projects.list()).filter(
    (project) => project.workspaceId === workspaceId,
  );
  for (const project of projects) {
    await repositories.projects.delete(project.id);
  }

  const projectIds = new Set(projects.map((project) => project.id));
  const projectContents = await repositories.projectContents.list();
  for (const projectContent of projectContents) {
    if (projectIds.has(projectContent.projectId)) {
      await repositories.projectContents.delete(projectContent.id);
    }
  }

  const documents = await repositories.documents.list();
  for (const document of documents) {
    if (projectIds.has(document.projectId)) {
      await repositories.documents.delete(document.id);
    }
  }

  const targets = await repositories.targets.list();
  const targetIds = new Set<string>();
  for (const target of targets) {
    if (projectIds.has(target.projectId)) {
      targetIds.add(target.id);
      await repositories.targets.delete(target.id);
    }
  }

  const deployments = await repositories.deployments.list();
  for (const deployment of deployments) {
    if (projectIds.has(deployment.projectId) || targetIds.has(deployment.targetId)) {
      await repositories.deployments.delete(deployment.id);
    }
  }
}

export function createBirdCoderConsoleQueries({
  repositories,
}: CreateBirdCoderConsoleQueriesOptions): BirdCoderConsoleQueries {
  return {
    async createWorkspace(
      request: BirdCoderCreateWorkspaceRequest,
    ): Promise<BirdCoderWorkspaceRecord> {
      await ensureBirdCoderBootstrapWorkspace({ repositories });
      const name = normalizeRequiredText(request.name, 'name');
      const ownerId =
        normalizeOptionalText(request.ownerId) ?? BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID;
      const createdByUserId =
        normalizeOptionalText(request.createdByUserId) ?? ownerId;
      const now = createTimestamp();
      const workspaceRecord = await repositories.workspaces.save({
        id: createBirdCoderLocalEntityId('workspace'),
        uuid: createUuid(),
        tenantId: normalizeOptionalText(request.tenantId) ?? BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
        organizationId:
          normalizeOptionalText(request.organizationId) ?? BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
        dataScope: normalizeOptionalText(request.dataScope) ?? 'PRIVATE',
        code: normalizeOptionalText(request.code) ?? name,
        title: normalizeOptionalText(request.title) ?? name,
        name,
        description: normalizeOptionalText(request.description),
        icon: normalizeOptionalText(request.icon) ?? 'Folder',
        color: normalizeOptionalText(request.color),
        ownerId,
        leaderId: normalizeOptionalText(request.leaderId) ?? ownerId,
        createdByUserId,
        type: normalizeOptionalText(request.type) ?? 'DEFAULT',
        startTime: normalizeOptionalText(request.startTime),
        endTime: normalizeOptionalText(request.endTime),
        maxMembers: normalizeOptionalNumber(request.maxMembers, 'maxMembers'),
        currentMembers: normalizeOptionalNumber(request.currentMembers, 'currentMembers'),
        memberCount: normalizeOptionalNumber(request.memberCount, 'memberCount'),
        maxStorage: normalizeOptionalLongInteger('maxStorage', request.maxStorage),
        usedStorage: normalizeOptionalLongInteger('usedStorage', request.usedStorage),
        settings: normalizeOptionalObject(request.settings) ?? {},
        isPublic: normalizeOptionalBoolean(request.isPublic) ?? false,
        isTemplate: normalizeOptionalBoolean(request.isTemplate) ?? false,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      const defaultTeamId = createBirdCoderLocalEntityId('team');
      await repositories.teams.save({
        id: defaultTeamId,
        uuid: createUuid(),
        tenantId: workspaceRecord.tenantId,
        organizationId: workspaceRecord.organizationId,
        workspaceId: workspaceRecord.id,
        code: `${workspaceRecord.code ?? workspaceRecord.id}-owners`,
        title: `${workspaceRecord.name} Owners`,
        name: `${workspaceRecord.name} Owners`,
        description: 'Default workspace owner team.',
        ownerId: workspaceRecord.ownerId,
        leaderId: workspaceRecord.leaderId,
        createdByUserId: workspaceRecord.createdByUserId,
        metadata: { source: 'local-console-bootstrap' },
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      await repositories.members.save({
        id: createBirdCoderLocalEntityId('team-member'),
        uuid: createUuid(),
        tenantId: workspaceRecord.tenantId,
        organizationId: workspaceRecord.organizationId,
        teamId: defaultTeamId,
        userId: workspaceRecord.ownerId ?? ownerId,
        role: 'owner',
        status: 'active',
        createdByUserId: workspaceRecord.createdByUserId ?? workspaceRecord.ownerId ?? ownerId,
        grantedByUserId: workspaceRecord.createdByUserId ?? workspaceRecord.ownerId ?? ownerId,
        createdAt: now,
        updatedAt: now,
      });

      return workspaceRecord;
    },
    async updateWorkspace(
      workspaceId: string,
      request: BirdCoderUpdateWorkspaceRequest,
    ): Promise<BirdCoderWorkspaceRecord> {
      const normalizedWorkspaceId = normalizeRequiredText(workspaceId, 'workspaceId');
      const existingWorkspace = await repositories.workspaces.findById(normalizedWorkspaceId);
      if (!existingWorkspace) {
        throw new Error(`Workspace ${normalizedWorkspaceId} was not found.`);
      }

      return repositories.workspaces.save({
        ...existingWorkspace,
        name: normalizeOptionalText(request.name) ?? existingWorkspace.name,
        description:
          request.description === undefined
            ? existingWorkspace.description
            : normalizeOptionalText(request.description),
        dataScope: normalizeOptionalText(request.dataScope) ?? existingWorkspace.dataScope,
        code: normalizeOptionalText(request.code) ?? existingWorkspace.code,
        title: normalizeOptionalText(request.title) ?? existingWorkspace.title,
        icon:
          request.icon === undefined
            ? existingWorkspace.icon
            : normalizeOptionalText(request.icon),
        color:
          request.color === undefined
            ? existingWorkspace.color
            : normalizeOptionalText(request.color),
        ownerId: normalizeOptionalText(request.ownerId) ?? existingWorkspace.ownerId,
        leaderId: normalizeOptionalText(request.leaderId) ?? existingWorkspace.leaderId,
        createdByUserId:
          normalizeOptionalText(request.createdByUserId) ?? existingWorkspace.createdByUserId,
        type: normalizeOptionalText(request.type) ?? existingWorkspace.type,
        startTime:
          request.startTime === undefined
            ? existingWorkspace.startTime
            : normalizeOptionalText(request.startTime),
        endTime:
          request.endTime === undefined
            ? existingWorkspace.endTime
            : normalizeOptionalText(request.endTime),
        maxMembers:
          request.maxMembers === undefined
            ? existingWorkspace.maxMembers
            : normalizeOptionalNumber(request.maxMembers, 'maxMembers'),
        currentMembers:
          request.currentMembers === undefined
            ? existingWorkspace.currentMembers
            : normalizeOptionalNumber(request.currentMembers, 'currentMembers'),
        memberCount:
          request.memberCount === undefined
            ? existingWorkspace.memberCount
            : normalizeOptionalNumber(request.memberCount, 'memberCount'),
        maxStorage:
          request.maxStorage === undefined
            ? existingWorkspace.maxStorage
            : normalizeOptionalLongInteger('maxStorage', request.maxStorage),
        usedStorage:
          request.usedStorage === undefined
            ? existingWorkspace.usedStorage
            : normalizeOptionalLongInteger('usedStorage', request.usedStorage),
        settings:
          request.settings === undefined
            ? existingWorkspace.settings
            : normalizeOptionalObject(request.settings),
        isPublic:
          request.isPublic === undefined
            ? existingWorkspace.isPublic
            : normalizeOptionalBoolean(request.isPublic),
        isTemplate:
          request.isTemplate === undefined
            ? existingWorkspace.isTemplate
            : normalizeOptionalBoolean(request.isTemplate),
        status: normalizeOptionalText(request.status) ?? existingWorkspace.status,
        updatedAt: createTimestamp(),
      });
    },
    async deleteWorkspace(workspaceId: string): Promise<{ id: string }> {
      const normalizedWorkspaceId = normalizeRequiredText(workspaceId, 'workspaceId');
      const existingWorkspace = await repositories.workspaces.findById(normalizedWorkspaceId);
      if (!existingWorkspace) {
        throw new Error(`Workspace ${normalizedWorkspaceId} was not found.`);
      }

      await repositories.workspaces.delete(normalizedWorkspaceId);
      await deleteProjectsForWorkspace(repositories, normalizedWorkspaceId);

      const teams = await repositories.teams.list();
      const teamIds = new Set<string>();
      for (const team of teams) {
        if (team.workspaceId === normalizedWorkspaceId) {
          teamIds.add(team.id);
          await repositories.teams.delete(team.id);
        }
      }

      const members = await repositories.members.list();
      for (const member of members) {
        if (teamIds.has(member.teamId)) {
          await repositories.members.delete(member.id);
        }
      }

      return {
        id: normalizedWorkspaceId,
      };
    },
    async listWorkspaces(): Promise<BirdCoderWorkspaceRecord[]> {
      await ensureBirdCoderBootstrapWorkspace({ repositories });
      return repositories.workspaces.list();
    },
    async listWorkspacePage({ page, pageSize }) {
      await ensureBirdCoderBootstrapWorkspace({ repositories });
      return repositories.workspaces.listPage(
        resolveProjectPageOffset(page, pageSize),
        pageSize,
      );
    },
    async listAuditEvents(): Promise<BirdCoderRepresentativeAuditRecord[]> {
      return repositories.audits.list();
    },
    async listDeployments(): Promise<BirdCoderRepresentativeDeploymentRecord[]> {
      return repositories.deployments.list();
    },
    async listDeploymentTargets(
      options = {},
    ): Promise<BirdCoderRepresentativeDeploymentTargetRecord[]> {
      return filterByProjectId(await repositories.targets.list(), options.projectId);
    },
    async listDocuments(): Promise<BirdCoderRepresentativeProjectDocumentRecord[]> {
      return repositories.documents.list();
    },
    async listPolicies(): Promise<BirdCoderRepresentativePolicyRecord[]> {
      return repositories.policies.list();
    },
    async getProject(projectId: string): Promise<BirdCoderRepresentativeProjectRecord | null> {
      await ensureBirdCoderBootstrapWorkspace({ repositories });
      const normalizedProjectId = normalizeRequiredText(projectId, 'projectId');
      return repositories.projects.findById(normalizedProjectId);
    },
    async listProjectPage({ page, pageSize, workspaceId }): Promise<BirdCoderProjectListPage> {
      await ensureBirdCoderBootstrapWorkspace({ repositories });
      const storagePage = await loadRepresentativeProjectsPage(
        repositories,
        workspaceId,
        resolveProjectPageOffset(page, pageSize),
        pageSize,
      );

      return {
        items: storagePage.items,
        total: storagePage.total,
      };
    },
    async createProject(
      request: BirdCoderCreateProjectRequest,
    ): Promise<BirdCoderRepresentativeProjectRecord> {
      await ensureBirdCoderBootstrapWorkspace({ repositories });
      const workspaceId = normalizeRequiredText(request.workspaceId, 'workspaceId');
      const workspaceRecord = await repositories.workspaces.findById(workspaceId);
      if (!workspaceRecord) {
        throw new Error(`Workspace ${workspaceId} was not found.`);
      }

      const name = normalizeRequiredText(request.name, 'name');
      const ownerId =
        workspaceRecord.ownerId ??
        BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID;
      const createdByUserId =
        workspaceRecord.createdByUserId ??
        ownerId;
      const now = createTimestamp();
      const projectId = createBirdCoderLocalEntityId('project');
      const projectBusinessName = buildBirdCoderProjectBusinessName({
        name,
        projectId,
      });
      return repositories.projects.save({
        id: projectId,
        uuid: createUuid(),
        tenantId: workspaceRecord.tenantId ?? BIRDCODER_DEFAULT_LOCAL_TENANT_ID,
        organizationId:
          workspaceRecord.organizationId ?? BIRDCODER_DEFAULT_LOCAL_ORGANIZATION_ID,
        dataScope: workspaceRecord.dataScope ?? 'PRIVATE',
        workspaceId,
        workspaceUuid: workspaceRecord.uuid,
        userId: createdByUserId,
        parentId: '0',
        parentUuid: '0',
        parentMetadata: {},
        name: projectBusinessName,
        code: buildBirdCoderProjectBusinessCode({ name, projectId }),
        title: name,
        description: normalizeOptionalText(request.description),
        ownerId,
        leaderId: ownerId,
        createdByUserId,
        author: createdByUserId,
        type: 'CODE',
        isTemplate: false,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    },
    async updateProject(
      projectId: string,
      request: BirdCoderUpdateProjectRequest,
    ): Promise<BirdCoderRepresentativeProjectRecord> {
      const normalizedProjectId = normalizeRequiredText(projectId, 'projectId');
      const existingProject = await repositories.projects.findById(normalizedProjectId);
      if (!existingProject) {
        throw new Error(`Project ${normalizedProjectId} was not found.`);
      }

      return repositories.projects.save({
        ...existingProject,
        name:
          request.name === undefined
            ? existingProject.name
            : buildBirdCoderProjectBusinessName({
                name: normalizeOptionalText(request.name) ?? existingProject.title ?? existingProject.name,
                projectId: existingProject.id,
              }),
        description:
          request.description === undefined
            ? existingProject.description
            : normalizeOptionalText(request.description),
        title:
          normalizeOptionalText(request.name) ??
          existingProject.title,
        status: request.status ?? existingProject.status,
        updatedAt: createTimestamp(),
      });
    },
    async deleteProject(projectId: string): Promise<{ id: string }> {
      const normalizedProjectId = normalizeRequiredText(projectId, 'projectId');
      const existingProject = await repositories.projects.findById(normalizedProjectId);
      if (!existingProject) {
        throw new Error(`Project ${normalizedProjectId} was not found.`);
      }

      await repositories.projects.delete(normalizedProjectId);
      const projectContents = await repositories.projectContents.list();
      for (const projectContent of projectContents) {
        if (projectContent.projectId === normalizedProjectId) {
          await repositories.projectContents.delete(projectContent.id);
        }
      }

      const documents = await repositories.documents.list();
      for (const document of documents) {
        if (document.projectId === normalizedProjectId) {
          await repositories.documents.delete(document.id);
        }
      }

      const targets = await repositories.targets.list();
      const targetIds = new Set<string>();
      for (const target of targets) {
        if (target.projectId === normalizedProjectId) {
          targetIds.add(target.id);
          await repositories.targets.delete(target.id);
        }
      }

      const deployments = await repositories.deployments.list();
      for (const deployment of deployments) {
        if (
          deployment.projectId === normalizedProjectId ||
          targetIds.has(deployment.targetId)
        ) {
          await repositories.deployments.delete(deployment.id);
        }
      }

      return {
        id: normalizedProjectId,
      };
    },
    async listTeamMembers(options = {}): Promise<BirdCoderRepresentativeTeamMemberRecord[]> {
      return filterByTeamId(await repositories.members.list(), options.teamId);
    },
    async listTeams(options = {}): Promise<BirdCoderRepresentativeTeamRecord[]> {
      return filterByWorkspaceId(await repositories.teams.list(), options.workspaceId);
    },
    async listReleases(): Promise<BirdCoderRepresentativeReleaseRecord[]> {
      return repositories.releases.list();
    },
  };
}
