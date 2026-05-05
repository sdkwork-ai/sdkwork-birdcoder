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
  BirdCoderCanonicalEntityId,
  BirdCoderDataScope,
  BirdCoderLongIntegerString,
} from './data.ts';
import type {
  BirdCoderCodeEngineKey,
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigSyncResult,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineBindingSummary,
  BirdCoderEngineDescriptor,
  BirdCoderEngineTransportKind,
  BirdCoderModelCatalogEntry,
  BirdCoderSyncCodeEngineModelConfigRequest,
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
  codingSessionRuntimeStatus?: BirdCoderCodingSessionRuntimeStatus;
  nativeSessionId?: string;
  turnId?: string;
  codingSessionEventKind?: BirdCoderCodingSessionEvent['kind'];
  codingSessionEventPayload?: BirdCoderCodingSessionEvent['payload'];
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

export interface BirdCoderSubmitUserQuestionAnswerRequest {
  answer?: string;
  optionId?: string;
  optionLabel?: string;
  rejected?: boolean;
}

export interface BirdCoderUserQuestionAnswerResult {
  questionId: string;
  codingSessionId: string;
  answer?: string;
  answeredAt: string;
  optionId?: string;
  optionLabel?: string;
  rejected?: boolean;
  runtimeId?: string;
  runtimeStatus: BirdCoderCodingSessionRuntimeStatus;
  turnId?: string;
}

export interface BirdCoderWorkspaceSummary {
  id: BirdCoderCanonicalEntityId;
  uuid?: string;
  tenantId?: BirdCoderCanonicalEntityId;
  organizationId?: BirdCoderCanonicalEntityId;
  dataScope?: BirdCoderDataScope;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  ownerId?: BirdCoderCanonicalEntityId;
  leaderId?: BirdCoderCanonicalEntityId;
  createdByUserId?: BirdCoderCanonicalEntityId;
  type?: string;
  startTime?: string;
  endTime?: string;
  maxMembers?: number;
  currentMembers?: number;
  memberCount?: number;
  maxStorage?: BirdCoderLongIntegerString;
  usedStorage?: BirdCoderLongIntegerString;
  settings?: Record<string, unknown>;
  isPublic?: boolean;
  isTemplate?: boolean;
  status: 'active' | 'archived';
  viewerRole?: BirdCoderCollaborationRole;
}

export interface BirdCoderCreateWorkspaceRequest {
  description?: string;
  name: string;
  tenantId?: BirdCoderCanonicalEntityId;
  organizationId?: BirdCoderCanonicalEntityId;
  dataScope?: BirdCoderDataScope;
  code?: string;
  title?: string;
  ownerId?: BirdCoderCanonicalEntityId;
  leaderId?: BirdCoderCanonicalEntityId;
  createdByUserId?: BirdCoderCanonicalEntityId;
  icon?: string;
  color?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  maxMembers?: number;
  currentMembers?: number;
  memberCount?: number;
  maxStorage?: BirdCoderLongIntegerString;
  usedStorage?: BirdCoderLongIntegerString;
  settings?: Record<string, unknown>;
  isPublic?: boolean;
  isTemplate?: boolean;
}

export interface BirdCoderUpdateWorkspaceRequest {
  description?: string;
  dataScope?: BirdCoderDataScope;
  code?: string;
  title?: string;
  name?: string;
  ownerId?: BirdCoderCanonicalEntityId;
  leaderId?: BirdCoderCanonicalEntityId;
  createdByUserId?: BirdCoderCanonicalEntityId;
  icon?: string;
  color?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  maxMembers?: number;
  currentMembers?: number;
  memberCount?: number;
  maxStorage?: BirdCoderLongIntegerString;
  usedStorage?: BirdCoderLongIntegerString;
  settings?: Record<string, unknown>;
  isPublic?: boolean;
  isTemplate?: boolean;
  status?: BirdCoderWorkspaceSummary['status'];
}

export interface BirdCoderProjectSummary {
  createdAt: string;
  id: BirdCoderCanonicalEntityId;
  uuid?: string;
  tenantId?: BirdCoderCanonicalEntityId;
  organizationId?: BirdCoderCanonicalEntityId;
  dataScope?: BirdCoderDataScope;
  workspaceId: BirdCoderCanonicalEntityId;
  workspaceUuid?: string;
  userId?: BirdCoderCanonicalEntityId;
  parentId?: BirdCoderCanonicalEntityId;
  parentUuid?: string;
  parentMetadata?: Record<string, unknown>;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  rootPath?: string;
  sitePath?: string;
  domainPrefix?: string;
  ownerId?: BirdCoderCanonicalEntityId;
  leaderId?: BirdCoderCanonicalEntityId;
  createdByUserId?: BirdCoderCanonicalEntityId;
  author?: string;
  fileId?: BirdCoderCanonicalEntityId;
  conversationId?: BirdCoderCanonicalEntityId;
  type?: string;
  coverImage?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  budgetAmount?: BirdCoderLongIntegerString;
  isTemplate?: boolean;
  collaboratorCount?: number;
  status: 'active' | 'archived';
  updatedAt: string;
  viewerRole?: BirdCoderCollaborationRole;
}

export type BirdCoderGitOverviewStatus = 'ready' | 'not_repository';

export interface BirdCoderGitStatusCounts {
  conflicted: number;
  deleted: number;
  modified: number;
  staged: number;
  untracked: number;
}

export interface BirdCoderGitBranchSummary {
  ahead: number;
  behind: number;
  isCurrent: boolean;
  kind: string;
  name: string;
  upstreamName?: string;
}

export interface BirdCoderGitWorktreeSummary {
  branch?: string;
  head?: string;
  id: string;
  isCurrent: boolean;
  isDetached: boolean;
  isLocked: boolean;
  isPrunable: boolean;
  label: string;
  lockedReason?: string;
  path: string;
  prunableReason?: string;
}

export interface BirdCoderProjectGitOverview {
  branches: BirdCoderGitBranchSummary[];
  currentBranch?: string;
  currentRevision?: string;
  currentWorktreePath?: string;
  detachedHead: boolean;
  repositoryRootPath?: string;
  status: BirdCoderGitOverviewStatus;
  statusCounts: BirdCoderGitStatusCounts;
  worktrees: BirdCoderGitWorktreeSummary[];
}

export interface BirdCoderCreateProjectGitBranchRequest {
  branchName: string;
}

export interface BirdCoderSwitchProjectGitBranchRequest {
  branchName: string;
}

export interface BirdCoderCommitProjectGitChangesRequest {
  message: string;
}

export interface BirdCoderPushProjectGitBranchRequest {
  branchName?: string;
  remoteName?: string;
}

export interface BirdCoderCreateProjectGitWorktreeRequest {
  branchName: string;
  path: string;
}

export interface BirdCoderRemoveProjectGitWorktreeRequest {
  force?: boolean;
  path: string;
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
  installCount?: BirdCoderLongIntegerString;
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
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  author?: string;
  versionId: string;
  versionLabel: string;
  installCount?: BirdCoderLongIntegerString;
  longDescription?: string;
  sourceUri?: string;
  installed: boolean;
  skills: BirdCoderSkillCatalogEntrySummary[];
}

export interface BirdCoderInstallSkillPackageRequest {
  scopeId: string;
  scopeType: 'workspace' | 'project';
}

export interface BirdCoderSkillInstallationSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  packageId: string;
  scopeId: string;
  scopeType: 'workspace' | 'project';
  status: 'active' | 'archived' | (string & {});
  versionId: string;
  installedAt: string;
}

export interface BirdCoderAppTemplateSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
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
}

export interface BirdCoderCreateProjectRequest {
  description?: string;
  name: string;
  workspaceUuid?: string;
  tenantId?: BirdCoderCanonicalEntityId;
  organizationId?: BirdCoderCanonicalEntityId;
  dataScope?: BirdCoderDataScope;
  userId?: BirdCoderCanonicalEntityId;
  parentId?: BirdCoderCanonicalEntityId;
  parentUuid?: string;
  parentMetadata?: Record<string, unknown>;
  code?: string;
  title?: string;
  ownerId?: BirdCoderCanonicalEntityId;
  leaderId?: BirdCoderCanonicalEntityId;
  createdByUserId?: BirdCoderCanonicalEntityId;
  author?: string;
  fileId?: BirdCoderCanonicalEntityId;
  conversationId?: BirdCoderCanonicalEntityId;
  type?: string;
  rootPath?: string;
  sitePath?: string;
  domainPrefix?: string;
  coverImage?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  budgetAmount?: BirdCoderLongIntegerString;
  isTemplate?: boolean;
  appTemplateVersionId?: string;
  templatePresetKey?: string;
  status?: BirdCoderProjectSummary['status'];
  workspaceId: BirdCoderCanonicalEntityId;
}

export interface BirdCoderUpdateProjectRequest {
  description?: string;
  dataScope?: BirdCoderDataScope;
  userId?: BirdCoderCanonicalEntityId;
  parentId?: BirdCoderCanonicalEntityId;
  parentUuid?: string;
  parentMetadata?: Record<string, unknown>;
  code?: string;
  title?: string;
  name?: string;
  ownerId?: BirdCoderCanonicalEntityId;
  leaderId?: BirdCoderCanonicalEntityId;
  createdByUserId?: BirdCoderCanonicalEntityId;
  author?: string;
  fileId?: BirdCoderCanonicalEntityId;
  conversationId?: BirdCoderCanonicalEntityId;
  type?: string;
  rootPath?: string;
  sitePath?: string;
  domainPrefix?: string;
  coverImage?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  budgetAmount?: BirdCoderLongIntegerString;
  isTemplate?: boolean;
  status?: BirdCoderProjectSummary['status'];
}

export interface BirdCoderProjectDocumentSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId: string;
  documentKind: 'prd' | 'architecture' | 'step' | 'release' | 'test-plan' | 'custom';
  title: string;
  slug: string;
  bodyRef?: string;
  status: 'draft' | 'active' | 'archived';
}

export interface BirdCoderTeamSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  workspaceId: string;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
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
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  teamId: string;
  userId: string;
  role: BirdCoderCollaborationRole;
  status: BirdCoderCollaborationStatus;
  createdByUserId?: string;
  grantedByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BirdCoderWorkspaceMemberSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
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
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
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
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId: string;
  name: string;
  environmentKey: 'dev' | 'test' | 'staging' | 'prod' | (string & {});
  runtime: 'web' | 'desktop' | 'server' | 'container' | 'kubernetes' | (string & {});
  status: 'active' | 'archived';
}

export interface BirdCoderDeploymentRecordSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId: string;
  targetId: string;
  releaseRecordId?: string;
  status: 'planned' | 'running' | 'succeeded' | 'failed' | 'rolled_back';
  endpointUrl?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BirdCoderReleaseSummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  releaseVersion: string;
  releaseKind: 'formal' | 'canary' | 'hotfix' | 'rollback' | (string & {});
  rolloutStage: string;
  manifest?: Record<string, unknown>;
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
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
  scopeType: string;
  scopeId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface BirdCoderAdminPolicySummary {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
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
}

export type BirdCoderUserCenterMode = 'builtin-local' | 'sdkwork-cloud-app-api' | 'external-user-center';

