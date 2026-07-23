import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderCommitProjectGitChangesRequest, BirdCoderCreateProjectDocumentBindingRequest, BirdCoderCreateProjectGitBranchRequest, BirdCoderCreateProjectGitWorktreeRequest, BirdCoderCreateProjectRequest, BirdCoderCreateProjectRuntimeLocationRequest, BirdCoderCreateWorkspaceRequest, BirdCoderProjectDocumentBinding, BirdCoderProjectGitDiff, BirdCoderProjectGitOverview, BirdCoderProjectRuntimeLocation, BirdCoderProjectRuntimeLocationCommandAccepted, BirdCoderProjectRuntimeLocationPreference, BirdCoderProjectSandboxBinding, BirdCoderProjectSummary, BirdCoderPruneProjectGitWorktreesRequest, BirdCoderPushProjectGitBranchRequest, BirdCoderRebindProjectRuntimeLocationRequest, BirdCoderRemoveProjectGitWorktreeRequest, BirdCoderSetProjectRuntimeLocationPreferenceRequest, BirdCoderSwitchProjectGitBranchRequest, BirdCoderUpdateProjectRequest, BirdCoderUpdateProjectRuntimeLocationRequest, BirdCoderUpdateWorkspaceRequest, BirdCoderUpsertProjectSandboxBindingRequest, BirdCoderWorkspaceSummary, PageInfo } from '../types';


export interface IntelligenceWorkspacesListParams {
  userId?: string;
  page?: number;
  pageSize?: number;
}

export interface IntelligenceWorkspacesDeleteParams {
  ifMatch: string;
}

export interface IntelligenceWorkspacesUpdateParams {
  ifMatch: string;
}

export class IntelligenceWorkspacesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create workspace */
  async create(body: BirdCoderCreateWorkspaceRequest): Promise<BirdCoderWorkspaceSummary> {
    return this.client.post<BirdCoderWorkspaceSummary>(appApiPath(`/workspaces`), body, undefined, undefined, 'application/json');
  }

/** List workspaces */
  async list(params?: IntelligenceWorkspacesListParams): Promise<{ items: BirdCoderWorkspaceSummary[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'userId', value: params?.userId, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<{ items: BirdCoderWorkspaceSummary[]; pageInfo: PageInfo; }>(appendQueryString(appApiPath(`/workspaces`), query));
  }

/** Delete workspace */
  async delete(workspaceId: string, params: IntelligenceWorkspacesDeleteParams): Promise<void> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.delete<void>(appApiPath(`/workspaces/${serializePathParameter(workspaceId, { name: 'workspaceId', style: 'simple', explode: false })}`), undefined, requestHeaders);
  }

/** Get workspace */
  async retrieve(workspaceId: string): Promise<BirdCoderWorkspaceSummary> {
    return this.client.get<BirdCoderWorkspaceSummary>(appApiPath(`/workspaces/${serializePathParameter(workspaceId, { name: 'workspaceId', style: 'simple', explode: false })}`));
  }

/** Update workspace */
  async update(workspaceId: string, body: BirdCoderUpdateWorkspaceRequest, params: IntelligenceWorkspacesUpdateParams): Promise<BirdCoderWorkspaceSummary> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.patch<BirdCoderWorkspaceSummary>(appApiPath(`/workspaces/${serializePathParameter(workspaceId, { name: 'workspaceId', style: 'simple', explode: false })}`), body, undefined, requestHeaders, 'application/json');
  }
}

export class IntelligenceProjectsGitWorktreesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create project Git worktree */
  async create(projectId: string, body: BirdCoderCreateProjectGitWorktreeRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/worktrees`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceProjectsGitCommitsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Commit project Git changes */
  async create(projectId: string, body: BirdCoderCommitProjectGitChangesRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/commits`), body, undefined, undefined, 'application/json');
  }
}

export class IntelligenceProjectsGitBranchesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create project Git branch */
  async create(projectId: string, body: BirdCoderCreateProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/branches`), body, undefined, undefined, 'application/json');
  }
}

export interface IntelligenceProjectsGitDiffRetrieveParams {
  runtimeLocationId: string;
}

export class IntelligenceProjectsGitDiffApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get project Git diff */
  async retrieve(projectId: string, params: IntelligenceProjectsGitDiffRetrieveParams): Promise<BirdCoderProjectGitDiff> {
    const query = buildQueryString([
      { name: 'runtime_location_id', value: params.runtimeLocationId, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderProjectGitDiff>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/diff`), query));
  }
}

export interface IntelligenceProjectsGitOverviewRetrieveParams {
  runtimeLocationId: string;
}

export class IntelligenceProjectsGitOverviewApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get project Git overview */
  async retrieve(projectId: string, params: IntelligenceProjectsGitOverviewRetrieveParams): Promise<BirdCoderProjectGitOverview> {
    const query = buildQueryString([
      { name: 'runtime_location_id', value: params.runtimeLocationId, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderProjectGitOverview>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/overview`), query));
  }
}

export class IntelligenceProjectsGitApi {
  private client: HttpClient;
  public readonly overview: IntelligenceProjectsGitOverviewApi;
  public readonly diff: IntelligenceProjectsGitDiffApi;
  public readonly branches: IntelligenceProjectsGitBranchesApi;
  public readonly commits: IntelligenceProjectsGitCommitsApi;
  public readonly worktrees: IntelligenceProjectsGitWorktreesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.overview = new IntelligenceProjectsGitOverviewApi(client);
    this.diff = new IntelligenceProjectsGitDiffApi(client);
    this.branches = new IntelligenceProjectsGitBranchesApi(client);
    this.commits = new IntelligenceProjectsGitCommitsApi(client);
    this.worktrees = new IntelligenceProjectsGitWorktreesApi(client);
  }


/** Switch project Git branch */
  async switchBranch(projectId: string, body: BirdCoderSwitchProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/switch_branch`), body, undefined, undefined, 'application/json');
  }

/** Push project Git branch */
  async push(projectId: string, body: BirdCoderPushProjectGitBranchRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/push`), body, undefined, undefined, 'application/json');
  }

/** Remove project Git worktree */
  async removeWorktree(projectId: string, body: BirdCoderRemoveProjectGitWorktreeRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/remove_worktree`), body, undefined, undefined, 'application/json');
  }

/** Prune project Git worktrees */
  async pruneWorktrees(projectId: string, body: BirdCoderPruneProjectGitWorktreesRequest): Promise<BirdCoderProjectGitOverview> {
    return this.client.post<BirdCoderProjectGitOverview>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/git/prune_worktrees`), body, undefined, undefined, 'application/json');
  }
}

export interface IntelligenceProjectsRuntimeLocationsPreferencesListParams {
  page?: number;
  pageSize?: number;
}

export interface IntelligenceProjectsRuntimeLocationsPreferencesUpdateParams {
  ifMatch?: string;
  idempotencyKey: string;
}

export class IntelligenceProjectsRuntimeLocationsPreferencesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List project runtime-location preferences */
  async list(projectId: string, params?: IntelligenceProjectsRuntimeLocationsPreferencesListParams): Promise<{ items: BirdCoderProjectRuntimeLocationPreference[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<{ items: BirdCoderProjectRuntimeLocationPreference[]; pageInfo: PageInfo; }>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_location_preferences`), query));
  }

