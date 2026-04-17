import type {
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionMessage,
  BirdCoderCodingSessionRuntimeStatus,
  BirdCoderCodingSessionRuntime,
  BirdCoderCodingSessionSummary,
  BirdCoderCodingSessionTurn,
  BirdCoderHostMode,
} from './coding-session.ts';
import type {
  BirdCoderCodeEngineKey,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineBindingSummary,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
} from './engine.ts';
import type { BirdcoderApprovalPolicy } from './governance.ts';
import {
  createBirdCoderFinalizedCodingServerClient,
  type BirdCoderFinalizedCodingServerClientOperationId,
} from './generated/coding-server-client.ts';

export const BIRDCODER_API_SURFACES = ['core', 'app', 'admin'] as const;

export type BirdCoderApiSurface = (typeof BIRDCODER_API_SURFACES)[number];

export const BIRDCODER_CODING_SERVER_API_VERSION = 'v1';

export const BIRDCODER_CODING_SERVER_API_PREFIXES = {
  admin: '/api/admin/v1',
  app: '/api/app/v1',
  core: '/api/core/v1',
} as const;

export type BirdCoderApiQueryValue = boolean | number | string | null | undefined;

export interface BirdCoderApiTransportRequest {
  body?: unknown;
  headers?: Record<string, string | undefined>;
  method: BirdCoderApiRouteDefinition['method'];
  path: string;
  query?: Record<string, BirdCoderApiQueryValue>;
}

export interface BirdCoderApiTransport {
  request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse>;
}

export interface BirdCoderApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  version: string;
}

export interface BirdCoderApiEnvelope<T> {
  requestId: string;
  timestamp: string;
  data: T;
  meta: BirdCoderApiMeta;
}

export interface BirdCoderApiListEnvelope<T> {
  requestId: string;
  timestamp: string;
  items: T[];
  meta: Required<Pick<BirdCoderApiMeta, 'page' | 'pageSize' | 'total' | 'version'>>;
}

export interface BirdCoderApiProblemDetails {
  code: string;
  message: string;
  detail?: string;
  retryable: boolean;
  fieldErrors?: Record<string, string>;
}

export interface BirdCoderApiRouteDefinition {
  authMode: 'host' | 'user' | 'admin';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  surface: BirdCoderApiSurface;
  summary: string;
}

export interface BirdCoderApiRouteCatalogEntry extends BirdCoderApiRouteDefinition {
  openApiPath: string;
  operationId: string;
}

export interface BirdCoderApiGatewaySurfaceSummary {
  authMode: BirdCoderApiRouteDefinition['authMode'];
  basePath: string;
  description: string;
  name: BirdCoderApiSurface;
  routeCount: number;
}

export interface BirdCoderApiGatewaySummary {
  basePath: string;
  docsPath: string;
  liveOpenApiPath: string;
  openApiPath: string;
  routeCatalogPath: string;
  routeCount: number;
  routesBySurface: Record<BirdCoderApiSurface, number>;
  surfaces: readonly BirdCoderApiGatewaySurfaceSummary[];
}

export interface BirdCoderOperationDescriptor {
  operationId: string;
  status:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'rolled_back';
  artifactRefs: string[];
  streamUrl?: string;
  streamKind?: 'sse' | 'websocket';
}

export interface BirdCoderSubmitApprovalDecisionRequest {
  decision: 'approved' | 'denied' | 'blocked';
  reason?: string;
}

export interface BirdCoderApprovalDecisionResult {
  approvalId: string;
  checkpointId: string;
  codingSessionId: string;
  decision: BirdCoderSubmitApprovalDecisionRequest['decision'];
  decidedAt: string;
  operationId?: string;
  operationStatus: BirdCoderOperationDescriptor['status'];
  reason?: string;
  runtimeId?: string;
  runtimeStatus: BirdCoderCodingSessionRuntimeStatus;
  turnId?: string;
}

export interface BirdCoderWorkspaceSummary {
  id: string;
  name: string;
  description?: string;
  ownerIdentityId?: string;
  createdByIdentityId?: string;
  memberCount?: number;
  status: 'active' | 'archived';
  viewerRole?: BirdCoderCollaborationRole;
}

export interface BirdCoderCreateWorkspaceRequest {
  description?: string;
  name: string;
  ownerIdentityId?: string;
  createdByIdentityId?: string;
}

export interface BirdCoderUpdateWorkspaceRequest {
  description?: string;
  name?: string;
  status?: BirdCoderWorkspaceSummary['status'];
}

export interface BirdCoderProjectSummary {
  createdAt: string;
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  rootPath?: string;
  ownerIdentityId?: string;
  createdByIdentityId?: string;
  collaboratorCount?: number;
  status: 'active' | 'archived';
  updatedAt: string;
  viewerRole?: BirdCoderCollaborationRole;
}

export interface BirdCoderCreateProjectRequest {
  description?: string;
  name: string;
  ownerIdentityId?: string;
  createdByIdentityId?: string;
  rootPath?: string;
  status?: BirdCoderProjectSummary['status'];
  workspaceId: string;
}

export interface BirdCoderUpdateProjectRequest {
  description?: string;
  name?: string;
  rootPath?: string;
  status?: BirdCoderProjectSummary['status'];
}

export interface BirdCoderProjectDocumentSummary {
  id: string;
  projectId: string;
  documentKind: 'prd' | 'architecture' | 'step' | 'release' | 'test-plan' | 'custom';
  title: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  updatedAt: string;
}

export interface BirdCoderTeamSummary {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  ownerIdentityId?: string;
  createdByIdentityId?: string;
  status: 'active' | 'archived';
}

export type BirdCoderCollaborationRole = 'owner' | 'admin' | 'member' | 'viewer';

export type BirdCoderCollaborationStatus =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'removed';

export interface BirdCoderTeamMemberSummary {
  id: string;
  teamId: string;
  identityId: string;
  role: BirdCoderCollaborationRole;
  status: BirdCoderCollaborationStatus;
  createdByIdentityId?: string;
  grantedByIdentityId?: string;
}