export const BIRDCODER_USER_CENTER_LOGIN_METHODS = [
  'emailCode',
  'password',
  'phoneCode',
  'sessionBridge',
] as const;

export type BirdCoderUserCenterLoginMethod =
  (typeof BIRDCODER_USER_CENTER_LOGIN_METHODS)[number];

export const BIRDCODER_USER_CENTER_REGISTER_METHODS = [
  'email',
  'phone',
] as const;

export type BirdCoderUserCenterRegisterMethod =
  (typeof BIRDCODER_USER_CENTER_REGISTER_METHODS)[number];

export const BIRDCODER_USER_CENTER_RECOVERY_METHODS = [
  'email',
  'phone',
] as const;

export type BirdCoderUserCenterRecoveryMethod =
  (typeof BIRDCODER_USER_CENTER_RECOVERY_METHODS)[number];

export const BIRDCODER_USER_CENTER_VERIFY_TYPES = ['EMAIL', 'PHONE'] as const;

export type BirdCoderUserCenterVerifyType =
  (typeof BIRDCODER_USER_CENTER_VERIFY_TYPES)[number];

export const BIRDCODER_USER_CENTER_VERIFY_SCENES = [
  'LOGIN',
  'REGISTER',
  'RESET_PASSWORD',
] as const;

export type BirdCoderUserCenterVerifyScene =
  (typeof BIRDCODER_USER_CENTER_VERIFY_SCENES)[number];

export const BIRDCODER_USER_CENTER_PASSWORD_RESET_CHANNELS = [
  'EMAIL',
  'SMS',
] as const;

export type BirdCoderUserCenterPasswordResetChannel =
  (typeof BIRDCODER_USER_CENTER_PASSWORD_RESET_CHANNELS)[number];

export const BIRDCODER_USER_CENTER_DEVICE_TYPES = [
  'android',
  'desktop',
  'ios',
  'web',
] as const;

export type BirdCoderUserCenterDeviceType =
  (typeof BIRDCODER_USER_CENTER_DEVICE_TYPES)[number];

export const BIRDCODER_USER_CENTER_LOGIN_QR_STATUSES = [
  'pending',
  'scanned',
  'confirmed',
  'expired',
] as const;

export type BirdCoderUserCenterLoginQrStatus =
  (typeof BIRDCODER_USER_CENTER_LOGIN_QR_STATUSES)[number];

