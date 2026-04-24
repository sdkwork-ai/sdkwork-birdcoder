import React, { type ReactNode, useRef } from 'react';
import type {
  IAdminDeploymentService,
  IAdminPolicyService,
  IAuthService,
  IAuditService,
  ICatalogService,
  ICollaborationService,
  ICoreReadService,
  ICoreWriteService,
  IDeploymentService,
  IDocumentService,
  IFileSystemService,
  IGitService,
  IPromptService,
  IProjectService,
  IReleaseService,
  ITeamService,
  IWorkspaceService,
} from '@sdkwork/birdcoder-infrastructure-runtime';
import {
  IDEContext,
  type IIDEContext,
  createDefaultIdeContextValue,
  useIDEServices,
} from './ideServices.ts';

export interface IDEProviderProps {
  children: ReactNode;
  adminDeploymentService?: IAdminDeploymentService;
  adminPolicyService?: IAdminPolicyService;
  catalogService?: ICatalogService;
  workspaceService?: IWorkspaceService;
  projectService?: IProjectService;
  collaborationService?: ICollaborationService;
  coreReadService?: ICoreReadService;
  coreWriteService?: ICoreWriteService;
  auditService?: IAuditService;
  deploymentService?: IDeploymentService;
  documentService?: IDocumentService;
  releaseService?: IReleaseService;
  teamService?: ITeamService;
  fileSystemService?: IFileSystemService;
  gitService?: IGitService;
  authService?: IAuthService;
  promptService?: IPromptService;
}

export const IDEProvider = ({
  children,
  adminDeploymentService,
  adminPolicyService,
  catalogService,
  workspaceService,
  projectService,
  collaborationService,
  coreReadService,
  coreWriteService,
  auditService,
  deploymentService,
  documentService,
  releaseService,
  teamService,
  fileSystemService,
  gitService,
  authService,
  promptService,
}: IDEProviderProps) => {
  const defaultContextRef = useRef<IIDEContext | null>(null);
  defaultContextRef.current ??= createDefaultIdeContextValue();
  const defaultContext = defaultContextRef.current;

  return React.createElement(
    IDEContext.Provider,
    {
      value: {
        adminDeploymentService: adminDeploymentService ?? defaultContext.adminDeploymentService,
        adminPolicyService: adminPolicyService ?? defaultContext.adminPolicyService,
        catalogService: catalogService ?? defaultContext.catalogService,
        workspaceService: workspaceService ?? defaultContext.workspaceService,
        projectService: projectService ?? defaultContext.projectService,
        collaborationService: collaborationService ?? defaultContext.collaborationService,
        coreReadService: coreReadService ?? defaultContext.coreReadService,
        coreWriteService: coreWriteService ?? defaultContext.coreWriteService,
        auditService: auditService ?? defaultContext.auditService,
        deploymentService: deploymentService ?? defaultContext.deploymentService,
        documentService: documentService ?? defaultContext.documentService,
        releaseService: releaseService ?? defaultContext.releaseService,
        teamService: teamService ?? defaultContext.teamService,
        fileSystemService: fileSystemService ?? defaultContext.fileSystemService,
        gitService: gitService ?? defaultContext.gitService,
        authService: authService ?? defaultContext.authService,
        promptService: promptService ?? defaultContext.promptService,
      },
    },
    children,
  );
};

export { useIDEServices };
