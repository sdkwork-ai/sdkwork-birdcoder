import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderCommitProjectGitChangesRequest, BirdCoderCreateProjectGitBranchRequest, BirdCoderCreateProjectGitWorktreeRequest, BirdCoderCreateProjectRequest, BirdCoderCreateProjectRuntimeLocationRequest, BirdCoderCreateWorkspaceRequest, BirdCoderDeploymentRecordSummary, BirdCoderDeploymentTargetSummary, BirdCoderProjectCollaboratorSummary, BirdCoderProjectGitDiff, BirdCoderProjectGitOverview, BirdCoderProjectPublishResult, BirdCoderProjectRuntimeLocation, BirdCoderProjectRuntimeLocationCommandAccepted, BirdCoderProjectRuntimeLocationPreference, BirdCoderProjectSummary, BirdCoderProjectWorkspaceBinding, BirdCoderPruneProjectGitWorktreesRequest, BirdCoderPublishProjectRequest, BirdCoderPushProjectGitBranchRequest, BirdCoderRebindProjectRuntimeLocationRequest, BirdCoderRemoveProjectGitWorktreeRequest, BirdCoderSetProjectRuntimeLocationPreferenceRequest, BirdCoderSwitchProjectGitBranchRequest, BirdCoderUpdateProjectRequest, BirdCoderUpdateProjectRuntimeLocationRequest, BirdCoderUpdateWorkspaceRequest, BirdCoderUpsertProjectCollaboratorRequest, BirdCoderUpsertProjectWorkspaceBindingRequest, BirdCoderWorkspaceSummary, PageInfo } from '../types';


export interface PlatformDeploymentsListParams {
  page?: number;
  pageSize?: number;
}

export class PlatformDeploymentsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List deployments */
  async list(params?: PlatformDeploymentsListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/deployments`), query));
  }
}

export interface PlatformWorkspacesListParams {
  userId?: string;
  page?: number;
  pageSize?: number;
}

export class PlatformWorkspacesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create workspace */
  async create(body: BirdCoderCreateWorkspaceRequest): Promise<BirdCoderWorkspaceSummary> {
    return this.client.post<BirdCoderWorkspaceSummary>(appApiPath(`/workspaces`), body, undefined, undefined, 'application/json');
  }

/** List workspaces */
  async list(params?: PlatformWorkspacesListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'userId', value: params?.userId, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/workspaces`), query));
  }

/** Delete workspace */
  async delete(workspaceId: string): Promise<void> {
    return this.client.delete<void>(appApiPath(`/workspaces/${serializePathParameter(workspaceId, { name: 'workspaceId', style: 'simple', explode: false })}`));
  }

/** Get workspace */
  async retrieve(workspaceId: string): Promise<BirdCoderWorkspaceSummary> {
    return this.client.get<BirdCoderWorkspaceSummary>(appApiPath(`/workspaces/${serializePathParameter(workspaceId, { name: 'workspaceId', style: 'simple', explode: false })}`));
  }

