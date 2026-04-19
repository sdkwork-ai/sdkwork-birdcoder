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
  BirdCoderEngineTransportKind,
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

export const BIRDCODER_WORKSPACE_REALTIME_EVENT_KINDS = [
  'project.created',
  'project.updated',
  'project.deleted',
  'coding-session.created',
  'coding-session.updated',
  'coding-session.deleted',
  'coding-session.turn.created',
] as const;

export type BirdCoderWorkspaceRealtimeEventKind =
  (typeof BIRDCODER_WORKSPACE_REALTIME_EVENT_KINDS)[number];

export interface BirdCoderWorkspaceRealtimeEvent {
  eventId: string;
  eventKind: BirdCoderWorkspaceRealtimeEventKind;
  workspaceId: string;
  projectId?: string;
  projectName?: string;
  projectRootPath?: string;
  codingSessionId?: string;
  codingSessionTitle?: string;
  codingSessionStatus?: BirdCoderCodingSessionSummary['status'];
  codingSessionHostMode?: BirdCoderHostMode;
  codingSessionEngineId?: BirdCoderCodingSessionSummary['engineId'];
  codingSessionModelId?: string;
  turnId?: string;
  occurredAt: string;
  projectUpdatedAt?: string;
  codingSessionUpdatedAt?: string;
  sourceSurface: BirdCoderApiSurface;
}

export interface BirdCoderWorkspaceRealtimeReadyMessage {
  kind: 'ready';
  connectedAt: string;
  userId: string;
  workspaceId: string;
}

export interface BirdCoderWorkspaceRealtimeEventMessage {
  kind: 'event';
  event: BirdCoderWorkspaceRealtimeEvent;
}

export type BirdCoderWorkspaceRealtimeMessage =
  | BirdCoderWorkspaceRealtimeReadyMessage
  | BirdCoderWorkspaceRealtimeEventMessage;

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
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  type?: string;
  memberCount?: number;
  status: 'active' | 'archived';
  viewerRole?: BirdCoderCollaborationRole;
}

export interface BirdCoderCreateWorkspaceRequest {
  description?: string;
  name: string;
  tenantId?: string;
  organizationId?: string;
  code?: string;
  title?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  type?: string;
}

export interface BirdCoderUpdateWorkspaceRequest {
  description?: string;
  code?: string;
  title?: string;
  name?: string;
  ownerId?: string;
  leaderId?: string;
  type?: string;
  status?: BirdCoderWorkspaceSummary['status'];
}

export interface BirdCoderProjectSummary {
  createdAt: string;
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  workspaceId: string;
  workspaceUuid?: string;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  rootPath?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  author?: string;
  type?: string;
  collaboratorCount?: number;
  status: 'active' | 'archived';
  updatedAt: string;
  viewerRole?: BirdCoderCollaborationRole;
}

export interface BirdCoderSkillCatalogEntrySummary {
  id: string;
  packageId: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  author?: string;
  versionId: string;
  versionLabel: string;
  installCount?: number;
  longDescription?: string;
  tags: string[];
  license?: string;
  repositoryUrl?: string;
  lastUpdated?: string;
  readme?: string;
  capabilityKeys: string[];
  installed: boolean;
}

export interface BirdCoderSkillPackageSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  author?: string;
  versionId: string;
  versionLabel: string;
  installCount?: number;
  longDescription?: string;
  sourceUri?: string;
  installed: boolean;
  updatedAt: string;
  skills: BirdCoderSkillCatalogEntrySummary[];
}

export interface BirdCoderInstallSkillPackageRequest {
  scopeId: string;
  scopeType: 'workspace' | 'project';
}

export interface BirdCoderSkillInstallationSummary {
  id: string;
  packageId: string;
  scopeId: string;
  scopeType: 'workspace' | 'project';
  status: 'active' | 'archived' | (string & {});
  versionId: string;
  installedAt: string;
}

