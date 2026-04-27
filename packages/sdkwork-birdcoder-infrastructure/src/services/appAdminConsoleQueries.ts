import type {
  BirdCoderCreateProjectRequest,
  BirdCoderCreateWorkspaceRequest,
  BirdCoderLongIntegerString,
  BirdCoderUpdateProjectRequest,
  BirdCoderUpdateWorkspaceRequest,
} from '@sdkwork/birdcoder-types';
import {
  buildBirdCoderProjectBusinessCode,
  buildBirdCoderProjectBusinessName,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-types';
import type {
  BirdCoderConsoleRepositories,
  BirdCoderRepresentativeAuditRecord,
  BirdCoderRepresentativeDeploymentRecord,
  BirdCoderRepresentativeDeploymentTargetRecord,
  BirdCoderRepresentativePolicyRecord,
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
  ensureBirdCoderBootstrapConsoleCatalog,
} from '../storage/bootstrapConsoleCatalog.ts';
import {
  buildBirdCoderProjectContentConfigData,
  readBirdCoderProjectRootPathFromConfigData,
} from './projectContentConfigData.ts';

export interface BirdCoderAppAdminConsoleQueries {
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
  listProjects(options?: {
    rootPath?: string;
    workspaceId?: string;
  }): Promise<BirdCoderRepresentativeProjectRecord[]>;
  listReleases(): Promise<BirdCoderRepresentativeReleaseRecord[]>;
  listTeamMembers(options?: {
    teamId?: string;
  }): Promise<BirdCoderRepresentativeTeamMemberRecord[]>;
  listTeams(options?: {
    workspaceId?: string;
  }): Promise<BirdCoderRepresentativeTeamRecord[]>;
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

export interface CreateBirdCoderAppAdminConsoleQueriesOptions {
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

function createIdentifier(prefix: string): string {
  void prefix;
  const timestampPart = BigInt(Date.now()) * 1_000_000n;
  const randomPart = BigInt(Math.floor(Math.random() * 1_000_000));
  return (timestampPart + randomPart).toString();
}

function createUuid(): string {
  return crypto.randomUUID();
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
    throw new Error(`BirdCoder app/admin int field ${fieldName} must be an integer.`);
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `BirdCoder app/admin int field ${fieldName} received an unsafe JavaScript number; pass a safe integer instead.`,
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

  if (typeof value === 'string' && value.trim().length === 0) {
    return undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error(`BirdCoder app/admin Long field ${fieldName} must be an exact decimal string.`);
  }

  try {
    return stringifyBirdCoderLongInteger(value);
  } catch (error) {
    throw new Error(
      `BirdCoder app/admin Long field ${fieldName} is invalid: ${error instanceof Error ? error.message : String(error)}`,
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

function isAbsoluteProjectPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/u.test(path) || path.startsWith('\\\\') || path.startsWith('/');
}

function normalizeRequiredProjectRootPath(rootPath: string | null | undefined): string {
  const normalizedRootPath = normalizeRequiredText(rootPath, 'project rootPath');
  if (!isAbsoluteProjectPath(normalizedRootPath)) {
    throw new Error('project rootPath must be an absolute path.');
  }
  return normalizedRootPath;
}

function normalizeProjectRootPathForComparison(
  rootPath: string | null | undefined,
): string | undefined {
  const normalizedRootPath = normalizeOptionalText(rootPath);
  if (!normalizedRootPath) {
    return undefined;
  }

  const windowsPath =
    /^[a-zA-Z]:/u.test(normalizedRootPath) ||
    normalizedRootPath.includes('\\') ||
    normalizedRootPath.startsWith('\\\\');
  const normalizedSeparators = normalizedRootPath.replace(/\\/gu, '/');
  const collapsedPath = normalizedSeparators.startsWith('//')
    ? `//${normalizedSeparators.slice(2).replace(/\/+/gu, '/')}`
    : normalizedSeparators.replace(/\/+/gu, '/');
  const withoutTrailingSlash =
    collapsedPath === '/' ? collapsedPath : collapsedPath.replace(/\/+$/u, '') || collapsedPath;

  return windowsPath ? withoutTrailingSlash.toLowerCase() : withoutTrailingSlash;
}

async function findProjectContentByProjectId(
  repositories: BirdCoderConsoleRepositories,
  projectId: string,
) {
  return (
    (await repositories.projectContents.list()).find(
      (content) => content.projectId === projectId,
    ) ?? null
  );
}

function omitProjectRootPathShadow(
  projectRecord: BirdCoderRepresentativeProjectRecord,
): BirdCoderRepresentativeProjectRecord {
  const { rootPath, ...projectRecordWithoutRootPath } = projectRecord;
  void rootPath;
  return projectRecordWithoutRootPath;
}

async function upsertProjectRootPathContent(
  repositories: BirdCoderConsoleRepositories,
  project: BirdCoderRepresentativeProjectRecord,
  rootPath: string,
): Promise<void> {
  const existingContent = await findProjectContentByProjectId(repositories, project.id);
  await repositories.projectContents.save({
    id: existingContent?.id ?? project.id,
    uuid: existingContent?.uuid ?? createUuid(),
    tenantId: project.tenantId,
    organizationId: project.organizationId,
    dataScope: project.dataScope,
    userId: project.userId ?? project.createdByUserId ?? project.ownerId,
    parentId: project.parentId ?? '0',
    projectId: project.id,
    projectUuid: project.uuid ?? existingContent?.projectUuid ?? `project-${project.id}`,
    configData: buildBirdCoderProjectContentConfigData(rootPath, {
      existingConfigData: existingContent?.configData,
    }),
    contentData: existingContent?.contentData,
    metadata: existingContent?.metadata,
    contentVersion: existingContent?.contentVersion ?? '1.0',
    contentHash: existingContent?.contentHash,
    createdAt: existingContent?.createdAt ?? project.createdAt,
    updatedAt: project.updatedAt,
  });
}

async function resolveProjectRootPathsById(
  repositories: BirdCoderConsoleRepositories,
  projectIds: readonly string[],
): Promise<Map<string, string>> {
  const projectIdSet = new Set(projectIds);
  const rootPathsByProjectId = new Map<string, string>();
  const projectContents = await repositories.projectContents.list();
  for (const projectContent of projectContents) {
    if (!projectIdSet.has(projectContent.projectId)) {
      continue;
    }

    const rootPath = readBirdCoderProjectRootPathFromConfigData(projectContent.configData);
    if (rootPath && !rootPathsByProjectId.has(projectContent.projectId)) {
      rootPathsByProjectId.set(projectContent.projectId, rootPath);
    }
  }

  return rootPathsByProjectId;
}

async function hydrateProjectRootPaths(
  repositories: BirdCoderConsoleRepositories,
  projects: readonly BirdCoderRepresentativeProjectRecord[],
): Promise<BirdCoderRepresentativeProjectRecord[]> {
  if (projects.length === 0) {
    return [];
  }

  const rootPathsByProjectId = await resolveProjectRootPathsById(
    repositories,
    projects.map((project) => project.id),
  );
  return projects.map((project) => {
    const projectRecord = omitProjectRootPathShadow(project);
    const rootPath = rootPathsByProjectId.get(project.id);
    return rootPath
      ? {
          ...projectRecord,
          rootPath,
        }
      : projectRecord;
  });
}

async function findProjectByWorkspaceAndRootPath(
  repositories: BirdCoderConsoleRepositories,
  workspaceId: string,
  rootPath: string,
  excludedProjectId?: string,
): Promise<BirdCoderRepresentativeProjectRecord | null> {
  const normalizedRootPath = normalizeProjectRootPathForComparison(rootPath);
  if (!normalizedRootPath) {
    return null;
  }

  const projects = await hydrateProjectRootPaths(repositories, await repositories.projects.list());
  return (
    projects.find((project) => {
      if (project.workspaceId !== workspaceId || project.id === excludedProjectId) {
        return false;
      }
      return normalizeProjectRootPathForComparison(project.rootPath) === normalizedRootPath;
    }) ?? null
  );
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

export function createBirdCoderAppAdminConsoleQueries({
  repositories,
}: CreateBirdCoderAppAdminConsoleQueriesOptions): BirdCoderAppAdminConsoleQueries {
  return {
    async createWorkspace(
      request: BirdCoderCreateWorkspaceRequest,
    ): Promise<BirdCoderWorkspaceRecord> {
      await ensureBirdCoderBootstrapConsoleCatalog({ repositories });
      const name = normalizeRequiredText(request.name, 'name');
      const ownerId =
        normalizeOptionalText(request.ownerId) ?? BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID;
      const createdByUserId =
        normalizeOptionalText(request.createdByUserId) ?? ownerId;
      const now = createTimestamp();
      const workspaceRecord = await repositories.workspaces.save({
        id: createIdentifier('workspace'),
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

      const defaultTeamId = createIdentifier('team');
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
        id: createIdentifier('team-member'),
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
      return (await ensureBirdCoderBootstrapConsoleCatalog({ repositories })).workspaces;
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
      await ensureBirdCoderBootstrapConsoleCatalog({ repositories });
      const normalizedProjectId = normalizeRequiredText(projectId, 'projectId');
      const project = await repositories.projects.findById(normalizedProjectId);
      if (!project) {
        return null;
      }

      const hydratedProject = (
        await hydrateProjectRootPaths(repositories, [project])
      )[0];
      const rootPath = hydratedProject?.rootPath?.trim();
      return hydratedProject && rootPath && isAbsoluteProjectPath(rootPath)
        ? hydratedProject
        : null;
    },
    async listProjects(options = {}): Promise<BirdCoderRepresentativeProjectRecord[]> {
      await ensureBirdCoderBootstrapConsoleCatalog({ repositories });
      const projects = filterByWorkspaceId(
        (await hydrateProjectRootPaths(repositories, await repositories.projects.list())).filter((project) => {
          const rootPath = project.rootPath?.trim();
          return Boolean(rootPath && isAbsoluteProjectPath(rootPath));
        }),
        options.workspaceId,
      );
      const normalizedRootPath = normalizeProjectRootPathForComparison(options.rootPath);
      if (!normalizedRootPath) {
        return projects;
      }

      return projects.filter((project) => {
        return normalizeProjectRootPathForComparison(project.rootPath) === normalizedRootPath;
      });
    },
    async createProject(
      request: BirdCoderCreateProjectRequest,
    ): Promise<BirdCoderRepresentativeProjectRecord> {
      await ensureBirdCoderBootstrapConsoleCatalog({ repositories });
      const workspaceId = normalizeRequiredText(request.workspaceId, 'workspaceId');
      const workspaceRecord = await repositories.workspaces.findById(workspaceId);
      if (!workspaceRecord) {
        throw new Error(`Workspace ${workspaceId} was not found.`);
      }

      const rootPath = normalizeRequiredProjectRootPath(request.rootPath);
      const existingProject = await findProjectByWorkspaceAndRootPath(
        repositories,
        workspaceId,
        rootPath,
      );
      if (existingProject) {
        return existingProject;
      }

      const name = normalizeRequiredText(request.name, 'name');
      const ownerId =
        normalizeOptionalText(request.ownerId) ??
        workspaceRecord.ownerId ??
        BIRDCODER_DEFAULT_LOCAL_OWNER_USER_ID;
      const createdByUserId =
        normalizeOptionalText(request.createdByUserId) ??
        workspaceRecord.createdByUserId ??
        ownerId;
      const now = createTimestamp();
      const projectId = createIdentifier('project');
      const projectBusinessName = buildBirdCoderProjectBusinessName({
        name,
        projectId,
      });
      const projectRecord = await repositories.projects.save(omitProjectRootPathShadow({
        id: projectId,
        uuid: createUuid(),
        tenantId:
          normalizeOptionalText(request.tenantId) ?? workspaceRecord.tenantId,
        organizationId:
          normalizeOptionalText(request.organizationId) ?? workspaceRecord.organizationId,
        dataScope:
          normalizeOptionalText(request.dataScope) ??
          workspaceRecord.dataScope ??
          'PRIVATE',
        workspaceId,
        workspaceUuid:
          normalizeOptionalText(request.workspaceUuid) ?? workspaceRecord.uuid,
        userId: normalizeOptionalText(request.userId) ?? createdByUserId,
        parentId: normalizeOptionalText(request.parentId) ?? '0',
        parentUuid: normalizeOptionalText(request.parentUuid) ?? '0',
        parentMetadata: normalizeOptionalObject(request.parentMetadata),
        name: projectBusinessName,
        code:
          normalizeOptionalText(request.code) ??
          buildBirdCoderProjectBusinessCode({
            name,
            projectId,
            rootPath,
          }),
        title: normalizeOptionalText(request.title) ?? name,
        description: normalizeOptionalText(request.description),
        sitePath: normalizeOptionalText(request.sitePath),
        domainPrefix: normalizeOptionalText(request.domainPrefix),
        rootPath,
        ownerId,
        leaderId: normalizeOptionalText(request.leaderId) ?? ownerId,
        createdByUserId,
        author: normalizeOptionalText(request.author) ?? createdByUserId,
        fileId: normalizeOptionalText(request.fileId),
        conversationId: normalizeOptionalText(request.conversationId),
        type: normalizeOptionalText(request.type) ?? 'CODE',
        coverImage: normalizeOptionalObject(request.coverImage),
        startTime: normalizeOptionalText(request.startTime),
        endTime: normalizeOptionalText(request.endTime),
        budgetAmount: normalizeOptionalLongInteger('budgetAmount', request.budgetAmount),
        isTemplate: normalizeOptionalBoolean(request.isTemplate) ?? false,
        status: normalizeOptionalText(request.status) ?? 'active',
        createdAt: now,
        updatedAt: now,
      }));
      await upsertProjectRootPathContent(repositories, projectRecord, rootPath);
      return {
        ...projectRecord,
        rootPath,
      };
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
      const hydratedExistingProject = (
        await hydrateProjectRootPaths(repositories, [existingProject])
      )[0] ?? existingProject;

      const nextRootPath =
        request.rootPath === undefined
          ? hydratedExistingProject.rootPath
          : normalizeRequiredProjectRootPath(request.rootPath);
      const conflictingProject = nextRootPath
        ? await findProjectByWorkspaceAndRootPath(
            repositories,
            hydratedExistingProject.workspaceId,
            nextRootPath,
            normalizedProjectId,
          )
        : null;
      if (conflictingProject) {
        throw new Error(
          `Workspace already contains project "${conflictingProject.name}" for rootPath "${nextRootPath}".`,
        );
      }

      const updatedProject = await repositories.projects.save(omitProjectRootPathShadow({
        ...hydratedExistingProject,
        name:
          request.name === undefined
            ? hydratedExistingProject.name
            : buildBirdCoderProjectBusinessName({
                name: normalizeOptionalText(request.name) ?? hydratedExistingProject.title ?? hydratedExistingProject.name,
                projectId: hydratedExistingProject.id,
              }),
        description:
          request.description === undefined
            ? hydratedExistingProject.description
            : normalizeOptionalText(request.description),
        dataScope: normalizeOptionalText(request.dataScope) ?? hydratedExistingProject.dataScope,
        userId:
          request.userId === undefined
            ? hydratedExistingProject.userId
            : normalizeOptionalText(request.userId),
        parentId:
          request.parentId === undefined
            ? hydratedExistingProject.parentId
            : normalizeOptionalText(request.parentId),
        parentUuid:
          request.parentUuid === undefined
            ? hydratedExistingProject.parentUuid
            : normalizeOptionalText(request.parentUuid),
        parentMetadata:
          request.parentMetadata === undefined
            ? hydratedExistingProject.parentMetadata
            : normalizeOptionalObject(request.parentMetadata),
        code: normalizeOptionalText(request.code) ?? hydratedExistingProject.code,
        title:
          normalizeOptionalText(request.title) ??
          normalizeOptionalText(request.name) ??
          hydratedExistingProject.title,
        sitePath:
          request.sitePath === undefined
            ? hydratedExistingProject.sitePath
            : normalizeOptionalText(request.sitePath),
        domainPrefix:
          request.domainPrefix === undefined
            ? hydratedExistingProject.domainPrefix
            : normalizeOptionalText(request.domainPrefix),
        rootPath: nextRootPath,
        ownerId: normalizeOptionalText(request.ownerId) ?? hydratedExistingProject.ownerId,
        leaderId: normalizeOptionalText(request.leaderId) ?? hydratedExistingProject.leaderId,
        createdByUserId:
          normalizeOptionalText(request.createdByUserId) ?? hydratedExistingProject.createdByUserId,
        author: normalizeOptionalText(request.author) ?? hydratedExistingProject.author,
        fileId:
          request.fileId === undefined
            ? hydratedExistingProject.fileId
            : normalizeOptionalText(request.fileId),
        conversationId:
          request.conversationId === undefined
            ? hydratedExistingProject.conversationId
            : normalizeOptionalText(request.conversationId),
        type: normalizeOptionalText(request.type) ?? hydratedExistingProject.type,
        coverImage:
          request.coverImage === undefined
            ? hydratedExistingProject.coverImage
            : normalizeOptionalObject(request.coverImage),
        startTime:
          request.startTime === undefined
            ? hydratedExistingProject.startTime
            : normalizeOptionalText(request.startTime),
        endTime:
          request.endTime === undefined
            ? hydratedExistingProject.endTime
            : normalizeOptionalText(request.endTime),
        budgetAmount:
          request.budgetAmount === undefined
            ? hydratedExistingProject.budgetAmount
            : normalizeOptionalLongInteger('budgetAmount', request.budgetAmount),
        isTemplate:
          request.isTemplate === undefined
            ? hydratedExistingProject.isTemplate
            : normalizeOptionalBoolean(request.isTemplate),
        status: normalizeOptionalText(request.status) ?? hydratedExistingProject.status,
        updatedAt: createTimestamp(),
      }));
      if (nextRootPath) {
        await upsertProjectRootPathContent(repositories, updatedProject, nextRootPath);
      }
      return {
        ...updatedProject,
        rootPath: nextRootPath,
      };
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
