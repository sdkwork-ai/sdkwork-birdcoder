import { backendApiPath } from './paths';
import type { HttpClient } from '../http/client';

import type { BirdCoderBooleanSuccessEnvelope, BirdCoderCreateIamOrganizationMemberRequest, BirdCoderCreateIamOrganizationRequest, BirdCoderCreateIamPermissionRequest, BirdCoderCreateIamPolicyRequest, BirdCoderCreateIamRolePermissionRequest, BirdCoderCreateIamRoleRequest, BirdCoderCreateIamTenantMemberRequest, BirdCoderCreateIamTenantRequest, BirdCoderCreateIamUserRequest, BirdCoderCreateIamUserRoleRequest, BirdCoderDeletedResourceEnvelope, BirdCoderIamApiKeySummaryListEnvelope, BirdCoderIamAuditEventSummaryListEnvelope, BirdCoderIamOrganizationMemberSummaryEnvelope, BirdCoderIamOrganizationSummaryEnvelope, BirdCoderIamPermissionSummaryEnvelope, BirdCoderIamPermissionSummaryListEnvelope, BirdCoderIamPolicySummaryEnvelope, BirdCoderIamPolicySummaryListEnvelope, BirdCoderIamRolePermissionSummaryEnvelope, BirdCoderIamRolePermissionSummaryListEnvelope, BirdCoderIamRoleSummaryEnvelope, BirdCoderIamRoleSummaryListEnvelope, BirdCoderIamSecurityEventSummaryListEnvelope, BirdCoderIamTenantMemberSummaryEnvelope, BirdCoderIamTenantMemberSummaryListEnvelope, BirdCoderIamTenantSummaryEnvelope, BirdCoderIamTenantSummaryListEnvelope, BirdCoderIamUserRoleSummaryEnvelope, BirdCoderIamUserSummaryEnvelope, BirdCoderIamUserSummaryListEnvelope, BirdCoderTeamMemberSummaryListEnvelope, BirdCoderTeamSummaryListEnvelope, BirdCoderUpdateIamOrganizationMemberRequest, BirdCoderUpdateIamOrganizationRequest, BirdCoderUpdateIamPermissionRequest, BirdCoderUpdateIamPolicyRequest, BirdCoderUpdateIamRoleRequest, BirdCoderUpdateIamTenantMemberRequest, BirdCoderUpdateIamTenantRequest, BirdCoderUpdateIamUserRequest } from '../types';


export class IamTeamsMembersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List team members */
  async list(teamId: string): Promise<BirdCoderTeamMemberSummaryListEnvelope> {
    return this.client.get<BirdCoderTeamMemberSummaryListEnvelope>(backendApiPath(`/iam/teams/${serializePathParameter(teamId, { name: 'teamId', style: 'simple', explode: false })}/members`));
  }
}

export interface IamTeamsListParams {
  userId?: string;
  workspaceId?: string;
}

export class IamTeamsApi {
  private client: HttpClient;
  public readonly members: IamTeamsMembersApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.members = new IamTeamsMembersApi(client);
  }


