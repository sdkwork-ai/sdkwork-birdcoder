import {
  createBirdcoderAppSdkClient,
  type BirdcoderAppSdkClient,
  type BirdCoderCommitProjectGitChangesRequest as GeneratedBirdCoderCommitProjectGitChangesRequest,
  type BirdCoderCreateCodingSessionRequest as GeneratedBirdCoderCreateCodingSessionRequest,
  type BirdCoderCreateCodingSessionTurnRequest as GeneratedBirdCoderCreateCodingSessionTurnRequest,
  type BirdCoderCreateProjectGitBranchRequest as GeneratedBirdCoderCreateProjectGitBranchRequest,
  type BirdCoderCreateProjectGitWorktreeRequest as GeneratedBirdCoderCreateProjectGitWorktreeRequest,
  type BirdCoderCreateProjectRequest as GeneratedBirdCoderCreateProjectRequest,
  type BirdCoderCreateWorkspaceRequest as GeneratedBirdCoderCreateWorkspaceRequest,
  type BirdCoderForkCodingSessionRequest as GeneratedBirdCoderForkCodingSessionRequest,
  type BirdCoderSyncCodeEngineModelConfigRequest as GeneratedBirdCoderSyncCodeEngineModelConfigRequest,
  type BirdCoderUpdateCodingSessionRequest as GeneratedBirdCoderUpdateCodingSessionRequest,
  type BirdCoderUpdateProjectRequest as GeneratedBirdCoderUpdateProjectRequest,
  type BirdCoderUpdateWorkspaceRequest as GeneratedBirdCoderUpdateWorkspaceRequest,
  type BirdCoderRemoveProjectGitWorktreeRequest as GeneratedBirdCoderRemoveProjectGitWorktreeRequest,
  type BirdCoderPushProjectGitBranchRequest as GeneratedBirdCoderPushProjectGitBranchRequest,
  type BirdCoderPruneProjectGitWorktreesRequest as GeneratedBirdCoderPruneProjectGitWorktreesRequest,
  type BirdCoderProjectWorkspaceBinding as GeneratedBirdCoderProjectWorkspaceBinding,
  type BirdCoderSwitchProjectGitBranchRequest as GeneratedBirdCoderSwitchProjectGitBranchRequest,
  type BirdCoderUpsertProjectCollaboratorRequest as GeneratedBirdCoderUpsertProjectCollaboratorRequest,
  type BirdCoderUpsertProjectWorkspaceBindingRequest as GeneratedBirdCoderUpsertProjectWorkspaceBindingRequest,
  type CollaborationWorkspaceTeamsListQuery,
  type ContentDocumentsListQuery,
  type IntelligenceCodingSessionsListQuery,
  type PlatformProjectsListQuery,
  type PlatformDeploymentsListQuery,
  type PlatformProjectsCollaboratorsListQuery,
  type PlatformProjectsDeploymentTargetsListQuery,
  type PlatformProjectsGitDiffRetrieveQuery,
  type PlatformProjectsGitOverviewRetrieveQuery,
  type IamWorkspacesMembersListQuery,
  type TemplatesAppTemplatesListQuery,
  type PlatformWorkspacesListQuery,
  type RuntimeNativeSessionsListQuery,
  type RuntimeNativeSessionsRetrieveQuery,
  type SkillsSkillPackagesListQuery,
} from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';
import {
  registerBirdCoderBackendSdkTransportResolver,
  resetBirdCoderGeneratedBackendSdkClient,
  setBirdCoderBackendSdkTokenManager,
  type BirdCoderGeneratedBackendSdkClientOptions,
} from '@sdkwork/birdcoder-pc-admin-core';
import { buildAuthHeaders, type AuthTokenManager } from '@sdkwork/sdk-common';
import {
  handleSdkworkSessionAuthUnauthorizedError,
  resetSdkworkSessionAuthRedirectState,
} from '@sdkwork/auth-runtime-pc-react/handleSdkworkSessionAuthUnauthorizedError';
import { isSdkworkSdkSessionAuthError } from '@sdkwork/auth-runtime-pc-react/sdkSessionAuthError';
import { isBlank } from '@sdkwork/utils/string';
import {
  getBirdCoderGlobalTokenManager as getCoreBirdCoderGlobalTokenManager,
  setBirdCoderGlobalTokenManager,
} from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import type {
  BirdCoderApiRouteCatalogEntry,
  BirdCoderApiTransport,
  BirdCoderAppTemplateSummary,
  BirdCoderApprovalDecisionResult,
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCodingSessionTurn,
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigSyncResult,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
  BirdCoderCreateCodingSessionRequest,
  BirdCoderCreateCodingSessionTurnRequest,
  BirdCoderCreateProjectRequest,
  BirdCoderCreateWorkspaceRequest,
  BirdCoderDeleteCodingSessionMessageResult,
  BirdCoderDeleteCodingSessionResult,
  BirdCoderDeploymentRecordSummary,
  BirdCoderDeploymentTargetSummary,
  BirdCoderEditCodingSessionMessageRequest,
  BirdCoderEditCodingSessionMessageResult,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderForkCodingSessionRequest,
  BirdCoderGetNativeSessionRequest,
  BirdCoderInstallSkillPackageRequest,
  BirdCoderIamAuditEventSummary,
  BirdCoderIamPolicySummary,
  BirdCoderListCodingSessionsRequest,
  BirdCoderListNativeSessionsRequest,
  BirdCoderModelCatalogEntry,
  BirdCoderNativeSessionDetail,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderNativeSessionSummary,
  BirdCoderOperationDescriptor,
  BirdCoderPageInfo,
  BirdCoderProjectDocumentSummary,
  BirdCoderProjectCollaboratorSummary,
  BirdCoderProjectGitDiff,
  BirdCoderProjectGitOverview,
  BirdCoderProjectPublishResult,
  BirdCoderProjectSummary,
  BirdCoderPublishProjectRequest,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderReleaseSummary,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSubmitApprovalDecisionRequest,
  BirdCoderSubmitUserQuestionAnswerRequest,
  BirdCoderSkillInstallationSummary,
  BirdCoderSkillPackageSummary,
  BirdCoderSyncCodeEngineModelConfigRequest,
  BirdCoderSwitchProjectGitBranchRequest,
  BirdCoderTeamMemberSummary,
  BirdCoderTeamSummary,
  BirdCoderUpdateCodingSessionRequest,
  BirdCoderUpdateProjectRequest,
  BirdCoderUpdateWorkspaceRequest,
  BirdCoderUpsertProjectCollaboratorRequest,
  BirdCoderUpsertWorkspaceMemberRequest,
  BirdCoderUserQuestionAnswerResult,
  BirdCoderWorkspaceMemberSummary,
  BirdCoderWorkspaceSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { BIRDCODER_DATA_SCOPES } from '@sdkwork/birdcoder-pc-contracts-commons/dataScopes';
import { clearStoredAppSessionToken } from './appSessionToken.ts';
import {
  buildBirdCoderProtectedLoginBrowserUrl,
  redirectBrowserToBirdCoderProtectedLogin,
} from '@sdkwork/birdcoder-pc-core/appSessionAuthRedirect';
import {
  BirdCoderApiTransportError,
  readBirdCoderApiTransportErrorHttpStatus,
} from '@sdkwork/birdcoder-pc-contracts-commons/apiTransportError';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { invalidateBirdCoderCurrentSession } from './iamCurrentSession.ts';
import { invalidateBirdCoderCurrentUser } from './iamCurrentUser.ts';
import { createBirdCoderHttpApiTransport } from './sdkTransportShared.ts';

export interface BirdCoderWorkspaceScopedListRequest {
  userId?: string;
  workspaceId?: string;
  limit?: number;
  offset?: number;
}

export type BirdCoderProjectListRequest = BirdCoderWorkspaceScopedListRequest;

export interface BirdCoderProjectPageRequest {
  page: number;
  pageSize: number;
  workspaceId?: string;
}

export interface BirdCoderWorkspacePageRequest {
  page: number;
  pageSize: number;
  userId?: string;
}

export interface BirdCoderOffsetPageInfo extends Required<
  Pick<BirdCoderPageInfo, 'hasMore' | 'page' | 'pageSize' | 'totalItems' | 'totalPages'>
> {
  mode: 'offset';
}

export interface BirdCoderPage<TItem> {
  items: TItem[];
  pageInfo: BirdCoderOffsetPageInfo;
}

/**
 * The only app-side request shape that carries a desktop path. The composed
 * SDK writes it to the server's protected runtime-location storage; no caller
 * receives it back in the semantic result.
 */
export interface BirdCoderProjectRuntimeLocationRegistrationRequest {
  absolutePath: string;
  displayName?: string;
  idempotencyKey: string;
  locationKind: 'desktop_checkout';
  pathFlavor: 'windows' | 'posix';
  rootLocator: string;
  runtimeTargetId: string;
  runtimeTargetKind: 'desktop_device';
}

export interface BirdCoderProjectRuntimeLocationRebindRequest {
  absolutePath: string;
  displayName?: string;
  idempotencyKey: string;
  pathFlavor: 'windows' | 'posix';
  rootLocator: string;
}

export interface BirdCoderProjectWorkspaceBindingRequest {
  idempotencyKey: string;
  logicalPath: string;
  rootEntryId: string;
  sandboxId: string;
}

export interface BirdCoderProjectWorkspaceBindingRecord {
  id: string;
  projectId: string;
  sandboxId: string;
  rootEntryId: string;
  logicalPath: string;
  lifecycleStatus: 'active';
  version: string;
}

type RuntimeBoundGitRequest<TRequest> = TRequest & {
  runtimeLocationId: string;
};

/** Safe remote state. Absolute-path material is deliberately absent. */
export interface BirdCoderProjectRuntimeLocationRecord {
  id: string;
  rootLocator: string;
  runtimeTargetId: string;
  version: string;
}

export interface BirdCoderAppSdkApiClient {
  createCodingSession(request: BirdCoderCreateCodingSessionRequest): Promise<BirdCoderCodingSessionSummary>;
  commitProjectGitChanges(
    projectId: string,
    request: RuntimeBoundGitRequest<BirdCoderCommitProjectGitChangesRequest>,
  ): Promise<BirdCoderProjectGitOverview>;
  createCodingSessionTurn(
    codingSessionId: string,
    request: BirdCoderCreateCodingSessionTurnRequest,
  ): Promise<BirdCoderCodingSessionTurn>;
  createProject(request: BirdCoderCreateProjectRequest): Promise<BirdCoderProjectSummary>;
  createProjectGitBranch(
    projectId: string,
    request: RuntimeBoundGitRequest<BirdCoderCreateProjectGitBranchRequest>,
  ): Promise<BirdCoderProjectGitOverview>;
  createProjectGitWorktree(
    projectId: string,
    request: RuntimeBoundGitRequest<BirdCoderCreateProjectGitWorktreeRequest>,
  ): Promise<BirdCoderProjectGitOverview>;
  createProjectRuntimeLocation(
    projectId: string,
    request: BirdCoderProjectRuntimeLocationRegistrationRequest,
  ): Promise<BirdCoderProjectRuntimeLocationRecord>;
  bindProjectWorkspace(
    projectId: string,
    request: BirdCoderProjectWorkspaceBindingRequest,
  ): Promise<void>;
  createWorkspace(request: BirdCoderCreateWorkspaceRequest): Promise<BirdCoderWorkspaceSummary>;
  deleteCodingSession(codingSessionId: string): Promise<BirdCoderDeleteCodingSessionResult>;
  deleteCodingSessionMessage(
    codingSessionId: string,
    messageId: string,
  ): Promise<BirdCoderDeleteCodingSessionMessageResult>;
  deleteProject(projectId: string): Promise<void>;
  deleteWorkspace(workspaceId: string): Promise<void>;
  editCodingSessionMessage(
    codingSessionId: string,
    messageId: string,
    request: BirdCoderEditCodingSessionMessageRequest,
  ): Promise<BirdCoderEditCodingSessionMessageResult>;
  forkCodingSession(
    codingSessionId: string,
    request?: BirdCoderForkCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary>;
  getDescriptor(): Promise<BirdCoderCodingServerDescriptor>;
  getEngineCapabilities(engineKey: string): Promise<BirdCoderEngineCapabilityMatrix>;
  getHealth(): Promise<BirdCoderCoreHealthSummary>;
  getModelConfig(): Promise<BirdCoderCodeEngineModelConfig>;
  getNativeSession(
    codingSessionId: string,
    request: BirdCoderGetNativeSessionRequest,
  ): Promise<BirdCoderNativeSessionDetail>;
  getOperation(operationId: string): Promise<BirdCoderOperationDescriptor>;
  getProject(projectId: string): Promise<BirdCoderProjectSummary>;
  getProjectGitOverview(
    projectId: string,
    runtimeLocationId: string,
  ): Promise<BirdCoderProjectGitOverview>;
  getProjectWorkspaceBinding(
    projectId: string,
  ): Promise<BirdCoderProjectWorkspaceBindingRecord | null>;
  getProjectRuntimeLocation(
    projectId: string,
    runtimeLocationId: string,
  ): Promise<BirdCoderProjectRuntimeLocationRecord>;
  getProjectGitDiff(
    projectId: string,
    runtimeLocationId: string,
  ): Promise<BirdCoderProjectGitDiff>;
  getRuntime(): Promise<BirdCoderCoreRuntimeSummary>;
  installSkillPackage(
    packageId: string,
    request: BirdCoderInstallSkillPackageRequest,
  ): Promise<BirdCoderSkillInstallationSummary>;
  listAppTemplates(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderAppTemplateSummary[]>;
  listCodingSessionArtifacts(codingSessionId: string): Promise<BirdCoderCodingSessionArtifact[]>;
  listCodingSessionCheckpoints(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionCheckpoint[]>;
  listCodingSessionEvents(codingSessionId: string): Promise<BirdCoderCodingSessionEvent[]>;
  listCodingSessions(
    request?: BirdCoderListCodingSessionsRequest,
  ): Promise<BirdCoderCodingSessionSummary[]>;
  listCodingSessionPage(
    request?: BirdCoderListCodingSessionsRequest,
  ): Promise<BirdCoderPage<BirdCoderCodingSessionSummary>>;
  listDeployments(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderDeploymentRecordSummary[]>;
  listDeploymentTargets(
    projectId: string,
    options?: BirdCoderWorkspaceScopedListRequest,
  ): Promise<BirdCoderDeploymentTargetSummary[]>;
  listDocuments(options?: { projectId?: string; limit?: number; offset?: number }): Promise<BirdCoderProjectDocumentSummary[]>;
  listEngines(): Promise<BirdCoderEngineDescriptor[]>;
  listModels(): Promise<BirdCoderModelCatalogEntry[]>;
  listNativeSessionProviders(): Promise<BirdCoderNativeSessionProviderSummary[]>;
  listNativeSessions(
    request: BirdCoderListNativeSessionsRequest,
  ): Promise<BirdCoderNativeSessionSummary[]>;
  listNativeSessionPage(
    request: BirdCoderListNativeSessionsRequest,
  ): Promise<BirdCoderPage<BirdCoderNativeSessionSummary>>;
  listProjectCollaborators(
    projectId: string,
    options?: BirdCoderWorkspaceScopedListRequest,
  ): Promise<BirdCoderProjectCollaboratorSummary[]>;
  listProjectPage(
    input: BirdCoderProjectPageRequest,
  ): Promise<BirdCoderPage<BirdCoderProjectSummary>>;
  listProjects(options?: BirdCoderProjectListRequest): Promise<BirdCoderProjectSummary[]>;
  listRoutes(): Promise<BirdCoderApiRouteCatalogEntry[]>;
  listSkillPackages(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderSkillPackageSummary[]>;
  listTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listWorkspaceMembers(
    workspaceId: string,
    options?: BirdCoderWorkspaceScopedListRequest,
  ): Promise<BirdCoderWorkspaceMemberSummary[]>;
  listWorkspacePage(
    input: BirdCoderWorkspacePageRequest,
  ): Promise<BirdCoderPage<BirdCoderWorkspaceSummary>>;
  listWorkspaces(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderWorkspaceSummary[]>;
  publishProject(
    projectId: string,
    request: BirdCoderPublishProjectRequest,
  ): Promise<BirdCoderProjectPublishResult>;
  pruneProjectGitWorktrees(
    projectId: string,
    runtimeLocationId: string,
  ): Promise<BirdCoderProjectGitOverview>;
  pushProjectGitBranch(
    projectId: string,
    request: RuntimeBoundGitRequest<BirdCoderPushProjectGitBranchRequest>,
  ): Promise<BirdCoderProjectGitOverview>;
  removeProjectGitWorktree(
    projectId: string,
    request: RuntimeBoundGitRequest<BirdCoderRemoveProjectGitWorktreeRequest>,
  ): Promise<BirdCoderProjectGitOverview>;
  rebindProjectRuntimeLocation(
    projectId: string,
    runtimeLocationId: string,
    request: BirdCoderProjectRuntimeLocationRebindRequest,
  ): Promise<BirdCoderProjectRuntimeLocationRecord>;
  submitApprovalDecision(
    codingSessionId: string,
    interactionEventId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ): Promise<BirdCoderApprovalDecisionResult>;
  submitUserQuestionAnswer(
    codingSessionId: string,
    interactionEventId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ): Promise<BirdCoderUserQuestionAnswerResult>;
  switchProjectGitBranch(
    projectId: string,
    request: RuntimeBoundGitRequest<BirdCoderSwitchProjectGitBranchRequest>,
  ): Promise<BirdCoderProjectGitOverview>;
  syncModelConfig(
    request: BirdCoderSyncCodeEngineModelConfigRequest,
  ): Promise<BirdCoderCodeEngineModelConfigSyncResult>;
  updateCodingSession(
    codingSessionId: string,
    request: BirdCoderUpdateCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  updateProject(
    projectId: string,
    request: BirdCoderUpdateProjectRequest,
  ): Promise<BirdCoderProjectSummary>;
  updateWorkspace(
    workspaceId: string,
    request: BirdCoderUpdateWorkspaceRequest,
  ): Promise<BirdCoderWorkspaceSummary>;
  upsertProjectCollaborator(
    projectId: string,
    request: BirdCoderUpsertProjectCollaboratorRequest,
  ): Promise<BirdCoderProjectCollaboratorSummary>;
  upsertWorkspaceMember(
    workspaceId: string,
    request: BirdCoderUpsertWorkspaceMemberRequest,
  ): Promise<BirdCoderWorkspaceMemberSummary>;
}

export type BirdCoderAppRuntimeReadSdkApiClient = Pick<
  BirdCoderAppSdkApiClient,
  | 'getCodingSession'
  | 'getDescriptor'
  | 'getEngineCapabilities'
  | 'getHealth'
  | 'getModelConfig'
  | 'getNativeSession'
  | 'getOperation'
  | 'getRuntime'
  | 'listCodingSessionArtifacts'
  | 'listCodingSessionCheckpoints'
  | 'listCodingSessionEvents'
  | 'listCodingSessionPage'
  | 'listCodingSessions'
  | 'listEngines'
  | 'listModels'
  | 'listNativeSessionProviders'
  | 'listNativeSessionPage'
  | 'listNativeSessions'
  | 'listRoutes'
>;

export type BirdCoderAppRuntimeWriteSdkApiClient = Pick<
  BirdCoderAppSdkApiClient,
  | 'createCodingSession'
  | 'createCodingSessionTurn'
  | 'deleteCodingSession'
  | 'deleteCodingSessionMessage'
  | 'editCodingSessionMessage'
  | 'forkCodingSession'
  | 'submitApprovalDecision'
  | 'submitUserQuestionAnswer'
  | 'syncModelConfig'
  | 'updateCodingSession'
>;

export type BirdCoderAppRuntimeSdkApiClient =
  BirdCoderAppRuntimeReadSdkApiClient &
  BirdCoderAppRuntimeWriteSdkApiClient;

export interface CreateBirdCoderAppSdkApiClientOptions {
  accessToken?: string;
  authToken?: string;
  transport: BirdCoderApiTransport;
}

export type {
  BirdCoderBackendSdkApiClient,
  BirdCoderGeneratedBackendSdkClientOptions,
  BirdCoderTokenManagerAwareBackendSdkClient,
  CreateBirdCoderBackendSdkApiClientOptions,
} from '@sdkwork/birdcoder-pc-admin-core';
export {
  createBirdCoderBackendSdkApiClient,
  createBirdCoderGeneratedBackendSdkClient,
  getBirdCoderGeneratedBackendSdkClient,
} from '@sdkwork/birdcoder-pc-admin-core';

export interface BirdCoderGeneratedAppSdkClientOptions {
  accessToken?: string;
  apiBaseUrl?: string;
  authToken?: string;
  timeoutMs?: number;
  tokenManager?: AuthTokenManager;
  transport?: BirdCoderApiTransport;
}

type BirdCoderTokenManagerAwareClient<TClient> = TClient & {
  setTokenManager(manager: AuthTokenManager): BirdCoderTokenManagerAwareClient<TClient>;
};

export type BirdCoderTokenManagerAwareAppSdkClient =
  BirdCoderTokenManagerAwareClient<BirdcoderAppSdkClient>;

type GeneratedCodeEngineKey = NonNullable<IntelligenceCodingSessionsListQuery['engineId']>;
type GeneratedDataScope = NonNullable<GeneratedBirdCoderCreateWorkspaceRequest['dataScope']>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function readData<TData>(payload: unknown): TData {
  if (!isRecord(payload)) {
    return payload as TData;
  }

  if ('data' in payload) {
    const data = payload.data;
    if (isRecord(data) && 'item' in data) {
      return data.item as TData;
    }
    return data as TData;
  }

  if ('item' in payload) {
    return payload.item as TData;
  }

  return payload as TData;
}

function readItems<TItem>(payload: unknown): TItem[] {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return payload.items as TItem[];
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items as TItem[];
  }

  return [];
}

function readCanonicalData<TData>(payload: unknown): TData {
  return readData<TData>(payload);
}

function readCanonicalItems<TItem>(payload: unknown): TItem[] {
  return readItems<TItem>(payload);
}

function readRequiredRuntimeLocationField(
  value: Record<string, unknown>,
  field: keyof BirdCoderProjectRuntimeLocationRecord,
): string {
  const normalizedValue = typeof value[field] === 'string' ? value[field].trim() : '';
  if (!normalizedValue) {
    throw new Error(`Project runtime location response is missing ${field}.`);
  }
  return normalizedValue;
}

function readProjectRuntimeLocationRecord(
  payload: unknown,
): BirdCoderProjectRuntimeLocationRecord {
  const value = readCanonicalData<unknown>(payload);
  if (!isRecord(value)) {
    throw new Error('Project runtime location response must contain a resource item.');
  }

  return {
    id: readRequiredRuntimeLocationField(value, 'id'),
    rootLocator: readRequiredRuntimeLocationField(value, 'rootLocator'),
    runtimeTargetId: readRequiredRuntimeLocationField(value, 'runtimeTargetId'),
    version: readRequiredRuntimeLocationField(value, 'version'),
  };
}

function readCanonicalOffsetPage<TItem>(
  payload: unknown,
  resourceName: string,
): BirdCoderPage<TItem> {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(data) || !Array.isArray(data.items) || !isRecord(data.pageInfo)) {
    throw new Error(`${resourceName} list response must include data.items and data.pageInfo.`);
  }

  const pageInfo = data.pageInfo;
  const page = pageInfo.page;
  const pageSize = pageInfo.pageSize;
  const totalItems = pageInfo.totalItems;
  const totalPages = pageInfo.totalPages;
  const hasMore = pageInfo.hasMore;
  if (
    pageInfo.mode !== 'offset' ||
    !isPositiveSafeInteger(page) ||
    !isValidPageSize(pageSize) ||
    !isNonNegativeSafeInteger(totalPages) ||
    typeof totalItems !== 'string' ||
    !/^[0-9]+$/u.test(totalItems) ||
    typeof hasMore !== 'boolean'
  ) {
    throw new Error(`${resourceName} list response contains an invalid offset pageInfo payload.`);
  }

  return {
    items: data.items as TItem[],
    pageInfo: {
      hasMore,
      mode: 'offset',
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

const DEFAULT_SDK_PAGE_SIZE = 20;

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidPageSize(value: unknown): value is number {
  return isPositiveSafeInteger(value) && value <= 200;
}

type GeneratedPageQuery = {
  page?: number;
  page_size?: number;
};

function withDefaultPageSize<T extends { limit?: number }>(query: T): T & { limit: number } {
  if (query.limit === undefined) {
    return { ...query, limit: DEFAULT_SDK_PAGE_SIZE };
  }
  if (isValidPageSize(query.limit)) {
    return query as T & { limit: number };
  }
  throw new Error('Pagination limit must be an integer between 1 and 200.');
}

function toGeneratedPageQuery(
  options: BirdCoderWorkspaceScopedListRequest = {},
): GeneratedPageQuery {
  const scoped = withDefaultPageSize(options);
  const pageSize = scoped.limit;
  if (scoped.offset !== undefined && !isNonNegativeSafeInteger(scoped.offset)) {
    throw new Error('Pagination offset must be a non-negative safe integer.');
  }
  if (scoped.offset !== undefined && scoped.offset % pageSize !== 0) {
    throw new Error(`Pagination offset must be aligned to page size ${pageSize}.`);
  }
  const page = scoped.offset === undefined ? undefined : scoped.offset / pageSize + 1;
  if (page !== undefined && !isPositiveSafeInteger(page)) {
    throw new Error('Pagination offset produces an unsafe page number.');
  }
  return {
    ...(page === undefined ? {} : { page }),
    page_size: pageSize,
  };
}

function toGeneratedDocumentsQuery(
  options: { projectId?: string; limit?: number; offset?: number } = {},
): ContentDocumentsListQuery {
  return {
    ...(options.projectId ? { projectId: options.projectId } : {}),
    ...toGeneratedPageQuery(options),
  };
}

function toGeneratedCodeEngineKey(value: string | undefined): GeneratedCodeEngineKey | undefined {
  return value ? (value as GeneratedCodeEngineKey) : undefined;
}

function toGeneratedDataScope(
  dataScope: string | undefined,
): GeneratedBirdCoderCreateWorkspaceRequest['dataScope'] {
  if (!dataScope) {
    return undefined;
  }

  const normalizedDataScope = dataScope.trim().toUpperCase();
  if (BIRDCODER_DATA_SCOPES.includes(normalizedDataScope as GeneratedDataScope)) {
    return normalizedDataScope as GeneratedDataScope;
  }

  throw new Error(`Unsupported BirdCoder dataScope value: ${dataScope}`);
}

function toGeneratedCreateWorkspaceRequest(
  request: BirdCoderCreateWorkspaceRequest,
): GeneratedBirdCoderCreateWorkspaceRequest {
  return {
    ...request,
    dataScope: toGeneratedDataScope(request.dataScope),
  };
}

function toGeneratedUpdateWorkspaceRequest(
  request: BirdCoderUpdateWorkspaceRequest,
): GeneratedBirdCoderUpdateWorkspaceRequest {
  return {
    ...request,
    dataScope: toGeneratedDataScope(request.dataScope),
  };
}

function toGeneratedCreateProjectRequest(
  request: BirdCoderCreateProjectRequest,
): GeneratedBirdCoderCreateProjectRequest {
  const { description, name, workspaceId } = request;
  return {
    ...(description === undefined ? {} : { description }),
    name,
    workspaceId,
  };
}

function toGeneratedUpdateProjectRequest(
  request: BirdCoderUpdateProjectRequest,
): GeneratedBirdCoderUpdateProjectRequest {
  const { description, name, status } = request;
  return {
    ...(description === undefined ? {} : { description }),
    ...(name === undefined ? {} : { name }),
    ...(status === undefined ? {} : { status }),
  };
}

function toGeneratedCreateProjectGitWorktreeRequest(
  request: RuntimeBoundGitRequest<BirdCoderCreateProjectGitWorktreeRequest>,
): GeneratedBirdCoderCreateProjectGitWorktreeRequest {
  return {
    branchName: request.branchName,
    runtimeLocationId: request.runtimeLocationId,
  };
}

function toGeneratedRemoveProjectGitWorktreeRequest(
  request: RuntimeBoundGitRequest<BirdCoderRemoveProjectGitWorktreeRequest>,
): GeneratedBirdCoderRemoveProjectGitWorktreeRequest {
  return {
    ...(request.force === undefined ? {} : { force: request.force }),
    runtimeLocationId: request.runtimeLocationId,
    worktreeKey: request.worktreeKey,
  };
}

function toGeneratedCreateProjectGitBranchRequest(
  request: RuntimeBoundGitRequest<BirdCoderCreateProjectGitBranchRequest>,
): GeneratedBirdCoderCreateProjectGitBranchRequest {
  return {
    branchName: request.branchName,
    runtimeLocationId: request.runtimeLocationId,
  };
}

function toGeneratedSwitchProjectGitBranchRequest(
  request: RuntimeBoundGitRequest<BirdCoderSwitchProjectGitBranchRequest>,
): GeneratedBirdCoderSwitchProjectGitBranchRequest {
  return {
    branchName: request.branchName,
    runtimeLocationId: request.runtimeLocationId,
  };
}

function toGeneratedCommitProjectGitChangesRequest(
  request: RuntimeBoundGitRequest<BirdCoderCommitProjectGitChangesRequest>,
): GeneratedBirdCoderCommitProjectGitChangesRequest {
  return {
    ...(request.includeUnstaged === undefined
      ? {}
      : { includeUnstaged: request.includeUnstaged }),
    message: request.message,
    runtimeLocationId: request.runtimeLocationId,
  };
}

function toGeneratedPushProjectGitBranchRequest(
  request: RuntimeBoundGitRequest<BirdCoderPushProjectGitBranchRequest>,
): GeneratedBirdCoderPushProjectGitBranchRequest {
  return {
    ...(request.branchName === undefined ? {} : { branchName: request.branchName }),
    ...(request.remoteName === undefined ? {} : { remoteName: request.remoteName }),
    runtimeLocationId: request.runtimeLocationId,
  };
}

function toGeneratedUpsertProjectCollaboratorRequest(
  request: BirdCoderUpsertProjectCollaboratorRequest,
): GeneratedBirdCoderUpsertProjectCollaboratorRequest {
  const userId = request.userId.trim();
  if (!userId) {
    throw new Error('Project collaborator userId must not be blank.');
  }

  return {
    ...(request.role === undefined ? {} : { role: request.role }),
    ...(request.status === undefined ? {} : { status: request.status }),
    userId,
  };
}

function toGeneratedWorkspaceQuery(
  options: BirdCoderWorkspaceScopedListRequest,
): PlatformWorkspacesListQuery {
  const scoped = withDefaultPageSize(options);
  // The server resolves the authenticated user from the IAM context; the
  // client must not supply `userId` as a query parameter.
  return {
    ...toGeneratedPageQuery(scoped),
  };
}

function toGeneratedProjectQuery(
  options: BirdCoderProjectListRequest,
): PlatformProjectsListQuery {
  const scoped = withDefaultPageSize(options);
  // The server resolves the authenticated user from the IAM context; the
  // client must not supply `userId` as a query parameter.
  return {
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
    ...toGeneratedPageQuery(scoped),
  };
}

function toGeneratedProjectPageQuery(
  input: BirdCoderProjectPageRequest,
): PlatformProjectsListQuery {
  if (!isPositiveSafeInteger(input.page)) {
    throw new Error('Project page must be a positive integer.');
  }
  if (!isValidPageSize(input.pageSize)) {
    throw new Error('Project pageSize must be an integer between 1 and 200.');
  }
  const offset = (input.page - 1) * input.pageSize;
  if (!Number.isSafeInteger(offset) || offset > 200_000) {
    throw new Error('Project page exceeds the supported offset range.');
  }
  if (input.workspaceId !== undefined && isBlank(input.workspaceId)) {
    throw new Error('Project workspaceId must not be blank when provided.');
  }

  return {
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    page: input.page,
    page_size: input.pageSize,
  };
}

function toGeneratedWorkspacePageQuery(
  input: BirdCoderWorkspacePageRequest,
): PlatformWorkspacesListQuery {
  if (!isPositiveSafeInteger(input.page)) {
    throw new Error('Workspace page must be a positive integer.');
  }
  if (!isValidPageSize(input.pageSize)) {
    throw new Error('Workspace pageSize must be an integer between 1 and 200.');
  }
  const offset = (input.page - 1) * input.pageSize;
  if (!Number.isSafeInteger(offset) || offset > 200_000) {
    throw new Error('Workspace page exceeds the supported offset range.');
  }
  // The server resolves the authenticated user from the IAM context; the
  // client must not supply `userId` as a query parameter.
  return {
    page: input.page,
    page_size: input.pageSize,
  };
}

function toGeneratedWorkspaceTeamQuery(
  options: BirdCoderWorkspaceScopedListRequest,
): CollaborationWorkspaceTeamsListQuery {
  const scoped = withDefaultPageSize(options);
  // The server resolves the authenticated user from the IAM context; the
  // client must not supply `userId` as a query parameter.
  return {
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
    ...toGeneratedPageQuery(scoped),
  };
}

function toGeneratedCodingSessionQuery(
  request: BirdCoderListCodingSessionsRequest,
): IntelligenceCodingSessionsListQuery {
  const scoped = withDefaultPageSize(request);
  return {
    ...(scoped.engineId ? { engineId: toGeneratedCodeEngineKey(scoped.engineId) } : {}),
    ...toGeneratedPageQuery(scoped),
    ...(scoped.projectId ? { projectId: scoped.projectId } : {}),
    ...(scoped.runtimeLocationId ? { runtimeLocationId: scoped.runtimeLocationId } : {}),
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
  };
}

function toGeneratedNativeSessionListQuery(
  request: BirdCoderListNativeSessionsRequest,
): RuntimeNativeSessionsListQuery {
  const scoped = withDefaultPageSize(request);
  const workspaceId = scoped.workspaceId?.trim();
  const projectId = scoped.projectId?.trim();
  const runtimeLocationId = scoped.runtimeLocationId?.trim();
  if (!workspaceId || !projectId || !runtimeLocationId) {
    throw new Error('Native session list requires workspaceId, projectId, and runtimeLocationId.');
  }
  return {
    ...(scoped.engineId ? { engineId: toGeneratedCodeEngineKey(scoped.engineId) } : {}),
    ...toGeneratedPageQuery(scoped),
    projectId,
    runtimeLocationId,
    workspaceId,
  };
}

function toGeneratedNativeSessionRetrieveQuery(
  request: BirdCoderGetNativeSessionRequest,
): RuntimeNativeSessionsRetrieveQuery {
  const workspaceId = request.workspaceId?.trim();
  const projectId = request.projectId?.trim();
  const runtimeLocationId = request.runtimeLocationId?.trim();
  if (!workspaceId || !projectId || !runtimeLocationId) {
    throw new Error(
      'Native session retrieval requires workspaceId, projectId, and runtimeLocationId.',
    );
  }
  return {
    ...(request.engineId ? { engineId: toGeneratedCodeEngineKey(request.engineId) } : {}),
    projectId,
    runtimeLocationId,
    workspaceId,
  };
}

function toGeneratedSkillPackageQuery(
  options: BirdCoderWorkspaceScopedListRequest,
): SkillsSkillPackagesListQuery {
  const scoped = withDefaultPageSize(options);
  // The server resolves the authenticated user from the IAM context; the
  // client must not supply `userId` as a query parameter.
  return {
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
    ...toGeneratedPageQuery(scoped),
  };
}

interface BirdCoderSdkTokenManagerRef {
  current?: AuthTokenManager;
}

let generatedAppClient: BirdCoderTokenManagerAwareAppSdkClient | null = null;

export function createBirdCoderGeneratedAppSdkClient(
  options: BirdCoderGeneratedAppSdkClientOptions = {},
): BirdCoderTokenManagerAwareAppSdkClient {
  const tokenManagerRef: BirdCoderSdkTokenManagerRef = {
    current: options.tokenManager ?? getCoreBirdCoderGlobalTokenManager(),
  };
  const client = createBirdcoderAppSdkClient({
    accessToken: options.accessToken,
    authToken: options.authToken,
    transport: createBirdCoderSessionAwareTransport(
      resolveBirdCoderGeneratedSdkTransport(options, tokenManagerRef),
    ),
  });
  return attachBirdCoderSdkTokenManager(client, tokenManagerRef);
}

export function getBirdCoderGeneratedAppSdkClient(
  options: BirdCoderGeneratedAppSdkClientOptions = {},
): BirdCoderTokenManagerAwareAppSdkClient {
  if (options.tokenManager) {
    setBirdCoderSdkTokenManager(options.tokenManager);
  }
  if (hasGeneratedSdkRuntimeOverrides(options)) {
    return createBirdCoderGeneratedAppSdkClient(options);
  }

  if (!generatedAppClient) {
    generatedAppClient = createBirdCoderGeneratedAppSdkClient({
      tokenManager: getCoreBirdCoderGlobalTokenManager(),
    });
  }
  return generatedAppClient;
}

export function getBirdCoderGlobalTokenManager(): AuthTokenManager {
  return getCoreBirdCoderGlobalTokenManager();
}

export function setBirdCoderSdkTokenManager(tokenManager: AuthTokenManager): void {
  setBirdCoderGlobalTokenManager(tokenManager);
  generatedAppClient?.setTokenManager(tokenManager);
  setBirdCoderBackendSdkTokenManager(tokenManager);
}

export function resetBirdCoderSdkClients(): void {
  generatedAppClient = null;
  resetBirdCoderGeneratedBackendSdkClient();
}

export function resetBirdCoderSdkSessionAuthRedirectState(): void {
  resetSdkworkSessionAuthRedirectState();
}

export function isBirdCoderSdkSessionAuthError(error: unknown): boolean {
  return isSdkworkSdkSessionAuthError(error);
}

export function clearBirdCoderAppSessionState(): void {
  getCoreBirdCoderGlobalTokenManager().clearTokens();
  invalidateBirdCoderCurrentSession();
  invalidateBirdCoderCurrentUser();
  clearStoredAppSessionToken();
  resetBirdCoderSdkClients();
}

export function terminateBirdCoderAppSessionAfterRefreshFailure(): void {
  clearBirdCoderAppSessionState();
  redirectBrowserToBirdCoderProtectedLogin();
}

export function handleBirdCoderSdkSessionAuthError(error: unknown): boolean {
  return handleSdkworkSessionAuthUnauthorizedError(error, {
    clearSession: clearBirdCoderAppSessionState,
    redirectToLogin: () => {
      redirectBrowserToBirdCoderProtectedLogin();
    },
  });
}

function resolveBirdCoderGeneratedSdkTransport(
  options: BirdCoderGeneratedAppSdkClientOptions | BirdCoderGeneratedBackendSdkClientOptions,
  tokenManagerRef: BirdCoderSdkTokenManagerRef,
): BirdCoderApiTransport {
  if (options.transport) {
    return options.transport;
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = options.apiBaseUrl ?? runtimeConfig.apiBaseUrl ?? '';
  if (baseUrl || typeof window !== 'undefined') {
    return createBirdCoderHttpApiTransport({
      baseUrl,
      resolveHeaders: () => buildBirdCoderTokenManagerHeaders(tokenManagerRef.current),
      timeoutMs: options.timeoutMs,
    });
  }

  return createUnavailableBirdCoderGeneratedSdkTransport();
}

function createUnavailableBirdCoderGeneratedSdkTransport(): BirdCoderApiTransport {
  return {
    async request(request: Parameters<BirdCoderApiTransport['request']>[0]) {
      throw new Error(
        `BirdCoder generated SDK client is unavailable. Configure a real server API base URL or explicit generated SDK transport before using ${request.method} ${request.path}.`,
      );
    },
  };
}

function attachBirdCoderSdkTokenManager<
  TClient extends {
    clearSdkworkAuthTokens(): void;
    setSdkworkAuthTokens(tokens: { accessToken?: string; authToken?: string }): void;
  },
>(
  client: TClient,
  tokenManagerRef: BirdCoderSdkTokenManagerRef,
): BirdCoderTokenManagerAwareClient<TClient> {
  const tokenManagerAwareClient = client as BirdCoderTokenManagerAwareClient<TClient>;
  tokenManagerAwareClient.setTokenManager = (manager: AuthTokenManager) => {
    tokenManagerRef.current = manager;
    syncBirdCoderSdkAuthTokensFromTokenManager(client, manager);
    return tokenManagerAwareClient;
  };
  if (tokenManagerRef.current) {
    syncBirdCoderSdkAuthTokensFromTokenManager(client, tokenManagerRef.current);
  }
  return tokenManagerAwareClient;
}

function syncBirdCoderSdkAuthTokensFromTokenManager(
  client: {
    clearSdkworkAuthTokens(): void;
    setSdkworkAuthTokens(tokens: { accessToken?: string; authToken?: string }): void;
  },
  tokenManager: AuthTokenManager,
): void {
  const tokens = tokenManager.getTokens();
  if (tokens.authToken || tokens.accessToken) {
    client.setSdkworkAuthTokens({
      ...(tokens.accessToken ? { accessToken: tokens.accessToken } : {}),
      ...(tokens.authToken ? { authToken: tokens.authToken } : {}),
    });
    return;
  }
  client.clearSdkworkAuthTokens();
}

function buildBirdCoderTokenManagerHeaders(
  tokenManager: AuthTokenManager | undefined,
): Record<string, string | undefined> {
  return buildAuthHeaders('dual-token', undefined, tokenManager);
}

function createBirdCoderSessionAwareTransport(transport: BirdCoderApiTransport): BirdCoderApiTransport {
  return {
    async request<TResponse>(
      request: Parameters<BirdCoderApiTransport['request']>[0],
    ): Promise<TResponse> {
      try {
        return await transport.request<TResponse>(request);
      } catch (error) {
        handleBirdCoderSdkSessionAuthError(error);
        throw error;
      }
    },
  };
}

function hasGeneratedSdkRuntimeOverrides(
  options: BirdCoderGeneratedAppSdkClientOptions | BirdCoderGeneratedBackendSdkClientOptions,
): boolean {
  return Object.entries(options).some(([key, value]) => key !== 'tokenManager' && value !== undefined);
}

function readBirdCoderSdkErrorCode(error: unknown): string {
  if (error instanceof BirdCoderApiTransportError && error.code) {
    return String(error.code);
  }
  const value = readBirdCoderSdkErrorField(error, 'code');
  return normalizeBirdCoderSdkErrorCode(value);
}

function readBirdCoderSdkBusinessCode(error: unknown): string {
  if (error instanceof BirdCoderApiTransportError && error.businessCode) {
    return error.businessCode;
  }
  const value = readBirdCoderSdkErrorField(error, 'businessCode');
  return normalizeBirdCoderSdkErrorCode(value);
}

function readBirdCoderSdkErrorHttpStatus(error: unknown): number | undefined {
  return readBirdCoderApiTransportErrorHttpStatus(error);
}

function readBirdCoderSdkErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const value = readBirdCoderSdkErrorField(error, 'message')
    ?? readBirdCoderSdkErrorField(error, 'msg');
  return typeof value === 'string' ? value : '';
}

function readBirdCoderSdkErrorField(error: unknown, key: string): unknown {
  if (!isBirdCoderSdkErrorRecord(error)) {
    return undefined;
  }
  return error[key];
}

function normalizeBirdCoderSdkErrorCode(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return typeof value === 'string' ? value.trim() : '';
}

function isBirdCoderSdkErrorRecord(error: unknown): error is Record<string, unknown> {
  return typeof error === 'object' && error !== null && !Array.isArray(error);
}

export function createBirdCoderAppSdkApiClient({
  accessToken,
  authToken,
  transport,
}: CreateBirdCoderAppSdkApiClientOptions): BirdCoderAppSdkApiClient {
  const sessionTransport = createBirdCoderSessionAwareTransport(transport);
  const client: BirdcoderAppSdkClient = createBirdcoderAppSdkClient({
    accessToken,
    authToken,
    transport: sessionTransport,
  });

  return {
    async getDescriptor() {
      return readCanonicalData<BirdCoderCodingServerDescriptor>(
        await client.system.descriptor.retrieve(),
      );
    },
    async getRuntime() {
      return readCanonicalData<BirdCoderCoreRuntimeSummary>(
        await client.system.runtime.retrieve(),
      );
    },
    async getHealth() {
      return readCanonicalData<BirdCoderCoreHealthSummary>(
        await client.system.health.retrieve(),
      );
    },
    async listRoutes() {
      return readCanonicalItems<BirdCoderApiRouteCatalogEntry>(
        await client.system.routes.list(),
      );
    },
    async getOperation(operationId) {
      return readCanonicalData<BirdCoderOperationDescriptor>(
        await client.system.operations.retrieve({ operationId }),
      );
    },
    async listEngines() {
      return readCanonicalItems<BirdCoderEngineDescriptor>(
        await client.runtime.engines.list(),
      );
    },
    async getEngineCapabilities(engineKey) {
      return readCanonicalData<BirdCoderEngineCapabilityMatrix>(
        await client.runtime.engines.capabilities.retrieve({ engineKey }),
      );
    },
    async listModels() {
      return readCanonicalItems<BirdCoderModelCatalogEntry>(
        await client.runtime.models.list(),
      );
    },
    async getModelConfig() {
      return readCanonicalData<BirdCoderCodeEngineModelConfig>(
        await client.runtime.modelConfig.retrieve(),
      );
    },
    async syncModelConfig(request) {
      return readCanonicalData<BirdCoderCodeEngineModelConfigSyncResult>(
        await client.runtime.modelConfig.update(
          request as unknown as GeneratedBirdCoderSyncCodeEngineModelConfigRequest,
        ),
      );
    },
    async listNativeSessionProviders() {
      return readCanonicalItems<BirdCoderNativeSessionProviderSummary>(
        await client.runtime.nativeSessionProviders.list(),
      );
    },
    async listNativeSessions(request) {
      return readCanonicalItems<BirdCoderNativeSessionSummary>(
        await client.runtime.nativeSessions.list(toGeneratedNativeSessionListQuery(request)),
      );
    },
    async listNativeSessionPage(request) {
      return readCanonicalOffsetPage<BirdCoderNativeSessionSummary>(
        await client.runtime.nativeSessions.list(toGeneratedNativeSessionListQuery(request)),
        'Native session',
      );
    },
    async getNativeSession(codingSessionId, request) {
      return readCanonicalData<BirdCoderNativeSessionDetail>(
        await client.runtime.nativeSessions.retrieve(
          { id: codingSessionId },
          toGeneratedNativeSessionRetrieveQuery(request),
        ),
      );
    },
    async listCodingSessions(request = {}) {
      return readCanonicalItems<BirdCoderCodingSessionSummary>(
        await client.intelligence.codingSessions.list(toGeneratedCodingSessionQuery(request)),
      );
    },
    async listCodingSessionPage(request = {}) {
      return readCanonicalOffsetPage<BirdCoderCodingSessionSummary>(
        await client.intelligence.codingSessions.list(toGeneratedCodingSessionQuery(request)),
        'Coding session',
      );
    },
    async getCodingSession(codingSessionId) {
      return readCanonicalData<BirdCoderCodingSessionSummary>(
        await client.intelligence.codingSessions.retrieve({ sessionId: codingSessionId }),
      );
    },
    async listCodingSessionEvents(codingSessionId) {
      return readCanonicalItems<BirdCoderCodingSessionEvent>(
        await client.intelligence.codingSessions.events.list({ sessionId: codingSessionId }),
      );
    },
    async listCodingSessionArtifacts(codingSessionId) {
      return readCanonicalItems<BirdCoderCodingSessionArtifact>(
        await client.intelligence.codingSessions.artifacts.list({ sessionId: codingSessionId }),
      );
    },
    async listCodingSessionCheckpoints(codingSessionId) {
      return readCanonicalItems<BirdCoderCodingSessionCheckpoint>(
        await client.intelligence.codingSessions.checkpoints.list({ sessionId: codingSessionId }),
      );
    },
    async createCodingSession(request) {
      return readCanonicalData<BirdCoderCodingSessionSummary>(
        await client.intelligence.codingSessions.create(
          request as unknown as GeneratedBirdCoderCreateCodingSessionRequest,
        ),
      );
    },
    async forkCodingSession(codingSessionId, request = {}) {
      return readCanonicalData<BirdCoderCodingSessionSummary>(
        await client.intelligence.codingSessions.forks.create(
          { sessionId: codingSessionId },
          request as unknown as GeneratedBirdCoderForkCodingSessionRequest,
        ),
      );
    },
    async updateCodingSession(codingSessionId, request) {
      return readCanonicalData<BirdCoderCodingSessionSummary>(
        await client.intelligence.codingSessions.update(
          { sessionId: codingSessionId },
          request as unknown as GeneratedBirdCoderUpdateCodingSessionRequest,
        ),
      );
    },
    async deleteCodingSession(codingSessionId) {
      return readCanonicalData<BirdCoderDeleteCodingSessionResult>(
        await client.intelligence.codingSessions.delete({ sessionId: codingSessionId }),
      );
    },
    async editCodingSessionMessage(codingSessionId, messageId, request) {
      return readCanonicalData<BirdCoderEditCodingSessionMessageResult>(
        await client.intelligence.codingSessions.messages.update(
          { sessionId: codingSessionId, messageId },
          request,
        ),
      );
    },
    async deleteCodingSessionMessage(codingSessionId, messageId) {
      return readCanonicalData<BirdCoderDeleteCodingSessionMessageResult>(
        await client.intelligence.codingSessions.messages.delete({
          sessionId: codingSessionId,
          messageId,
        }),
      );
    },
    async createCodingSessionTurn(codingSessionId, request) {
      return readCanonicalData<BirdCoderCodingSessionTurn>(
        await client.intelligence.codingSessions.turns.create(
          { sessionId: codingSessionId },
          request as unknown as GeneratedBirdCoderCreateCodingSessionTurnRequest,
        ),
      );
    },
    async submitApprovalDecision(codingSessionId, interactionEventId, request) {
      return readCanonicalData<BirdCoderApprovalDecisionResult>(
        await client.intelligence.codingSessions.checkpoints.approval.create(
          { sessionId: codingSessionId, checkpointId: interactionEventId },
          request,
        ),
      );
    },
    async submitUserQuestionAnswer(codingSessionId, interactionEventId, request) {
      return readCanonicalData<BirdCoderUserQuestionAnswerResult>(
        await client.intelligence.codingSessions.questions.answers.create(
          { sessionId: codingSessionId, questionId: interactionEventId },
          request,
        ),
      );
    },
    async createWorkspace(request) {
      return readData(await client.platform.workspaces.create(toGeneratedCreateWorkspaceRequest(request)));
    },
    async updateWorkspace(workspaceId, request) {
      return readData(
        await client.platform.workspaces.update(
          { workspaceId },
          toGeneratedUpdateWorkspaceRequest(request),
        ),
      );
    },
    async deleteWorkspace(workspaceId) {
      await client.platform.workspaces.delete({ workspaceId });
    },
    async listWorkspaces(options = {}) {
      return readItems(await client.platform.workspaces.list(toGeneratedWorkspaceQuery(options)));
    },
    async listWorkspacePage(input) {
      return readCanonicalOffsetPage<BirdCoderWorkspaceSummary>(
        await client.platform.workspaces.list(toGeneratedWorkspacePageQuery(input)),
        'Workspace',
      );
    },
    async createProject(request) {
      return readData(await client.platform.projects.create(toGeneratedCreateProjectRequest(request)));
    },
    async bindProjectWorkspace(projectId, request) {
      const {
        idempotencyKey,
        logicalPath,
        rootEntryId,
        sandboxId,
      } = request;
      const body: GeneratedBirdCoderUpsertProjectWorkspaceBindingRequest = {
        logicalPath,
        rootEntryId,
        sandboxId,
      };
      await client.platform.projects.workspaceBinding.update(
        { projectId },
        body,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
    },
    async getProjectWorkspaceBinding(projectId) {
      try {
        return readData<GeneratedBirdCoderProjectWorkspaceBinding>(
          await client.platform.projects.workspaceBinding.retrieve({ projectId }),
        );
      } catch (error) {
        if (readBirdCoderSdkErrorHttpStatus(error) === 404) {
          return null;
        }
        throw error;
      }
    },
    async createProjectRuntimeLocation(projectId, request) {
      const { idempotencyKey, ...body } = request;
      return readProjectRuntimeLocationRecord(
        await client.platform.projects.runtimeLocations.create(
          { projectId },
          body as Parameters<typeof client.platform.projects.runtimeLocations.create>[1],
          { headers: { 'Idempotency-Key': idempotencyKey } },
        ),
      );
    },
    async updateProject(projectId, request) {
      return readData(
        await client.platform.projects.update(
          { projectId },
          toGeneratedUpdateProjectRequest(request),
        ),
      );
    },
    async deleteProject(projectId) {
      await client.platform.projects.delete({ projectId });
    },
    async listProjects(options = {}) {
      return readItems(await client.platform.projects.list(toGeneratedProjectQuery(options)));
    },
    async listProjectPage(input) {
      return readCanonicalOffsetPage<BirdCoderProjectSummary>(
        await client.platform.projects.list(toGeneratedProjectPageQuery(input)),
        'Project',
      );
    },
    async getProject(projectId) {
      return readData(await client.platform.projects.retrieve({ projectId }));
    },
    async getProjectGitOverview(projectId, runtimeLocationId) {
      return readData(
        await client.platform.projects.git.overview.retrieve(
          { projectId },
          { runtime_location_id: runtimeLocationId } satisfies PlatformProjectsGitOverviewRetrieveQuery,
        ),
      );
    },
    async getProjectGitDiff(projectId, runtimeLocationId) {
      return readData(
        await client.platform.projects.git.diff.retrieve(
          { projectId },
          { runtime_location_id: runtimeLocationId } satisfies PlatformProjectsGitDiffRetrieveQuery,
        ),
      );
    },
    async getProjectRuntimeLocation(projectId, runtimeLocationId) {
      return readProjectRuntimeLocationRecord(
        await client.platform.projects.runtimeLocations.retrieve({
          projectId,
          runtimeLocationId,
        }),
      );
    },
    async createProjectGitBranch(projectId, request) {
      return readData(
        await client.platform.projects.git.branches.create(
          { projectId },
          toGeneratedCreateProjectGitBranchRequest(request),
        ),
      );
    },
    async createProjectGitWorktree(projectId, request) {
      return readData(
        await client.platform.projects.git.worktrees.create(
          { projectId },
          toGeneratedCreateProjectGitWorktreeRequest(request),
        ),
      );
    },
    async switchProjectGitBranch(projectId, request) {
      return readData(
        await client.platform.projects.git.branchSwitch.create(
          { projectId },
          toGeneratedSwitchProjectGitBranchRequest(request),
        ),
      );
    },
    async commitProjectGitChanges(projectId, request) {
      return readData(
        await client.platform.projects.git.commits.create(
          { projectId },
          toGeneratedCommitProjectGitChangesRequest(request),
        ),
      );
    },
    async pushProjectGitBranch(projectId, request) {
      return readData(
        await client.platform.projects.git.pushes.create(
          { projectId },
          toGeneratedPushProjectGitBranchRequest(request),
        ),
      );
    },
    async removeProjectGitWorktree(projectId, request) {
      return readData(
        await client.platform.projects.git.worktreeRemovals.create(
          { projectId },
          toGeneratedRemoveProjectGitWorktreeRequest(request),
        ),
      );
    },
    async rebindProjectRuntimeLocation(projectId, runtimeLocationId, request) {
      const { idempotencyKey, ...body } = request;
      await client.platform.projects.runtimeLocations.rebind(
        { projectId, runtimeLocationId },
        body as Parameters<typeof client.platform.projects.runtimeLocations.rebind>[1],
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      return readProjectRuntimeLocationRecord(
        await client.platform.projects.runtimeLocations.retrieve({
          projectId,
          runtimeLocationId,
        }),
      );
    },
    async pruneProjectGitWorktrees(projectId, runtimeLocationId) {
      return readData(
        await client.platform.projects.git.worktreePrune.create(
          { projectId },
          { runtimeLocationId } satisfies GeneratedBirdCoderPruneProjectGitWorktreesRequest,
        ),
      );
    },
    async listDocuments(options = {}) {
      return readItems(await client.content.documents.list(toGeneratedDocumentsQuery(options)));
    },
    async listDeployments(options = {}) {
      return readItems(
        await client.platform.deployments.list(
          toGeneratedPageQuery(options) as PlatformDeploymentsListQuery,
        ),
      );
    },
    async listDeploymentTargets(projectId, options = {}) {
      return readItems(
        await client.platform.projects.deploymentTargets.list(
          { projectId },
          toGeneratedPageQuery(options) as PlatformProjectsDeploymentTargetsListQuery,
        ),
      );
    },
    async publishProject(projectId, request) {
      return readData(await client.platform.projects.publish.publish({ projectId }, request));
    },
    async listTeams(options = {}) {
      return readItems(await client.collaboration.workspaceTeams.list(toGeneratedWorkspaceTeamQuery(options)));
    },
    async listWorkspaceMembers(workspaceId, options = {}) {
      return readItems(
        await client.iam.workspaces.members.list(
          { workspaceId },
          toGeneratedPageQuery(options) as IamWorkspacesMembersListQuery,
        ),
      );
    },
    async upsertWorkspaceMember(workspaceId, request) {
      return readData(await client.iam.workspaces.members.create({ workspaceId }, request));
    },
    async listProjectCollaborators(projectId, options = {}) {
      return readItems(
        await client.platform.projects.collaborators.list(
          { projectId },
          toGeneratedPageQuery(options) as PlatformProjectsCollaboratorsListQuery,
        ),
      );
    },
    async upsertProjectCollaborator(projectId, request) {
      return readData(
        await client.platform.projects.collaborators.create(
          { projectId },
          toGeneratedUpsertProjectCollaboratorRequest(request),
        ),
      );
    },
    async listSkillPackages(options = {}) {
      return readItems(await client.skills.skillPackages.list(toGeneratedSkillPackageQuery(options)));
    },
    async installSkillPackage(packageId, request) {
      return readData(await client.skills.skillPackages.installations.create({ packageId }, request));
    },
    async listAppTemplates(options = {}) {
      return readItems(
        await client.templates.appTemplates.list(
          toGeneratedPageQuery(options) as TemplatesAppTemplatesListQuery,
        ),
      );
    },
  };
}

registerBirdCoderBackendSdkTransportResolver((options, tokenManagerRef) =>
  createBirdCoderSessionAwareTransport(
    resolveBirdCoderGeneratedSdkTransport(options, tokenManagerRef),
  ),
);