export interface BirdCoderWorkspaceMemberSummary {
  id: string;
  workspaceId: string;
  identityId: string;
  identityEmail?: string;
  identityDisplayName?: string;
  identityAvatarUrl?: string;
  teamId?: string;
  role: BirdCoderCollaborationRole;
  status: BirdCoderCollaborationStatus;
  createdByIdentityId?: string;
  grantedByIdentityId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BirdCoderProjectCollaboratorSummary {
  id: string;
  projectId: string;
  workspaceId: string;
  identityId: string;
  identityEmail?: string;
  identityDisplayName?: string;
  identityAvatarUrl?: string;
  teamId?: string;
  role: BirdCoderCollaborationRole;
  status: BirdCoderCollaborationStatus;
  createdByIdentityId?: string;
  grantedByIdentityId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BirdCoderUpsertWorkspaceMemberRequest {
  identityId?: string;
  email?: string;
  teamId?: string;
  role?: BirdCoderCollaborationRole;
  status?: BirdCoderCollaborationStatus;
  createdByIdentityId?: string;
  grantedByIdentityId?: string;
}

export interface BirdCoderUpsertProjectCollaboratorRequest {
  identityId?: string;
  email?: string;
  teamId?: string;
  role?: BirdCoderCollaborationRole;
  status?: BirdCoderCollaborationStatus;
  createdByIdentityId?: string;
  grantedByIdentityId?: string;
}

export interface BirdCoderDeploymentTargetSummary {
  id: string;
  projectId: string;
  name: string;
  environmentKey: 'dev' | 'test' | 'staging' | 'prod' | (string & {});
  runtime: 'web' | 'desktop' | 'server' | 'container' | 'kubernetes' | (string & {});
  status: 'active' | 'archived';
}

export interface BirdCoderDeploymentRecordSummary {
  id: string;
  projectId: string;
  targetId: string;
  status: 'planned' | 'running' | 'succeeded' | 'failed' | 'rolled_back';
  startedAt?: string;
  completedAt?: string;
}

export interface BirdCoderReleaseSummary {
  id: string;
  releaseVersion: string;
  releaseKind: 'formal' | 'canary' | 'hotfix' | 'rollback' | (string & {});
  rolloutStage: string;
  status: 'pending' | 'ready' | 'running' | 'succeeded' | 'failed' | 'rolled_back' | (string & {});
}

export interface BirdCoderPublishProjectRequest {
  endpointUrl?: string;
  environmentKey?: BirdCoderDeploymentTargetSummary['environmentKey'];
  releaseKind?: BirdCoderReleaseSummary['releaseKind'];
  releaseVersion?: string;
  rolloutStage?: string;
  runtime?: BirdCoderDeploymentTargetSummary['runtime'];
  targetId?: string;
  targetName?: string;
}

export interface BirdCoderProjectPublishResult {
  deployment: BirdCoderDeploymentRecordSummary;
  release: BirdCoderReleaseSummary;
  target: BirdCoderDeploymentTargetSummary;
}

export interface BirdCoderAdminAuditEventSummary {
  id: string;
  scopeType: string;
  scopeId: string;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface BirdCoderAdminPolicySummary {
  id: string;
  scopeType: 'global' | 'workspace' | 'project' | 'team' | 'release' | 'runtime' | (string & {});
  scopeId: string;
  policyCategory:
    | 'terminal'
    | 'engine'
    | 'deployment'
    | 'release'
    | 'workspace'
    | 'project'
    | (string & {});
  targetType:
    | 'engine'
    | 'workflow'
    | 'terminal-profile'
    | 'deployment-target'
    | 'workspace'
    | 'project'
    | (string & {});
  targetId: string;
  approvalPolicy: BirdcoderApprovalPolicy;
  rationale?: string;
  status: 'draft' | 'active' | 'archived' | (string & {});
  updatedAt: string;
}

export type BirdCoderUserCenterMode = 'local' | 'external';

export interface BirdCoderAuthenticatedUserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface BirdCoderUserCenterMetadataSummary {
  mode: BirdCoderUserCenterMode;
  providerKey: string;
  sessionHeaderName: string;
  supportsLocalCredentials: boolean;
  supportsSessionExchange: boolean;
}

export interface BirdCoderUserCenterSessionSummary {
  createdAt: string;
  providerKey: string;
  providerMode: BirdCoderUserCenterMode;
  sessionId: string;
  updatedAt: string;
  user: BirdCoderAuthenticatedUserSummary;
}

export interface BirdCoderUserCenterLoginRequest {
  email: string;
  password?: string;
}

export interface BirdCoderUserCenterRegisterRequest {
  email: string;
  name?: string;
  password?: string;
}

export interface BirdCoderUserCenterSessionExchangeRequest {
  avatarUrl?: string;
  email: string;
  identityId?: string;
  name?: string;
  providerKey?: string;
  subject?: string;
}

export interface BirdCoderUserCenterProfileSummary {
  avatarUrl?: string;
  bio: string;
  company: string;
  displayName: string;
  email: string;
  identityId: string;
  location: string;
  website: string;
}

export interface BirdCoderUpdateCurrentUserProfileRequest {
  avatarUrl?: string;
  bio?: string;
  company?: string;
  displayName?: string;
  location?: string;
  website?: string;
}

export interface BirdCoderUserCenterMembershipSummary {
  creditsPerMonth: number;
  identityId: string;
  planId: string;
  planTitle: string;
  renewAt?: string;
  seats: number;
  status: string;
}

export interface BirdCoderUpdateCurrentUserMembershipRequest {
  creditsPerMonth?: number;
  planId?: string;
  planTitle?: string;
  renewAt?: string;
  seats?: number;
  status?: string;
}

export interface BirdCoderWorkspaceScopedListRequest {
  identityId?: string;
  workspaceId?: string;
}

export interface BirdCoderAppAdminApiClient {
  createProject?(request: BirdCoderCreateProjectRequest): Promise<BirdCoderProjectSummary>;
  createWorkspace?(request: BirdCoderCreateWorkspaceRequest): Promise<BirdCoderWorkspaceSummary>;
  deleteProject?(projectId: string): Promise<void>;
  deleteWorkspace?(workspaceId: string): Promise<void>;
  listAdminDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listAdminTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listAuditEvents(): Promise<BirdCoderAdminAuditEventSummary[]>;
  listDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]>;
  listDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listDocuments(): Promise<BirdCoderProjectDocumentSummary[]>;
  listPolicies(): Promise<BirdCoderAdminPolicySummary[]>;
  listProjectCollaborators?(
    projectId: string,
  ): Promise<BirdCoderProjectCollaboratorSummary[]>;
  listProjects(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderProjectSummary[]>;
  listReleases(): Promise<BirdCoderReleaseSummary[]>;
  listTeamMembers(teamId: string): Promise<BirdCoderTeamMemberSummary[]>;
  listTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listWorkspaceMembers?(
    workspaceId: string,
  ): Promise<BirdCoderWorkspaceMemberSummary[]>;
  listWorkspaces(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderWorkspaceSummary[]>;
  publishProject?(
    projectId: string,
    request: BirdCoderPublishProjectRequest,
  ): Promise<BirdCoderProjectPublishResult>;
  upsertProjectCollaborator?(
    projectId: string,
    request: BirdCoderUpsertProjectCollaboratorRequest,
  ): Promise<BirdCoderProjectCollaboratorSummary>;
  upsertWorkspaceMember?(
    workspaceId: string,
    request: BirdCoderUpsertWorkspaceMemberRequest,
  ): Promise<BirdCoderWorkspaceMemberSummary>;
  updateProject?(
    projectId: string,
    request: BirdCoderUpdateProjectRequest,
  ): Promise<BirdCoderProjectSummary>;
  updateWorkspace?(
    workspaceId: string,
    request: BirdCoderUpdateWorkspaceRequest,
  ): Promise<BirdCoderWorkspaceSummary>;
}

export interface BirdCoderUserCenterApiClient {
  exchangeSession(
    request: BirdCoderUserCenterSessionExchangeRequest,
  ): Promise<BirdCoderUserCenterSessionSummary>;
  getConfig(): Promise<BirdCoderUserCenterMetadataSummary>;
  getCurrentMembership(): Promise<BirdCoderUserCenterMembershipSummary>;
  getCurrentProfile(): Promise<BirdCoderUserCenterProfileSummary>;
  getCurrentSession(): Promise<BirdCoderUserCenterSessionSummary | null>;
  login(request: BirdCoderUserCenterLoginRequest): Promise<BirdCoderUserCenterSessionSummary>;
  logout(): Promise<void>;
  register(
    request: BirdCoderUserCenterRegisterRequest,
  ): Promise<BirdCoderUserCenterSessionSummary>;
  updateCurrentMembership(
    request: BirdCoderUpdateCurrentUserMembershipRequest,
  ): Promise<BirdCoderUserCenterMembershipSummary>;
  updateCurrentProfile(
    request: BirdCoderUpdateCurrentUserProfileRequest,
  ): Promise<BirdCoderUserCenterProfileSummary>;
}

export interface CreateBirdCoderGeneratedAppAdminApiClientOptions {
  transport: BirdCoderApiTransport;
}

export interface BirdCoderCoreHealthSummary {
  status: string;
}

export interface BirdCoderCoreRuntimeSummary {
  host: string;
  port: number;
  configFileName: string;
}

export interface BirdCoderNativeSessionCommand {
  command: string;
  status: 'running' | 'success' | 'error';
  output?: string;
}

export interface BirdCoderNativeSessionMessage {
  id: string;
  codingSessionId: string;
  turnId?: string;
  role: BirdCoderCodingSessionMessage['role'];
  content: string;
  commands?: BirdCoderNativeSessionCommand[];
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface BirdCoderNativeSessionSummary extends BirdCoderCodingSessionSummary {
  kind: 'coding';
  nativeCwd?: string | null;
  sortTimestamp: number;
  transcriptUpdatedAt?: string | null;
}

export interface BirdCoderNativeSessionDetail {
  summary: BirdCoderNativeSessionSummary;
  messages: BirdCoderNativeSessionMessage[];
}

export interface BirdCoderListNativeSessionsRequest {
  engineId?: BirdCoderCodeEngineKey;
  limit?: number;
  projectId?: string;
  workspaceId?: string;
}

export interface BirdCoderGetNativeSessionRequest {
  engineId?: BirdCoderCodeEngineKey;
  projectId?: string;
  workspaceId?: string;
}

export interface BirdCoderCoreReadApiClient {
  getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary>;
  getDescriptor(): Promise<BirdCoderCodingServerDescriptor>;
  getEngineCapabilities(engineKey: string): Promise<BirdCoderEngineCapabilityMatrix>;
  getHealth(): Promise<BirdCoderCoreHealthSummary>;
  getNativeSession(
    codingSessionId: string,
    request?: BirdCoderGetNativeSessionRequest,
  ): Promise<BirdCoderNativeSessionDetail>;
  getOperation(operationId: string): Promise<BirdCoderOperationDescriptor>;
  getRuntime(): Promise<BirdCoderCoreRuntimeSummary>;
  listCodingSessionArtifacts(codingSessionId: string): Promise<BirdCoderCodingSessionArtifact[]>;
  listCodingSessionCheckpoints(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionCheckpoint[]>;
  listCodingSessionEvents(codingSessionId: string): Promise<BirdCoderCodingSessionEvent[]>;
  listEngines(): Promise<BirdCoderEngineDescriptor[]>;
  listModels(): Promise<BirdCoderModelCatalogEntry[]>;
  listNativeSessions(
    request?: BirdCoderListNativeSessionsRequest,
  ): Promise<BirdCoderNativeSessionSummary[]>;
  listRoutes(): Promise<BirdCoderApiRouteCatalogEntry[]>;
}

export interface CreateBirdCoderGeneratedCoreReadApiClientOptions {
  transport: BirdCoderApiTransport;
}

export interface BirdCoderCreateCodingSessionRequest {
  workspaceId: string;
  projectId: string;
  title?: string;
  hostMode?: BirdCoderHostMode;
  engineId?: BirdCoderCodeEngineKey;
  modelId?: string;
}

export interface BirdCoderCreateCodingSessionTurnRequest {
  runtimeId?: string;
  requestKind: BirdCoderCodingSessionTurn['requestKind'];
  inputSummary: string;
}

export interface BirdCoderCoreWriteApiClient {
  createCodingSession(
    request: BirdCoderCreateCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  createCodingSessionTurn(
    codingSessionId: string,
    request: BirdCoderCreateCodingSessionTurnRequest,
  ): Promise<BirdCoderCodingSessionTurn>;
  submitApprovalDecision(
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ): Promise<BirdCoderApprovalDecisionResult>;
}

export interface CreateBirdCoderGeneratedCoreWriteApiClientOptions {
  transport: BirdCoderApiTransport;
}

export const BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS = [
  'core.getDescriptor',
  'core.getRuntime',
  'core.getHealth',
  'core.listRoutes',
  'core.listEngines',
  'core.listNativeSessions',
  'core.getNativeSession',
  'core.getEngineCapabilities',
  'core.listModels',
  'core.getOperation',
  'core.createCodingSession',
  'core.createCodingSessionTurn',
  'core.submitApprovalDecision',
  'core.getCodingSession',
  'core.listCodingSessionEvents',
  'core.listCodingSessionArtifacts',
  'core.listCodingSessionCheckpoints',
] as const satisfies readonly BirdCoderFinalizedCodingServerClientOperationId[];

export type BirdCoderSharedCoreFacadeOperationId =
  (typeof BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS)[number];

export const BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS =
  [] as const satisfies readonly BirdCoderFinalizedCodingServerClientOperationId[];

export type BirdCoderSharedCoreFacadeExcludedOperationId =
  (typeof BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS)[number];

const BIRDCODER_SHARED_CORE_FACADE_OPERATION_ID_SET = new Set<string>(
  BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS,
);
const BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_ID_SET = new Set<string>(
  BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS,
);

export function isBirdCoderSharedCoreFacadeOperationId(
  operationId: string,
): operationId is BirdCoderSharedCoreFacadeOperationId {
  return BIRDCODER_SHARED_CORE_FACADE_OPERATION_ID_SET.has(operationId);
}

export function isBirdCoderSharedCoreFacadeExcludedOperationId(
  operationId: string,
): operationId is BirdCoderSharedCoreFacadeExcludedOperationId {
  return BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_ID_SET.has(operationId);
}

export interface BirdCoderCodingServerDescriptor {
  apiVersion: string;
  gateway: BirdCoderApiGatewaySummary;
  hostMode: BirdCoderHostMode;
  moduleId: 'coding-server';
  openApiPath: string;
  surfaces: readonly BirdCoderApiSurface[];
}

export interface BirdCoderCoreApiContract {
  codingSession: BirdCoderApiRouteDefinition;
  descriptor: BirdCoderApiRouteDefinition;
  engineCapabilities: BirdCoderApiRouteDefinition;
  engines: BirdCoderApiRouteDefinition;
  events: BirdCoderApiRouteDefinition;
  health: BirdCoderApiRouteDefinition;
  models: BirdCoderApiRouteDefinition;
  nativeSession: BirdCoderApiRouteDefinition;
  nativeSessions: BirdCoderApiRouteDefinition;
  operations: BirdCoderApiRouteDefinition;
  approvals: BirdCoderApiRouteDefinition;
  routes: BirdCoderApiRouteDefinition;
  runtime: BirdCoderApiRouteDefinition;
  sessions: BirdCoderApiRouteDefinition;
  sessionArtifacts: BirdCoderApiRouteDefinition;
  sessionCheckpoints: BirdCoderApiRouteDefinition;
  sessionTurns: BirdCoderApiRouteDefinition;
}

export interface BirdCoderAppApiContract {
  authConfig: BirdCoderApiRouteDefinition;
  authSession: BirdCoderApiRouteDefinition;
  createProject: BirdCoderApiRouteDefinition;
  createProjectCollaborator: BirdCoderApiRouteDefinition;
  createWorkspace: BirdCoderApiRouteDefinition;
  createWorkspaceMember: BirdCoderApiRouteDefinition;
  deleteProject: BirdCoderApiRouteDefinition;
  deleteWorkspace: BirdCoderApiRouteDefinition;
  deployments: BirdCoderApiRouteDefinition;
  documents: BirdCoderApiRouteDefinition;
  exchangeUserCenterSession: BirdCoderApiRouteDefinition;
  getCurrentUserMembership: BirdCoderApiRouteDefinition;
  getCurrentUserProfile: BirdCoderApiRouteDefinition;
  login: BirdCoderApiRouteDefinition;
  logout: BirdCoderApiRouteDefinition;
  publishProject: BirdCoderApiRouteDefinition;
  projectCollaborators: BirdCoderApiRouteDefinition;
  projects: BirdCoderApiRouteDefinition;
  register: BirdCoderApiRouteDefinition;
  teams: BirdCoderApiRouteDefinition;
  updateCurrentUserMembership: BirdCoderApiRouteDefinition;
  updateCurrentUserProfile: BirdCoderApiRouteDefinition;
  updateProject: BirdCoderApiRouteDefinition;
  updateWorkspace: BirdCoderApiRouteDefinition;
  workspaceMembers: BirdCoderApiRouteDefinition;
  workspaces: BirdCoderApiRouteDefinition;
}

export interface BirdCoderAdminApiContract {
  audit: BirdCoderApiRouteDefinition;
  deployments: BirdCoderApiRouteDefinition;
  deploymentTargets: BirdCoderApiRouteDefinition;
  policies: BirdCoderApiRouteDefinition;
  releases: BirdCoderApiRouteDefinition;
  teamMembers: BirdCoderApiRouteDefinition;
  teams: BirdCoderApiRouteDefinition;
}

export interface BirdCoderCoreApiModel {
  artifacts: BirdCoderCodingSessionArtifact[];
  checkpoints: BirdCoderCodingSessionCheckpoint[];
  engineBindings: BirdCoderEngineBindingSummary[];
  engines: BirdCoderEngineDescriptor[];
  events: BirdCoderCodingSessionEvent[];
  messages: BirdCoderCodingSessionMessage[];
  models: BirdCoderModelCatalogEntry[];
  runtimes: BirdCoderCodingSessionRuntime[];
  sessions: BirdCoderCodingSessionSummary[];
  turns: BirdCoderCodingSessionTurn[];
}

export interface BirdCoderAppApiModel {
  authConfig?: BirdCoderUserCenterMetadataSummary;
  currentMembership?: BirdCoderUserCenterMembershipSummary;
  currentProfile?: BirdCoderUserCenterProfileSummary;
  currentSession?: BirdCoderUserCenterSessionSummary | null;
  deployments: BirdCoderDeploymentRecordSummary[];
  documents: BirdCoderProjectDocumentSummary[];
  projectCollaborators: BirdCoderProjectCollaboratorSummary[];
  projects: BirdCoderProjectSummary[];
  teams: BirdCoderTeamSummary[];
  workspaceMembers: BirdCoderWorkspaceMemberSummary[];
  workspaceProjects: Record<string, BirdCoderProjectSummary[]>;
  workspaces: BirdCoderWorkspaceSummary[];
}

export interface BirdCoderAdminApiModel {
  audits: BirdCoderAdminAuditEventSummary[];
  deploymentTargets: BirdCoderDeploymentTargetSummary[];
  members: BirdCoderTeamMemberSummary[];
  policies: BirdCoderAdminPolicySummary[];
  releases: BirdCoderReleaseSummary[];
  teams: BirdCoderTeamSummary[];
}

function normalizeWorkspaceScopedQueryValue(value: BirdCoderApiQueryValue): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function readWorkspaceScopedQuery(
  options?: BirdCoderWorkspaceScopedListRequest,
): string | undefined {
  return normalizeWorkspaceScopedQueryValue(options?.workspaceId);
}

function readIdentityScopedQuery(
  options?: BirdCoderWorkspaceScopedListRequest,
): string | undefined {
  return normalizeWorkspaceScopedQueryValue(options?.identityId);
}

function normalizeRequiredIdentifier(value: string, fieldName: string): string {
  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    throw new Error(`${fieldName} must not be empty.`);
  }
  return normalizedValue;
}

function normalizeOptionalText(value?: string): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function normalizeCollaborationIdentityReference(
  request:
    | BirdCoderUpsertProjectCollaboratorRequest
    | BirdCoderUpsertWorkspaceMemberRequest,
): { email?: string; identityId?: string } {
  const identityId = normalizeOptionalText(request.identityId);
  const email = normalizeOptionalText(request.email);
  if (!identityId && !email) {
    throw new Error('identityId or email must not be empty.');
  }
  return {
    email,
    identityId,
  };
}

const BIRDCODER_WORKSPACE_STATUS_SET = new Set<BirdCoderWorkspaceSummary['status']>([
  'active',
  'archived',
]);
const BIRDCODER_PROJECT_STATUS_SET = new Set<BirdCoderProjectSummary['status']>([
  'active',
  'archived',
]);
const BIRDCODER_COLLABORATION_ROLE_SET = new Set<BirdCoderCollaborationRole>([
  'owner',
  'admin',
  'member',
  'viewer',
]);
const BIRDCODER_COLLABORATION_STATUS_SET = new Set<BirdCoderCollaborationStatus>([
  'invited',
  'active',
  'suspended',
  'removed',
]);
const BIRDCODER_CODING_SESSION_TURN_REQUEST_KIND_SET = new Set<
  BirdCoderCodingSessionTurn['requestKind']
>(['chat', 'plan', 'tool', 'review', 'apply']);
const BIRDCODER_SUBMIT_APPROVAL_DECISION_SET = new Set<
  BirdCoderSubmitApprovalDecisionRequest['decision']
>(['approved', 'denied', 'blocked']);

function normalizeCodingSessionTurnRequestKind(
  value: string,
): BirdCoderCodingSessionTurn['requestKind'] {
  const normalizedValue = normalizeRequiredIdentifier(value, 'requestKind');
  if (
    !BIRDCODER_CODING_SESSION_TURN_REQUEST_KIND_SET.has(
      normalizedValue as BirdCoderCodingSessionTurn['requestKind'],
    )
  ) {
    throw new Error('requestKind must be one of chat/plan/tool/review/apply.');
  }

  return normalizedValue as BirdCoderCodingSessionTurn['requestKind'];
}

function normalizeSubmitApprovalDecision(
  value: string,
): BirdCoderSubmitApprovalDecisionRequest['decision'] {
  const normalizedValue = normalizeRequiredIdentifier(value, 'decision');
  if (
    !BIRDCODER_SUBMIT_APPROVAL_DECISION_SET.has(
      normalizedValue as BirdCoderSubmitApprovalDecisionRequest['decision'],
    )
  ) {
    throw new Error('decision must be one of approved/denied/blocked.');
  }

  return normalizedValue as BirdCoderSubmitApprovalDecisionRequest['decision'];
}

function normalizeWorkspaceStatus(
  value?: string,
): BirdCoderWorkspaceSummary['status'] | undefined {
  const normalizedValue = normalizeOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }
  if (
    !BIRDCODER_WORKSPACE_STATUS_SET.has(
      normalizedValue as BirdCoderWorkspaceSummary['status'],
    )
  ) {
    throw new Error('workspace status must be active or archived.');
  }

  return normalizedValue as BirdCoderWorkspaceSummary['status'];
}

function normalizeProjectStatus(
  value?: string,
): BirdCoderProjectSummary['status'] | undefined {
  const normalizedValue = normalizeOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }
  if (
    !BIRDCODER_PROJECT_STATUS_SET.has(
      normalizedValue as BirdCoderProjectSummary['status'],
    )
  ) {
    throw new Error('project status must be active or archived.');
  }

  return normalizedValue as BirdCoderProjectSummary['status'];
}

function normalizeCollaborationRole(
  value?: string,
): BirdCoderCollaborationRole | undefined {
  const normalizedValue = normalizeOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }
  if (!BIRDCODER_COLLABORATION_ROLE_SET.has(normalizedValue as BirdCoderCollaborationRole)) {
    throw new Error('collaboration role must be owner/admin/member/viewer.');
  }

  return normalizedValue as BirdCoderCollaborationRole;
}

function normalizeCollaborationStatus(
  value?: string,
): BirdCoderCollaborationStatus | undefined {
  const normalizedValue = normalizeOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }
  if (!BIRDCODER_COLLABORATION_STATUS_SET.has(normalizedValue as BirdCoderCollaborationStatus)) {
    throw new Error('collaboration status must be invited/active/suspended/removed.');
  }

  return normalizedValue as BirdCoderCollaborationStatus;
}

export function createBirdCoderGeneratedAppAdminApiClient({
  transport,
}: CreateBirdCoderGeneratedAppAdminApiClientOptions): BirdCoderAppAdminApiClient {
  const client = createBirdCoderFinalizedCodingServerClient(transport);

  return {
    async createWorkspace(
      request: BirdCoderCreateWorkspaceRequest,
    ): Promise<BirdCoderWorkspaceSummary> {
      const response = await transport.request<BirdCoderApiEnvelope<BirdCoderWorkspaceSummary>>({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces`,
        body: {
          name: normalizeRequiredIdentifier(request.name, 'name'),
          description: normalizeOptionalText(request.description),
          ownerIdentityId: normalizeOptionalText(request.ownerIdentityId),
          createdByIdentityId: normalizeOptionalText(request.createdByIdentityId),
        },
      });
      return response.data;
    },
    async updateWorkspace(
      workspaceId: string,
      request: BirdCoderUpdateWorkspaceRequest,
    ): Promise<BirdCoderWorkspaceSummary> {
      const response = await transport.request<BirdCoderApiEnvelope<BirdCoderWorkspaceSummary>>({
        method: 'PATCH',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces/${encodeURIComponent(
          normalizeRequiredIdentifier(workspaceId, 'workspaceId'),
        )}`,
        body: {
          name: normalizeOptionalText(request.name),
          description: normalizeOptionalText(request.description),
          status: normalizeWorkspaceStatus(request.status),
        },
      });
      return response.data;
    },
    async deleteWorkspace(workspaceId: string): Promise<void> {
      await transport.request<BirdCoderApiEnvelope<{ id: string }>>({
        method: 'DELETE',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces/${encodeURIComponent(
          normalizeRequiredIdentifier(workspaceId, 'workspaceId'),
        )}`,
      });
    },
    async listWorkspaces(
      options: BirdCoderWorkspaceScopedListRequest = {},
    ): Promise<BirdCoderWorkspaceSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderWorkspaceSummary>,
        'app.listWorkspaces'
      >('app.listWorkspaces', {
        query: {
          identityId: readIdentityScopedQuery(options),
        },
      });
      return response.items;
    },
    async listProjects(
      options: BirdCoderWorkspaceScopedListRequest = {},
    ): Promise<BirdCoderProjectSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderProjectSummary>,
        'app.listProjects'
      >('app.listProjects', {
        query: {
          identityId: readIdentityScopedQuery(options),
          workspaceId: readWorkspaceScopedQuery(options),
        },
      });
      return response.items;
    },
    async createProject(
      request: BirdCoderCreateProjectRequest,
    ): Promise<BirdCoderProjectSummary> {
      const response = await transport.request<BirdCoderApiEnvelope<BirdCoderProjectSummary>>({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects`,
        body: {
          workspaceId: normalizeRequiredIdentifier(request.workspaceId, 'workspaceId'),
          name: normalizeRequiredIdentifier(request.name, 'name'),
          description: normalizeOptionalText(request.description),
          ownerIdentityId: normalizeOptionalText(request.ownerIdentityId),
          createdByIdentityId: normalizeOptionalText(request.createdByIdentityId),
          rootPath: normalizeOptionalText(request.rootPath),
          status: normalizeProjectStatus(request.status),
        },
      });
      return response.data;
    },
    async updateProject(
      projectId: string,
      request: BirdCoderUpdateProjectRequest,
    ): Promise<BirdCoderProjectSummary> {
      const response = await transport.request<BirdCoderApiEnvelope<BirdCoderProjectSummary>>({
        method: 'PATCH',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects/${encodeURIComponent(
          normalizeRequiredIdentifier(projectId, 'projectId'),
        )}`,
        body: {
          name: normalizeOptionalText(request.name),
          description: normalizeOptionalText(request.description),
          rootPath: normalizeOptionalText(request.rootPath),
          status: normalizeProjectStatus(request.status),
        },
      });
      return response.data;
    },
    async deleteProject(projectId: string): Promise<void> {
      await transport.request<BirdCoderApiEnvelope<{ id: string }>>({
        method: 'DELETE',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects/${encodeURIComponent(
          normalizeRequiredIdentifier(projectId, 'projectId'),
        )}`,
      });
    },
    async listDocuments(): Promise<BirdCoderProjectDocumentSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderProjectDocumentSummary>,
        'app.listDocuments'
      >('app.listDocuments');
      return response.items;
    },
    async listDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderDeploymentRecordSummary>,
        'app.listDeployments'
      >('app.listDeployments');
      return response.items;
    },
    async listAdminDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderDeploymentRecordSummary>,
        'admin.listDeployments'
      >('admin.listDeployments');
      return response.items;
    },
    async listDeploymentTargets(
      projectId: string,
    ): Promise<BirdCoderDeploymentTargetSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderDeploymentTargetSummary>,
        'admin.listDeploymentTargets'
      >('admin.listDeploymentTargets', {
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.items;
    },
    async listTeams(
      options: BirdCoderWorkspaceScopedListRequest = {},
    ): Promise<BirdCoderTeamSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderTeamSummary>,
        'app.listTeams'
      >('app.listTeams', {
        query: {
          identityId: readIdentityScopedQuery(options),
          workspaceId: readWorkspaceScopedQuery(options),
        },
      });
      return response.items;
    },
    async listAdminTeams(
      options: BirdCoderWorkspaceScopedListRequest = {},
    ): Promise<BirdCoderTeamSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderTeamSummary>,
        'admin.listTeams'
      >('admin.listTeams', {
        query: {
          identityId: readIdentityScopedQuery(options),
          workspaceId: readWorkspaceScopedQuery(options),
        },
      });
      return response.items;
    },
    async listWorkspaceMembers(
      workspaceId: string,
    ): Promise<BirdCoderWorkspaceMemberSummary[]> {
      const response = await transport.request<
        BirdCoderApiListEnvelope<BirdCoderWorkspaceMemberSummary>
      >({
        method: 'GET',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces/${encodeURIComponent(
          normalizeRequiredIdentifier(workspaceId, 'workspaceId'),
        )}/members`,
      });
      return response.items;
    },
    async publishProject(
      projectId: string,
      request: BirdCoderPublishProjectRequest,
    ): Promise<BirdCoderProjectPublishResult> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderProjectPublishResult>
      >({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects/${encodeURIComponent(
          normalizeRequiredIdentifier(projectId, 'projectId'),
        )}/publish`,
        body: {
          endpointUrl: normalizeOptionalText(request.endpointUrl),
          environmentKey: normalizeOptionalText(request.environmentKey),
          releaseKind: normalizeOptionalText(request.releaseKind),
          releaseVersion: normalizeOptionalText(request.releaseVersion),
          rolloutStage: normalizeOptionalText(request.rolloutStage),
          runtime: normalizeOptionalText(request.runtime),
          targetId: normalizeOptionalText(request.targetId),
          targetName: normalizeOptionalText(request.targetName),
        },
      });
      return response.data;
    },
    async upsertWorkspaceMember(
      workspaceId: string,
      request: BirdCoderUpsertWorkspaceMemberRequest,
    ): Promise<BirdCoderWorkspaceMemberSummary> {
      const identityReference = normalizeCollaborationIdentityReference(request);
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderWorkspaceMemberSummary>
      >({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/workspaces/${encodeURIComponent(
          normalizeRequiredIdentifier(workspaceId, 'workspaceId'),
        )}/members`,
        body: {
          email: identityReference.email,
          identityId: identityReference.identityId,
          teamId: normalizeOptionalText(request.teamId),
          role: normalizeCollaborationRole(request.role),
          status: normalizeCollaborationStatus(request.status),
          createdByIdentityId: normalizeOptionalText(request.createdByIdentityId),
          grantedByIdentityId: normalizeOptionalText(request.grantedByIdentityId),
        },
      });
      return response.data;
    },
    async listProjectCollaborators(
      projectId: string,
    ): Promise<BirdCoderProjectCollaboratorSummary[]> {
      const response = await transport.request<
        BirdCoderApiListEnvelope<BirdCoderProjectCollaboratorSummary>
      >({
        method: 'GET',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects/${encodeURIComponent(
          normalizeRequiredIdentifier(projectId, 'projectId'),
        )}/collaborators`,
      });
      return response.items;
    },
    async upsertProjectCollaborator(
      projectId: string,
      request: BirdCoderUpsertProjectCollaboratorRequest,
    ): Promise<BirdCoderProjectCollaboratorSummary> {
      const identityReference = normalizeCollaborationIdentityReference(request);
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderProjectCollaboratorSummary>
      >({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/projects/${encodeURIComponent(
          normalizeRequiredIdentifier(projectId, 'projectId'),
        )}/collaborators`,
        body: {
          email: identityReference.email,
          identityId: identityReference.identityId,
          teamId: normalizeOptionalText(request.teamId),
          role: normalizeCollaborationRole(request.role),
          status: normalizeCollaborationStatus(request.status),
          createdByIdentityId: normalizeOptionalText(request.createdByIdentityId),
          grantedByIdentityId: normalizeOptionalText(request.grantedByIdentityId),
        },
      });
      return response.data;
    },
    async listTeamMembers(teamId: string): Promise<BirdCoderTeamMemberSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderTeamMemberSummary>,
        'admin.listTeamMembers'
      >('admin.listTeamMembers', {
        pathParams: {
          teamId: normalizeRequiredIdentifier(teamId, 'teamId'),
        },
      });
      return response.items;
    },
    async listReleases(): Promise<BirdCoderReleaseSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderReleaseSummary>,
        'admin.listReleases'
      >('admin.listReleases');
      return response.items;
    },
    async listAuditEvents(): Promise<BirdCoderAdminAuditEventSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderAdminAuditEventSummary>,
        'admin.listAuditEvents'
      >('admin.listAuditEvents');
      return response.items;
    },
    async listPolicies(): Promise<BirdCoderAdminPolicySummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderAdminPolicySummary>,
        'admin.listPolicies'
      >('admin.listPolicies');
      return response.items;
    },
  };
}

export function createBirdCoderGeneratedUserCenterApiClient({
  transport,
}: CreateBirdCoderGeneratedAppAdminApiClientOptions): BirdCoderUserCenterApiClient {
  return {
    async getConfig(): Promise<BirdCoderUserCenterMetadataSummary> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMetadataSummary>
      >({
        method: 'GET',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/auth/config`,
      });
      return response.data;
    },
    async getCurrentSession(): Promise<BirdCoderUserCenterSessionSummary | null> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary | null>
      >({
        method: 'GET',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/auth/session`,
      });
      return response.data ?? null;
    },
    async login(
      request: BirdCoderUserCenterLoginRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>
      >({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/auth/login`,
        body: {
          email: normalizeRequiredIdentifier(request.email, 'email'),
          password: normalizeOptionalText(request.password),
        },
      });
      return response.data;
    },
    async register(
      request: BirdCoderUserCenterRegisterRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>
      >({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/auth/register`,
        body: {
          email: normalizeRequiredIdentifier(request.email, 'email'),
          name: normalizeOptionalText(request.name),
          password: normalizeOptionalText(request.password),
        },
      });
      return response.data;
    },
    async logout(): Promise<void> {
      await transport.request<BirdCoderApiEnvelope<{ success: boolean }>>({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/auth/logout`,
      });
    },
    async exchangeSession(
      request: BirdCoderUserCenterSessionExchangeRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>
      >({
        method: 'POST',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/auth/session/exchange`,
        body: {
          avatarUrl: normalizeOptionalText(request.avatarUrl),
          email: normalizeRequiredIdentifier(request.email, 'email'),
          identityId: normalizeOptionalText(request.identityId),
          name: normalizeOptionalText(request.name),
          providerKey: normalizeOptionalText(request.providerKey),
          subject: normalizeOptionalText(request.subject),
        },
      });
      return response.data;
    },
    async getCurrentProfile(): Promise<BirdCoderUserCenterProfileSummary> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterProfileSummary>
      >({
        method: 'GET',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/user-center/profile`,
      });
      return response.data;
    },
    async updateCurrentProfile(
      request: BirdCoderUpdateCurrentUserProfileRequest,
    ): Promise<BirdCoderUserCenterProfileSummary> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterProfileSummary>
      >({
        method: 'PATCH',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/user-center/profile`,
        body: {
          avatarUrl: normalizeOptionalText(request.avatarUrl),
          bio: normalizeOptionalText(request.bio),
          company: normalizeOptionalText(request.company),
          displayName: normalizeOptionalText(request.displayName),
          location: normalizeOptionalText(request.location),
          website: normalizeOptionalText(request.website),
        },
      });
      return response.data;
    },
    async getCurrentMembership(): Promise<BirdCoderUserCenterMembershipSummary> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMembershipSummary>
      >({
        method: 'GET',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/user-center/membership`,
      });
      return response.data;
    },
    async updateCurrentMembership(
      request: BirdCoderUpdateCurrentUserMembershipRequest,
    ): Promise<BirdCoderUserCenterMembershipSummary> {
      const response = await transport.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMembershipSummary>
      >({
        method: 'PATCH',
        path: `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/user-center/membership`,
        body: {
          creditsPerMonth: request.creditsPerMonth,
          planId: normalizeOptionalText(request.planId),
          planTitle: normalizeOptionalText(request.planTitle),
          renewAt: normalizeOptionalText(request.renewAt),
          seats: request.seats,
          status: normalizeOptionalText(request.status),
        },
      });
      return response.data;
    },
  };
}

