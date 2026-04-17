import React, { type ReactNode, useRef } from 'react';
import type {
  IAdminDeploymentService,
  IAdminPolicyService,
  IAuthService,
  IAuditService,
  ICollaborationService,
  ICoreReadService,
  ICoreWriteService,
  IDeploymentService,
  IDocumentService,
  IFileSystemService,
  IProjectService,
  IReleaseService,
  ITeamService,
  IWorkspaceService,
} from '@sdkwork/birdcoder-infrastructure';
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
  authService?: IAuthService;
}

export const IDEProvider = ({
  children,
  adminDeploymentService,
  adminPolicyService,
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
  authService,
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
        authService: authService ?? defaultContext.authService,
      },
    },
    children,
  );
};

export { useIDEServices };
