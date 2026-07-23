import type {
  AgentProjectCompositionSlotRecord,
  AgentProjectRecord,
  AgentsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { AgentProjectView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { readBirdCoderApiTransportErrorHttpStatus } from '@sdkwork/birdcoder-pc-contracts-commons/apiTransportError';
import { normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

import type {
  AgentProjectPageRequest,
  AgentProjectViewPage,
  BindProjectDriveCompositionInput,
  CreateProjectOptions,
  IProjectService,
  ProjectDriveComposition,
  UpdateProjectOptions,
} from '../interfaces/IProjectService.ts';

type AgentsProjectsSdkApi = AgentsAppSdkClient['ai']['agents']['projects'];
type AgentsProjectCompositionSlotsSdkApi =
  AgentsAppSdkClient['ai']['agents']['projectCompositionSlots'];

export type AgentProjectsSdkPort = Pick<
  AgentsProjectsSdkApi,
  'archive' | 'create' | 'delete' | 'list' | 'retrieve' | 'update'
>;

export interface ApiBackedProjectServiceOptions {
  projectCompositionSlots: Pick<
    AgentsProjectCompositionSlotsSdkApi,
    'create' | 'retrieve' | 'update'
  >;
  projects: AgentProjectsSdkPort;
}

const PRIMARY_DRIVE_SLOT_ID = 'primary-drive';
const PROJECT_DRIVE_POLICY_SCHEMA = 'sdkwork.agents.project-drive/v1';

interface ProjectDrivePolicy {
  logicalPath: string;
  rootEntryId: string;
  schema: typeof PROJECT_DRIVE_POLICY_SCHEMA;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function buildProjectDrivePolicy(
  input: BindProjectDriveCompositionInput,
): ProjectDrivePolicy {
  return {
    logicalPath: input.logicalPath.trim(),
    rootEntryId: normalizeRequired(input.rootEntryId, 'Drive root entry ID'),
    schema: PROJECT_DRIVE_POLICY_SCHEMA,
  };
}

function parseProjectDrivePolicy(policyJson: string | null | undefined): ProjectDrivePolicy {
  let value: unknown;
  try {
    value = JSON.parse(policyJson ?? '');
  } catch {
    throw new Error('The Agents project Drive composition policy is invalid JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The Agents project Drive composition policy must be an object.');
  }
  const policy = value as Record<string, unknown>;
  if (
    policy.schema !== PROJECT_DRIVE_POLICY_SCHEMA ||
    typeof policy.logicalPath !== 'string' ||
    typeof policy.rootEntryId !== 'string' ||
    !policy.rootEntryId.trim()
  ) {
    throw new Error('The Agents project Drive composition policy is incompatible.');
  }
  return {
    logicalPath: policy.logicalPath.trim(),
    rootEntryId: policy.rootEntryId.trim(),
    schema: PROJECT_DRIVE_POLICY_SCHEMA,
  };
}

function mapProjectDriveComposition(
  slot: AgentProjectCompositionSlotRecord,
): ProjectDriveComposition {
  if (
    slot.slotId !== PRIMARY_DRIVE_SLOT_ID ||
    slot.slotKind !== 'drive' ||
    slot.targetModule !== 'drive' ||
    !slot.enabled
  ) {
    throw new Error('The Agents project primary Drive composition is incompatible.');
  }
  const policy = parseProjectDrivePolicy(slot.policyJson);
  return {
    driveId: normalizeRequired(slot.targetRef, 'Drive target reference'),
    logicalPath: policy.logicalPath,
    projectId: normalizeRequired(slot.projectId, 'Project ID'),
    rootEntryId: policy.rootEntryId,
    slotId: slot.slotId,
    version: slot.version,
  };
}

function mapProject(project: AgentProjectRecord): AgentProjectView {
  return {
    projectId: project.projectId,
    tenantId: project.tenantId,
    organizationId: project.organizationId,
    ownerUserId: project.ownerUserId,
    name: project.name,
    ...(project.description == null ? {} : { description: project.description }),
    visibility: project.visibility,
    status: project.status,
    driveAccessMode: project.driveAccessMode,
    ...(project.defaultAgentId == null ? {} : { defaultAgentId: project.defaultAgentId }),
    ...(project.defaultModelId == null ? {} : { defaultModelId: project.defaultModelId }),
    version: project.version,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ...(project.archivedAt ? { archivedAt: project.archivedAt } : {}),
    agentSessions: [],
  };
}

export class ApiBackedProjectService implements IProjectService {
  private readonly projectCompositionSlots: ApiBackedProjectServiceOptions['projectCompositionSlots'];
  private readonly projects: AgentProjectsSdkPort;
  private readonly versions = new Map<string, string>();

  constructor({ projectCompositionSlots, projects }: ApiBackedProjectServiceOptions) {
    this.projectCompositionSlots = projectCompositionSlots;
    this.projects = projects;
  }

  async getProjectsPage(request: AgentProjectPageRequest): Promise<AgentProjectViewPage> {
    const pagination = normalizeOffsetListQuery({
      page: request.page,
      page_size: request.pageSize,
    });
    const response = await this.projects.list({
      page: pagination.page,
      pageSize: pagination.page_size,
      ...(request.q?.trim() ? { q: request.q.trim() } : {}),
      ...(request.status ? { status: request.status } : {}),
      ...(request.includeDeleted === undefined
        ? {}
        : { includeDeleted: request.includeDeleted }),
    });
    for (const project of response.items) {
      this.versions.set(project.projectId, project.version);
    }
    return {
      items: response.items.map(mapProject),
      pageInfo: response.pageInfo,
    };
  }

  async getProjectById(projectId: string): Promise<AgentProjectView | null> {
    try {
      const project = await this.projects.retrieve(projectId);
      this.versions.set(project.projectId, project.version);
      return mapProject(project);
    } catch (error) {
      if (readBirdCoderApiTransportErrorHttpStatus(error) === 404) {
        return null;
      }
      throw error;
    }
  }

  async createProject(
    name: string,
    options: CreateProjectOptions = {},
  ): Promise<AgentProjectView> {
    const project = await this.projects.create({
      name,
      ...(options.description?.trim()
        ? { description: options.description.trim() }
        : {}),
    });
    this.versions.set(project.projectId, project.version);
    return mapProject(project);
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    await this.updateProject(projectId, { name });
  }

  async updateProject(projectId: string, updates: UpdateProjectOptions): Promise<void> {
    const project = await this.projects.update(projectId, {
      expectedVersion: await this.resolveVersion(projectId),
      ...(updates.name === undefined ? {} : { name: updates.name }),
      ...(updates.description === undefined
        ? {}
        : { description: updates.description }),
    });
    this.versions.set(project.projectId, project.version);
  }

  async archiveProject(projectId: string): Promise<void> {
    const project = await this.projects.archive(projectId, {
      expectedVersion: await this.resolveVersion(projectId),
    });
    this.versions.set(project.projectId, project.version);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.projects.delete(projectId);
    this.versions.delete(projectId);
  }

  async bindProjectDrive(
    projectId: string,
    input: BindProjectDriveCompositionInput,
  ): Promise<ProjectDriveComposition> {
    const normalizedProjectId = normalizeRequired(projectId, 'Project ID');
    const driveId = normalizeRequired(input.driveId, 'Drive target reference');
    const policyJson = JSON.stringify(buildProjectDrivePolicy(input));
    const current = await this.projectCompositionSlots
      .retrieve(normalizedProjectId, PRIMARY_DRIVE_SLOT_ID)
      .catch((error: unknown) => {
        if (readBirdCoderApiTransportErrorHttpStatus(error) === 404) {
          return null;
        }
        throw error;
      });
    const slot = current
      ? await this.projectCompositionSlots.update(
          normalizedProjectId,
          PRIMARY_DRIVE_SLOT_ID,
          {
            enabled: true,
            expectedVersion: current.version,
            policyJson,
            slotKind: 'drive',
            targetModule: 'drive',
            targetRef: driveId,
          },
        )
      : await this.projectCompositionSlots.create(normalizedProjectId, {
          enabled: true,
          policyJson,
          slotId: PRIMARY_DRIVE_SLOT_ID,
          slotKind: 'drive',
          targetModule: 'drive',
          targetRef: driveId,
        });
    return mapProjectDriveComposition(slot);
  }

  async getProjectDrive(projectId: string): Promise<ProjectDriveComposition | null> {
    const normalizedProjectId = normalizeRequired(projectId, 'Project ID');
    const slot = await this.projectCompositionSlots
      .retrieve(normalizedProjectId, PRIMARY_DRIVE_SLOT_ID)
      .catch((error: unknown) => {
        if (readBirdCoderApiTransportErrorHttpStatus(error) === 404) {
          return null;
        }
        throw error;
      });
    return slot ? mapProjectDriveComposition(slot) : null;
  }

  private async resolveVersion(projectId: string): Promise<string> {
    const knownVersion = this.versions.get(projectId);
    if (knownVersion) {
      return knownVersion;
    }
    const project = await this.projects.retrieve(projectId);
    this.versions.set(project.projectId, project.version);
    return project.version;
  }
}
