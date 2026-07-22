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
import type { BirdCoderChatMessageReasoningItem } from './chat-message-reasoning.ts';
import type { BirdCoderChatMessageResource } from './chat-message-resources.ts';

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

export interface BirdCoderPageInfo {
  mode: 'offset' | 'cursor';
  page?: number;
  pageSize?: number;
  totalItems?: string;
  totalPages?: number;
  nextCursor?: string;
  hasMore?: boolean;
}

export interface BirdCoderSdkWorkResourceData<T> {
  item: T;
}

export interface BirdCoderSdkWorkPageData<T> {
  items: T[];
  pageInfo: BirdCoderPageInfo;
}

/** Canonical HTTP success envelope (`API_SPEC.md` §15.1). */
export interface BirdCoderSdkWorkApiResponse<TData> {
  code: 0;
  data: TData;
  traceId: string;
}

export type BirdCoderApiEnvelope<T> = BirdCoderSdkWorkApiResponse<BirdCoderSdkWorkResourceData<T>>;

export type BirdCoderApiListEnvelope<T> = BirdCoderSdkWorkApiResponse<BirdCoderSdkWorkPageData<T>>;

export interface BirdCoderApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  version: string;
}

export interface BirdCoderApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: number;
  traceId: string;
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
  'coding-session.turn.completed',
  'coding-session.approval.decided',
  'coding-session.question.answered',
] as const;

export type BirdCoderWorkspaceRealtimeEventKind =
  (typeof BIRDCODER_WORKSPACE_REALTIME_EVENT_KINDS)[number];