/** Update workspace */
  async update(workspaceId: string, body: BirdCoderUpdateWorkspaceRequest): Promise<BirdCoderWorkspaceSummary> {
    return this.client.patch<BirdCoderWorkspaceSummary>(appApiPath(`/workspaces/${serializePathParameter(workspaceId, { name: 'workspaceId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformProjectsPublishApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Publish project release flow */
  async publish(projectId: string, body?: BirdCoderPublishProjectRequest): Promise<BirdCoderProjectPublishResult> {
    return this.client.post<BirdCoderProjectPublishResult>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/publish`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformProjectsGitWorktreePruneApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Prune project Git worktrees */
  async create(projectId: string, body: BirdCoderPruneProjectGitWorktreesRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/worktree_prune`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformProjectsGitWorktreeRemovalsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Remove project Git worktree */
  async create(projectId: string, body: BirdCoderRemoveProjectGitWorktreeRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/worktree_removals`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformProjectsGitWorktreesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create project Git worktree */
  async create(projectId: string, body: BirdCoderCreateProjectGitWorktreeRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/worktrees`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformProjectsGitPushesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Push project Git branch */
  async create(projectId: string, body: BirdCoderPushProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/pushes`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformProjectsGitCommitsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Commit project Git changes */
  async create(projectId: string, body: BirdCoderCommitProjectGitChangesRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/commits`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformProjectsGitBranchSwitchApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Switch project Git branch */
  async create(projectId: string, body: BirdCoderSwitchProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/branch_switch`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformProjectsGitBranchesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create project Git branch */
  async create(projectId: string, body: BirdCoderCreateProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/branches`), body, undefined, undefined, 'application/json');
  }
}

export interface PlatformProjectsGitDiffRetrieveParams {
  runtimeLocationId: string;
}

export class PlatformProjectsGitDiffApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get project Git diff */
  async retrieve(projectId: string, params: PlatformProjectsGitDiffRetrieveParams): Promise<BirdCoderProjectGitDiff> {
    const query = buildQueryString([
      { name: 'runtime_location_id', value: params.runtimeLocationId, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderProjectGitDiff>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/diff`), query));
  }
}

export interface PlatformProjectsGitOverviewRetrieveParams {
  runtimeLocationId: string;
}

export class PlatformProjectsGitOverviewApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get project Git overview */
  async retrieve(projectId: string, params: PlatformProjectsGitOverviewRetrieveParams): Promise<BirdCoderProjectGitOverview> {
    const query = buildQueryString([
      { name: 'runtime_location_id', value: params.runtimeLocationId, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderProjectGitOverview>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/overview`), query));
  }
}

export class PlatformProjectsGitApi {
  private client: HttpClient;
  public readonly overview: PlatformProjectsGitOverviewApi;
  public readonly diff: PlatformProjectsGitDiffApi;
  public readonly branches: PlatformProjectsGitBranchesApi;
  public readonly branchSwitch: PlatformProjectsGitBranchSwitchApi;
  public readonly commits: PlatformProjectsGitCommitsApi;
  public readonly pushes: PlatformProjectsGitPushesApi;
  public readonly worktrees: PlatformProjectsGitWorktreesApi;
  public readonly worktreeRemovals: PlatformProjectsGitWorktreeRemovalsApi;
  public readonly worktreePrune: PlatformProjectsGitWorktreePruneApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.overview = new PlatformProjectsGitOverviewApi(client);
    this.diff = new PlatformProjectsGitDiffApi(client);
    this.branches = new PlatformProjectsGitBranchesApi(client);
    this.branchSwitch = new PlatformProjectsGitBranchSwitchApi(client);
    this.commits = new PlatformProjectsGitCommitsApi(client);
    this.pushes = new PlatformProjectsGitPushesApi(client);
    this.worktrees = new PlatformProjectsGitWorktreesApi(client);
    this.worktreeRemovals = new PlatformProjectsGitWorktreeRemovalsApi(client);
    this.worktreePrune = new PlatformProjectsGitWorktreePruneApi(client);
  }

}

export interface PlatformProjectsRuntimeLocationsPreferencesListParams {
  page?: number;
  pageSize?: number;
}

export interface PlatformProjectsRuntimeLocationsPreferencesUpdateParams {
  ifMatch?: string;
  idempotencyKey: string;
}

export class PlatformProjectsRuntimeLocationsPreferencesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List project runtime-location preferences */
  async list(projectId: string, params?: PlatformProjectsRuntimeLocationsPreferencesListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_location_preferences`), query));
  }

/** Update project runtime-location preference */
  async update(projectId: string, capability: string, body: BirdCoderSetProjectRuntimeLocationPreferenceRequest, params: PlatformProjectsRuntimeLocationsPreferencesUpdateParams): Promise<BirdCoderProjectRuntimeLocationPreference> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
        'Idempotency-Key': { value: params.idempotencyKey, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.put<BirdCoderProjectRuntimeLocationPreference>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_location_preferences/${serializePathParameter(capability, { name: 'capability', style: 'simple', explode: false })}`), body, undefined, requestHeaders, 'application/json');
  }
}

export interface PlatformProjectsRuntimeLocationsListParams {
  page?: number;
  pageSize?: number;
}

export interface PlatformProjectsRuntimeLocationsCreateParams {
  idempotencyKey: string;
}

export interface PlatformProjectsRuntimeLocationsUpdateParams {
  ifMatch: string;
  idempotencyKey: string;
}

export interface PlatformProjectsRuntimeLocationsDeleteParams {
  ifMatch: string;
}

export interface PlatformProjectsRuntimeLocationsRebindParams {
  ifMatch: string;
  idempotencyKey: string;
}

export interface PlatformProjectsRuntimeLocationsRequestVerificationParams {
  ifMatch: string;
  idempotencyKey: string;
}

export class PlatformProjectsRuntimeLocationsApi {
  private client: HttpClient;
  public readonly preferences: PlatformProjectsRuntimeLocationsPreferencesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.preferences = new PlatformProjectsRuntimeLocationsPreferencesApi(client);
  }


/** List project runtime locations */
  async list(projectId: string, params?: PlatformProjectsRuntimeLocationsListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations`), query));
  }

