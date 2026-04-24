import type {
  BirdCoderAppAdminApiClient,
  BirdCoderAppTemplateSummary,
  BirdCoderDeploymentRecordSummary,
  BirdCoderDeploymentTargetSummary,
  BirdCoderProjectCollaboratorSummary,
  BirdCoderProjectDocumentSummary,
  BirdCoderProjectGitOverview,
  BirdCoderProjectPublishResult,
  BirdCoderProjectSummary,
  BirdCoderReleaseSummary,
  BirdCoderSkillInstallationSummary,
  BirdCoderSkillPackageSummary,
  BirdCoderTeamMemberSummary,
  BirdCoderTeamSummary,
  BirdCoderWorkspaceMemberSummary,
  BirdCoderWorkspaceSummary,
  BirdCoderAdminAuditEventSummary,
  BirdCoderAdminPolicySummary,
} from '@sdkwork/birdcoder-types';

function createUnexpectedMethodError(methodName: string): Error {
  return new Error(`Unexpected app admin client method call: ${methodName}`);
}

export function createAppAdminClientContractStub(
  overrides: Partial<BirdCoderAppAdminApiClient> = {},
): BirdCoderAppAdminApiClient {
  const stub: BirdCoderAppAdminApiClient = {
    async commitProjectGitChanges(): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('commitProjectGitChanges');
    },
    async createProjectGitBranch(): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('createProjectGitBranch');
    },
    async createProjectGitWorktree(): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('createProjectGitWorktree');
    },
    async createProject(): Promise<BirdCoderProjectSummary> {
      throw createUnexpectedMethodError('createProject');
    },
    async createWorkspace(): Promise<BirdCoderWorkspaceSummary> {
      throw createUnexpectedMethodError('createWorkspace');
    },
    async deleteProject(): Promise<void> {
      throw createUnexpectedMethodError('deleteProject');
    },
    async deleteWorkspace(): Promise<void> {
      throw createUnexpectedMethodError('deleteWorkspace');
    },
    async getProject(): Promise<BirdCoderProjectSummary> {
      throw createUnexpectedMethodError('getProject');
    },
    async getProjectGitOverview(): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('getProjectGitOverview');
    },
    async installSkillPackage(): Promise<BirdCoderSkillInstallationSummary> {
      throw createUnexpectedMethodError('installSkillPackage');
    },
    async listAdminDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
      return [];
    },
    async listAdminTeams(): Promise<BirdCoderTeamSummary[]> {
      return [];
    },
    async listAppTemplates(): Promise<BirdCoderAppTemplateSummary[]> {
      return [];
    },
    async listAuditEvents(): Promise<BirdCoderAdminAuditEventSummary[]> {
      return [];
    },
    async listDeploymentTargets(): Promise<BirdCoderDeploymentTargetSummary[]> {
      return [];
    },
    async listDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
      return [];
    },
    async listDocuments(): Promise<BirdCoderProjectDocumentSummary[]> {
      return [];
    },
    async listPolicies(): Promise<BirdCoderAdminPolicySummary[]> {
      return [];
    },
    async listProjectCollaborators(): Promise<BirdCoderProjectCollaboratorSummary[]> {
      return [];
    },
    async listProjects(): Promise<BirdCoderProjectSummary[]> {
      return [];
    },
    async listReleases(): Promise<BirdCoderReleaseSummary[]> {
      return [];
    },
    async listSkillPackages(): Promise<BirdCoderSkillPackageSummary[]> {
      return [];
    },
    async listTeamMembers(): Promise<BirdCoderTeamMemberSummary[]> {
      return [];
    },
    async listTeams(): Promise<BirdCoderTeamSummary[]> {
      return [];
    },
    async listWorkspaceMembers(): Promise<BirdCoderWorkspaceMemberSummary[]> {
      return [];
    },
    async listWorkspaces(): Promise<BirdCoderWorkspaceSummary[]> {
      return [];
    },
    async publishProject(): Promise<BirdCoderProjectPublishResult> {
      throw createUnexpectedMethodError('publishProject');
    },
    async pushProjectGitBranch(): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('pushProjectGitBranch');
    },
    async pruneProjectGitWorktrees(): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('pruneProjectGitWorktrees');
    },
    async removeProjectGitWorktree(): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('removeProjectGitWorktree');
    },
    async switchProjectGitBranch(): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('switchProjectGitBranch');
    },
    async upsertProjectCollaborator(): Promise<BirdCoderProjectCollaboratorSummary> {
      throw createUnexpectedMethodError('upsertProjectCollaborator');
    },
    async upsertWorkspaceMember(): Promise<BirdCoderWorkspaceMemberSummary> {
      throw createUnexpectedMethodError('upsertWorkspaceMember');
    },
    async updateProject(): Promise<BirdCoderProjectSummary> {
      throw createUnexpectedMethodError('updateProject');
    },
    async updateWorkspace(): Promise<BirdCoderWorkspaceSummary> {
      throw createUnexpectedMethodError('updateWorkspace');
    },
  };

  return {
    ...stub,
    ...overrides,
  };
}
