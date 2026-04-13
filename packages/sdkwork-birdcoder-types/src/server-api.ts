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
  status: 'active' | 'archived';
}

export interface BirdCoderProjectSummary {
  createdAt: string;
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  rootPath?: string;
  status: 'active' | 'archived';
  updatedAt: string;
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
  status: 'active' | 'archived';
}

export interface BirdCoderTeamMemberSummary {
  id: string;
  teamId: string;
  identityId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'invited' | 'active' | 'suspended' | 'removed';
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

export interface BirdCoderWorkspaceScopedListRequest {
  workspaceId?: string;
}

export interface BirdCoderAppAdminApiClient {
  listAdminDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listAdminTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listAuditEvents(): Promise<BirdCoderAdminAuditEventSummary[]>;
  listDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]>;
  listDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listDocuments(): Promise<BirdCoderProjectDocumentSummary[]>;
  listPolicies(): Promise<BirdCoderAdminPolicySummary[]>;
  listProjects(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderProjectSummary[]>;
  listReleases(): Promise<BirdCoderReleaseSummary[]>;
  listTeamMembers(teamId: string): Promise<BirdCoderTeamMemberSummary[]>;
  listTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listWorkspaces(): Promise<BirdCoderWorkspaceSummary[]>;
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

export interface BirdCoderCoreReadApiClient {
  getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary>;
  getDescriptor(): Promise<BirdCoderCodingServerDescriptor>;
  getEngineCapabilities(engineKey: string): Promise<BirdCoderEngineCapabilityMatrix>;
  getHealth(): Promise<BirdCoderCoreHealthSummary>;
  getOperation(operationId: string): Promise<BirdCoderOperationDescriptor>;
  getRuntime(): Promise<BirdCoderCoreRuntimeSummary>;
  listCodingSessionArtifacts(codingSessionId: string): Promise<BirdCoderCodingSessionArtifact[]>;
  listCodingSessionCheckpoints(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionCheckpoint[]>;
  listCodingSessionEvents(codingSessionId: string): Promise<BirdCoderCodingSessionEvent[]>;
  listEngines(): Promise<BirdCoderEngineDescriptor[]>;
  listModels(): Promise<BirdCoderModelCatalogEntry[]>;
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
  'core.listEngines',
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
  hostMode: BirdCoderHostMode;
  moduleId: 'coding-server';
  openApiPath: string;
  surfaces: readonly BirdCoderApiSurface[];
}

export interface BirdCoderCoreApiContract {
  descriptor: BirdCoderApiRouteDefinition;
  engineCapabilities: BirdCoderApiRouteDefinition;
  engines: BirdCoderApiRouteDefinition;
  events: BirdCoderApiRouteDefinition;
  health: BirdCoderApiRouteDefinition;
  operations: BirdCoderApiRouteDefinition;
  approvals: BirdCoderApiRouteDefinition;
  runtime: BirdCoderApiRouteDefinition;
  sessions: BirdCoderApiRouteDefinition;
  sessionArtifacts: BirdCoderApiRouteDefinition;
  sessionCheckpoints: BirdCoderApiRouteDefinition;
  sessionTurns: BirdCoderApiRouteDefinition;
}

export interface BirdCoderAppApiContract {
  deployments: BirdCoderApiRouteDefinition;
  documents: BirdCoderApiRouteDefinition;
  projects: BirdCoderApiRouteDefinition;
  teams: BirdCoderApiRouteDefinition;
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
  deployments: BirdCoderDeploymentRecordSummary[];
  documents: BirdCoderProjectDocumentSummary[];
  projects: BirdCoderProjectSummary[];
  teams: BirdCoderTeamSummary[];
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

export function createBirdCoderGeneratedAppAdminApiClient({
  transport,
}: CreateBirdCoderGeneratedAppAdminApiClientOptions): BirdCoderAppAdminApiClient {
  const client = createBirdCoderFinalizedCodingServerClient(transport);

  return {
    async listWorkspaces(): Promise<BirdCoderWorkspaceSummary[]> {
      const response = await client.request<
        BirdCoderApiListEnvelope<BirdCoderWorkspaceSummary>,
        'app.listWorkspaces'
      >('app.listWorkspaces');
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
          workspaceId: readWorkspaceScopedQuery(options),
        },
      });
      return response.items;
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
          workspaceId: readWorkspaceScopedQuery(options),
        },
      });
      return response.items;
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
