import { appApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderIamOrganizationMemberSummaryListEnvelope, BirdCoderIamOrganizationSummaryListEnvelope, BirdCoderIamUserProfileEnvelope, BirdCoderIamUserRoleSummaryListEnvelope, BirdCoderUpdateCurrentUserProfileRequest, BirdCoderUpsertWorkspaceMemberRequest, BirdCoderWorkspaceMemberSummaryEnvelope, BirdCoderWorkspaceMemberSummaryListEnvelope } from '../types';


export class IamRoleBindingsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM user role bindings */
  async list(): Promise<BirdCoderIamUserRoleSummaryListEnvelope> {
    return this.client.get<BirdCoderIamUserRoleSummaryListEnvelope>(appApiPath(`/iam/role_bindings`));
  }
}

export class IamOrganizationMembershipsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM organization memberships */
  async list(): Promise<BirdCoderIamOrganizationMemberSummaryListEnvelope> {
    return this.client.get<BirdCoderIamOrganizationMemberSummaryListEnvelope>(appApiPath(`/iam/organization_memberships`));
  }
}

export class IamOrganizationsTreeApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get SDKWork IAM organization tree */
  async retrieve(): Promise<BirdCoderIamOrganizationSummaryListEnvelope> {
    return this.client.get<BirdCoderIamOrganizationSummaryListEnvelope>(appApiPath(`/iam/organizations/tree`));
  }
}

export class IamOrganizationsApi {
  private client: HttpClient;
  public readonly tree: IamOrganizationsTreeApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.tree = new IamOrganizationsTreeApi(client);
  }


/** List SDKWork IAM organizations */
  async list(): Promise<BirdCoderIamOrganizationSummaryListEnvelope> {
    return this.client.get<BirdCoderIamOrganizationSummaryListEnvelope>(appApiPath(`/iam/organizations`));
  }
}

export class IamWorkspacesMembersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Upsert workspace member */
  async upsert(workspaceId: string, body: BirdCoderUpsertWorkspaceMemberRequest): Promise<BirdCoderWorkspaceMemberSummaryEnvelope> {
    return this.client.post<BirdCoderWorkspaceMemberSummaryEnvelope>(appApiPath(`/workspaces/${serializePathParameter(workspaceId, { name: 'workspaceId', style: 'simple', explode: false })}/members`), body, undefined, undefined, 'application/json');
  }

/** List workspace members */
  async list(workspaceId: string): Promise<BirdCoderWorkspaceMemberSummaryListEnvelope> {
    return this.client.get<BirdCoderWorkspaceMemberSummaryListEnvelope>(appApiPath(`/workspaces/${serializePathParameter(workspaceId, { name: 'workspaceId', style: 'simple', explode: false })}/members`));
  }
}

export class IamWorkspacesApi {
  private client: HttpClient;
  public readonly members: IamWorkspacesMembersApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.members = new IamWorkspacesMembersApi(client);
  }

}

export class IamUsersCurrentApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get current SDKWork IAM user */
  async retrieve(): Promise<BirdCoderIamUserProfileEnvelope> {
    return this.client.get<BirdCoderIamUserProfileEnvelope>(appApiPath(`/iam/users/current`));
  }

/** Update current SDKWork IAM user profile */
  async update(body: BirdCoderUpdateCurrentUserProfileRequest): Promise<BirdCoderIamUserProfileEnvelope> {
    return this.client.patch<BirdCoderIamUserProfileEnvelope>(appApiPath(`/iam/users/current`), body, undefined, undefined, 'application/json');
  }
}

export class IamUsersApi {
  private client: HttpClient;
  public readonly current: IamUsersCurrentApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.current = new IamUsersCurrentApi(client);
  }

}

export class IamApi {
  private client: HttpClient;
  public readonly users: IamUsersApi;
  public readonly workspaces: IamWorkspacesApi;
  public readonly organizations: IamOrganizationsApi;
  public readonly organizationMemberships: IamOrganizationMembershipsApi;
  public readonly roleBindings: IamRoleBindingsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.users = new IamUsersApi(client);
    this.workspaces = new IamWorkspacesApi(client);
    this.organizations = new IamOrganizationsApi(client);
    this.organizationMemberships = new IamOrganizationMembershipsApi(client);
    this.roleBindings = new IamRoleBindingsApi(client);
  }

}

export function createIamApi(client: HttpClient): IamApi {
  return new IamApi(client);
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
