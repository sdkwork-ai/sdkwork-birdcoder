import type {
  BirdCoderApiRouteCatalogEntry,
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
  BirdCoderCreateCodingSessionRequest,
  BirdCoderCreateCodingSessionTurnRequest,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
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
  BirdCoderIamAuditEventSummary,
  BirdCoderIamPolicySummary,
  BirdCoderInstallSkillPackageRequest,
  BirdCoderListCodingSessionsRequest,
  BirdCoderListNativeSessionsRequest,
  BirdCoderModelCatalogEntry,
  BirdCoderNativeSessionDetail,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderNativeSessionSummary,
  BirdCoderOperationDescriptor,
  BirdCoderProjectCollaboratorSummary,
  BirdCoderProjectDocumentSummary,
  BirdCoderProjectGitOverview,
  BirdCoderProjectPublishResult,
  BirdCoderProjectSummary,
  BirdCoderPublishProjectRequest,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderReleaseSummary,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSkillInstallationSummary,
  BirdCoderSkillPackageSummary,
  BirdCoderSubmitApprovalDecisionRequest,
  BirdCoderSubmitUserQuestionAnswerRequest,
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
} from '@sdkwork/birdcoder-types';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
  BirdCoderProjectListRequest,
  BirdCoderWorkspaceScopedListRequest,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

function createUnexpectedMethodError(methodName: string): Error {
  return new Error(`Unexpected split SDK client method call: ${methodName}`);
}