/** List teams */
  async list(params?: IamTeamsListParams): Promise<BirdCoderTeamSummaryListEnvelope> {
    const query = buildQueryString([
      { name: 'userId', value: params?.userId, style: 'form', explode: true, allowReserved: false },
      { name: 'workspaceId', value: params?.workspaceId, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.get<BirdCoderTeamSummaryListEnvelope>(appendQueryString(backendApiPath(`/iam/teams`), query));
  }
}

export class IamRoleBindingsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create SDKWork IAM user role binding */
  async create(body: BirdCoderCreateIamUserRoleRequest): Promise<BirdCoderIamUserRoleSummaryEnvelope> {
    return this.client.post<BirdCoderIamUserRoleSummaryEnvelope>(backendApiPath(`/iam/role_bindings`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM user role binding */
  async delete(roleBindingId: string): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.delete<BirdCoderBooleanSuccessEnvelope>(backendApiPath(`/iam/role_bindings/${serializePathParameter(roleBindingId, { name: 'roleBindingId', style: 'simple', explode: false })}`));
  }
}

export class IamUsersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM users */
  async list(): Promise<BirdCoderIamUserSummaryListEnvelope> {
    return this.client.get<BirdCoderIamUserSummaryListEnvelope>(backendApiPath(`/iam/users`));
  }

/** Create SDKWork IAM user */
  async create(body: BirdCoderCreateIamUserRequest): Promise<BirdCoderIamUserSummaryEnvelope> {
    return this.client.post<BirdCoderIamUserSummaryEnvelope>(backendApiPath(`/iam/users`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork IAM user */
  async retrieve(userId: string): Promise<BirdCoderIamUserSummaryEnvelope> {
    return this.client.get<BirdCoderIamUserSummaryEnvelope>(backendApiPath(`/iam/users/${serializePathParameter(userId, { name: 'userId', style: 'simple', explode: false })}`));
  }

/** Update SDKWork IAM user */
  async update(userId: string, body: BirdCoderUpdateIamUserRequest): Promise<BirdCoderIamUserSummaryEnvelope> {
    return this.client.patch<BirdCoderIamUserSummaryEnvelope>(backendApiPath(`/iam/users/${serializePathParameter(userId, { name: 'userId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM user */
  async delete(userId: string): Promise<BirdCoderDeletedResourceEnvelope> {
    return this.client.delete<BirdCoderDeletedResourceEnvelope>(backendApiPath(`/iam/users/${serializePathParameter(userId, { name: 'userId', style: 'simple', explode: false })}`));
  }
}

export class IamTenantsMembersApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM tenant members */
  async list(tenantId: string): Promise<BirdCoderIamTenantMemberSummaryListEnvelope> {
    return this.client.get<BirdCoderIamTenantMemberSummaryListEnvelope>(backendApiPath(`/iam/tenants/${serializePathParameter(tenantId, { name: 'tenantId', style: 'simple', explode: false })}/members`));
  }

/** Create SDKWork IAM tenant member */
  async create(tenantId: string, body: BirdCoderCreateIamTenantMemberRequest): Promise<BirdCoderIamTenantMemberSummaryEnvelope> {
    return this.client.post<BirdCoderIamTenantMemberSummaryEnvelope>(backendApiPath(`/iam/tenants/${serializePathParameter(tenantId, { name: 'tenantId', style: 'simple', explode: false })}/members`), body, undefined, undefined, 'application/json');
  }

/** Update SDKWork IAM tenant member */
  async update(tenantId: string, userId: string, body: BirdCoderUpdateIamTenantMemberRequest): Promise<BirdCoderIamTenantMemberSummaryEnvelope> {
    return this.client.patch<BirdCoderIamTenantMemberSummaryEnvelope>(backendApiPath(`/iam/tenants/${serializePathParameter(tenantId, { name: 'tenantId', style: 'simple', explode: false })}/members/${serializePathParameter(userId, { name: 'userId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM tenant member */
  async delete(tenantId: string, userId: string): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.delete<BirdCoderBooleanSuccessEnvelope>(backendApiPath(`/iam/tenants/${serializePathParameter(tenantId, { name: 'tenantId', style: 'simple', explode: false })}/members/${serializePathParameter(userId, { name: 'userId', style: 'simple', explode: false })}`));
  }
}

export class IamTenantsApi {
  private client: HttpClient;
  public readonly members: IamTenantsMembersApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.members = new IamTenantsMembersApi(client);
  }


/** List SDKWork IAM tenants */
  async list(): Promise<BirdCoderIamTenantSummaryListEnvelope> {
    return this.client.get<BirdCoderIamTenantSummaryListEnvelope>(backendApiPath(`/iam/tenants`));
  }

/** Create SDKWork IAM tenant */
  async create(body: BirdCoderCreateIamTenantRequest): Promise<BirdCoderIamTenantSummaryEnvelope> {
    return this.client.post<BirdCoderIamTenantSummaryEnvelope>(backendApiPath(`/iam/tenants`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork IAM tenant */
  async retrieve(tenantId: string): Promise<BirdCoderIamTenantSummaryEnvelope> {
    return this.client.get<BirdCoderIamTenantSummaryEnvelope>(backendApiPath(`/iam/tenants/${serializePathParameter(tenantId, { name: 'tenantId', style: 'simple', explode: false })}`));
  }

/** Update SDKWork IAM tenant */
  async update(tenantId: string, body: BirdCoderUpdateIamTenantRequest): Promise<BirdCoderIamTenantSummaryEnvelope> {
    return this.client.patch<BirdCoderIamTenantSummaryEnvelope>(backendApiPath(`/iam/tenants/${serializePathParameter(tenantId, { name: 'tenantId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM tenant */
  async delete(tenantId: string): Promise<BirdCoderDeletedResourceEnvelope> {
    return this.client.delete<BirdCoderDeletedResourceEnvelope>(backendApiPath(`/iam/tenants/${serializePathParameter(tenantId, { name: 'tenantId', style: 'simple', explode: false })}`));
  }
}

export class IamSecurityEventsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM security events */
  async list(): Promise<BirdCoderIamSecurityEventSummaryListEnvelope> {
    return this.client.get<BirdCoderIamSecurityEventSummaryListEnvelope>(backendApiPath(`/iam/security_events`));
  }
}

export class IamRolesPermissionsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM role permissions */
  async list(roleId: string): Promise<BirdCoderIamRolePermissionSummaryListEnvelope> {
    return this.client.get<BirdCoderIamRolePermissionSummaryListEnvelope>(backendApiPath(`/iam/roles/${serializePathParameter(roleId, { name: 'roleId', style: 'simple', explode: false })}/permissions`));
  }

/** Create SDKWork IAM role permission */
  async create(roleId: string, body: BirdCoderCreateIamRolePermissionRequest): Promise<BirdCoderIamRolePermissionSummaryEnvelope> {
    return this.client.post<BirdCoderIamRolePermissionSummaryEnvelope>(backendApiPath(`/iam/roles/${serializePathParameter(roleId, { name: 'roleId', style: 'simple', explode: false })}/permissions`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM role permission */
  async delete(roleId: string, permissionId: string): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.delete<BirdCoderBooleanSuccessEnvelope>(backendApiPath(`/iam/roles/${serializePathParameter(roleId, { name: 'roleId', style: 'simple', explode: false })}/permissions/${serializePathParameter(permissionId, { name: 'permissionId', style: 'simple', explode: false })}`));
  }
}

export class IamRolesApi {
  private client: HttpClient;
  public readonly permissions: IamRolesPermissionsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.permissions = new IamRolesPermissionsApi(client);
  }


/** List SDKWork IAM roles */
  async list(): Promise<BirdCoderIamRoleSummaryListEnvelope> {
    return this.client.get<BirdCoderIamRoleSummaryListEnvelope>(backendApiPath(`/iam/roles`));
  }

/** Create SDKWork IAM role */
  async create(body: BirdCoderCreateIamRoleRequest): Promise<BirdCoderIamRoleSummaryEnvelope> {
    return this.client.post<BirdCoderIamRoleSummaryEnvelope>(backendApiPath(`/iam/roles`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork IAM role */
  async retrieve(roleId: string): Promise<BirdCoderIamRoleSummaryEnvelope> {
    return this.client.get<BirdCoderIamRoleSummaryEnvelope>(backendApiPath(`/iam/roles/${serializePathParameter(roleId, { name: 'roleId', style: 'simple', explode: false })}`));
  }

/** Update SDKWork IAM role */
  async update(roleId: string, body: BirdCoderUpdateIamRoleRequest): Promise<BirdCoderIamRoleSummaryEnvelope> {
    return this.client.patch<BirdCoderIamRoleSummaryEnvelope>(backendApiPath(`/iam/roles/${serializePathParameter(roleId, { name: 'roleId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM role */
  async delete(roleId: string): Promise<BirdCoderDeletedResourceEnvelope> {
    return this.client.delete<BirdCoderDeletedResourceEnvelope>(backendApiPath(`/iam/roles/${serializePathParameter(roleId, { name: 'roleId', style: 'simple', explode: false })}`));
  }
}

export class IamPoliciesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM policies */
  async list(): Promise<BirdCoderIamPolicySummaryListEnvelope> {
    return this.client.get<BirdCoderIamPolicySummaryListEnvelope>(backendApiPath(`/iam/policies`));
  }

/** Create SDKWork IAM policy */
  async create(body: BirdCoderCreateIamPolicyRequest): Promise<BirdCoderIamPolicySummaryEnvelope> {
    return this.client.post<BirdCoderIamPolicySummaryEnvelope>(backendApiPath(`/iam/policies`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork IAM policy */
  async retrieve(policyId: string): Promise<BirdCoderIamPolicySummaryEnvelope> {
    return this.client.get<BirdCoderIamPolicySummaryEnvelope>(backendApiPath(`/iam/policies/${serializePathParameter(policyId, { name: 'policyId', style: 'simple', explode: false })}`));
  }

/** Update SDKWork IAM policy */
  async update(policyId: string, body: BirdCoderUpdateIamPolicyRequest): Promise<BirdCoderIamPolicySummaryEnvelope> {
    return this.client.patch<BirdCoderIamPolicySummaryEnvelope>(backendApiPath(`/iam/policies/${serializePathParameter(policyId, { name: 'policyId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM policy */
  async delete(policyId: string): Promise<BirdCoderDeletedResourceEnvelope> {
    return this.client.delete<BirdCoderDeletedResourceEnvelope>(backendApiPath(`/iam/policies/${serializePathParameter(policyId, { name: 'policyId', style: 'simple', explode: false })}`));
  }
}

export class IamPermissionsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM permissions */
  async list(): Promise<BirdCoderIamPermissionSummaryListEnvelope> {
    return this.client.get<BirdCoderIamPermissionSummaryListEnvelope>(backendApiPath(`/iam/permissions`));
  }

/** Create SDKWork IAM permission */
  async create(body: BirdCoderCreateIamPermissionRequest): Promise<BirdCoderIamPermissionSummaryEnvelope> {
    return this.client.post<BirdCoderIamPermissionSummaryEnvelope>(backendApiPath(`/iam/permissions`), body, undefined, undefined, 'application/json');
  }

/** Get SDKWork IAM permission */
  async retrieve(permissionId: string): Promise<BirdCoderIamPermissionSummaryEnvelope> {
    return this.client.get<BirdCoderIamPermissionSummaryEnvelope>(backendApiPath(`/iam/permissions/${serializePathParameter(permissionId, { name: 'permissionId', style: 'simple', explode: false })}`));
  }

/** Update SDKWork IAM permission */
  async update(permissionId: string, body: BirdCoderUpdateIamPermissionRequest): Promise<BirdCoderIamPermissionSummaryEnvelope> {
    return this.client.patch<BirdCoderIamPermissionSummaryEnvelope>(backendApiPath(`/iam/permissions/${serializePathParameter(permissionId, { name: 'permissionId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM permission */
  async delete(permissionId: string): Promise<BirdCoderDeletedResourceEnvelope> {
    return this.client.delete<BirdCoderDeletedResourceEnvelope>(backendApiPath(`/iam/permissions/${serializePathParameter(permissionId, { name: 'permissionId', style: 'simple', explode: false })}`));
  }
}

export class IamOrganizationMembershipsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Create SDKWork IAM organization membership */
  async create(body: BirdCoderCreateIamOrganizationMemberRequest): Promise<BirdCoderIamOrganizationMemberSummaryEnvelope> {
    return this.client.post<BirdCoderIamOrganizationMemberSummaryEnvelope>(backendApiPath(`/iam/organization_memberships`), body, undefined, undefined, 'application/json');
  }

/** Update SDKWork IAM organization membership */
  async update(membershipId: string, body: BirdCoderUpdateIamOrganizationMemberRequest): Promise<BirdCoderIamOrganizationMemberSummaryEnvelope> {
    return this.client.patch<BirdCoderIamOrganizationMemberSummaryEnvelope>(backendApiPath(`/iam/organization_memberships/${serializePathParameter(membershipId, { name: 'membershipId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }
}

export class IamOrganizationsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Get SDKWork IAM organization */
  async retrieve(organizationId: string): Promise<BirdCoderIamOrganizationSummaryEnvelope> {
    return this.client.get<BirdCoderIamOrganizationSummaryEnvelope>(backendApiPath(`/iam/organizations/${serializePathParameter(organizationId, { name: 'organizationId', style: 'simple', explode: false })}`));
  }

/** Update SDKWork IAM organization */
  async update(organizationId: string, body: BirdCoderUpdateIamOrganizationRequest): Promise<BirdCoderIamOrganizationSummaryEnvelope> {
    return this.client.patch<BirdCoderIamOrganizationSummaryEnvelope>(backendApiPath(`/iam/organizations/${serializePathParameter(organizationId, { name: 'organizationId', style: 'simple', explode: false })}`), body, undefined, undefined, 'application/json');
  }

/** Delete SDKWork IAM organization */
  async delete(organizationId: string): Promise<BirdCoderDeletedResourceEnvelope> {
    return this.client.delete<BirdCoderDeletedResourceEnvelope>(backendApiPath(`/iam/organizations/${serializePathParameter(organizationId, { name: 'organizationId', style: 'simple', explode: false })}`));
  }

/** Create SDKWork IAM organization */
  async create(body: BirdCoderCreateIamOrganizationRequest): Promise<BirdCoderIamOrganizationSummaryEnvelope> {
    return this.client.post<BirdCoderIamOrganizationSummaryEnvelope>(backendApiPath(`/iam/organizations`), body, undefined, undefined, 'application/json');
  }
}

export class IamAuditEventsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM audit events */
  async list(): Promise<BirdCoderIamAuditEventSummaryListEnvelope> {
    return this.client.get<BirdCoderIamAuditEventSummaryListEnvelope>(backendApiPath(`/iam/audit_events`));
  }
}

export class IamApiKeysApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** List SDKWork IAM API keys */
  async list(): Promise<BirdCoderIamApiKeySummaryListEnvelope> {
    return this.client.get<BirdCoderIamApiKeySummaryListEnvelope>(backendApiPath(`/iam/api_keys`));
  }

/** Revoke SDKWork IAM API key */
  async revoke(apiKeyId: string): Promise<BirdCoderBooleanSuccessEnvelope> {
    return this.client.post<BirdCoderBooleanSuccessEnvelope>(backendApiPath(`/iam/api_keys/${serializePathParameter(apiKeyId, { name: 'apiKeyId', style: 'simple', explode: false })}/revoke`));
  }
}

export class IamApi {
  private client: HttpClient;
  public readonly apiKeys: IamApiKeysApi;
  public readonly auditEvents: IamAuditEventsApi;
  public readonly organizations: IamOrganizationsApi;
  public readonly organizationMemberships: IamOrganizationMembershipsApi;
  public readonly permissions: IamPermissionsApi;
  public readonly policies: IamPoliciesApi;
  public readonly roles: IamRolesApi;
  public readonly securityEvents: IamSecurityEventsApi;
  public readonly tenants: IamTenantsApi;
  public readonly users: IamUsersApi;
  public readonly roleBindings: IamRoleBindingsApi;
  public readonly teams: IamTeamsApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.apiKeys = new IamApiKeysApi(client);
    this.auditEvents = new IamAuditEventsApi(client);
    this.organizations = new IamOrganizationsApi(client);
    this.organizationMemberships = new IamOrganizationMembershipsApi(client);
    this.permissions = new IamPermissionsApi(client);
    this.policies = new IamPoliciesApi(client);
    this.roles = new IamRolesApi(client);
    this.securityEvents = new IamSecurityEventsApi(client);
    this.tenants = new IamTenantsApi(client);
    this.users = new IamUsersApi(client);
    this.roleBindings = new IamRoleBindingsApi(client);
    this.teams = new IamTeamsApi(client);
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