/** Register project runtime location */
  async create(projectId: string, body: BirdCoderCreateProjectRuntimeLocationRequest, params: PlatformProjectsRuntimeLocationsCreateParams): Promise<BirdCoderProjectRuntimeLocation> {
    const requestHeaders = buildRequestHeaders(
      {
        'Idempotency-Key': { value: params.idempotencyKey, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.post<BirdCoderProjectRuntimeLocation>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations`), body, undefined, requestHeaders, 'application/json');
  }

/** Get project runtime location */
  async retrieve(projectId: string, runtimeLocationId: string): Promise<BirdCoderProjectRuntimeLocation> {
    return this.client.get<BirdCoderProjectRuntimeLocation>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations/${serializePathParameter(runtimeLocationId, { name: 'runtimeLocationId', style: 'simple', explode: false })}`));
  }

/** Update project runtime location */
  async update(projectId: string, runtimeLocationId: string, body: BirdCoderUpdateProjectRuntimeLocationRequest, params: PlatformProjectsRuntimeLocationsUpdateParams): Promise<BirdCoderProjectRuntimeLocation> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
        'Idempotency-Key': { value: params.idempotencyKey, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.patch<BirdCoderProjectRuntimeLocation>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations/${serializePathParameter(runtimeLocationId, { name: 'runtimeLocationId', style: 'simple', explode: false })}`), body, undefined, requestHeaders, 'application/json');
  }

/** Delete project runtime location */
  async delete(projectId: string, runtimeLocationId: string, params: PlatformProjectsRuntimeLocationsDeleteParams): Promise<void> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.delete<void>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations/${serializePathParameter(runtimeLocationId, { name: 'runtimeLocationId', style: 'simple', explode: false })}`), undefined, requestHeaders);
  }

/** Rebind project runtime location */
  async rebind(projectId: string, runtimeLocationId: string, body: BirdCoderRebindProjectRuntimeLocationRequest, params: PlatformProjectsRuntimeLocationsRebindParams): Promise<BirdCoderProjectRuntimeLocationCommandAccepted> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
        'Idempotency-Key': { value: params.idempotencyKey, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.post<BirdCoderProjectRuntimeLocationCommandAccepted>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations/${serializePathParameter(runtimeLocationId, { name: 'runtimeLocationId', style: 'simple', explode: false })}/rebind`), body, undefined, requestHeaders, 'application/json');
  }

/** Request project runtime-location verification */
  async requestVerification(projectId: string, runtimeLocationId: string, params: PlatformProjectsRuntimeLocationsRequestVerificationParams): Promise<BirdCoderProjectRuntimeLocationCommandAccepted> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
        'Idempotency-Key': { value: params.idempotencyKey, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.post<BirdCoderProjectRuntimeLocationCommandAccepted>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations/${serializePathParameter(runtimeLocationId, { name: 'runtimeLocationId', style: 'simple', explode: false })}/request_verification`), undefined, undefined, requestHeaders);
  }
}

export interface PlatformProjectsWorkspaceBindingUpdateParams {
  ifMatch?: string;
  idempotencyKey: string;
}

export interface PlatformProjectsWorkspaceBindingDeleteParams {
  ifMatch: string;
}

export class PlatformProjectsWorkspaceBindingApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get project workspace binding */
  async retrieve(projectId: string): Promise<BirdCoderProjectWorkspaceBinding> {
    return this.client.get<BirdCoderProjectWorkspaceBinding>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/workspace_binding`));
  }

/** Create or update project workspace binding */
  async update(projectId: string, body: BirdCoderUpsertProjectWorkspaceBindingRequest, params: PlatformProjectsWorkspaceBindingUpdateParams): Promise<BirdCoderProjectWorkspaceBinding> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
        'Idempotency-Key': { value: params.idempotencyKey, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.put<BirdCoderProjectWorkspaceBinding>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/workspace_binding`), body, undefined, requestHeaders, 'application/json');
  }

/** Delete project workspace binding */
  async delete(projectId: string, params: PlatformProjectsWorkspaceBindingDeleteParams): Promise<void> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.delete<void>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/workspace_binding`), undefined, requestHeaders);
  }
}

export interface PlatformProjectsDeploymentTargetsListParams {
  page?: number;
  pageSize?: number;
}

export class PlatformProjectsDeploymentTargetsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List project deployment targets */
  async list(projectId: string, params?: PlatformProjectsDeploymentTargetsListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/deployment_targets`), query));
  }
}

export interface PlatformProjectsCollaboratorsListParams {
  page?: number;
  pageSize?: number;
}

export class PlatformProjectsCollaboratorsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Upsert project collaborator */
  async create(projectId: string, body: BirdCoderUpsertProjectCollaboratorRequest): Promise<BirdCoderProjectCollaboratorSummary> {
    return this.client.post<BirdCoderProjectCollaboratorSummary>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/collaborators`), body, undefined, undefined, 'application/json');
  }

/** List project collaborators */
  async list(projectId: string, params?: PlatformProjectsCollaboratorsListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/collaborators`), query));
  }
}

export interface PlatformProjectsListParams {
  userId?: string;
  workspaceId?: string;
  page?: number;
  pageSize?: number;
}

export class PlatformProjectsApi {
  private client: HttpClient;
  public readonly collaborators: PlatformProjectsCollaboratorsApi;
  public readonly deploymentTargets: PlatformProjectsDeploymentTargetsApi;
  public readonly workspaceBinding: PlatformProjectsWorkspaceBindingApi;
  public readonly runtimeLocations: PlatformProjectsRuntimeLocationsApi;
  public readonly git: PlatformProjectsGitApi;
  public readonly publish: PlatformProjectsPublishApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.collaborators = new PlatformProjectsCollaboratorsApi(client);
    this.deploymentTargets = new PlatformProjectsDeploymentTargetsApi(client);
    this.workspaceBinding = new PlatformProjectsWorkspaceBindingApi(client);
    this.runtimeLocations = new PlatformProjectsRuntimeLocationsApi(client);
    this.git = new PlatformProjectsGitApi(client);
    this.publish = new PlatformProjectsPublishApi(client);
  }


/** Create project */
  async create(body: BirdCoderCreateProjectRequest): Promise<BirdCoderProjectSummary> {
    return this.client.post<BirdCoderProjectSummary>(appApiPath(`/projects`), body, undefined, undefined, 'application/json');
  }

/** List projects */
  async list(params?: PlatformProjectsListParams): Promise<Record<string, unknown>> {
    const query = buildQueryString([
      { name: 'userId', value: params?.userId, style: 'form', explode: true, allowReserved: false },
      { name: 'workspaceId', value: params?.workspaceId, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<Record<string, unknown>>(appendQueryString(appApiPath(`/projects`), query));
  }

/** Delete project */
  async delete(projectId: string): Promise<void> {
    return this.client.delete<void>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}`));
  }

/** Get project */
  async retrieve(projectId: string): Promise<BirdCoderProjectSummary> {
    return this.client.get<BirdCoderProjectSummary>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}`));
  }

/** Update project */
  async update(projectId: string, body: BirdCoderUpdateProjectRequest): Promise<BirdCoderProjectSummary> {
    return this.client.patch<BirdCoderProjectSummary>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }
}

export class PlatformApi {
  private client: HttpClient;
  public readonly projects: PlatformProjectsApi;
  public readonly workspaces: PlatformWorkspacesApi;
  public readonly deployments: PlatformDeploymentsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.projects = new PlatformProjectsApi(client);
    this.workspaces = new PlatformWorkspacesApi(client);
    this.deployments = new PlatformDeploymentsApi(client);
  }

}