export interface BirdCoderWorkspaceRealtimeEvent {
  eventId: string;
  eventKind: BirdCoderWorkspaceRealtimeEventKind;
  workspaceId: string;
  projectId?: string;
  projectName?: string;
  codingSessionId?: string;
  codingSessionTitle?: string;
  codingSessionStatus?: BirdCoderCodingSessionSummary['status'];
  codingSessionHostMode?: BirdCoderHostMode;
  codingSessionEngineId?: BirdCoderCodingSessionSummary['engineId'];
  codingSessionModelId?: string;
  /** Opaque server-issued binding; never a local path or filesystem handle. */
  codingSessionRuntimeLocationId?: string;
  codingSessionRuntimeStatus?: BirdCoderCodingSessionRuntimeStatus;
  nativeSessionId?: string;
  turnId?: string;
  codingSessionEventKind?: BirdCoderCodingSessionEvent['kind'];
  codingSessionEventPayload?: BirdCoderCodingSessionEvent['payload'];
  codingSessionEventSequence?: BirdCoderCodingSessionEvent['sequence'];
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
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface BirdCoderGitBranchSummary {
  isCurrent: boolean;
  isRemote: boolean;
  name: string;
}

export interface BirdCoderGitWorktreeSummary {
  branch?: string;
  head?: string;
  isCurrent: boolean;
  prunableReason?: string;
  worktreeKey?: string;
}

export interface BirdCoderProjectGitOverview {
  branches: BirdCoderGitBranchSummary[];
  currentBranch?: string;
  currentRevision?: string;
  detachedHead: boolean;
  status: BirdCoderGitOverviewStatus;
  statusCounts: BirdCoderGitStatusCounts;
  worktrees: BirdCoderGitWorktreeSummary[];
}

export interface BirdCoderProjectGitDiff {
  patch: string;
  truncated: boolean;
}

export interface BirdCoderCreateProjectGitBranchRequest {
  branchName: string;
}

export interface BirdCoderSwitchProjectGitBranchRequest {
  branchName: string;
}

export interface BirdCoderCommitProjectGitChangesRequest {
  includeUnstaged?: boolean;
  message: string;
}

export interface BirdCoderPushProjectGitBranchRequest {
  branchName?: string;
  remoteName?: string;
}

export interface BirdCoderCreateProjectGitWorktreeRequest {
  branchName: string;
}

export interface BirdCoderRemoveProjectGitWorktreeRequest {
  force?: boolean;
  worktreeKey: string;
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
  workspaceId: BirdCoderCanonicalEntityId;
}

export interface BirdCoderUpdateProjectRequest {
  description?: string;
  name?: string;
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
  userId: string;
  role?: BirdCoderCollaborationRole;
  status?: Exclude<BirdCoderCollaborationStatus, 'removed'>;
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

export interface BirdCoderIamAuditEventSummary {
  id: string;
  tenantId: string;
  organizationId?: string;
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  traceId?: string;
  appId?: string;
  environment?: string;
  shardingKey?: string;
  detail: Record<string, unknown>;
  createdAt?: string;
}

export interface BirdCoderIamPolicySummary {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  policy: Record<string, unknown>;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export const BIRDCODER_IAM_LOGIN_METHODS = [
  'emailCode',
  'password',
  'phoneCode',
  'sessionBridge',
] as const;

export type BirdCoderIamLoginMethod =
  (typeof BIRDCODER_IAM_LOGIN_METHODS)[number];

export const BIRDCODER_IAM_REGISTER_METHODS = [
  'email',
  'phone',
] as const;

export type BirdCoderIamRegisterMethod =
  (typeof BIRDCODER_IAM_REGISTER_METHODS)[number];

export const BIRDCODER_IAM_RECOVERY_METHODS = [
  'email',
  'phone',
] as const;

export type BirdCoderIamRecoveryMethod =
  (typeof BIRDCODER_IAM_RECOVERY_METHODS)[number];

export const BIRDCODER_IAM_VERIFY_TYPES = ['EMAIL', 'PHONE'] as const;

export type BirdCoderIamVerifyType =
  (typeof BIRDCODER_IAM_VERIFY_TYPES)[number];

export const BIRDCODER_IAM_VERIFY_SCENES = [
  'LOGIN',
  'REGISTER',
  'RESET_PASSWORD',
] as const;

export type BirdCoderIamVerifyScene =
  (typeof BIRDCODER_IAM_VERIFY_SCENES)[number];

export const BIRDCODER_IAM_PASSWORD_RESET_CHANNELS = [
  'EMAIL',
  'SMS',
] as const;

export type BirdCoderIamPasswordResetChannel =
  (typeof BIRDCODER_IAM_PASSWORD_RESET_CHANNELS)[number];

export const BIRDCODER_IAM_DEVICE_TYPES = [
  'android',
  'desktop',
  'ios',
  'web',
] as const;

export type BirdCoderIamDeviceType =
  (typeof BIRDCODER_IAM_DEVICE_TYPES)[number];

export const BIRDCODER_IAM_DEVICE_AUTHORIZATION_STATUSES = [
  'pending',
  'scanned',
  'confirmed',
  'expired',
] as const;

export type BirdCoderIamDeviceAuthorizationStatus =
  (typeof BIRDCODER_IAM_DEVICE_AUTHORIZATION_STATUSES)[number];

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

export interface BirdCoderIamVerificationPolicySummary {
  emailCodeLoginEnabled: boolean;
  emailRegistrationVerificationRequired: boolean;
  phoneCodeLoginEnabled: boolean;
  phoneRegistrationVerificationRequired: boolean;
}

export interface BirdCoderIamRuntimeSettingsSummary {
  leftRailMode: 'auto' | 'highlights-only' | 'qr-only';
  loginMethods: BirdCoderIamLoginMethod[];
  oauthLoginEnabled: boolean;
  oauthProviders: string[];
  qrLoginEnabled: boolean;
  qrLoginType: 'web' | 'official' | 'mini';
  recoveryMethods: BirdCoderIamRecoveryMethod[];
  registerMethods: BirdCoderIamRegisterMethod[];
  verificationPolicy: BirdCoderIamVerificationPolicySummary;
}

export interface BirdCoderIamSessionSummary {
  accessToken: string;
  authToken: string;
  context?: Record<string, unknown>;
  expiresAt?: string;
  refreshToken?: string | null;
  sessionId?: string;
  user?: BirdCoderAuthenticatedUserSummary;
}

export interface BirdCoderIamCreateSessionRequest {
  account?: string;
  appVersion?: string;
  code?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: BirdCoderIamDeviceType;
  email?: string;
  grantType?: 'password' | 'email_code' | 'phone_code' | 'session_bridge';
  loginMethod?: BirdCoderIamLoginMethod;
  password?: string;
  phone?: string;
  username?: string;
}

export interface BirdCoderIamUpdateCurrentSessionRequest {
  deviceId?: string;
  deviceName?: string;
  trusted?: boolean;
}

export interface BirdCoderIamRefreshSessionRequest {
  refreshToken: string;
}

export interface BirdCoderIamRegistrationCreateRequest {
  channel?: BirdCoderIamVerifyType;
  confirmPassword?: string;
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  username?: string;
  verificationCode?: string;
}

export interface BirdCoderIamVerificationCodeCreateRequest {
  scene: BirdCoderIamVerifyScene;
  target: string;
  verifyType: BirdCoderIamVerifyType;
}

export interface BirdCoderIamVerificationCodeVerifyRequest {
  code: string;
  scene: BirdCoderIamVerifyScene;
  target: string;
  verifyType: BirdCoderIamVerifyType;
}

export interface BirdCoderIamPasswordResetRequestCreateRequest {
  account: string;
  channel: BirdCoderIamPasswordResetChannel;
}

export interface BirdCoderIamPasswordResetCreateRequest {
  account: string;
  code: string;
  confirmPassword?: string;
  newPassword: string;
}

export interface BirdCoderIamOAuthAuthorizationCreateRequest {
  provider: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export interface BirdCoderIamOAuthSessionCreateRequest {
  code: string;
  deviceId?: string;
  deviceType?: BirdCoderIamDeviceType;
  provider: string;
  state?: string;
}

export interface BirdCoderIamOAuthAuthorizationSummary {
  authUrl: string;
}

export interface BirdCoderIamDeviceAuthorizationCreateRequest {
  purpose: 'login' | 'register';
  redirectUri?: string;
}

export interface BirdCoderIamDeviceAuthorizationSummary {
  deviceAuthorizationId: string;
  expiresAt?: string;
  qrContent?: string;
  qrUrl?: string;
  status: BirdCoderIamDeviceAuthorizationStatus;
}

export interface BirdCoderIamDeviceAuthorizationScanRequest {
  scanSource?: string;
}

export interface BirdCoderIamDeviceAuthorizationPasswordCompletionRequest {
  password: string;
  username: string;
}

export interface BirdCoderIamUserProfileSummary {
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

export interface BirdCoderWorkspaceScopedListRequest {
  userId?: string;
  workspaceId?: string;
  limit?: number;
  offset?: number;
}

export type BirdCoderProjectListRequest = BirdCoderWorkspaceScopedListRequest;

export interface BirdCoderCoreHealthSummary {
  status: string;
}

export interface BirdCoderCoreRuntimeSummary {
  host: string;
  port: number;
  configFileName: string;
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

export interface BirdCoderListCodingSessionsRequest {
  engineId?: BirdCoderCodeEngineKey;
  limit?: number;
  offset?: number;
  projectId?: string;
  runtimeLocationId?: string;
  workspaceId?: string;
}

export interface BirdCoderCreateCodingSessionRequest {
  workspaceId: string;
  projectId: string;
  runtimeLocationId: string;
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
  engineCapabilities: BirdCoderApiRouteDefinition;
  engines: BirdCoderApiRouteDefinition;
  editCodingSessionMessage: BirdCoderApiRouteDefinition;
  events: BirdCoderApiRouteDefinition;
  forkCodingSession: BirdCoderApiRouteDefinition;
  health: BirdCoderApiRouteDefinition;
  modelConfig: BirdCoderApiRouteDefinition;
  models: BirdCoderApiRouteDefinition;
  nativeSessionProviders: BirdCoderApiRouteDefinition;
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

export type BirdCoderAppApiContract = Record<string, BirdCoderApiRouteDefinition>;

export type BirdCoderBackendApiContract = Record<string, BirdCoderApiRouteDefinition>;

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
  currentIamSession?: BirdCoderIamSessionSummary | null;
  currentProfile?: BirdCoderIamUserProfileSummary;
  iamRuntimeSettings?: BirdCoderIamRuntimeSettingsSummary;
  deployments: BirdCoderDeploymentRecordSummary[];
  documents: BirdCoderProjectDocumentSummary[];
  projectCollaborators: BirdCoderProjectCollaboratorSummary[];
  projectGitOverview?: BirdCoderProjectGitOverview;
  projects: BirdCoderProjectSummary[];
  teams: BirdCoderTeamSummary[];
  workspaceMembers: BirdCoderWorkspaceMemberSummary[];
  workspaceProjects: Record<string, BirdCoderProjectSummary[]>;
  workspaces: BirdCoderWorkspaceSummary[];
}

export interface BirdCoderBackendApiModel {
  audits: BirdCoderIamAuditEventSummary[];
  deploymentTargets: BirdCoderDeploymentTargetSummary[];
  members: BirdCoderTeamMemberSummary[];
  policies: BirdCoderIamPolicySummary[];
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