export function createBirdCoderGeneratedCoreReadApiClient({
  transport,
}: CreateBirdCoderGeneratedCoreReadApiClientOptions): BirdCoderCoreReadApiClient {
  const client = createBirdCoderFinalizedCodingServerClient(transport);

  return {
    async getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCodingSessionSummary>,
        'core.getCodingSession'
      >('core.getCodingSession', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
      });
      return response.data;
    },
    async getDescriptor(): Promise<BirdCoderCodingServerDescriptor> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCodingServerDescriptor>,
        'core.getDescriptor'
      >('core.getDescriptor');
      return response.data;
    },
    async getEngineCapabilities(engineKey: string): Promise<BirdCoderEngineCapabilityMatrix> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderEngineCapabilityMatrix>,
        'core.getEngineCapabilities'
      >('core.getEngineCapabilities', {
        pathParams: {
          engineKey: normalizeRequiredIdentifier(engineKey, 'engineKey'),
        },
      });
      return response.data;
    },
    async getHealth(): Promise<BirdCoderCoreHealthSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCoreHealthSummary>,
        'core.getHealth'
      >('core.getHealth');
      return response.data;
    },
    async getNativeSession(
      codingSessionId: string,
      request: BirdCoderGetNativeSessionRequest = {},
    ): Promise<BirdCoderNativeSessionDetail> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderNativeSessionDetail>,
        'core.getNativeSession'
      >('core.getNativeSession', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
        query: {
          engineId: normalizeOptionalText(request.engineId),
          projectId: normalizeOptionalText(request.projectId),
          workspaceId: normalizeOptionalText(request.workspaceId),
        },
      });
      return response.data;
    },
    async listRoutes(): Promise<BirdCoderApiRouteCatalogEntry[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderApiRouteCatalogEntry>,
        'core.listRoutes'
      >('core.listRoutes');
      return response.items;
    },
    async getOperation(operationId: string): Promise<BirdCoderOperationDescriptor> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderOperationDescriptor>,
        'core.getOperation'
      >('core.getOperation', {
        pathParams: {
          operationId: normalizeRequiredIdentifier(operationId, 'operationId'),
        },
      });
      return response.data;
    },
    async getRuntime(): Promise<BirdCoderCoreRuntimeSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCoreRuntimeSummary>,
        'core.getRuntime'
      >('core.getRuntime');
      return response.data;
    },
    async listCodingSessionArtifacts(
      codingSessionId: string,
    ): Promise<BirdCoderCodingSessionArtifact[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderCodingSessionArtifact>,
        'core.listCodingSessionArtifacts'
      >('core.listCodingSessionArtifacts', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
      });
      return response.items;
    },
    async listCodingSessionCheckpoints(
      codingSessionId: string,
    ): Promise<BirdCoderCodingSessionCheckpoint[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderCodingSessionCheckpoint>,
        'core.listCodingSessionCheckpoints'
      >('core.listCodingSessionCheckpoints', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
      });
      return response.items;
    },
    async listCodingSessionEvents(
      codingSessionId: string,
    ): Promise<BirdCoderCodingSessionEvent[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderCodingSessionEvent>,
        'core.listCodingSessionEvents'
      >('core.listCodingSessionEvents', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
      });
      return response.items;
    },
    async listEngines(): Promise<BirdCoderEngineDescriptor[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderEngineDescriptor>,
        'core.listEngines'
      >('core.listEngines');
      return response.items;
    },
    async listModels(): Promise<BirdCoderModelCatalogEntry[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderModelCatalogEntry>,
        'core.listModels'
      >('core.listModels');
      return response.items;
    },
    async listNativeSessions(
      request: BirdCoderListNativeSessionsRequest = {},
    ): Promise<BirdCoderNativeSessionSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderNativeSessionSummary>,
        'core.listNativeSessions'
      >('core.listNativeSessions', {
        query: {
          engineId: normalizeOptionalText(request.engineId),
          limit: request.limit,
          projectId: normalizeOptionalText(request.projectId),
          workspaceId: normalizeOptionalText(request.workspaceId),
        },
      });
      return response.items;
    },
  };
}

