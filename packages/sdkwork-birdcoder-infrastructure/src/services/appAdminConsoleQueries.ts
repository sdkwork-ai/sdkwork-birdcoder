import type {
  BirdCoderConsoleRepositories,
  BirdCoderRepresentativeAuditRecord,
  BirdCoderRepresentativeDeploymentRecord,
  BirdCoderRepresentativeDeploymentTargetRecord,
  BirdCoderRepresentativePolicyRecord,
  BirdCoderRepresentativeProjectDocumentRecord,
  BirdCoderRepresentativeProjectRecord,
  BirdCoderRepresentativeReleaseRecord,
  BirdCoderRepresentativeTeamMemberRecord,
  BirdCoderRepresentativeTeamRecord,
  BirdCoderWorkspaceRecord,
} from '../storage/appConsoleRepository.ts';
import { ensureBirdCoderBootstrapConsoleCatalog } from '../storage/bootstrapConsoleCatalog.ts';

export interface BirdCoderAppAdminConsoleQueries {
  listAuditEvents(): Promise<BirdCoderRepresentativeAuditRecord[]>;
  listDeployments(): Promise<BirdCoderRepresentativeDeploymentRecord[]>;
  listDeploymentTargets(options?: {
    projectId?: string;
  }): Promise<BirdCoderRepresentativeDeploymentTargetRecord[]>;
  listDocuments(): Promise<BirdCoderRepresentativeProjectDocumentRecord[]>;
  listPolicies(): Promise<BirdCoderRepresentativePolicyRecord[]>;
  listProjects(options?: {
    workspaceId?: string;
  }): Promise<BirdCoderRepresentativeProjectRecord[]>;
  listReleases(): Promise<BirdCoderRepresentativeReleaseRecord[]>;
  listTeamMembers(options?: {
    teamId?: string;
  }): Promise<BirdCoderRepresentativeTeamMemberRecord[]>;
  listTeams(options?: {
    workspaceId?: string;
  }): Promise<BirdCoderRepresentativeTeamRecord[]>;
  listWorkspaces(): Promise<BirdCoderWorkspaceRecord[]>;
}

export interface CreateBirdCoderAppAdminConsoleQueriesOptions {
  repositories: BirdCoderConsoleRepositories;
}

function filterByWorkspaceId<
  TRecord extends {
    workspaceId: string;
  },
>(records: readonly TRecord[], workspaceId: string | undefined): TRecord[] {
  const normalizedWorkspaceId = workspaceId?.trim();
  if (!normalizedWorkspaceId) {
    return [...records];
  }

  return records.filter((record) => record.workspaceId === normalizedWorkspaceId);
}

function filterByTeamId<
  TRecord extends {
    teamId: string;
  },
>(records: readonly TRecord[], teamId: string | undefined): TRecord[] {
  const normalizedTeamId = teamId?.trim();
  if (!normalizedTeamId) {
    return [...records];
  }

  return records.filter((record) => record.teamId === normalizedTeamId);
}

function filterByProjectId<
  TRecord extends {
    projectId: string;
  },
>(records: readonly TRecord[], projectId: string | undefined): TRecord[] {
  const normalizedProjectId = projectId?.trim();
  if (!normalizedProjectId) {
    return [...records];
  }

  return records.filter((record) => record.projectId === normalizedProjectId);
}

export function createBirdCoderAppAdminConsoleQueries({
  repositories,
}: CreateBirdCoderAppAdminConsoleQueriesOptions): BirdCoderAppAdminConsoleQueries {
  return {
    async listWorkspaces(): Promise<BirdCoderWorkspaceRecord[]> {
      return (await ensureBirdCoderBootstrapConsoleCatalog({ repositories })).workspaces;
    },
    async listAuditEvents(): Promise<BirdCoderRepresentativeAuditRecord[]> {
      return repositories.audits.list();
    },
    async listDeployments(): Promise<BirdCoderRepresentativeDeploymentRecord[]> {
      return repositories.deployments.list();
    },
    async listDeploymentTargets(
      options = {},
    ): Promise<BirdCoderRepresentativeDeploymentTargetRecord[]> {
      return filterByProjectId(await repositories.targets.list(), options.projectId);
    },
    async listDocuments(): Promise<BirdCoderRepresentativeProjectDocumentRecord[]> {
      return repositories.documents.list();
    },
    async listPolicies(): Promise<BirdCoderRepresentativePolicyRecord[]> {
      return repositories.policies.list();
    },
    async listProjects(options = {}): Promise<BirdCoderRepresentativeProjectRecord[]> {
      return filterByWorkspaceId(
        (await ensureBirdCoderBootstrapConsoleCatalog({ repositories })).projects,
        options.workspaceId,
      );
    },
    async listTeamMembers(options = {}): Promise<BirdCoderRepresentativeTeamMemberRecord[]> {
      return filterByTeamId(await repositories.members.list(), options.teamId);
    },
    async listTeams(options = {}): Promise<BirdCoderRepresentativeTeamRecord[]> {
      return filterByWorkspaceId(await repositories.teams.list(), options.workspaceId);
    },
    async listReleases(): Promise<BirdCoderRepresentativeReleaseRecord[]> {
      return repositories.releases.list();
    },
  };
}