export interface BirdCoderAuthenticatedUserSummary {
  id: string;
  uuid: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface BirdCoderUserCenterMetadataSummary {
  integrationKind?: string;
  loginMethods: BirdCoderUserCenterLoginMethod[];
  mode: BirdCoderUserCenterMode;
  oauthLoginEnabled: boolean;
  oauthProviders: string[];
  providerKey: string;
  qrLoginEnabled: boolean;
  recoveryMethods: BirdCoderUserCenterRecoveryMethod[];
  registerMethods: BirdCoderUserCenterRegisterMethod[];
  sessionHeaderName: string;
  supportsLocalCredentials: boolean;
  supportsMembershipWrite: boolean;
  supportsProfileWrite: boolean;
  supportsSessionExchange: boolean;
  upstreamBaseUrl?: string;
}

export interface BirdCoderUserCenterSessionSummary {
  accessToken: string;
  authToken: string;
  uuid: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  providerKey: string;
  providerMode: BirdCoderUserCenterMode;
  refreshToken?: string | null;
  sessionId: string;
  tokenType: string;
  updatedAt: string;
  user: BirdCoderAuthenticatedUserSummary;
}

export interface BirdCoderUserCenterLoginRequest {
  account?: string;
  email?: string;
  password?: string;
}

export interface BirdCoderUserCenterRegisterRequest {
  channel?: BirdCoderUserCenterVerifyType;
  confirmPassword?: string;
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  username?: string;
  verificationCode?: string;
}

export interface BirdCoderUserCenterSendVerifyCodeRequest {
  scene: BirdCoderUserCenterVerifyScene;
  target: string;
  verifyType: BirdCoderUserCenterVerifyType;
}

export interface BirdCoderUserCenterEmailCodeLoginRequest {
  appVersion?: string;
  code: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: BirdCoderUserCenterDeviceType;
  email: string;
}

export interface BirdCoderUserCenterPhoneCodeLoginRequest {
  appVersion?: string;
  code: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: BirdCoderUserCenterDeviceType;
  phone: string;
}

export interface BirdCoderUserCenterPasswordResetChallengeRequest {
  account: string;
  channel: BirdCoderUserCenterPasswordResetChannel;
}

export interface BirdCoderUserCenterPasswordResetRequest {
  account: string;
  code: string;
  confirmPassword?: string;
  newPassword: string;
}

export interface BirdCoderUserCenterOAuthAuthorizationRequest {
  provider: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export interface BirdCoderUserCenterOAuthLoginRequest {
  code: string;
  deviceId?: string;
  deviceType?: BirdCoderUserCenterDeviceType;
  provider: string;
  state?: string;
}

export interface BirdCoderUserCenterOAuthAuthorizationSummary {
  authUrl: string;
}

export interface BirdCoderUserCenterSessionExchangeRequest {
  avatarUrl?: string;
  email: string;
  userId?: string;
  name?: string;
  providerKey?: string;
  subject?: string;
}

export interface BirdCoderUserCenterLoginQrCodeSummary {
  description?: string;
  expireTime?: number;
  qrContent?: string;
  qrKey: string;
  qrUrl?: string;
  title?: string;
  type?: string;
}

export interface BirdCoderUserCenterLoginQrStatusSummary {
  session?: BirdCoderUserCenterSessionSummary;
  status: BirdCoderUserCenterLoginQrStatus;
  user?: BirdCoderAuthenticatedUserSummary;
}

export interface BirdCoderUserCenterProfileSummary {
  uuid: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
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
  uuid: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  vipLevelId?: string;
  pointBalance: BirdCoderLongIntegerString;
  totalRechargedPoints: BirdCoderLongIntegerString;
  status: string;
  validFrom?: string;
  validTo?: string;
  lastActiveTime?: string;
  remark?: string;
}

export interface BirdCoderUpdateCurrentUserMembershipRequest {
  vipLevelId?: string;
  pointBalance?: BirdCoderLongIntegerString;
  totalRechargedPoints?: BirdCoderLongIntegerString;
  status?: string;
  validFrom?: string;
  validTo?: string;
  lastActiveTime?: string;
  remark?: string;
}

export interface BirdCoderWorkspaceScopedListRequest {
  userId?: string;
  workspaceId?: string;
}

export interface BirdCoderProjectListRequest extends BirdCoderWorkspaceScopedListRequest {
  rootPath?: string;
}

export interface BirdCoderAppAdminApiClient {
  commitProjectGitChanges(
    projectId: string,
    request: BirdCoderCommitProjectGitChangesRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  createProjectGitBranch(
    projectId: string,
    request: BirdCoderCreateProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  createProjectGitWorktree(
    projectId: string,
    request: BirdCoderCreateProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  createProject(request: BirdCoderCreateProjectRequest): Promise<BirdCoderProjectSummary>;
  createWorkspace(request: BirdCoderCreateWorkspaceRequest): Promise<BirdCoderWorkspaceSummary>;
  deleteProject(projectId: string): Promise<void>;
  deleteWorkspace(workspaceId: string): Promise<void>;
  getProject(projectId: string): Promise<BirdCoderProjectSummary>;
  getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview>;
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
  pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview>;
  removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
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
  checkLoginQrCodeStatus(
    qrKey: string,
  ): Promise<BirdCoderUserCenterLoginQrStatusSummary>;
  exchangeSession(
    request: BirdCoderUserCenterSessionExchangeRequest,
  ): Promise<BirdCoderUserCenterSessionSummary>;
  generateLoginQrCode(): Promise<BirdCoderUserCenterLoginQrCodeSummary>;
  getConfig(): Promise<BirdCoderUserCenterMetadataSummary>;
  getCurrentMembership(): Promise<BirdCoderUserCenterMembershipSummary>;
  getCurrentProfile(): Promise<BirdCoderUserCenterProfileSummary>;
  getCurrentSession(): Promise<BirdCoderUserCenterSessionSummary | null>;
  getOAuthAuthorizationUrl(
    request: BirdCoderUserCenterOAuthAuthorizationRequest,
  ): Promise<string>;
  loginWithEmailCode(
    request: BirdCoderUserCenterEmailCodeLoginRequest,
  ): Promise<BirdCoderUserCenterSessionSummary>;
  loginWithOAuth(
    request: BirdCoderUserCenterOAuthLoginRequest,
  ): Promise<BirdCoderUserCenterSessionSummary>;
  loginWithPhoneCode(
    request: BirdCoderUserCenterPhoneCodeLoginRequest,
  ): Promise<BirdCoderUserCenterSessionSummary>;
  login(request: BirdCoderUserCenterLoginRequest): Promise<BirdCoderUserCenterSessionSummary>;
  logout(): Promise<void>;
  requestPasswordReset(
    request: BirdCoderUserCenterPasswordResetChallengeRequest,
  ): Promise<void>;
  register(
    request: BirdCoderUserCenterRegisterRequest,
  ): Promise<BirdCoderUserCenterSessionSummary>;
  resetPassword(request: BirdCoderUserCenterPasswordResetRequest): Promise<void>;
  sendVerifyCode(request: BirdCoderUserCenterSendVerifyCodeRequest): Promise<void>;
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
  kind?: 'approval' | 'command' | 'file_change' | 'task' | 'tool' | 'user_question';
  toolName?: string;
  toolCallId?: string;
  runtimeStatus?: BirdCoderCodingSessionRuntimeStatus;
  requiresApproval?: boolean;
  requiresReply?: boolean;
}

export interface BirdCoderNativeSessionMessage {
  id: string;
  codingSessionId: string;
  turnId?: string;
  role: BirdCoderCodingSessionMessage['role'];
  content: string;
  commands?: BirdCoderNativeSessionCommand[];
  tool_calls?: unknown[];
  tool_call_id?: string;
  fileChanges?: readonly unknown[];
  taskProgress?: unknown;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface BirdCoderNativeSessionSummary extends BirdCoderCodingSessionSummary {
  kind: 'coding';
  nativeCwd?: string | null;
  sortTimestamp: BirdCoderLongIntegerString;
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
  getModelConfig(): Promise<BirdCoderCodeEngineModelConfig>;
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
  engineId: BirdCoderCodeEngineKey;
  modelId: string;
}

export interface BirdCoderUpdateCodingSessionRequest {
  title?: string;
  status?: BirdCoderCodingSessionSummary['status'];
  hostMode?: BirdCoderHostMode;
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

export interface BirdCoderEditCodingSessionMessageRequest {
  content: string;
}

export interface BirdCoderEditCodingSessionMessageResult {
  id: string;
  codingSessionId: string;
  content: string;
}

export interface BirdCoderCodingSessionTurnCurrentFileContext {
  path: string;
  content?: string;
  language?: string;
}

export interface BirdCoderCodingSessionTurnIdeContext {
  workspaceId?: string;
  projectId?: string;
  sessionId?: string;
  currentFile?: BirdCoderCodingSessionTurnCurrentFileContext;
}

export interface BirdCoderCodingSessionTurnOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface BirdCoderCreateCodingSessionTurnRequest {
  runtimeId?: string;
  engineId?: BirdCoderCodeEngineKey;
  modelId?: string;
  requestKind: BirdCoderCodingSessionTurn['requestKind'];
  inputSummary: string;
  stream?: boolean;
  ideContext?: BirdCoderCodingSessionTurnIdeContext;
  options?: BirdCoderCodingSessionTurnOptions;
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
  editCodingSessionMessage(
    codingSessionId: string,
    messageId: string,
    request: BirdCoderEditCodingSessionMessageRequest,
  ): Promise<BirdCoderEditCodingSessionMessageResult>;
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
  submitUserQuestionAnswer(
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ): Promise<BirdCoderUserQuestionAnswerResult>;
  syncModelConfig(
    request: BirdCoderSyncCodeEngineModelConfigRequest,
  ): Promise<BirdCoderCodeEngineModelConfigSyncResult>;
}

export interface CreateBirdCoderGeneratedCoreWriteApiClientOptions {
  transport: BirdCoderApiTransport;
}

export const BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS = [
  'core.getDescriptor',
  'core.getRuntime',
  'core.getHealth',
  'core.getModelConfig',
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
  'core.editCodingSessionMessage',
  'core.deleteCodingSessionMessage',
  'core.createCodingSessionTurn',
  'core.submitApprovalDecision',
  'core.submitUserQuestionAnswer',
  'core.syncModelConfig',
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
  deleteCodingSession: BirdCoderApiRouteDefinition;
  deleteCodingSessionMessage: BirdCoderApiRouteDefinition;
  descriptor: BirdCoderApiRouteDefinition;
  editCodingSessionMessage: BirdCoderApiRouteDefinition;
  engineCapabilities: BirdCoderApiRouteDefinition;
  engines: BirdCoderApiRouteDefinition;
  events: BirdCoderApiRouteDefinition;
  forkCodingSession: BirdCoderApiRouteDefinition;
  health: BirdCoderApiRouteDefinition;
  modelConfig: BirdCoderApiRouteDefinition;
  models: BirdCoderApiRouteDefinition;
  nativeSession: BirdCoderApiRouteDefinition;
  nativeSessionProviders: BirdCoderApiRouteDefinition;
  nativeSessions: BirdCoderApiRouteDefinition;
  operations: BirdCoderApiRouteDefinition;
  approvals: BirdCoderApiRouteDefinition;
  questions: BirdCoderApiRouteDefinition;
  routes: BirdCoderApiRouteDefinition;
  runtime: BirdCoderApiRouteDefinition;
  sessions: BirdCoderApiRouteDefinition;
  sessionArtifacts: BirdCoderApiRouteDefinition;
  sessionCheckpoints: BirdCoderApiRouteDefinition;
  sessionTurns: BirdCoderApiRouteDefinition;
  syncModelConfig: BirdCoderApiRouteDefinition;
  updateCodingSession: BirdCoderApiRouteDefinition;
}

export interface BirdCoderAppApiContract {
  appTemplates: BirdCoderApiRouteDefinition;
  authConfig: BirdCoderApiRouteDefinition;
  authOAuthLogin: BirdCoderApiRouteDefinition;
  authOAuthUrl: BirdCoderApiRouteDefinition;
  authQrGenerate: BirdCoderApiRouteDefinition;
  authQrStatus: BirdCoderApiRouteDefinition;
  authSession: BirdCoderApiRouteDefinition;
  commitProjectGitChanges: BirdCoderApiRouteDefinition;
  createProjectGitBranch: BirdCoderApiRouteDefinition;
  createProjectGitWorktree: BirdCoderApiRouteDefinition;
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
  loginWithEmailCode: BirdCoderApiRouteDefinition;
  loginWithPhoneCode: BirdCoderApiRouteDefinition;
  project: BirdCoderApiRouteDefinition;
  projectGitOverview: BirdCoderApiRouteDefinition;
  installSkillPackage: BirdCoderApiRouteDefinition;
  login: BirdCoderApiRouteDefinition;
  logout: BirdCoderApiRouteDefinition;
  pruneProjectGitWorktrees: BirdCoderApiRouteDefinition;
  publishProject: BirdCoderApiRouteDefinition;
  pushProjectGitBranch: BirdCoderApiRouteDefinition;
  projectCollaborators: BirdCoderApiRouteDefinition;
  projects: BirdCoderApiRouteDefinition;
  requestPasswordReset: BirdCoderApiRouteDefinition;
  register: BirdCoderApiRouteDefinition;
  resetPassword: BirdCoderApiRouteDefinition;
  removeProjectGitWorktree: BirdCoderApiRouteDefinition;
  sendVerifyCode: BirdCoderApiRouteDefinition;
  skillPackages: BirdCoderApiRouteDefinition;
  switchProjectGitBranch: BirdCoderApiRouteDefinition;
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
  projectGitOverview?: BirdCoderProjectGitOverview;
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

function normalizeRequiredText(value: string, fieldName: string): string {
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

function normalizeOptionalFiniteNumber(
  value: number | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeOptionalPositiveInteger(
  value: number | undefined,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function buildBirdCoderCodingSessionTurnOptionsBody(
  options: BirdCoderCodingSessionTurnOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const temperature = normalizeOptionalFiniteNumber(options.temperature, 0, 2);
  const topP = normalizeOptionalFiniteNumber(options.topP, 0, 1);
  const maxTokens = normalizeOptionalPositiveInteger(options.maxTokens, 128000);

  if (temperature !== undefined) {
    body.temperature = temperature;
  }
  if (topP !== undefined) {
    body.topP = topP;
  }
  if (maxTokens !== undefined) {
    body.maxTokens = maxTokens;
  }

  return body;
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
          dataScope: normalizeOptionalText(request.dataScope),
          code: normalizeOptionalText(request.code),
          title: normalizeOptionalText(request.title),
          ownerId: normalizeOptionalText(request.ownerId),
          leaderId: normalizeOptionalText(request.leaderId),
          createdByUserId: normalizeOptionalText(request.createdByUserId),
          icon: normalizeOptionalText(request.icon),
          color: normalizeOptionalText(request.color),
          type: normalizeOptionalText(request.type),
          startTime: normalizeOptionalText(request.startTime),
          endTime: normalizeOptionalText(request.endTime),
          maxMembers: request.maxMembers,
          currentMembers: request.currentMembers,
          memberCount: request.memberCount,
          maxStorage: request.maxStorage,
          usedStorage: request.usedStorage,
          settings: request.settings,
          isPublic: typeof request.isPublic === 'boolean' ? request.isPublic : undefined,
          isTemplate: typeof request.isTemplate === 'boolean' ? request.isTemplate : undefined,
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
          dataScope: normalizeOptionalText(request.dataScope),
          code: normalizeOptionalText(request.code),
          title: normalizeOptionalText(request.title),
          ownerId: normalizeOptionalText(request.ownerId),
          leaderId: normalizeOptionalText(request.leaderId),
          createdByUserId: normalizeOptionalText(request.createdByUserId),
          icon: normalizeOptionalText(request.icon),
          color: normalizeOptionalText(request.color),
          type: normalizeOptionalText(request.type),
          startTime: normalizeOptionalText(request.startTime),
          endTime: normalizeOptionalText(request.endTime),
          maxMembers: request.maxMembers,
          currentMembers: request.currentMembers,
          memberCount: request.memberCount,
          maxStorage: request.maxStorage,
          usedStorage: request.usedStorage,
          settings: request.settings,
          isPublic: typeof request.isPublic === 'boolean' ? request.isPublic : undefined,
          isTemplate: typeof request.isTemplate === 'boolean' ? request.isTemplate : undefined,
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
    async getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectGitOverview>,
        'app.getProjectGitOverview'
      >('app.getProjectGitOverview', {
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.data;
    },
    async createProjectGitBranch(
      projectId: string,
      request: BirdCoderCreateProjectGitBranchRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectGitOverview>,
        'app.createProjectGitBranch'
      >('app.createProjectGitBranch', {
        body: {
          branchName: normalizeRequiredIdentifier(request.branchName, 'branchName'),
        },
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.data;
    },
    async createProjectGitWorktree(
      projectId: string,
      request: BirdCoderCreateProjectGitWorktreeRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectGitOverview>,
        'app.createProjectGitWorktree'
      >('app.createProjectGitWorktree', {
        body: {
          branchName: normalizeRequiredIdentifier(request.branchName, 'branchName'),
          path: normalizeRequiredText(request.path, 'path'),
        },
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.data;
    },
    async switchProjectGitBranch(
      projectId: string,
      request: BirdCoderSwitchProjectGitBranchRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectGitOverview>,
        'app.switchProjectGitBranch'
      >('app.switchProjectGitBranch', {
        body: {
          branchName: normalizeRequiredIdentifier(request.branchName, 'branchName'),
        },
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.data;
    },
    async commitProjectGitChanges(
      projectId: string,
      request: BirdCoderCommitProjectGitChangesRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectGitOverview>,
        'app.commitProjectGitChanges'
      >('app.commitProjectGitChanges', {
        body: {
          message: normalizeRequiredIdentifier(request.message, 'message'),
        },
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.data;
    },
    async pushProjectGitBranch(
      projectId: string,
      request: BirdCoderPushProjectGitBranchRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectGitOverview>,
        'app.pushProjectGitBranch'
      >('app.pushProjectGitBranch', {
        body: {
          branchName: normalizeOptionalText(request.branchName),
          remoteName: normalizeOptionalText(request.remoteName),
        },
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.data;
    },
    async removeProjectGitWorktree(
      projectId: string,
      request: BirdCoderRemoveProjectGitWorktreeRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectGitOverview>,
        'app.removeProjectGitWorktree'
      >('app.removeProjectGitWorktree', {
        body: {
          force: typeof request.force === 'boolean' ? request.force : undefined,
          path: normalizeRequiredText(request.path, 'path'),
        },
        pathParams: {
          projectId: normalizeRequiredIdentifier(projectId, 'projectId'),
        },
      });
      return response.data;
    },
    async pruneProjectGitWorktrees(
      projectId: string,
    ): Promise<BirdCoderProjectGitOverview> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderProjectGitOverview>,
        'app.pruneProjectGitWorktrees'
      >('app.pruneProjectGitWorktrees', {
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
          dataScope: normalizeOptionalText(request.dataScope),
          userId: normalizeOptionalText(request.userId),
          parentId: normalizeOptionalText(request.parentId),
          parentUuid: normalizeOptionalText(request.parentUuid),
          parentMetadata: request.parentMetadata,
          code: normalizeOptionalText(request.code),
          title: normalizeOptionalText(request.title),
          ownerId: normalizeOptionalText(request.ownerId),
          leaderId: normalizeOptionalText(request.leaderId),
          createdByUserId: normalizeOptionalText(request.createdByUserId),
          author: normalizeOptionalText(request.author),
          type: normalizeOptionalText(request.type),
          description: normalizeOptionalText(request.description),
          rootPath: normalizeOptionalText(request.rootPath),
          sitePath: normalizeOptionalText(request.sitePath),
          domainPrefix: normalizeOptionalText(request.domainPrefix),
          fileId: normalizeOptionalText(request.fileId),
          conversationId: normalizeOptionalText(request.conversationId),
          startTime: normalizeOptionalText(request.startTime),
          endTime: normalizeOptionalText(request.endTime),
          budgetAmount: request.budgetAmount,
          coverImage: request.coverImage,
          isTemplate: typeof request.isTemplate === 'boolean' ? request.isTemplate : undefined,
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
          dataScope: normalizeOptionalText(request.dataScope),
          userId: normalizeOptionalText(request.userId),
          parentId: normalizeOptionalText(request.parentId),
          parentUuid: normalizeOptionalText(request.parentUuid),
          parentMetadata: request.parentMetadata,
          code: normalizeOptionalText(request.code),
          title: normalizeOptionalText(request.title),
          ownerId: normalizeOptionalText(request.ownerId),
          leaderId: normalizeOptionalText(request.leaderId),
          createdByUserId: normalizeOptionalText(request.createdByUserId),
          author: normalizeOptionalText(request.author),
          type: normalizeOptionalText(request.type),
          rootPath: normalizeOptionalText(request.rootPath),
          sitePath: normalizeOptionalText(request.sitePath),
          domainPrefix: normalizeOptionalText(request.domainPrefix),
          fileId: normalizeOptionalText(request.fileId),
          conversationId: normalizeOptionalText(request.conversationId),
          startTime: normalizeOptionalText(request.startTime),
          endTime: normalizeOptionalText(request.endTime),
          budgetAmount: request.budgetAmount,
          coverImage: request.coverImage,
          isTemplate: typeof request.isTemplate === 'boolean' ? request.isTemplate : undefined,
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
  const userCenterAuthBasePath = `${BIRDCODER_CODING_SERVER_API_PREFIXES.app}/auth`;

  async function requestUserCenterEnvelope<T>(
    method: BirdCoderApiRouteDefinition['method'],
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await transport.request<BirdCoderApiEnvelope<T>>({
      ...(body === undefined ? {} : { body }),
      method,
      path,
    });
    return response.data;
  }

  return {
    async checkLoginQrCodeStatus(
      qrKey: string,
    ): Promise<BirdCoderUserCenterLoginQrStatusSummary> {
      return requestUserCenterEnvelope(
        'GET',
        `${userCenterAuthBasePath}/qr/status/${encodeURIComponent(
          normalizeRequiredIdentifier(qrKey, 'qrKey'),
        )}`,
      );
    },
    async getConfig(): Promise<BirdCoderUserCenterMetadataSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMetadataSummary>,
        'app.getUserCenterConfig'
      >('app.getUserCenterConfig');
      return response.data;
    },
    async generateLoginQrCode(): Promise<BirdCoderUserCenterLoginQrCodeSummary> {
      return requestUserCenterEnvelope(
        'POST',
        `${userCenterAuthBasePath}/qr/generate`,
      );
    },
    async getOAuthAuthorizationUrl(
      request: BirdCoderUserCenterOAuthAuthorizationRequest,
    ): Promise<string> {
      const response = await requestUserCenterEnvelope<
        BirdCoderUserCenterOAuthAuthorizationSummary
      >(
        'POST',
        `${userCenterAuthBasePath}/oauth/url`,
        {
          provider: normalizeRequiredIdentifier(request.provider, 'provider'),
          redirectUri: normalizeRequiredIdentifier(request.redirectUri, 'redirectUri'),
          scope: normalizeOptionalText(request.scope),
          state: normalizeOptionalText(request.state),
        },
      );
      return normalizeRequiredIdentifier(response.authUrl, 'authUrl');
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
      const account =
        normalizeOptionalText(request.account) ??
        normalizeRequiredIdentifier(request.email, 'email');
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'app.login'
      >('app.login', {
        body: {
          account,
          email: normalizeOptionalText(request.email) ?? account,
          password: normalizeOptionalText(request.password),
        },
      });
      return response.data;
    },
    async loginWithEmailCode(
      request: BirdCoderUserCenterEmailCodeLoginRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'app.loginWithEmailCode'
      >('app.loginWithEmailCode', {
        body: {
          appVersion: normalizeOptionalText(request.appVersion),
          code: normalizeRequiredIdentifier(request.code, 'code'),
          deviceId: normalizeOptionalText(request.deviceId),
          deviceName: normalizeOptionalText(request.deviceName),
          deviceType: normalizeOptionalText(request.deviceType),
          email: normalizeRequiredIdentifier(request.email, 'email'),
        },
      });
      return response.data;
    },
    async loginWithOAuth(
      request: BirdCoderUserCenterOAuthLoginRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      return requestUserCenterEnvelope(
        'POST',
        `${userCenterAuthBasePath}/oauth/login`,
        {
          code: normalizeRequiredIdentifier(request.code, 'code'),
          deviceId: normalizeOptionalText(request.deviceId),
          deviceType: normalizeOptionalText(request.deviceType),
          provider: normalizeRequiredIdentifier(request.provider, 'provider'),
          state: normalizeOptionalText(request.state),
        },
      );
    },
    async loginWithPhoneCode(
      request: BirdCoderUserCenterPhoneCodeLoginRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'app.loginWithPhoneCode'
      >('app.loginWithPhoneCode', {
        body: {
          appVersion: normalizeOptionalText(request.appVersion),
          code: normalizeRequiredIdentifier(request.code, 'code'),
          deviceId: normalizeOptionalText(request.deviceId),
          deviceName: normalizeOptionalText(request.deviceName),
          deviceType: normalizeOptionalText(request.deviceType),
          phone: normalizeRequiredIdentifier(request.phone, 'phone'),
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
          channel: normalizeOptionalText(request.channel),
          confirmPassword: normalizeOptionalText(request.confirmPassword),
          email: normalizeOptionalText(request.email),
          name: normalizeOptionalText(request.name),
          password: normalizeOptionalText(request.password),
          phone: normalizeOptionalText(request.phone),
          username: normalizeOptionalText(request.username),
          verificationCode: normalizeOptionalText(request.verificationCode),
        },
      });
      return response.data;
    },
    async sendVerifyCode(
      request: BirdCoderUserCenterSendVerifyCodeRequest,
    ): Promise<void> {
      await client.request<
        BirdCoderApiEnvelope<{ success: boolean }>,
        'app.sendVerifyCode'
      >('app.sendVerifyCode', {
        body: {
          scene: normalizeRequiredIdentifier(request.scene, 'scene'),
          target: normalizeRequiredIdentifier(request.target, 'target'),
          verifyType: normalizeRequiredIdentifier(request.verifyType, 'verifyType'),
        },
      });
    },
    async requestPasswordReset(
      request: BirdCoderUserCenterPasswordResetChallengeRequest,
    ): Promise<void> {
      await client.request<
        BirdCoderApiEnvelope<{ success: boolean }>,
        'app.requestPasswordReset'
      >('app.requestPasswordReset', {
        body: {
          account: normalizeRequiredIdentifier(request.account, 'account'),
          channel: normalizeRequiredIdentifier(request.channel, 'channel'),
        },
      });
    },
    async resetPassword(
      request: BirdCoderUserCenterPasswordResetRequest,
    ): Promise<void> {
      await client.request<
        BirdCoderApiEnvelope<{ success: boolean }>,
        'app.resetPassword'
      >('app.resetPassword', {
        body: {
          account: normalizeRequiredIdentifier(request.account, 'account'),
          code: normalizeRequiredIdentifier(request.code, 'code'),
          confirmPassword: normalizeOptionalText(request.confirmPassword),
          newPassword: normalizeRequiredIdentifier(request.newPassword, 'newPassword'),
        },
      });
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
          vipLevelId: normalizeOptionalText(request.vipLevelId),
          pointBalance: request.pointBalance,
          totalRechargedPoints: request.totalRechargedPoints,
          status: normalizeOptionalText(request.status),
          validFrom: normalizeOptionalText(request.validFrom),
          validTo: normalizeOptionalText(request.validTo),
          lastActiveTime: normalizeOptionalText(request.lastActiveTime),
          remark: normalizeOptionalText(request.remark),
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
    async getModelConfig(): Promise<BirdCoderCodeEngineModelConfig> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCodeEngineModelConfig>,
        'core.getModelConfig'
      >('core.getModelConfig');
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
        engineId: normalizeRequiredText(request.engineId, 'engineId'),
        modelId: normalizeRequiredText(request.modelId, 'modelId'),
      };
      const title = normalizeOptionalText(request.title);

      if (title) {
        body.title = title;
      }
      if (request.hostMode) {
        body.hostMode = request.hostMode;
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

      if (title) {
        body.title = title;
      }
      if (status) {
        body.status = status;
      }
      if (request.hostMode) {
        body.hostMode = request.hostMode;
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
    async editCodingSessionMessage(
      codingSessionId: string,
      messageId: string,
      request: BirdCoderEditCodingSessionMessageRequest,
    ): Promise<BirdCoderEditCodingSessionMessageResult> {
      const body = {
        content: normalizeRequiredIdentifier(request.content, 'content'),
      };
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderEditCodingSessionMessageResult>,
        'core.editCodingSessionMessage'
      >('core.editCodingSessionMessage', {
        pathParams: {
          id: normalizeRequiredIdentifier(codingSessionId, 'codingSessionId'),
          messageId: normalizeRequiredIdentifier(messageId, 'messageId'),
        },
        body,
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
      const engineId = normalizeOptionalText(request.engineId);
      const modelId = normalizeOptionalText(request.modelId);
      const ideContext = request.ideContext;

      if (runtimeId) {
        body.runtimeId = runtimeId;
      }
      if (engineId) {
        body.engineId = engineId;
      }
      if (modelId) {
        body.modelId = modelId;
      }
      if (ideContext) {
        body.ideContext = {
          ...(ideContext.workspaceId ? { workspaceId: ideContext.workspaceId } : {}),
          ...(ideContext.projectId ? { projectId: ideContext.projectId } : {}),
          ...(ideContext.sessionId ? { sessionId: ideContext.sessionId } : {}),
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
      if (typeof request.stream === 'boolean') {
        body.stream = request.stream;
      }
      if (request.options) {
        body.options = buildBirdCoderCodingSessionTurnOptionsBody(request.options);
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
    async submitUserQuestionAnswer(
      questionId: string,
      request: BirdCoderSubmitUserQuestionAnswerRequest,
    ): Promise<BirdCoderUserQuestionAnswerResult> {
      const rejected = request.rejected === true;
      const body: Record<string, unknown> = rejected
        ? { rejected: true }
        : { answer: normalizeRequiredText(request.answer, 'answer') };
      const optionId = normalizeOptionalText(request.optionId);
      const optionLabel = normalizeOptionalText(request.optionLabel);
      if (optionId) {
        body.optionId = optionId;
      }
      if (optionLabel) {
        body.optionLabel = optionLabel;
      }

      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserQuestionAnswerResult>,
        'core.submitUserQuestionAnswer'
      >('core.submitUserQuestionAnswer', {
        pathParams: {
          questionId: normalizeRequiredIdentifier(questionId, 'questionId'),
        },
        body,
      });
      return response.data;
    },
    async syncModelConfig(
      request: BirdCoderSyncCodeEngineModelConfigRequest,
    ): Promise<BirdCoderCodeEngineModelConfigSyncResult> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderCodeEngineModelConfigSyncResult>,
        'core.syncModelConfig'
      >('core.syncModelConfig', {
        body: {
          localConfig: request.localConfig,
        },
      });
      return response.data;
    },
  };
}