export function createBirdCoderGeneratedCoreWriteApiClient({
  transport,
}: CreateBirdCoderGeneratedCoreWriteApiClientOptions): BirdCoderCoreWriteApiClient {
  const client = createBirdCoderFinalizedCodingServerClient(transport);

  return {
    async createCodingSession(
      request: BirdCoderCreateCodingSessionRequest,
    ): Promise<BirdCoderCodingSessionSummary> {
      const body: Record<string, unknown> = {
        workspaceId: normalizeRequiredIdentifier(request.workspaceId, 'workspaceId'),
        projectId: normalizeRequiredIdentifier(request.projectId, 'projectId'),
      };
      const title = normalizeOptionalText(request.title);
      const modelId = normalizeOptionalText(request.modelId);
      const engineId = normalizeOptionalText(request.engineId);

      if (title) {
        body.title = title;
      }
      if (request.hostMode) {
        body.hostMode = request.hostMode;
      }
      if (engineId) {
        body.engineId = engineId;
      }
      if (modelId) {
        body.modelId = modelId;
      }

      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCodingSessionSummary>,
        'core.createCodingSession'
      >('core.createCodingSession', {
        body,
      });
      return response.data;
    },
    async createCodingSessionTurn(
      codingSessionId: string,
      request: BirdCoderCreateCodingSessionTurnRequest,
    ): Promise<BirdCoderCodingSessionTurn> {
      const body: Record<string, unknown> = {
        requestKind: normalizeCodingSessionTurnRequestKind(request.requestKind),
        inputSummary: normalizeRequiredIdentifier(request.inputSummary, 'inputSummary'),
      };
      const runtimeId = normalizeOptionalText(request.runtimeId);

      if (runtimeId) {
        body.runtimeId = runtimeId;
      }

      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCodingSessionTurn>,
        'core.createCodingSessionTurn'
      >('core.createCodingSessionTurn', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
        body,
      });
      return response.data;
    },
    async submitApprovalDecision(
      approvalId: string,
      request: BirdCoderSubmitApprovalDecisionRequest,
    ): Promise<BirdCoderApprovalDecisionResult> {
      const body: Record<string, unknown> = {
        decision: normalizeSubmitApprovalDecision(request.decision),
      };
      const reason = normalizeOptionalText(request.reason);
      if (reason) {
        body.reason = reason;
      }

      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderApprovalDecisionResult>,
        'core.submitApprovalDecision'
      >('core.submitApprovalDecision', {
        pathParams: {
          approvalId: normalizeRequiredIdentifier(approvalId, 'approvalId'),
        },
        body,
      });
      return response.data;
    },
  };
}