export function createAppSdkClientContractStub(
  overrides: Partial<BirdCoderAppSdkApiClient> = {},
): BirdCoderAppSdkApiClient {
  const stub: BirdCoderAppSdkApiClient = {
    async createCodingSession(
      _request: BirdCoderCreateCodingSessionRequest,
    ): Promise<BirdCoderCodingSessionSummary> {
      throw createUnexpectedMethodError('createCodingSession');
    },
    async commitProjectGitChanges(
      _projectId: string,
      _request: BirdCoderCommitProjectGitChangesRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('commitProjectGitChanges');
    },
    async createCodingSessionTurn(
      _codingSessionId: string,
      _request: BirdCoderCreateCodingSessionTurnRequest,
    ): Promise<BirdCoderCodingSessionTurn> {
      throw createUnexpectedMethodError('createCodingSessionTurn');
    },
    async createProject(
      _request: BirdCoderCreateProjectRequest,
    ): Promise<BirdCoderProjectSummary> {
      throw createUnexpectedMethodError('createProject');
    },
    async createProjectRuntimeLocation(
      _projectId: string,
      _request: Parameters<BirdCoderAppSdkApiClient['createProjectRuntimeLocation']>[1],
    ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['createProjectRuntimeLocation']>>> {
      throw createUnexpectedMethodError('createProjectRuntimeLocation');
    },
    async createProjectGitBranch(
      _projectId: string,
      _request: BirdCoderCreateProjectGitBranchRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('createProjectGitBranch');
    },
    async createProjectGitWorktree(
      _projectId: string,
      _request: BirdCoderCreateProjectGitWorktreeRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('createProjectGitWorktree');
    },
    async createWorkspace(
      _request: BirdCoderCreateWorkspaceRequest,
    ): Promise<BirdCoderWorkspaceSummary> {
      throw createUnexpectedMethodError('createWorkspace');
    },
    async deleteProject(_projectId: string): Promise<void> {
      throw createUnexpectedMethodError('deleteProject');
    },
    async deleteWorkspace(_workspaceId: string): Promise<void> {
      throw createUnexpectedMethodError('deleteWorkspace');
    },
    async deleteCodingSession(
      _codingSessionId: string,
    ): Promise<BirdCoderDeleteCodingSessionResult> {
      throw createUnexpectedMethodError('deleteCodingSession');
    },
    async deleteCodingSessionMessage(
      _codingSessionId: string,
      _messageId: string,
    ): Promise<BirdCoderDeleteCodingSessionMessageResult> {
      throw createUnexpectedMethodError('deleteCodingSessionMessage');
    },
    async editCodingSessionMessage(
      _codingSessionId: string,
      _messageId: string,
      _request: BirdCoderEditCodingSessionMessageRequest,
    ): Promise<BirdCoderEditCodingSessionMessageResult> {
      throw createUnexpectedMethodError('editCodingSessionMessage');
    },
    async forkCodingSession(
      _codingSessionId: string,
      _request?: BirdCoderForkCodingSessionRequest,
    ): Promise<BirdCoderCodingSessionSummary> {
      throw createUnexpectedMethodError('forkCodingSession');
    },
    async getCodingSession(_codingSessionId: string): Promise<BirdCoderCodingSessionSummary> {
      throw createUnexpectedMethodError('getCodingSession');
    },
    async getDescriptor(): Promise<BirdCoderCodingServerDescriptor> {
      throw createUnexpectedMethodError('getDescriptor');
    },
    async getEngineCapabilities(
      _engineKey: string,
    ): Promise<BirdCoderEngineCapabilityMatrix> {
      throw createUnexpectedMethodError('getEngineCapabilities');
    },
    async getHealth(): Promise<BirdCoderCoreHealthSummary> {
      throw createUnexpectedMethodError('getHealth');
    },
    async getModelConfig(): Promise<BirdCoderCodeEngineModelConfig> {
      throw createUnexpectedMethodError('getModelConfig');
    },
    async getNativeSession(
      _codingSessionId: string,
      _request: BirdCoderGetNativeSessionRequest,
    ): Promise<BirdCoderNativeSessionDetail> {
      throw createUnexpectedMethodError('getNativeSession');
    },
    async getOperation(_operationId: string): Promise<BirdCoderOperationDescriptor> {
      throw createUnexpectedMethodError('getOperation');
    },
    async getProject(_projectId: string): Promise<BirdCoderProjectSummary> {
      throw createUnexpectedMethodError('getProject');
    },
    async getProjectGitOverview(_projectId: string): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('getProjectGitOverview');
    },
    async getProjectRuntimeLocation(
      _projectId: string,
      _runtimeLocationId: string,
    ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['getProjectRuntimeLocation']>>> {
      throw createUnexpectedMethodError('getProjectRuntimeLocation');
    },
    async getRuntime(): Promise<BirdCoderCoreRuntimeSummary> {
      throw createUnexpectedMethodError('getRuntime');
    },
    async installSkillPackage(
      _packageId: string,
      _request: BirdCoderInstallSkillPackageRequest,
    ): Promise<BirdCoderSkillInstallationSummary> {
      throw createUnexpectedMethodError('installSkillPackage');
    },
    async listAppTemplates(): Promise<BirdCoderAppTemplateSummary[]> {
      return [];
    },
    async listCodingSessionArtifacts(
      _codingSessionId: string,
    ): Promise<BirdCoderCodingSessionArtifact[]> {
      return [];
    },
    async listCodingSessionCheckpoints(
      _codingSessionId: string,
    ): Promise<BirdCoderCodingSessionCheckpoint[]> {
      return [];
    },
    async listCodingSessionEvents(
      _codingSessionId: string,
    ): Promise<BirdCoderCodingSessionEvent[]> {
      return [];
    },
    async listCodingSessions(
      _request?: BirdCoderListCodingSessionsRequest,
    ): Promise<BirdCoderCodingSessionSummary[]> {
      return [];
    },
    async listDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
      return [];
    },
    async listDocuments(): Promise<BirdCoderProjectDocumentSummary[]> {
      return [];
    },
    async listEngines(): Promise<BirdCoderEngineDescriptor[]> {
      return [];
    },
    async listModels(): Promise<BirdCoderModelCatalogEntry[]> {
      return [];
    },
    async listNativeSessionProviders(): Promise<BirdCoderNativeSessionProviderSummary[]> {
      return [];
    },
    async listNativeSessions(
      _request: BirdCoderListNativeSessionsRequest,
    ): Promise<BirdCoderNativeSessionSummary[]> {
      return [];
    },
    async listProjectCollaborators(
      _projectId: string,
    ): Promise<BirdCoderProjectCollaboratorSummary[]> {
      return [];
    },
    async listProjects(
      _options?: BirdCoderProjectListRequest,
    ): Promise<BirdCoderProjectSummary[]> {
      return [];
    },
    async listRoutes(): Promise<BirdCoderApiRouteCatalogEntry[]> {
      return [];
    },
    async listSkillPackages(
      _options?: BirdCoderWorkspaceScopedListRequest,
    ): Promise<BirdCoderSkillPackageSummary[]> {
      return [];
    },
    async listTeams(
      _options?: BirdCoderWorkspaceScopedListRequest,
    ): Promise<BirdCoderTeamSummary[]> {
      return [];
    },
    async listWorkspaceMembers(
      _workspaceId: string,
    ): Promise<BirdCoderWorkspaceMemberSummary[]> {
      return [];
    },
    async listWorkspaces(
      _options?: BirdCoderWorkspaceScopedListRequest,
    ): Promise<BirdCoderWorkspaceSummary[]> {
      return [];
    },
    async publishProject(
      _projectId: string,
      _request: BirdCoderPublishProjectRequest,
    ): Promise<BirdCoderProjectPublishResult> {
      throw createUnexpectedMethodError('publishProject');
    },
    async pruneProjectGitWorktrees(
      _projectId: string,
    ): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('pruneProjectGitWorktrees');
    },
    async pushProjectGitBranch(
      _projectId: string,
      _request: BirdCoderPushProjectGitBranchRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('pushProjectGitBranch');
    },
    async removeProjectGitWorktree(
      _projectId: string,
      _request: BirdCoderRemoveProjectGitWorktreeRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('removeProjectGitWorktree');
    },
    async rebindProjectRuntimeLocation(
      _projectId: string,
      _runtimeLocationId: string,
      _request: Parameters<BirdCoderAppSdkApiClient['rebindProjectRuntimeLocation']>[2],
    ): Promise<Awaited<ReturnType<BirdCoderAppSdkApiClient['rebindProjectRuntimeLocation']>>> {
      throw createUnexpectedMethodError('rebindProjectRuntimeLocation');
    },
    async submitApprovalDecision(
      _approvalId: string,
      _request: BirdCoderSubmitApprovalDecisionRequest,
    ): Promise<BirdCoderApprovalDecisionResult> {
      throw createUnexpectedMethodError('submitApprovalDecision');
    },
    async submitUserQuestionAnswer(
      _questionId: string,
      _request: BirdCoderSubmitUserQuestionAnswerRequest,
    ): Promise<BirdCoderUserQuestionAnswerResult> {
      throw createUnexpectedMethodError('submitUserQuestionAnswer');
    },
    async switchProjectGitBranch(
      _projectId: string,
      _request: BirdCoderSwitchProjectGitBranchRequest,
    ): Promise<BirdCoderProjectGitOverview> {
      throw createUnexpectedMethodError('switchProjectGitBranch');
    },
    async syncModelConfig(
      _request: BirdCoderSyncCodeEngineModelConfigRequest,
    ): Promise<BirdCoderCodeEngineModelConfigSyncResult> {
      throw createUnexpectedMethodError('syncModelConfig');
    },
    async updateCodingSession(
      _codingSessionId: string,
      _request: BirdCoderUpdateCodingSessionRequest,
    ): Promise<BirdCoderCodingSessionSummary> {
      throw createUnexpectedMethodError('updateCodingSession');
    },
    async updateProject(
      _projectId: string,
      _request: BirdCoderUpdateProjectRequest,
    ): Promise<BirdCoderProjectSummary> {
      throw createUnexpectedMethodError('updateProject');
    },
    async updateWorkspace(
      _workspaceId: string,
      _request: BirdCoderUpdateWorkspaceRequest,
    ): Promise<BirdCoderWorkspaceSummary> {
      throw createUnexpectedMethodError('updateWorkspace');
    },
    async upsertProjectCollaborator(
      _projectId: string,
      _request: BirdCoderUpsertProjectCollaboratorRequest,
    ): Promise<BirdCoderProjectCollaboratorSummary> {
      throw createUnexpectedMethodError('upsertProjectCollaborator');
    },
    async upsertWorkspaceMember(
      _workspaceId: string,
      _request: BirdCoderUpsertWorkspaceMemberRequest,
    ): Promise<BirdCoderWorkspaceMemberSummary> {
      throw createUnexpectedMethodError('upsertWorkspaceMember');
    },
  };

  return {
    ...stub,
    ...overrides,
  };
}

export function createBackendSdkClientContractStub(
  overrides: Partial<BirdCoderBackendSdkApiClient> = {},
): BirdCoderBackendSdkApiClient {
  const stub: BirdCoderBackendSdkApiClient = {
    async listAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]> {
      return [];
    },
    async listDeploymentTargets(
      _projectId: string,
    ): Promise<BirdCoderDeploymentTargetSummary[]> {
      return [];
    },
    async listGovernanceDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
      return [];
    },
    async listGovernanceTeams(
      _options?: BirdCoderWorkspaceScopedListRequest,
    ): Promise<BirdCoderTeamSummary[]> {
      return [];
    },
    async listPolicies(): Promise<BirdCoderIamPolicySummary[]> {
      return [];
    },
    async listReleases(): Promise<BirdCoderReleaseSummary[]> {
      return [];
    },
    async listTeamMembers(_teamId: string): Promise<BirdCoderTeamMemberSummary[]> {
      return [];
    },
  };

  return {
    ...stub,
    ...overrides,
  };
}