/** Update project runtime-location preference */
  async update(projectId: string, capability: string, body: BirdCoderSetProjectRuntimeLocationPreferenceRequest, params: IntelligenceProjectsRuntimeLocationsPreferencesUpdateParams): Promise<BirdCoderProjectRuntimeLocationPreference> {
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

export interface IntelligenceProjectsRuntimeLocationsListParams {
  page?: number;
  pageSize?: number;
}

export interface IntelligenceProjectsRuntimeLocationsCreateParams {
  idempotencyKey: string;
}

export interface IntelligenceProjectsRuntimeLocationsUpdateParams {
  ifMatch: string;
  idempotencyKey: string;
}

export interface IntelligenceProjectsRuntimeLocationsDeleteParams {
  ifMatch: string;
}

export interface IntelligenceProjectsRuntimeLocationsRebindParams {
  ifMatch: string;
  idempotencyKey: string;
}

export interface IntelligenceProjectsRuntimeLocationsRequestVerificationParams {
  ifMatch: string;
  idempotencyKey: string;
}

export class IntelligenceProjectsRuntimeLocationsApi {
  private client: HttpClient;
  public readonly preferences: IntelligenceProjectsRuntimeLocationsPreferencesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.preferences = new IntelligenceProjectsRuntimeLocationsPreferencesApi(client);
  }


/** List project runtime locations */
  async list(projectId: string, params?: IntelligenceProjectsRuntimeLocationsListParams): Promise<{ items: BirdCoderProjectRuntimeLocation[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<{ items: BirdCoderProjectRuntimeLocation[]; pageInfo: PageInfo; }>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations`), query));
  }

/** Register project runtime location */
  async create(projectId: string, body: BirdCoderCreateProjectRuntimeLocationRequest, params: IntelligenceProjectsRuntimeLocationsCreateParams): Promise<BirdCoderProjectRuntimeLocation> {
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
  async update(projectId: string, runtimeLocationId: string, body: BirdCoderUpdateProjectRuntimeLocationRequest, params: IntelligenceProjectsRuntimeLocationsUpdateParams): Promise<BirdCoderProjectRuntimeLocation> {
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
  async delete(projectId: string, runtimeLocationId: string, params: IntelligenceProjectsRuntimeLocationsDeleteParams): Promise<void> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.delete<void>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/runtime_locations/${serializePathParameter(runtimeLocationId, { name: 'runtimeLocationId', style: 'simple', explode: false })}`), undefined, requestHeaders);
  }

/** Rebind project runtime location */
  async rebind(projectId: string, runtimeLocationId: string, body: BirdCoderRebindProjectRuntimeLocationRequest, params: IntelligenceProjectsRuntimeLocationsRebindParams): Promise<BirdCoderProjectRuntimeLocationCommandAccepted> {
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
  async requestVerification(projectId: string, runtimeLocationId: string, params: IntelligenceProjectsRuntimeLocationsRequestVerificationParams): Promise<BirdCoderProjectRuntimeLocationCommandAccepted> {
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

export interface IntelligenceProjectsSandboxBindingUpdateParams {
  ifMatch?: string;
  idempotencyKey: string;
}

export interface IntelligenceProjectsSandboxBindingDeleteParams {
  ifMatch: string;
}

export class IntelligenceProjectsSandboxBindingApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get project sandbox binding */
  async retrieve(projectId: string): Promise<BirdCoderProjectSandboxBinding> {
    return this.client.get<BirdCoderProjectSandboxBinding>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/sandbox_binding`));
  }

/** Create or update project sandbox binding */
  async update(projectId: string, body: BirdCoderUpsertProjectSandboxBindingRequest, params: IntelligenceProjectsSandboxBindingUpdateParams): Promise<BirdCoderProjectSandboxBinding> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
        'Idempotency-Key': { value: params.idempotencyKey, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.put<BirdCoderProjectSandboxBinding>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/sandbox_binding`), body, undefined, requestHeaders, 'application/json');
  }

/** Delete project sandbox binding */
  async delete(projectId: string, params: IntelligenceProjectsSandboxBindingDeleteParams): Promise<void> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.delete<void>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/sandbox_binding`), undefined, requestHeaders);
  }
}

export interface IntelligenceProjectsDocumentBindingsListParams {
  page?: number;
  pageSize?: number;
}

export interface IntelligenceProjectsDocumentBindingsDeleteParams {
  ifMatch: string;
}

export class IntelligenceProjectsDocumentBindingsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List project document bindings */
  async list(projectId: string, params?: IntelligenceProjectsDocumentBindingsListParams): Promise<{ items: BirdCoderProjectDocumentBinding[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<{ items: BirdCoderProjectDocumentBinding[]; pageInfo: PageInfo; }>(appendQueryString(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/document_bindings`), query));
  }

