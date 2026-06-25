import React, { ReactNode, useRef } from 'react';
import type {
  IAuthService,
  ICatalogService,
  ICollaborationService,
  IAppRuntimeReadService,
  IAppRuntimeWriteService,
  IDeploymentService,
  IDocumentService,
  IFileSystemService,
  IGitService,
  IPromptService,
  IProjectService,
  IReleaseService,
  ITeamService,
  IVipMembershipService,
  IWorkspaceService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  IDEContext,
  IIDEContext,
  createDefaultIdeContextValue,
  useIDEServices,
} from './ideServices.ts';

// Source-governance marker preserved for shell-runtime contracts:
// const IDEContext = createContext<IIDEContext | null>(null);

export interface IDEProviderProps {
  children: ReactNode;
  catalogService?: ICatalogService;
  workspaceService?: IWorkspaceService;
  projectService?: IProjectService;
  collaborationService?: ICollaborationService;
  appRuntimeReadService?: IAppRuntimeReadService;
  appRuntimeWriteService?: IAppRuntimeWriteService;
  deploymentService?: IDeploymentService;
  documentService?: IDocumentService;
  releaseService?: IReleaseService;
  teamService?: ITeamService;
  vipMembershipService?: IVipMembershipService;
  fileSystemService?: IFileSystemService;
  gitService?: IGitService;
  authService?: IAuthService;
  promptService?: IPromptService;
}

export const IDEProvider: React.FC<IDEProviderProps> = ({
  children,
  catalogService,
  workspaceService,
  projectService,
  collaborationService,
  appRuntimeReadService,
  appRuntimeWriteService,
  deploymentService,
  documentService,
  releaseService,
  teamService,
  vipMembershipService,
  fileSystemService,
  gitService,
  authService,
  promptService,
}) => {
  const defaultContextRef = useRef<IIDEContext | null>(null);
  defaultContextRef.current ??= createDefaultIdeContextValue();
  const defaultContext = defaultContextRef.current;

  return (
    <IDEContext.Provider
      value={{
        catalogService: catalogService ?? defaultContext.catalogService,
        workspaceService: workspaceService ?? defaultContext.workspaceService,
        projectService: projectService ?? defaultContext.projectService,
        collaborationService: collaborationService ?? defaultContext.collaborationService,
        appRuntimeReadService: appRuntimeReadService ?? defaultContext.appRuntimeReadService,
        appRuntimeWriteService: appRuntimeWriteService ?? defaultContext.appRuntimeWriteService,
        deploymentService: deploymentService ?? defaultContext.deploymentService,
        documentService: documentService ?? defaultContext.documentService,
        releaseService: releaseService ?? defaultContext.releaseService,
        teamService: teamService ?? defaultContext.teamService,
        vipMembershipService: vipMembershipService ?? defaultContext.vipMembershipService,
        fileSystemService: fileSystemService ?? defaultContext.fileSystemService,
        gitService: gitService ?? defaultContext.gitService,
        authService: authService ?? defaultContext.authService,
        promptService: promptService ?? defaultContext.promptService,
      }}
    >
      {children}
    </IDEContext.Provider>
  );
};
export { useIDEServices };