export interface BirdCoderAppTemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  author?: string;
  versionId: string;
  versionLabel: string;
  presetKey: string;
  category: 'community' | 'saas' | 'mine' | (string & {});
  tags: string[];
  targetProfiles: string[];
  downloads?: number;
  stars?: number;
  status: 'active' | 'archived' | (string & {});
  updatedAt: string;
}

export interface BirdCoderCreateProjectRequest {
  description?: string;
  name: string;
  workspaceUuid?: string;
  tenantId?: string;
  organizationId?: string;
  code?: string;
  title?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  author?: string;
  type?: string;
  rootPath?: string;
  appTemplateVersionId?: string;
  templatePresetKey?: string;
  status?: BirdCoderProjectSummary['status'];
  workspaceId: string;
}

export interface BirdCoderUpdateProjectRequest {
  description?: string;
  code?: string;
  title?: string;
  name?: string;
  ownerId?: string;
  leaderId?: string;
  author?: string;
  type?: string;
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
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  workspaceId: string;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
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
  userId: string;
  role: BirdCoderCollaborationRole;
  status: BirdCoderCollaborationStatus;
  createdByUserId?: string;
  grantedByUserId?: string;
}

export interface BirdCoderWorkspaceMemberSummary {
  id: string;
  workspaceId: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  teamId?: string;
  role: BirdCoderCollaborationRole;
  status: BirdCoderCollaborationStatus;
  createdByUserId?: string;
  grantedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BirdCoderProjectCollaboratorSummary {
  id: string;
  projectId: string;
  workspaceId: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  teamId?: string;
  role: BirdCoderCollaborationRole;
  status: BirdCoderCollaborationStatus;
  createdByUserId?: string;
  grantedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BirdCoderUpsertWorkspaceMemberRequest {
  userId?: string;
  email?: string;
  teamId?: string;
  role?: BirdCoderCollaborationRole;
  status?: BirdCoderCollaborationStatus;
  createdByUserId?: string;
  grantedByUserId?: string;
}

export interface BirdCoderUpsertProjectCollaboratorRequest {
  userId?: string;
  email?: string;
  teamId?: string;
  role?: BirdCoderCollaborationRole;
  status?: BirdCoderCollaborationStatus;
  createdByUserId?: string;
  grantedByUserId?: string;
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
  integrationKind?: string;
  mode: BirdCoderUserCenterMode;
  providerKey: string;
  sessionHeaderName: string;
  supportsLocalCredentials: boolean;
  supportsMembershipWrite?: boolean;
  supportsProfileWrite?: boolean;
  supportsSessionExchange: boolean;
  upstreamBaseUrl?: string;
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
  userId?: string;
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
  userId: string;
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
  userId: string;
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
  userId?: string;
  workspaceId?: string;
}

export interface BirdCoderProjectListRequest extends BirdCoderWorkspaceScopedListRequest {
  rootPath?: string;
}

export interface BirdCoderAppAdminApiClient {
  createProject(request: BirdCoderCreateProjectRequest): Promise<BirdCoderProjectSummary>;
  createWorkspace(request: BirdCoderCreateWorkspaceRequest): Promise<BirdCoderWorkspaceSummary>;
  deleteProject(projectId: string): Promise<void>;
  deleteWorkspace(workspaceId: string): Promise<void>;
  getProject(projectId: string): Promise<BirdCoderProjectSummary>;
  installSkillPackage(
    packageId: string,
    request: BirdCoderInstallSkillPackageRequest,
  ): Promise<BirdCoderSkillInstallationSummary>;
  listAdminDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listAdminTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listAppTemplates(): Promise<BirdCoderAppTemplateSummary[]>;
  listAuditEvents(): Promise<BirdCoderAdminAuditEventSummary[]>;
  listDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]>;
  listDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listDocuments(): Promise<BirdCoderProjectDocumentSummary[]>;
  listPolicies(): Promise<BirdCoderAdminPolicySummary[]>;
  listProjectCollaborators(
    projectId: string,
  ): Promise<BirdCoderProjectCollaboratorSummary[]>;
  listProjects(options?: BirdCoderProjectListRequest): Promise<BirdCoderProjectSummary[]>;
  listReleases(): Promise<BirdCoderReleaseSummary[]>;
  listSkillPackages(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderSkillPackageSummary[]>;
  listTeamMembers(teamId: string): Promise<BirdCoderTeamMemberSummary[]>;
  listTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listWorkspaceMembers(
    workspaceId: string,
  ): Promise<BirdCoderWorkspaceMemberSummary[]>;
  listWorkspaces(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderWorkspaceSummary[]>;
  publishProject(
    projectId: string,
    request: BirdCoderPublishProjectRequest,
  ): Promise<BirdCoderProjectPublishResult>;
  upsertProjectCollaborator(
    projectId: string,
    request: BirdCoderUpsertProjectCollaboratorRequest,
  ): Promise<BirdCoderProjectCollaboratorSummary>;
  upsertWorkspaceMember(
    workspaceId: string,
    request: BirdCoderUpsertWorkspaceMemberRequest,
  ): Promise<BirdCoderWorkspaceMemberSummary>;
  updateProject(
    projectId: string,
    request: BirdCoderUpdateProjectRequest,
  ): Promise<BirdCoderProjectSummary>;
  updateWorkspace(
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

export type BirdCoderNativeSessionProviderDiscoveryMode =
  | 'explicit-only'
  | 'passive-global';

export interface BirdCoderNativeSessionProviderSummary {
  engineId: BirdCoderCodeEngineKey;
  displayName: string;
  nativeSessionIdPrefix: string;
  transportKinds: readonly BirdCoderEngineTransportKind[];
  discoveryMode: BirdCoderNativeSessionProviderDiscoveryMode;
}

export interface BirdCoderListNativeSessionsRequest {
  engineId?: BirdCoderCodeEngineKey;
  limit?: number;
  offset?: number;
  projectId?: string;
  workspaceId?: string;
}

export interface BirdCoderListCodingSessionsRequest {
  engineId?: BirdCoderCodeEngineKey;
  limit?: number;
  offset?: number;
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
  listCodingSessions(
    request?: BirdCoderListCodingSessionsRequest,
  ): Promise<BirdCoderCodingSessionSummary[]>;
  listEngines(): Promise<BirdCoderEngineDescriptor[]>;
  listModels(): Promise<BirdCoderModelCatalogEntry[]>;
  listNativeSessionProviders(): Promise<BirdCoderNativeSessionProviderSummary[]>;
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

export interface BirdCoderUpdateCodingSessionRequest {
  title?: string;
  status?: BirdCoderCodingSessionSummary['status'];
  hostMode?: BirdCoderHostMode;
  engineId?: BirdCoderCodeEngineKey;
  modelId?: string;
}

export interface BirdCoderForkCodingSessionRequest {
  title?: string;
}

export interface BirdCoderDeleteCodingSessionResult {
  id: string;
}

export interface BirdCoderDeleteCodingSessionMessageResult {
  id: string;
  codingSessionId: string;
}

export interface BirdCoderCodingSessionTurnCurrentFileContext {
  path: string;
  content?: string;
  language?: string;
}

export interface BirdCoderCodingSessionTurnIdeContext {
  workspaceId?: string;
  projectId?: string;
  threadId?: string;
  currentFile?: BirdCoderCodingSessionTurnCurrentFileContext;
}

export interface BirdCoderCreateCodingSessionTurnRequest {
  runtimeId?: string;
  requestKind: BirdCoderCodingSessionTurn['requestKind'];
  inputSummary: string;
  ideContext?: BirdCoderCodingSessionTurnIdeContext;
}

export interface BirdCoderCoreWriteApiClient {
  createCodingSession(
    request: BirdCoderCreateCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  forkCodingSession(
    codingSessionId: string,
    request?: BirdCoderForkCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  updateCodingSession(
    codingSessionId: string,
    request: BirdCoderUpdateCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  deleteCodingSession(codingSessionId: string): Promise<BirdCoderDeleteCodingSessionResult>;
  deleteCodingSessionMessage(
    codingSessionId: string,
    messageId: string,
  ): Promise<BirdCoderDeleteCodingSessionMessageResult>;
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
  'core.listNativeSessionProviders',
  'core.listCodingSessions',
  'core.listNativeSessions',
  'core.getNativeSession',
  'core.getEngineCapabilities',
  'core.listModels',
  'core.getOperation',
  'core.createCodingSession',
  'core.forkCodingSession',
  'core.updateCodingSession',
  'core.deleteCodingSession',
  'core.deleteCodingSessionMessage',
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
  codingSessions: BirdCoderApiRouteDefinition;
  descriptor: BirdCoderApiRouteDefinition;
  engineCapabilities: BirdCoderApiRouteDefinition;
  engines: BirdCoderApiRouteDefinition;
  events: BirdCoderApiRouteDefinition;
  health: BirdCoderApiRouteDefinition;
  models: BirdCoderApiRouteDefinition;
  nativeSession: BirdCoderApiRouteDefinition;
  nativeSessionProviders: BirdCoderApiRouteDefinition;
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
  appTemplates: BirdCoderApiRouteDefinition;
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
  project: BirdCoderApiRouteDefinition;
  installSkillPackage: BirdCoderApiRouteDefinition;
  login: BirdCoderApiRouteDefinition;
  logout: BirdCoderApiRouteDefinition;
  publishProject: BirdCoderApiRouteDefinition;
  projectCollaborators: BirdCoderApiRouteDefinition;
  projects: BirdCoderApiRouteDefinition;
  register: BirdCoderApiRouteDefinition;
  skillPackages: BirdCoderApiRouteDefinition;
  subscribeWorkspaceRealtime: BirdCoderApiRouteDefinition;
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
  nativeSessionProviders: BirdCoderNativeSessionProviderSummary[];
  runtimes: BirdCoderCodingSessionRuntime[];
  sessions: BirdCoderCodingSessionSummary[];
  turns: BirdCoderCodingSessionTurn[];
}

export interface BirdCoderAppApiModel {
  appTemplates: BirdCoderAppTemplateSummary[];
  authConfig?: BirdCoderUserCenterMetadataSummary;
  currentMembership?: BirdCoderUserCenterMembershipSummary;
  currentProfile?: BirdCoderUserCenterProfileSummary;
  currentSession?: BirdCoderUserCenterSessionSummary | null;
  deployments: BirdCoderDeploymentRecordSummary[];
  documents: BirdCoderProjectDocumentSummary[];
  projectCollaborators: BirdCoderProjectCollaboratorSummary[];
  projects: BirdCoderProjectSummary[];
  skillPackages: BirdCoderSkillPackageSummary[];
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

function readUserScopedQuery(
  options?: BirdCoderWorkspaceScopedListRequest,
): string | undefined {
  return normalizeWorkspaceScopedQueryValue(options?.userId);
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

function normalizeCollaborationUserReference(
  request:
    | BirdCoderUpsertProjectCollaboratorRequest
    | BirdCoderUpsertWorkspaceMemberRequest,
): { email?: string; userId?: string } {
  const userId = normalizeOptionalText(request.userId);
  const email = normalizeOptionalText(request.email);
  if (!userId && !email) {
    throw new Error('userId or email must not be empty.');
  }
  return {
    email,
    userId,
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
const BIRDCODER_CODING_SESSION_STATUS_SET = new Set<BirdCoderCodingSessionSummary['status']>([
  'draft',
  'active',
  'paused',
  'completed',
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

function normalizeCodingSessionStatus(
  value?: string,
): BirdCoderCodingSessionSummary['status'] | undefined {
  const normalizedValue = normalizeOptionalText(value);
  if (!normalizedValue) {
    return undefined;
  }
  if (
    !BIRDCODER_CODING_SESSION_STATUS_SET.has(
      normalizedValue as BirdCoderCodingSessionSummary['status'],
    )
  ) {
    throw new Error(
      'coding session status must be one of draft/active/paused/completed/archived.',
    );
  }

  return normalizedValue as BirdCoderCodingSessionSummary['status'];
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
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderWorkspaceSummary>,
        'app.createWorkspace'
      >('app.createWorkspace', {
        body: {
          name: normalizeRequiredIdentifier(request.name, 'name'),
          description: normalizeOptionalText(request.description),
          tenantId: normalizeOptionalText(request.tenantId),
          organizationId: normalizeOptionalText(request.organizationId),
          code: normalizeOptionalText(request.code),
          title: normalizeOptionalText(request.title),
          ownerId: normalizeOptionalText(request.ownerId),
          leaderId: normalizeOptionalText(request.leaderId),
          createdByUserId: normalizeOptionalText(request.createdByUserId),
          type: normalizeOptionalText(request.type),
        },
      });
      return response.data;
    },
    async updateWorkspace(
      workspaceId: string,
      request: BirdCoderUpdateWorkspaceRequest,
    ): Promise<BirdCoderWorkspaceSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderWorkspaceSummary>,
        'app.updateWorkspace'
      >('app.updateWorkspace', {
        pathParams: {
          workspaceId: normalizeRequiredIdentifier(workspaceId, 'workspaceId'),
        },
        body: {
          name: normalizeOptionalText(request.name),
          description: normalizeOptionalText(request.description),
          code: normalizeOptionalText(request.code),
          title: normalizeOptionalText(request.title),
          ownerId: normalizeOptionalText(request.ownerId),
          leaderId: normalizeOptionalText(request.leaderId),
          type: normalizeOptionalText(request.type),
          status: normalizeWorkspaceStatus(request.status),
        },
      });
      return response.data;
    },
    async deleteWorkspace(workspaceId: string): Promise<void> {
      await client.request<BirdCoderApiEnvelope<{ id: string }>, 'app.deleteWorkspace'>(
        'app.deleteWorkspace',
        {
          pathParams: {
            workspaceId: normalizeRequiredIdentifier(workspaceId, 'workspaceId'),
          },
        },
      );
    },
    async listWorkspaces(
      options: BirdCoderWorkspaceScopedListRequest = {},
    ): Promise<BirdCoderWorkspaceSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderWorkspaceSummary>,
        'app.listWorkspaces'
      >('app.listWorkspaces', {
        query: {
          userId: readUserScopedQuery(options),
        },
      });
      return response.items;
    },
    async listProjects(
      options: BirdCoderProjectListRequest = {},
    ): Promise<BirdCoderProjectSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderProjectSummary>,
        'app.listProjects'
      >('app.listProjects', {
        query: {
          rootPath: normalizeOptionalText(options.rootPath),
          userId: readUserScopedQuery(options),
          workspaceId: readWorkspaceScopedQuery(options),
        },
      });
      return response.items;
    },
    async getProject(projectId: string): Promise<BirdCoderProjectSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectSummary>,
        'app.getProject'
      >('app.getProject', {
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.data;
    },
    async listSkillPackages(
      options: BirdCoderWorkspaceScopedListRequest = {},
    ): Promise<BirdCoderSkillPackageSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderSkillPackageSummary>,
        'app.listSkillPackages'
      >('app.listSkillPackages', {
        query: {
          userId: readUserScopedQuery(options),
          workspaceId: readWorkspaceScopedQuery(options),
        },
      });
      return response.items;
    },
    async listAppTemplates(): Promise<BirdCoderAppTemplateSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderAppTemplateSummary>,
        'app.listAppTemplates'
      >('app.listAppTemplates');
      return response.items;
    },
    async createProject(
      request: BirdCoderCreateProjectRequest,
    ): Promise<BirdCoderProjectSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectSummary>,
        'app.createProject'
      >('app.createProject', {
        body: {
          workspaceId: normalizeRequiredIdentifier(request.workspaceId, 'workspaceId'),
          name: normalizeRequiredIdentifier(request.name, 'name'),
          workspaceUuid: normalizeOptionalText(request.workspaceUuid),
          tenantId: normalizeOptionalText(request.tenantId),
          organizationId: normalizeOptionalText(request.organizationId),
          code: normalizeOptionalText(request.code),
          title: normalizeOptionalText(request.title),
          ownerId: normalizeOptionalText(request.ownerId),
          leaderId: normalizeOptionalText(request.leaderId),
          createdByUserId: normalizeOptionalText(request.createdByUserId),
          author: normalizeOptionalText(request.author),
          type: normalizeOptionalText(request.type),
          description: normalizeOptionalText(request.description),
          rootPath: normalizeOptionalText(request.rootPath),
          appTemplateVersionId: normalizeOptionalText(request.appTemplateVersionId),
          templatePresetKey: normalizeOptionalText(request.templatePresetKey),
          status: normalizeProjectStatus(request.status),
        },
      });
      return response.data;
    },
    async updateProject(
      projectId: string,
      request: BirdCoderUpdateProjectRequest,
    ): Promise<BirdCoderProjectSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectSummary>,
        'app.updateProject'
      >('app.updateProject', {
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
        body: {
          name: normalizeOptionalText(request.name),
          description: normalizeOptionalText(request.description),
          code: normalizeOptionalText(request.code),
          title: normalizeOptionalText(request.title),
          ownerId: normalizeOptionalText(request.ownerId),
          leaderId: normalizeOptionalText(request.leaderId),
          author: normalizeOptionalText(request.author),
          type: normalizeOptionalText(request.type),
          rootPath: normalizeOptionalText(request.rootPath),
          status: normalizeProjectStatus(request.status),
        },
      });
      return response.data;
    },
    async deleteProject(projectId: string): Promise<void> {
      await client.request<BirdCoderApiEnvelope<{ id: string }>, 'app.deleteProject'>(
        'app.deleteProject',
        {
          pathParams: {
            projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
          },
        },
      );
    },
    async installSkillPackage(
      packageId: string,
      request: BirdCoderInstallSkillPackageRequest,
    ): Promise<BirdCoderSkillInstallationSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderSkillInstallationSummary>,
        'app.installSkillPackage'
      >('app.installSkillPackage', {
        pathParams: {
          packageId: normalizeRequiredIdentifier(packageId, 'packageId'),
        },
        body: {
          scopeId: normalizeRequiredIdentifier(request.scopeId, 'scopeId'),
          scopeType: normalizeRequiredIdentifier(request.scopeType, 'scopeType'),
        },
      });
      return response.data;
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
          userId: readUserScopedQuery(options),
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
          userId: readUserScopedQuery(options),
          workspaceId: readWorkspaceScopedQuery(options),
        },
      });
      return response.items;
    },
    async listWorkspaceMembers(
      workspaceId: string,
    ): Promise<BirdCoderWorkspaceMemberSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderWorkspaceMemberSummary>,
        'app.listWorkspaceMembers'
      >('app.listWorkspaceMembers', {
        pathParams: {
          workspaceId: normalizeRequiredIdentifier(workspaceId, 'workspaceId'),
        },
      });
      return response.items;
    },
    async publishProject(
      projectId: string,
      request: BirdCoderPublishProjectRequest,
    ): Promise<BirdCoderProjectPublishResult> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectPublishResult>,
        'app.publishProject'
      >('app.publishProject', {
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
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
      const userReference = normalizeCollaborationUserReference(request);
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderWorkspaceMemberSummary>,
        'app.upsertWorkspaceMember'
      >('app.upsertWorkspaceMember', {
        pathParams: {
          workspaceId: normalizeRequiredIdentifier(workspaceId, 'workspaceId'),
        },
        body: {
          email: userReference.email,
          userId: userReference.userId,
          teamId: normalizeOptionalText(request.teamId),
          role: normalizeCollaborationRole(request.role),
          status: normalizeCollaborationStatus(request.status),
          createdByUserId: normalizeOptionalText(request.createdByUserId),
          grantedByUserId: normalizeOptionalText(request.grantedByUserId),
        },
      });
      return response.data;
    },
    async listProjectCollaborators(
      projectId: string,
    ): Promise<BirdCoderProjectCollaboratorSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderProjectCollaboratorSummary>,
        'app.listProjectCollaborators'
      >('app.listProjectCollaborators', {
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.items;
    },
    async upsertProjectCollaborator(
      projectId: string,
      request: BirdCoderUpsertProjectCollaboratorRequest,
    ): Promise<BirdCoderProjectCollaboratorSummary> {
      const userReference = normalizeCollaborationUserReference(request);
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectCollaboratorSummary>,
        'app.upsertProjectCollaborator'
      >('app.upsertProjectCollaborator', {
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
        body: {
          email: userReference.email,
          userId: userReference.userId,
          teamId: normalizeOptionalText(request.teamId),
          role: normalizeCollaborationRole(request.role),
          status: normalizeCollaborationStatus(request.status),
          createdByUserId: normalizeOptionalText(request.createdByUserId),
          grantedByUserId: normalizeOptionalText(request.grantedByUserId),
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
  const client = createBirdCoderFinalizedCodingServerClient(transport);

  return {
    async getConfig(): Promise<BirdCoderUserCenterMetadataSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMetadataSummary>,
        'app.getUserCenterConfig'
      >('app.getUserCenterConfig');
      return response.data;
    },
    async getCurrentSession(): Promise<BirdCoderUserCenterSessionSummary | null> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary | null>,
        'app.getCurrentUserSession'
      >('app.getCurrentUserSession');
      return response.data ?? null;
    },
    async login(
      request: BirdCoderUserCenterLoginRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'app.login'
      >('app.login', {
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
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'app.register'
      >('app.register', {
        body: {
          email: normalizeRequiredIdentifier(request.email, 'email'),
          name: normalizeOptionalText(request.name),
          password: normalizeOptionalText(request.password),
        },
      });
      return response.data;
    },
    async logout(): Promise<void> {
      await client.request<BirdCoderApiEnvelope<{ success: boolean }>, 'app.logout'>('app.logout');
    },
    async exchangeSession(
      request: BirdCoderUserCenterSessionExchangeRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'app.exchangeUserCenterSession'
      >('app.exchangeUserCenterSession', {
        body: {
          avatarUrl: normalizeOptionalText(request.avatarUrl),
          email: normalizeRequiredIdentifier(request.email, 'email'),
          userId: normalizeOptionalText(request.userId),
          name: normalizeOptionalText(request.name),
          providerKey: normalizeOptionalText(request.providerKey),
          subject: normalizeOptionalText(request.subject),
        },
      });
      return response.data;
    },
    async getCurrentProfile(): Promise<BirdCoderUserCenterProfileSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterProfileSummary>,
        'app.getCurrentUserProfile'
      >('app.getCurrentUserProfile');
      return response.data;
    },
    async updateCurrentProfile(
      request: BirdCoderUpdateCurrentUserProfileRequest,
    ): Promise<BirdCoderUserCenterProfileSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterProfileSummary>,
        'app.updateCurrentUserProfile'
      >('app.updateCurrentUserProfile', {
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
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMembershipSummary>,
        'app.getCurrentUserMembership'
      >('app.getCurrentUserMembership');
      return response.data;
    },
    async updateCurrentMembership(
      request: BirdCoderUpdateCurrentUserMembershipRequest,
    ): Promise<BirdCoderUserCenterMembershipSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMembershipSummary>,
        'app.updateCurrentUserMembership'
      >('app.updateCurrentUserMembership', {
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
    async listCodingSessions(
      request: BirdCoderListCodingSessionsRequest = {},
    ): Promise<BirdCoderCodingSessionSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderCodingSessionSummary>,
        'core.listCodingSessions'
      >('core.listCodingSessions', {
        query: {
          engineId: normalizeOptionalText(request.engineId),
          limit: request.limit,
          offset: request.offset,
          projectId: normalizeOptionalText(request.projectId),
          workspaceId: normalizeOptionalText(request.workspaceId),
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
    async listNativeSessionProviders(): Promise<BirdCoderNativeSessionProviderSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderNativeSessionProviderSummary>,
        'core.listNativeSessionProviders'
      >('core.listNativeSessionProviders');
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
          offset: request.offset,
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
    async forkCodingSession(
      codingSessionId: string,
      request: BirdCoderForkCodingSessionRequest = {},
    ): Promise<BirdCoderCodingSessionSummary> {
      const body: Record<string, unknown> = {};
      const title = normalizeOptionalText(request.title);
      if (title) {
        body.title = title;
      }

      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCodingSessionSummary>,
        'core.forkCodingSession'
      >('core.forkCodingSession', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
        body,
      });
      return response.data;
    },
    async updateCodingSession(
      codingSessionId: string,
      request: BirdCoderUpdateCodingSessionRequest,
    ): Promise<BirdCoderCodingSessionSummary> {
      const body: Record<string, unknown> = {};
      const title = normalizeOptionalText(request.title);
      const status = normalizeCodingSessionStatus(request.status);
      const modelId = normalizeOptionalText(request.modelId);
      const engineId = normalizeOptionalText(request.engineId);

      if (title) {
        body.title = title;
      }
      if (status) {
        body.status = status;
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
      if (Object.keys(body).length === 0) {
        throw new Error('update coding session request must include at least one field.');
      }

      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCodingSessionSummary>,
        'core.updateCodingSession'
      >('core.updateCodingSession', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
        body,
      });
      return response.data;
    },
    async deleteCodingSession(
      codingSessionId: string,
    ): Promise<BirdCoderDeleteCodingSessionResult> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderDeleteCodingSessionResult>,
        'core.deleteCodingSession'
      >('core.deleteCodingSession', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
        },
      });
      return response.data;
    },
    async deleteCodingSessionMessage(
      codingSessionId: string,
      messageId: string,
    ): Promise<BirdCoderDeleteCodingSessionMessageResult> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderDeleteCodingSessionMessageResult>,
        'core.deleteCodingSessionMessage'
      >('core.deleteCodingSessionMessage', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
          messageId: normalizeRequiredIdentifier(messageId, 'messageId'),
        },
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
      const ideContext = request.ideContext;

      if (runtimeId) {
        body.runtimeId = runtimeId;
      }
      if (ideContext) {
        body.ideContext = {
          ...(ideContext.workspaceId ? { workspaceId: ideContext.workspaceId } : {}),
          ...(ideContext.projectId ? { projectId: ideContext.projectId } : {}),
          ...(ideContext.threadId ? { threadId: ideContext.threadId } : {}),
          ...(ideContext.currentFile
            ? {
                currentFile: {
                  path: normalizeRequiredIdentifier(
                    ideContext.currentFile.path,
                    'ideContext.currentFile.path',
                  ),
                  ...(normalizeOptionalText(ideContext.currentFile.content)
                    ? { content: ideContext.currentFile.content }
                    : {}),
                  ...(normalizeOptionalText(ideContext.currentFile.language)
                    ? { language: ideContext.currentFile.language }
                    : {}),
                },
              }
            : {}),
        };
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