export function createPlatformApi(client: HttpClient): PlatformApi {
  return new PlatformApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}

interface PathParameterSpec {
  name: string;
  style: string;
  explode: boolean;
}

function serializePathParameter(value: unknown, spec: PathParameterSpec): string {
  if (value === undefined || value === null) {
    return '';
  }

  const style = spec.style || 'simple';
  if (Array.isArray(value)) {
    return serializePathArray(spec.name, value, style, spec.explode);
  }
  if (typeof value === 'object') {
    return serializePathObject(spec.name, value as Record<string, unknown>, style, spec.explode);
  }
  return pathPrefix(spec.name, style, false) + encodePathValue(serializePathPrimitive(value));
}

function serializePathArray(name: string, values: unknown[], style: string, explode: boolean): string {
  const serialized = values
    .filter((item) => item !== undefined && item !== null)
    .map((item) => encodePathValue(serializePathPrimitive(item)));
  if (serialized.length === 0) {
    return pathPrefix(name, style, false);
  }
  if (style === 'matrix') {
    return explode
      ? serialized.map((item) => `;${name}=${item}`).join('')
      : `;${name}=${serialized.join(',')}`;
  }
  return pathPrefix(name, style, false) + serialized.join(explode ? '.' : ',');
}

function serializePathObject(name: string, value: Record<string, unknown>, style: string, explode: boolean): string {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (entries.length === 0) {
    return pathPrefix(name, style, true);
  }
  if (style === 'matrix') {
    return explode
      ? entries.map(([key, entryValue]) => `;${encodePathValue(key)}=${encodePathValue(serializePathPrimitive(entryValue))}`).join('')
      : `;${name}=${entries.flatMap(([key, entryValue]) => [encodePathValue(key), encodePathValue(serializePathPrimitive(entryValue))]).join(',')}`;
  }
  const serialized = explode
    ? entries.map(([key, entryValue]) => `${encodePathValue(key)}=${encodePathValue(serializePathPrimitive(entryValue))}`).join(style === 'label' ? '.' : ',')
    : entries.flatMap(([key, entryValue]) => [encodePathValue(key), encodePathValue(serializePathPrimitive(entryValue))]).join(',');
  return pathPrefix(name, style, true) + serialized;
}

function pathPrefix(name: string, style: string, _objectValue: boolean): string {
  if (style === 'label') return '.';
  if (style === 'matrix') return `;${name}`;
  return '';
}

function encodePathValue(value: string): string {
  return encodeURIComponent(value);
}

function serializePathPrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
interface QueryParameterSpec {
  name: string;
  value: unknown;
  style: string;
  explode: boolean;
  allowReserved: boolean;
  contentType?: string;
}

function buildQueryString(parameters: QueryParameterSpec[]): string {
  const pairs: string[] = [];
  for (const parameter of parameters) {
    appendSerializedParameter(pairs, parameter);
  }
  return pairs.join('&');
}

function appendSerializedParameter(pairs: string[], parameter: QueryParameterSpec): void {
  if (parameter.value === undefined || parameter.value === null) {
    return;
  }

  if (parameter.contentType) {
    pairs.push(`${encodeQueryComponent(parameter.name)}=${encodeQueryValue(JSON.stringify(parameter.value), parameter.allowReserved)}`);
    return;
  }

  const style = parameter.style || 'form';
  if (style === 'deepObject') {
    appendDeepObjectParameter(pairs, parameter.name, parameter.value, parameter.allowReserved);
    return;
  }

  if (Array.isArray(parameter.value)) {
    appendArrayParameter(pairs, parameter.name, parameter.value, style, parameter.explode, parameter.allowReserved);
    return;
  }

  if (typeof parameter.value === 'object') {
    appendObjectParameter(pairs, parameter.name, parameter.value as Record<string, unknown>, style, parameter.explode, parameter.allowReserved);
    return;
  }

  pairs.push(`${encodeQueryComponent(parameter.name)}=${encodeQueryValue(serializePrimitive(parameter.value), parameter.allowReserved)}`);
}

