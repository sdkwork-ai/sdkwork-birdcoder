import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { BirdCoderProjectSummary } from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';
import { readBirdCoderApiTransportErrorHttpStatus } from '@sdkwork/birdcoder-pc-contracts-commons/apiTransportError';
import { uuid } from '@sdkwork/utils/id';

import type { BirdCoderAppSdkApiClient } from '../birdCoderSdkClient.ts';
import type {
  BindProjectWorkspaceInput,
  BirdCoderServiceListPage,
  BirdCoderServicePageRequest,
  CreateProjectOptions,
  IProjectService,
  UpdateProjectOptions,
} from '../interfaces/IProjectService.ts';
import { resolveBirdCoderServicePageRequest } from '../servicePagination.ts';

export interface ApiBackedProjectServiceOptions {
  agentProjects: AgentProjectProvisioningSdkPort;
  appClient: BirdCoderAppSdkApiClient;
}

type AgentsProjectsSdkApi = AgentsAppSdkClient['ai']['agents']['projects'];

export type AgentProjectProvisioningSdkPort = Pick<
  AgentsProjectsSdkApi,
  'create' | 'delete'
>;

function requireAgentProjectId(value: string | null | undefined): string {
  const projectId = value?.trim() ?? '';
  if (
    !projectId.startsWith('project.')
    || projectId !== value
    || /[\u0000-\u001f\u007f]/u.test(projectId)
  ) {
    throw new Error('BirdCoder project is missing its canonical Agents project reference.');
  }
  return projectId;
}

function mapProject(summary: BirdCoderProjectSummary): BirdCoderProject {
  return {
    id: summary.id,
    uuid: summary.uuid,
    tenantId: summary.tenantId,
    organizationId: summary.organizationId,
    workspaceId: summary.workspaceId,
    defaultAgentProjectId: requireAgentProjectId(summary.defaultAgentProjectId),
    userId: summary.ownerUserId,
    code: summary.code,
    title: summary.name,
    name: summary.name,
    description: summary.description ?? undefined,
    ownerId: summary.ownerUserId,
    createdByUserId: summary.createdByUserId,
    type: summary.projectKind,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    agentSessions: [],
    archived: summary.status === 'archived',
  };
}

function mapProjectPage(
  request: BirdCoderServicePageRequest,
  response: Awaited<ReturnType<BirdCoderAppSdkApiClient['intelligence']['projects']['list']>>,
): BirdCoderServiceListPage<BirdCoderProject> {
  const items = response.items.map(mapProject);
  const page = response.pageInfo.page ?? request.page;
  const pageSize = response.pageInfo.pageSize ?? request.pageSize;
  const totalItems = response.pageInfo.totalItems ?? String(items.length);
  const totalPages = response.pageInfo.totalPages ?? (items.length > 0 ? page : 0);
  return {
    items,
    pageInfo: {
      mode: 'offset',
      page,
      pageSize,
      totalItems,
      totalPages,
      hasMore: response.pageInfo.hasMore ?? page < totalPages,
    },
  };
}

export class ApiBackedProjectService implements IProjectService {
  private readonly agentProjects: AgentProjectProvisioningSdkPort;
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly versions = new Map<string, string>();

  constructor({ agentProjects, appClient }: ApiBackedProjectServiceOptions) {
    this.agentProjects = agentProjects;
    this.appClient = appClient;
  }

  async bindProjectWorkspace(
    projectId: string,
    input: BindProjectWorkspaceInput,
  ): Promise<void> {
    const current = await this.appClient.intelligence.projects.sandboxBinding
      .retrieve(projectId)
      .catch((error: unknown) => {
        if (readBirdCoderApiTransportErrorHttpStatus(error) === 404) {
          return null;
        }
        throw error;
      });
    await this.appClient.intelligence.projects.sandboxBinding.update(
      projectId,
      {
        logicalPath: input.logicalPath,
        rootEntryId: input.rootEntryId,
        sandboxId: input.sandboxId,
      },
      {
        idempotencyKey: uuid(),
        ...(current ? { ifMatch: current.version } : {}),
      },
    );
  }

  async getProjectsPage(
    workspaceId: string | undefined,
    request: BirdCoderServicePageRequest,
  ): Promise<BirdCoderServiceListPage<BirdCoderProject>> {
    resolveBirdCoderServicePageRequest(request);
    const response = await this.appClient.intelligence.projects.list({
      page: request.page,
      pageSize: request.pageSize,
      workspaceId: workspaceId?.trim() || undefined,
    });
    for (const project of response.items) {
      this.versions.set(project.id, project.version);
    }
    return mapProjectPage(request, response);
  }

  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    try {
      const project = await this.appClient.intelligence.projects.retrieve(projectId);
      this.versions.set(project.id, project.version);
      return mapProject(project);
    } catch (error) {
      if (readBirdCoderApiTransportErrorHttpStatus(error) === 404) {
        return null;
      }
      throw error;
    }
  }

  invalidateProjectReadCache(): void {
    // The generated client is authoritative and this service keeps no record cache.
  }

  async createProject(
    workspaceId: string,
    name: string,
    options: CreateProjectOptions = {},
  ): Promise<BirdCoderProject> {
    const requestedAgentProjectId = `project.${uuid()}`;
    const agentProjectResponse = await this.agentProjects.create({
      projectId: requestedAgentProjectId,
      name,
      description: options.description,
    });
    const agentProjectId = requireAgentProjectId(agentProjectResponse.projectId);
    if (agentProjectId !== requestedAgentProjectId) {
      return this.compensateAgentProject(
        agentProjectId,
        new Error('Agents returned a different project id than the requested stable id.'),
      );
    }

    try {
      const project = await this.appClient.intelligence.projects.create({
        workspaceId,
        name,
        description: options.description ?? null,
        defaultAgentProjectId: agentProjectId,
      });
      this.versions.set(project.id, project.version);
      return mapProject(project);
    } catch (error) {
      return this.compensateAgentProject(agentProjectId, error);
    }
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    await this.updateProject(projectId, { name });
  }

  async updateProject(projectId: string, updates: UpdateProjectOptions): Promise<void> {
    const version = await this.resolveVersion(projectId);
    const project = await this.appClient.intelligence.projects.update(
      projectId,
      {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.description !== undefined
          ? { description: updates.description }
          : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
      },
      { ifMatch: version },
    );
    this.versions.set(project.id, project.version);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.appClient.intelligence.projects.delete(projectId, {
      ifMatch: await this.resolveVersion(projectId),
    });
    this.versions.delete(projectId);
  }

  private async resolveVersion(projectId: string): Promise<string> {
    const knownVersion = this.versions.get(projectId);
    if (knownVersion) {
      return knownVersion;
    }
    const project = await this.appClient.intelligence.projects.retrieve(projectId);
    this.versions.set(project.id, project.version);
    return project.version;
  }

  private async compensateAgentProject(
    agentProjectId: string,
    cause: unknown,
  ): Promise<never> {
    try {
      await this.agentProjects.delete(agentProjectId);
    } catch (compensationError) {
      throw new AggregateError(
        [cause, compensationError],
        `BirdCoder project creation failed and Agents project ${agentProjectId} compensation also failed.`,
      );
    }
    throw cause;
  }
}
