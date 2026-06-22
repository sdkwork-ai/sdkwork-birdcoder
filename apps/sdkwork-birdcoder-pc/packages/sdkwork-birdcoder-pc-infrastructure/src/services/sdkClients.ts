import {
  createBirdcoderAppSdkClient,
  type BirdcoderAppSdkClient,
  type BirdCoderCreateCodingSessionRequest as GeneratedBirdCoderCreateCodingSessionRequest,
  type BirdCoderCreateCodingSessionTurnRequest as GeneratedBirdCoderCreateCodingSessionTurnRequest,
  type BirdCoderCreateProjectRequest as GeneratedBirdCoderCreateProjectRequest,
  type BirdCoderCreateWorkspaceRequest as GeneratedBirdCoderCreateWorkspaceRequest,
  type BirdCoderForkCodingSessionRequest as GeneratedBirdCoderForkCodingSessionRequest,
  type BirdCoderSyncCodeEngineModelConfigRequest as GeneratedBirdCoderSyncCodeEngineModelConfigRequest,
  type BirdCoderUpdateCodingSessionRequest as GeneratedBirdCoderUpdateCodingSessionRequest,
  type BirdCoderUpdateProjectRequest as GeneratedBirdCoderUpdateProjectRequest,
  type BirdCoderUpdateWorkspaceRequest as GeneratedBirdCoderUpdateWorkspaceRequest,
  type CollaborationWorkspaceTeamsListQuery,
  type IntelligenceCodingSessionsListQuery,
  type PlatformProjectsListQuery,
  type PlatformWorkspacesListQuery,
  type RuntimeNativeSessionsListQuery,
  type RuntimeNativeSessionsRetrieveQuery,
  type SkillsSkillPackagesListQuery,
} from '@sdkwork/birdcoder-app-sdk';
import {
  createBirdcoderBackendSdkClient,
  type BirdcoderBackendSdkClient,
  type IamTeamsListQuery as BackendIamTeamsListQuery,
} from '@sdkwork/birdcoder-backend-sdk';
import { type AuthTokenManager } from '@sdkwork/sdk-common';
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
  BirdCoderProjectDocumentSummary,
  BirdCoderProjectCollaboratorSummary,
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
} from '@sdkwork/birdcoder-pc-types';
import { clearStoredAppSessionToken } from './appSessionToken.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { createBirdCoderHttpApiTransport } from './sdkTransportShared.ts';

export interface BirdCoderWorkspaceScopedListRequest {
  userId?: string;
  workspaceId?: string;
  limit?: number;
  offset?: number;
}

export interface BirdCoderProjectListRequest extends BirdCoderWorkspaceScopedListRequest {
  rootPath?: string;
}