function appendArrayParameter(
  pairs: string[],
  name: string,
  value: unknown[],
  style: string,
  explode: boolean,
  allowReserved: boolean,
): void {
  const values = value
    .filter((item) => item !== undefined && item !== null)
    .map((item) => serializePrimitive(item));
  if (values.length === 0) {
    return;
  }

  if (style === 'form' && explode) {
    for (const item of values) {
      pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(item, allowReserved)}`);
    }
    return;
  }

  pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(values.join(','), allowReserved)}`);
}

function appendObjectParameter(
  pairs: string[],
  name: string,
  value: Record<string, unknown>,
  style: string,
  explode: boolean,
  allowReserved: boolean,
): void {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (entries.length === 0) {
    return;
  }

  if (style === 'form' && explode) {
    for (const [key, entryValue] of entries) {
      pairs.push(`${encodeQueryComponent(key)}=${encodeQueryValue(serializePrimitive(entryValue), allowReserved)}`);
    }
    return;
  }

  const serialized = entries.flatMap(([key, entryValue]) => [key, serializePrimitive(entryValue)]).join(',');
  pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(serialized, allowReserved)}`);
}

function appendDeepObjectParameter(
  pairs: string[],
  name: string,
  value: unknown,
  allowReserved: boolean,
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(serializePrimitive(value), allowReserved)}`);
    return;
  }

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (entryValue === undefined || entryValue === null) {
      continue;
    }
    pairs.push(`${encodeQueryComponent(`${name}[${key}]`)}=${encodeQueryValue(serializePrimitive(entryValue), allowReserved)}`);
  }
}

function serializePrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value);
}

function encodeQueryValue(value: string, allowReserved: boolean): string {
  const encoded = encodeURIComponent(value);
  if (!allowReserved) {
    return encoded;
  }
  return encoded.replace(/%3A/gi, ':')
    .replace(/%2F/gi, '/')
    .replace(/%3F/gi, '?')
    .replace(/%23/gi, '#')
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']')
    .replace(/%40/gi, '@')
    .replace(/%21/gi, '!')
    .replace(/%24/gi, '$')
    .replace(/%26/gi, '&')
    .replace(/%27/gi, "'")
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%2A/gi, '*')
    .replace(/%2B/gi, '+')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';')
    .replace(/%3D/gi, '=');
}
function buildRequestHeaders(
  headers: Record<string, HeaderParameterSpec | undefined>,
  cookies: Record<string, HeaderParameterSpec | undefined> = {},
): Record<string, string> | undefined {
  const requestHeaders: Record<string, string> = {};

  for (const [name, parameter] of Object.entries(headers)) {
    const serialized = serializeParameterValue(parameter);
    if (serialized !== undefined) {
      requestHeaders[name] = serialized;
    }
  }

  const cookieHeader = buildCookieHeader(cookies);
  if (cookieHeader) {
    requestHeaders.Cookie = requestHeaders.Cookie
      ? `${requestHeaders.Cookie}; ${cookieHeader}`
      : cookieHeader;
  }

  return Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined;
}

interface HeaderParameterSpec {
  value: unknown;
  style: string;
  explode: boolean;
  contentType?: string;
}

function buildCookieHeader(cookies: Record<string, HeaderParameterSpec | undefined>): string | undefined {
  const pairs: string[] = [];
  for (const [name, parameter] of Object.entries(cookies)) {
    const serialized = serializeParameterValue(parameter);
    if (serialized !== undefined) {
      pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(serialized)}`);
    }
  }
  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

function serializeParameterValue(parameter: HeaderParameterSpec | undefined): string | undefined {
  const value = parameter?.value;
  if (value === undefined || value === null) {
    return undefined;
  }
  if (parameter?.contentType) {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeHeaderPrimitive(item)).join(',');
  }
  if (typeof value === 'object' && value !== null) {
    return serializeHeaderObject(value as Record<string, unknown>, parameter?.explode === true);
  }
  return serializeHeaderPrimitive(value);
}

function serializeHeaderObject(value: Record<string, unknown>, explode: boolean): string {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (explode) {
    return entries.map(([key, entryValue]) => `${key}=${serializeHeaderPrimitive(entryValue)}`).join(',');
  }
  return entries.flatMap(([key, entryValue]) => [key, serializeHeaderPrimitive(entryValue)]).join(',');
}

function serializeHeaderPrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
