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
import { createBirdCoderFinalizedCodingServerClient } from './generated/coding-server-client.ts';

export const BIRDCODER_API_SURFACES = ['app', 'backend'] as const;

export type BirdCoderApiSurface = (typeof BIRDCODER_API_SURFACES)[number];

export const BIRDCODER_CODING_SERVER_API_VERSION = 'v1';

export const BIRDCODER_CODING_SERVER_API_PREFIXES = {
  app: '/app/v3/api',
  backend: '/backend/v3/api',
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
  operationId?: string;
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
  appVersion?: string;
  code?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: BirdCoderUserCenterDeviceType;
  email?: string;
  loginMethod?: BirdCoderUserCenterLoginMethod;
  password?: string;
  phone?: string;
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

export interface CreateBirdCoderGeneratedUserCenterApiClientOptions {
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

export interface BirdCoderCodingServerDescriptor {
  apiVersion: string;
  gateway: BirdCoderApiGatewaySummary;
  hostMode: BirdCoderHostMode;
  moduleId: 'coding-server';
  openApiPath: string;
  surfaces: readonly BirdCoderApiSurface[];
}

export interface BirdCoderAppRuntimeApiContract {
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

export interface BirdCoderAppRuntimeApiModel {
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

export function createBirdCoderGeneratedUserCenterApiClient({
  transport,
}: CreateBirdCoderGeneratedUserCenterApiClientOptions): BirdCoderUserCenterApiClient {
  const client = createBirdCoderFinalizedCodingServerClient(transport);

  return {
    async checkLoginQrCodeStatus(
      qrKey: string,
    ): Promise<BirdCoderUserCenterLoginQrStatusSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterLoginQrStatusSummary>,
        'qrLoginCodes.retrieve'
      >('qrLoginCodes.retrieve', {
        pathParams: {
          qrKey: normalizeRequiredIdentifier(qrKey, 'qrKey'),
        },
      });
      return response.data;
    },
    async getConfig(): Promise<BirdCoderUserCenterMetadataSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMetadataSummary>,
        'config.retrieve'
      >('config.retrieve');
      return response.data;
    },
    async generateLoginQrCode(): Promise<BirdCoderUserCenterLoginQrCodeSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterLoginQrCodeSummary>,
        'qrLoginCodes.create'
      >('qrLoginCodes.create');
      return response.data;
    },
    async getOAuthAuthorizationUrl(
      request: BirdCoderUserCenterOAuthAuthorizationRequest,
    ): Promise<string> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterOAuthAuthorizationSummary>,
        'oauthAuthorizationUrls.retrieve'
      >('oauthAuthorizationUrls.retrieve', {
        query: {
          provider: normalizeRequiredIdentifier(request.provider, 'provider'),
          redirectUri: normalizeRequiredIdentifier(request.redirectUri, 'redirectUri'),
          scope: normalizeOptionalText(request.scope),
          state: normalizeOptionalText(request.state),
        },
      });
      return normalizeRequiredIdentifier(response.data.authUrl, 'authUrl');
    },
    async getCurrentSession(): Promise<BirdCoderUserCenterSessionSummary | null> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary | null>,
        'sessions.current.retrieve'
      >('sessions.current.retrieve');
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
        'sessions.create'
      >('sessions.create', {
        body: {
          account,
          email: normalizeOptionalText(request.email) ?? account,
          loginMethod: 'password',
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
        'sessions.create'
      >('sessions.create', {
        body: {
          appVersion: normalizeOptionalText(request.appVersion),
          code: normalizeRequiredIdentifier(request.code, 'code'),
          deviceId: normalizeOptionalText(request.deviceId),
          deviceName: normalizeOptionalText(request.deviceName),
          deviceType: normalizeOptionalText(request.deviceType),
          email: normalizeRequiredIdentifier(request.email, 'email'),
          loginMethod: 'emailCode',
        },
      });
      return response.data;
    },
    async loginWithOAuth(
      request: BirdCoderUserCenterOAuthLoginRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'oauthSessions.create'
      >('oauthSessions.create', {
        body: {
          code: normalizeRequiredIdentifier(request.code, 'code'),
          deviceId: normalizeOptionalText(request.deviceId),
          deviceType: normalizeOptionalText(request.deviceType),
          provider: normalizeRequiredIdentifier(request.provider, 'provider'),
          state: normalizeOptionalText(request.state),
        },
      });
      return response.data;
    },
    async loginWithPhoneCode(
      request: BirdCoderUserCenterPhoneCodeLoginRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'sessions.create'
      >('sessions.create', {
        body: {
          appVersion: normalizeOptionalText(request.appVersion),
          code: normalizeRequiredIdentifier(request.code, 'code'),
          deviceId: normalizeOptionalText(request.deviceId),
          deviceName: normalizeOptionalText(request.deviceName),
          deviceType: normalizeOptionalText(request.deviceType),
          loginMethod: 'phoneCode',
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
        'registrations.create'
      >('registrations.create', {
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
        'verificationCodes.create'
      >('verificationCodes.create', {
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
        'passwordResetRequests.create'
      >('passwordResetRequests.create', {
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
        'passwordResets.create'
      >('passwordResets.create', {
        body: {
          account: normalizeRequiredIdentifier(request.account, 'account'),
          code: normalizeRequiredIdentifier(request.code, 'code'),
          confirmPassword: normalizeOptionalText(request.confirmPassword),
          newPassword: normalizeRequiredIdentifier(request.newPassword, 'newPassword'),
        },
      });
    },
    async logout(): Promise<void> {
      await client.request<BirdCoderApiEnvelope<{ success: boolean }>, 'sessions.current.delete'>('sessions.current.delete');
    },
    async exchangeSession(
      request: BirdCoderUserCenterSessionExchangeRequest,
    ): Promise<BirdCoderUserCenterSessionSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterSessionSummary>,
        'sessionExchanges.create'
      >('sessionExchanges.create', {
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
        'users.current.retrieve'
      >('users.current.retrieve');
      return response.data;
    },
    async updateCurrentProfile(
      request: BirdCoderUpdateCurrentUserProfileRequest,
    ): Promise<BirdCoderUserCenterProfileSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterProfileSummary>,
        'users.current.update'
      >('users.current.update', {
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
        'vip.info.retrieve'
      >('vip.info.retrieve');
      return response.data;
    },
    async updateCurrentMembership(
      request: BirdCoderUpdateCurrentUserMembershipRequest,
    ): Promise<BirdCoderUserCenterMembershipSummary> {
      const response = await client.request<
        BirdCoderApiEnvelope<BirdCoderUserCenterMembershipSummary>,
        'vip.info.update'
      >('vip.info.update', {
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