export interface BirdCoderAppSdkApiClient {
  createCodingSession(request: BirdCoderCreateCodingSessionRequest): Promise<BirdCoderCodingSessionSummary>;
  commitProjectGitChanges(
    projectId: string,
    request: BirdCoderCommitProjectGitChangesRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  createCodingSessionTurn(
    codingSessionId: string,
    request: BirdCoderCreateCodingSessionTurnRequest,
  ): Promise<BirdCoderCodingSessionTurn>;
  createProject(request: BirdCoderCreateProjectRequest): Promise<BirdCoderProjectSummary>;
  createProjectGitBranch(
    projectId: string,
    request: BirdCoderCreateProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  createProjectGitWorktree(
    projectId: string,
    request: BirdCoderCreateProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview>;
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
    request?: BirdCoderGetNativeSessionRequest,
  ): Promise<BirdCoderNativeSessionDetail>;
  getOperation(operationId: string): Promise<BirdCoderOperationDescriptor>;
  getProject(projectId: string): Promise<BirdCoderProjectSummary>;
  getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview>;
  getRuntime(): Promise<BirdCoderCoreRuntimeSummary>;
  installSkillPackage(
    packageId: string,
    request: BirdCoderInstallSkillPackageRequest,
  ): Promise<BirdCoderSkillInstallationSummary>;
  listAppTemplates(): Promise<BirdCoderAppTemplateSummary[]>;
  listCodingSessionArtifacts(codingSessionId: string): Promise<BirdCoderCodingSessionArtifact[]>;
  listCodingSessionCheckpoints(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionCheckpoint[]>;
  listCodingSessionEvents(codingSessionId: string): Promise<BirdCoderCodingSessionEvent[]>;
  listCodingSessions(
    request?: BirdCoderListCodingSessionsRequest,
  ): Promise<BirdCoderCodingSessionSummary[]>;
  listDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listDocuments(): Promise<BirdCoderProjectDocumentSummary[]>;
  listEngines(): Promise<BirdCoderEngineDescriptor[]>;
  listModels(): Promise<BirdCoderModelCatalogEntry[]>;
  listNativeSessionProviders(): Promise<BirdCoderNativeSessionProviderSummary[]>;
  listNativeSessions(
    request?: BirdCoderListNativeSessionsRequest,
  ): Promise<BirdCoderNativeSessionSummary[]>;
  listProjectCollaborators(projectId: string): Promise<BirdCoderProjectCollaboratorSummary[]>;
  listProjects(options?: BirdCoderProjectListRequest): Promise<BirdCoderProjectSummary[]>;
  listRoutes(): Promise<BirdCoderApiRouteCatalogEntry[]>;
  listSkillPackages(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderSkillPackageSummary[]>;
  listTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listWorkspaceMembers(workspaceId: string): Promise<BirdCoderWorkspaceMemberSummary[]>;
  listWorkspaces(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderWorkspaceSummary[]>;
  publishProject(
    projectId: string,
    request: BirdCoderPublishProjectRequest,
  ): Promise<BirdCoderProjectPublishResult>;
  pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview>;
  pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  submitApprovalDecision(
    codingSessionId: string,
    checkpointId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ): Promise<BirdCoderApprovalDecisionResult>;
  submitUserQuestionAnswer(
    codingSessionId: string,
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ): Promise<BirdCoderUserQuestionAnswerResult>;
  switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
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

export interface BirdCoderBackendSdkApiClient {
  listAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]>;
  listDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]>;
  listGovernanceDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listGovernanceTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listPolicies(): Promise<BirdCoderIamPolicySummary[]>;
  listReleases(): Promise<BirdCoderReleaseSummary[]>;
  listTeamMembers(teamId: string): Promise<BirdCoderTeamMemberSummary[]>;
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
  | 'listCodingSessions'
  | 'listEngines'
  | 'listModels'
  | 'listNativeSessionProviders'
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

export interface CreateBirdCoderBackendSdkApiClientOptions {
  accessToken?: string;
  authToken?: string;
  transport: BirdCoderApiTransport;
}

export interface BirdCoderGeneratedAppSdkClientOptions {
  accessToken?: string;
  apiBaseUrl?: string;
  authToken?: string;
  timeoutMs?: number;
  tokenManager?: AuthTokenManager;
  transport?: BirdCoderApiTransport;
}

export interface BirdCoderGeneratedBackendSdkClientOptions {
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

export type BirdCoderTokenManagerAwareBackendSdkClient =
  BirdCoderTokenManagerAwareClient<BirdcoderBackendSdkClient>;

interface DataEnvelope<TData> {
  data: TData;
}

interface ListEnvelope<TItem> {
  items: TItem[];
}

type GeneratedCodeEngineKey = NonNullable<IntelligenceCodingSessionsListQuery['engineId']>;

function readData<TData>(envelope: DataEnvelope<TData>): TData {
  return envelope.data;
}

function readItems<TItem>(envelope: ListEnvelope<TItem>): TItem[] {
  return envelope.items;
}

function readCanonicalData<TData>(envelope: DataEnvelope<unknown>): TData {
  return envelope.data as TData;
}

function readCanonicalItems<TItem>(envelope: ListEnvelope<unknown>): TItem[] {
  return envelope.items as TItem[];
}

const DEFAULT_SDK_LIST_LIMIT = 20;

function withDefaultListLimit<T extends { limit?: number }>(query: T): T {
  return typeof query.limit === 'number' ? query : { ...query, limit: DEFAULT_SDK_LIST_LIMIT };
}

function toGeneratedCodeEngineKey(value: string | undefined): GeneratedCodeEngineKey | undefined {
  return value ? (value as GeneratedCodeEngineKey) : undefined;
}

function toGeneratedDataScope(
  dataScope: string | undefined,
): GeneratedBirdCoderCreateWorkspaceRequest['dataScope'] {
  if (
    dataScope === 'DEFAULT' ||
    dataScope === 'PRIVATE' ||
    dataScope === 'ORGANIZATION' ||
    dataScope === 'TENANT' ||
    dataScope === 'PUBLIC'
  ) {
    return dataScope;
  }
  return undefined;
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
  return {
    ...request,
    dataScope: toGeneratedDataScope(request.dataScope),
  };
}

function toGeneratedUpdateProjectRequest(
  request: BirdCoderUpdateProjectRequest,
): GeneratedBirdCoderUpdateProjectRequest {
  return {
    ...request,
    dataScope: toGeneratedDataScope(request.dataScope),
  };
}

function toGeneratedWorkspaceQuery(
  options: BirdCoderWorkspaceScopedListRequest,
): PlatformWorkspacesListQuery {
  const scoped = withDefaultListLimit(options);
  return {
    ...(scoped.userId ? { userId: scoped.userId } : {}),
    ...(typeof scoped.limit === 'number' ? { limit: scoped.limit } : {}),
    ...(typeof scoped.offset === 'number' ? { offset: scoped.offset } : {}),
  };
}

function toGeneratedProjectQuery(
  options: BirdCoderProjectListRequest,
): PlatformProjectsListQuery {
  const scoped = withDefaultListLimit(options);
  return {
    ...(scoped.rootPath ? { rootPath: scoped.rootPath } : {}),
    ...(scoped.userId ? { userId: scoped.userId } : {}),
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
    ...(typeof scoped.limit === 'number' ? { limit: scoped.limit } : {}),
    ...(typeof scoped.offset === 'number' ? { offset: scoped.offset } : {}),
  };
}

function toGeneratedWorkspaceTeamQuery(
  options: BirdCoderWorkspaceScopedListRequest,
): CollaborationWorkspaceTeamsListQuery {
  const scoped = withDefaultListLimit(options);
  return {
    ...(scoped.userId ? { userId: scoped.userId } : {}),
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
    ...(typeof scoped.limit === 'number' ? { limit: scoped.limit } : {}),
    ...(typeof scoped.offset === 'number' ? { offset: scoped.offset } : {}),
  };
}

function toGeneratedCodingSessionQuery(
  request: BirdCoderListCodingSessionsRequest,
): IntelligenceCodingSessionsListQuery {
  const scoped = withDefaultListLimit(request);
  return {
    ...(scoped.engineId ? { engineId: toGeneratedCodeEngineKey(scoped.engineId) } : {}),
    limit: scoped.limit,
    ...(typeof scoped.offset === 'number' ? { offset: scoped.offset } : {}),
    ...(scoped.projectId ? { projectId: scoped.projectId } : {}),
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
  };
}

function toGeneratedNativeSessionListQuery(
  request: BirdCoderListNativeSessionsRequest,
): RuntimeNativeSessionsListQuery {
  const scoped = withDefaultListLimit(request);
  return {
    ...(scoped.engineId ? { engineId: toGeneratedCodeEngineKey(scoped.engineId) } : {}),
    limit: scoped.limit,
    ...(typeof scoped.offset === 'number' ? { offset: scoped.offset } : {}),
    ...(scoped.projectId ? { projectId: scoped.projectId } : {}),
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
  };
}

function toGeneratedNativeSessionRetrieveQuery(
  request: BirdCoderGetNativeSessionRequest,
): RuntimeNativeSessionsRetrieveQuery {
  return {
    ...(request.engineId ? { engineId: toGeneratedCodeEngineKey(request.engineId) } : {}),
    ...(request.projectId ? { projectId: request.projectId } : {}),
    ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
  };
}

function toGeneratedSkillPackageQuery(
  options: BirdCoderWorkspaceScopedListRequest,
): SkillsSkillPackagesListQuery {
  const scoped = withDefaultListLimit(options);
  return {
    ...(scoped.userId ? { userId: scoped.userId } : {}),
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
    ...(typeof scoped.limit === 'number' ? { limit: scoped.limit } : {}),
    ...(typeof scoped.offset === 'number' ? { offset: scoped.offset } : {}),
  };
}

function toGeneratedBackendTeamQuery(
  options: BirdCoderWorkspaceScopedListRequest,
): BackendIamTeamsListQuery {
  const scoped = withDefaultListLimit(options);
  return {
    ...(scoped.userId ? { userId: scoped.userId } : {}),
    ...(scoped.workspaceId ? { workspaceId: scoped.workspaceId } : {}),
    ...(typeof scoped.limit === 'number' ? { limit: scoped.limit } : {}),
    ...(typeof scoped.offset === 'number' ? { offset: scoped.offset } : {}),
  };
}

interface BirdCoderSdkTokenManagerRef {
  current?: AuthTokenManager;
}

let generatedAppClient: BirdCoderTokenManagerAwareAppSdkClient | null = null;
let generatedBackendClient: BirdCoderTokenManagerAwareBackendSdkClient | null = null;
let sessionAuthRedirectTarget: string | null = null;

const SESSION_AUTH_ERROR_CODES = new Set([
  '401',
  '4010',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
]);
const SESSION_AUTH_ERROR_MESSAGES = [
  'app session token has expired',
  'session token has expired',
  'token has expired',
  'not logged in',
  'not login',
  'unauthorized',
];

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

export function createBirdCoderGeneratedBackendSdkClient(
  options: BirdCoderGeneratedBackendSdkClientOptions = {},
): BirdCoderTokenManagerAwareBackendSdkClient {
  const tokenManagerRef: BirdCoderSdkTokenManagerRef = {
    current: options.tokenManager ?? getCoreBirdCoderGlobalTokenManager(),
  };
  const client = createBirdcoderBackendSdkClient({
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

export function getBirdCoderGeneratedBackendSdkClient(
  options: BirdCoderGeneratedBackendSdkClientOptions = {},
): BirdCoderTokenManagerAwareBackendSdkClient {
  if (options.tokenManager) {
    setBirdCoderSdkTokenManager(options.tokenManager);
  }
  if (hasGeneratedSdkRuntimeOverrides(options)) {
    return createBirdCoderGeneratedBackendSdkClient(options);
  }

  if (!generatedBackendClient) {
    generatedBackendClient = createBirdCoderGeneratedBackendSdkClient({
      tokenManager: getCoreBirdCoderGlobalTokenManager(),
    });
  }
  return generatedBackendClient;
}

export function getBirdCoderGlobalTokenManager(): AuthTokenManager {
  return getCoreBirdCoderGlobalTokenManager();
}

export function setBirdCoderSdkTokenManager(tokenManager: AuthTokenManager): void {
  setBirdCoderGlobalTokenManager(tokenManager);
  generatedAppClient?.setTokenManager(tokenManager);
  generatedBackendClient?.setTokenManager(tokenManager);
}

export function resetBirdCoderSdkClients(): void {
  generatedAppClient = null;
  generatedBackendClient = null;
}

export function resetBirdCoderSdkSessionAuthRedirectState(): void {
  sessionAuthRedirectTarget = null;
}

export function isBirdCoderSdkSessionAuthError(error: unknown): boolean {
  const code = readBirdCoderSdkErrorCode(error);
  const httpStatus = readBirdCoderSdkErrorHttpStatus(error);
  const businessCode = readBirdCoderSdkBusinessCode(error);
  if (httpStatus === 401) {
    return true;
  }
  if (code && SESSION_AUTH_ERROR_CODES.has(code.toUpperCase())) {
    return true;
  }
  if (businessCode && SESSION_AUTH_ERROR_CODES.has(businessCode.toUpperCase())) {
    return true;
  }

  const message = readBirdCoderSdkErrorMessage(error).toLowerCase();
  return SESSION_AUTH_ERROR_MESSAGES.some((pattern) => message.includes(pattern));
}

export function handleBirdCoderSdkSessionAuthError(error: unknown): boolean {
  if (!isBirdCoderSdkSessionAuthError(error)) {
    return false;
  }

  clearStoredAppSessionToken();
  resetBirdCoderSdkClients();
  redirectBrowserToBirdCoderLoginAfterSessionAuthError(readBrowserWindow());
  return true;
}

function resolveBirdCoderGeneratedSdkTransport(
  options: BirdCoderGeneratedAppSdkClientOptions | BirdCoderGeneratedBackendSdkClientOptions,
  tokenManagerRef: BirdCoderSdkTokenManagerRef,
): BirdCoderApiTransport {
  if (options.transport) {
    return options.transport;
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = options.apiBaseUrl ?? runtimeConfig.apiBaseUrl;
  if (baseUrl) {
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
  const tokens = tokenManager?.getTokens();
  return {
    Authorization: tokens?.authToken ? `Bearer ${tokens.authToken}` : undefined,
    'Access-Token': tokens?.accessToken,
    'Refresh-Token': tokens?.refreshToken,
  };
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

type BrowserLocationWithReplace = {
  hash?: string;
  pathname?: string;
  replace?: (url: string) => void;
  search?: string;
};

type BrowserWindowWithLocation = {
  location?: BrowserLocationWithReplace;
};

function readBrowserWindow(): BrowserWindowWithLocation | undefined {
  const candidate = globalThis as typeof globalThis & { window?: BrowserWindowWithLocation };
  return candidate.window;
}

function redirectBrowserToBirdCoderLoginAfterSessionAuthError(
  browserWindow: BrowserWindowWithLocation | undefined,
): void {
  const location = browserWindow?.location;
  if (!location || typeof location.replace !== 'function') {
    return;
  }

  const pathname = normalizeBrowserLocationPathname(location.pathname);
  if (pathname === '/auth' || pathname.startsWith('/auth/')) {
    return;
  }

  const redirectTo = buildBirdCoderAuthLoginRedirect({
    hash: location.hash,
    pathname,
    search: location.search,
  });
  if (sessionAuthRedirectTarget === redirectTo) {
    return;
  }

  sessionAuthRedirectTarget = redirectTo;
  location.replace(redirectTo);
}

function buildBirdCoderAuthLoginRedirect({
  hash,
  pathname,
  search,
}: {
  hash?: string;
  pathname: string;
  search?: string;
}): string {
  const redirectPath = `${pathname}${search ?? ''}${hash ?? ''}`;
  const params = new URLSearchParams();
  if (redirectPath && redirectPath !== '/') {
    params.set('redirect', redirectPath);
  }
  const query = params.toString();
  return query ? `/auth?${query}` : '/auth';
}

function normalizeBrowserLocationPathname(pathname: string | undefined): string {
  const normalized = pathname?.trim();
  if (!normalized) {
    return '/';
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function readBirdCoderSdkErrorCode(error: unknown): string {
  const value = readBirdCoderSdkErrorField(error, 'code');
  return normalizeBirdCoderSdkErrorCode(value);
}

function readBirdCoderSdkBusinessCode(error: unknown): string {
  const value = readBirdCoderSdkErrorField(error, 'businessCode');
  return normalizeBirdCoderSdkErrorCode(value);
}

function readBirdCoderSdkErrorHttpStatus(error: unknown): number | undefined {
  const value = readBirdCoderSdkErrorField(error, 'httpStatus');
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
  const client: BirdcoderAppSdkClient = createBirdcoderAppSdkClient({
    accessToken,
    authToken,
    transport,
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
        await client.runtime.modelConfig.sync(
          request as unknown as GeneratedBirdCoderSyncCodeEngineModelConfigRequest,
        ),
      );
    },
    async listNativeSessionProviders() {
      return readCanonicalItems<BirdCoderNativeSessionProviderSummary>(
        await client.runtime.nativeSessionProviders.list(),
      );
    },
    async listNativeSessions(request = {}) {
      return readCanonicalItems<BirdCoderNativeSessionSummary>(
        await client.runtime.nativeSessions.list(toGeneratedNativeSessionListQuery(request)),
      );
    },
    async getNativeSession(codingSessionId, request = {}) {
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
    async submitApprovalDecision(codingSessionId, checkpointId, request) {
      return readCanonicalData<BirdCoderApprovalDecisionResult>(
        await client.intelligence.codingSessions.checkpoints.approval.create(
          { sessionId: codingSessionId, checkpointId },
          request,
        ),
      );
    },
    async submitUserQuestionAnswer(codingSessionId, questionId, request) {
      return readCanonicalData<BirdCoderUserQuestionAnswerResult>(
        await client.intelligence.codingSessions.questions.answers.create(
          { sessionId: codingSessionId, questionId },
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
    async createProject(request) {
      return readData(await client.platform.projects.create(toGeneratedCreateProjectRequest(request)));
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
    async getProject(projectId) {
      return readData(await client.platform.projects.retrieve({ projectId }));
    },
    async getProjectGitOverview(projectId) {
      return readData(await client.platform.projects.git.overview.retrieve({ projectId }));
    },
    async createProjectGitBranch(projectId, request) {
      return readData(await client.platform.projects.git.branches.create({ projectId }, request));
    },
    async createProjectGitWorktree(projectId, request) {
      return readData(await client.platform.projects.git.worktrees.create({ projectId }, request));
    },
    async switchProjectGitBranch(projectId, request) {
      return readData(await client.platform.projects.git.branchSwitch.create({ projectId }, request));
    },
    async commitProjectGitChanges(projectId, request) {
      return readData(await client.platform.projects.git.commits.create({ projectId }, request));
    },
    async pushProjectGitBranch(projectId, request) {
      return readData(await client.platform.projects.git.pushes.create({ projectId }, request));
    },
    async removeProjectGitWorktree(projectId, request) {
      return readData(await client.platform.projects.git.worktreeRemovals.create({ projectId }, request));
    },
    async pruneProjectGitWorktrees(projectId) {
      return readData(await client.platform.projects.git.worktreePrune.create({ projectId }));
    },
    async listDocuments() {
      return readItems(await client.content.documents.list());
    },
    async listDeployments() {
      return readItems(await client.platform.deployments.list());
    },
    async publishProject(projectId, request) {
      return readData(await client.platform.projects.publish.create({ projectId }, request));
    },
    async listTeams(options = {}) {
      return readItems(await client.collaboration.workspaceTeams.list(toGeneratedWorkspaceTeamQuery(options)));
    },
    async listWorkspaceMembers(workspaceId) {
      return readItems(await client.iam.workspaces.members.list({ workspaceId }));
    },
    async upsertWorkspaceMember(workspaceId, request) {
      return readData(await client.iam.workspaces.members.upsert({ workspaceId }, request));
    },
    async listProjectCollaborators(projectId) {
      return readItems(await client.platform.projects.collaborators.list({ projectId }));
    },
    async upsertProjectCollaborator(projectId, request) {
      return readData(await client.platform.projects.collaborators.upsert({ projectId }, request));
    },
    async listSkillPackages(options = {}) {
      return readItems(await client.skills.skillPackages.list(toGeneratedSkillPackageQuery(options)));
    },
    async installSkillPackage(packageId, request) {
      return readData(await client.skills.skillPackages.installations.create({ packageId }, request));
    },
    async listAppTemplates() {
      return readItems(await client.templates.appTemplates.list());
    },
  };
}

export function createBirdCoderBackendSdkApiClient({
  accessToken,
  authToken,
  transport,
}: CreateBirdCoderBackendSdkApiClientOptions): BirdCoderBackendSdkApiClient {
  const client: BirdcoderBackendSdkClient = createBirdcoderBackendSdkClient({
    accessToken,
    authToken,
    transport,
  });

  return {
    async listGovernanceDeployments() {
      return readItems(await client.platform.deploymentGovernance.list());
    },
    async listDeploymentTargets(projectId) {
      return readItems(await client.platform.projects.deploymentTargets.list({ projectId }));
    },
    async listGovernanceTeams(options = {}) {
      return readItems(await client.iam.teams.list(toGeneratedBackendTeamQuery(options)));
    },
    async listTeamMembers(teamId) {
      return readItems(await client.iam.teams.members.list({ teamId }));
    },
    async listReleases() {
      return readItems(await client.platform.releases.list());
    },
    async listAuditEvents() {
      return readItems(await client.iam.auditEvents.list());
    },
    async listPolicies() {
      return readItems(await client.iam.policies.list());
    },
  };
}
