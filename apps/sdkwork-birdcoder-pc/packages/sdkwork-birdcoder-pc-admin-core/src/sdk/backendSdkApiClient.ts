import {
  createBirdcoderBackendSdkClient,
  type BirdCoderCreateIamPolicyRequest,
  type BirdCoderUpdateIamPolicyRequest,
  type BirdcoderBackendSdkClient,
  type IamTeamsListQuery as BackendIamTeamsListQuery,
} from '@sdkwork/birdcoder-backend-sdk';
import type {
  BirdCoderApiTransport,
  BirdCoderDeploymentRecordSummary,
  BirdCoderDeploymentTargetSummary,
  BirdCoderIamAuditEventSummary,
  BirdCoderIamPolicySummary,
  BirdCoderReleaseSummary,
  BirdCoderTeamMemberSummary,
  BirdCoderTeamSummary,
  BirdCoderWorkspaceScopedListRequest,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export interface BirdCoderBackendSdkApiClient {
  createPolicy(input: BirdCoderCreateIamPolicyRequest): Promise<BirdCoderIamPolicySummary>;
  deletePolicy(policyId: string): Promise<void>;
  listAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]>;
  listDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]>;
  listGovernanceDeployments(): Promise<BirdCoderDeploymentRecordSummary[]>;
  listGovernanceTeams(options?: BirdCoderWorkspaceScopedListRequest): Promise<BirdCoderTeamSummary[]>;
  listPolicies(): Promise<BirdCoderIamPolicySummary[]>;
  listReleases(): Promise<BirdCoderReleaseSummary[]>;
  listTeamMembers(teamId: string): Promise<BirdCoderTeamMemberSummary[]>;
  updatePolicy(
    policyId: string,
    input: BirdCoderUpdateIamPolicyRequest,
  ): Promise<BirdCoderIamPolicySummary>;
}

export interface CreateBirdCoderBackendSdkApiClientOptions {
  accessToken?: string;
  authToken?: string;
  transport: BirdCoderApiTransport;
}

const DEFAULT_SDK_LIST_LIMIT = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
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

function readItem<TItem>(payload: unknown): TItem {
  if (!isRecord(payload)) {
    throw new Error('Backend SDK returned an invalid resource response.');
  }
  if (isRecord(payload.item)) {
    return payload.item as TItem;
  }
  if (isRecord(payload.data)) {
    if (isRecord(payload.data.item)) {
      return payload.data.item as TItem;
    }
    return payload.data as TItem;
  }
  return payload as TItem;
}

function withDefaultListLimit<T extends { limit?: number }>(query: T): T {
  return typeof query.limit === 'number' ? query : { ...query, limit: DEFAULT_SDK_LIST_LIMIT };
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
    async createPolicy(input) {
      return readItem(await client.iam.policies.create(input));
    },
    async updatePolicy(policyId, input) {
      return readItem(await client.iam.policies.update({ policyId }, input));
    },
    async deletePolicy(policyId) {
      await client.iam.policies.delete({ policyId });
    },
    async listGovernanceDeployments() {
      return readItems(await client.platform.deploymentGovernance.list());
    },
    async listDeploymentTargets(projectId) {
      return readItems(await client.platform.deploymentGovernance.targets.list({ projectId }));
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