/** Create project document binding */
  async create(projectId: string, body: BirdCoderCreateProjectDocumentBindingRequest): Promise<BirdCoderProjectDocumentBinding> {
    return this.client.post<BirdCoderProjectDocumentBinding>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/document_bindings`), body, undefined, undefined, 'application/json');
  }

/** Get project document binding */
  async retrieve(projectId: string, bindingId: string): Promise<BirdCoderProjectDocumentBinding> {
    return this.client.get<BirdCoderProjectDocumentBinding>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/document_bindings/${serializePathParameter(bindingId, { name: 'bindingId', style: 'simple', explode: false })}`));
  }

/** Delete project document binding */
  async delete(projectId: string, bindingId: string, params: IntelligenceProjectsDocumentBindingsDeleteParams): Promise<void> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.delete<void>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}/document_bindings/${serializePathParameter(bindingId, { name: 'bindingId', style: 'simple', explode: false })}`), undefined, requestHeaders);
  }
}

export interface IntelligenceProjectsListParams {
  userId?: string;
  workspaceId?: string;
  page?: number;
  pageSize?: number;
}

export interface IntelligenceProjectsDeleteParams {
  ifMatch: string;
}

export interface IntelligenceProjectsUpdateParams {
  ifMatch: string;
}

export class IntelligenceProjectsApi {
  private client: HttpClient;
  public readonly documentBindings: IntelligenceProjectsDocumentBindingsApi;
  public readonly sandboxBinding: IntelligenceProjectsSandboxBindingApi;
  public readonly runtimeLocations: IntelligenceProjectsRuntimeLocationsApi;
  public readonly git: IntelligenceProjectsGitApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.documentBindings = new IntelligenceProjectsDocumentBindingsApi(client);
    this.sandboxBinding = new IntelligenceProjectsSandboxBindingApi(client);
    this.runtimeLocations = new IntelligenceProjectsRuntimeLocationsApi(client);
    this.git = new IntelligenceProjectsGitApi(client);
  }


/** Create project */
  async create(body: BirdCoderCreateProjectRequest): Promise<BirdCoderProjectSummary> {
    return this.client.post<BirdCoderProjectSummary>(appApiPath(`/projects`), body, undefined, undefined, 'application/json');
  }

/** List projects */
  async list(params?: IntelligenceProjectsListParams): Promise<{ items: BirdCoderProjectSummary[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'userId', value: params?.userId, style: 'form', explode: true, allowReserved: false },
      { name: 'workspaceId', value: params?.workspaceId, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<{ items: BirdCoderProjectSummary[]; pageInfo: PageInfo; }>(appendQueryString(appApiPath(`/projects`), query));
  }

/** Delete project */
  async delete(projectId: string, params: IntelligenceProjectsDeleteParams): Promise<void> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.delete<void>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}`), undefined, requestHeaders);
  }

/** Get project */
  async retrieve(projectId: string): Promise<BirdCoderProjectSummary> {
    return this.client.get<BirdCoderProjectSummary>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}`));
  }

/** Update project */
  async update(projectId: string, body: BirdCoderUpdateProjectRequest, params: IntelligenceProjectsUpdateParams): Promise<BirdCoderProjectSummary> {
    const requestHeaders = buildRequestHeaders(
      {
        'If-Match': { value: params.ifMatch, style: 'simple', explode: false },
      },
      {}
    );
    return this.client.patch<BirdCoderProjectSummary>(appApiPath(`/projects/${serializePathParameter(projectId, { name: 'projectId', style: 'simple', explode: false })}`), body, undefined, requestHeaders, 'application/json');
  }
}

export class IntelligenceApi {

  public readonly projects: IntelligenceProjectsApi;
  public readonly workspaces: IntelligenceWorkspacesApi;

  constructor(client: HttpClient) {

    this.projects = new IntelligenceProjectsApi(client);
    this.workspaces = new IntelligenceWorkspacesApi(client);
  }

}

export function createIntelligenceApi(client: HttpClient): IntelligenceApi {
  return new IntelligenceApi(client);
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
