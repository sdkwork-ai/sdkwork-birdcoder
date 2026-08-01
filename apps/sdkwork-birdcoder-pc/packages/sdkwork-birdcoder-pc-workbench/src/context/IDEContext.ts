import React, { type ReactNode, useRef } from 'react';
import type {
  IAuthService,
  IAgentAutomationService,
  IAgentSessionService,
  IApplicationPublishService,
  ICatalogService,
  IDocumentService,
  IFileSystemService,
  IGitService,
  IProjectRuntimeLocationService,
  IProjectService,
  IAgentWorkspaceService,
  IPromptService,
  IVipMembershipService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  IDEContext,
  type IIDEContext,
  createDefaultIdeContextValue,
  useIDEServices,
} from './ideServices.ts';

export interface IDEProviderProps {
  children: ReactNode;
  agentAutomationService?: IAgentAutomationService;
  agentSessionService?: IAgentSessionService;
  applicationPublishService?: IApplicationPublishService;
  catalogService?: ICatalogService;
  projectService?: IProjectService;
  agentWorkspaceService?: IAgentWorkspaceService;
  promptService?: IPromptService;
  documentService?: IDocumentService;
  vipMembershipService?: IVipMembershipService;
  fileSystemService?: IFileSystemService;
  projectRuntimeLocationService?: IProjectRuntimeLocationService;
  gitService?: IGitService;
  authService?: IAuthService;
}

export const IDEProvider = ({
  children,
  agentAutomationService,
  agentSessionService,
  applicationPublishService,
  catalogService,
  projectService,
  agentWorkspaceService,
  promptService,
  documentService,
  vipMembershipService,
  fileSystemService,
  projectRuntimeLocationService,
  gitService,
  authService,
}: IDEProviderProps) => {
  const defaultContextRef = useRef<IIDEContext | null>(null);
  defaultContextRef.current ??= createDefaultIdeContextValue();
  const defaultContext = defaultContextRef.current;

  return React.createElement(
    IDEContext.Provider,
    {
      value: {
        agentAutomationService:
          agentAutomationService ?? defaultContext.agentAutomationService,
        agentSessionService: agentSessionService ?? defaultContext.agentSessionService,
        applicationPublishService:
          applicationPublishService ?? defaultContext.applicationPublishService,
        catalogService: catalogService ?? defaultContext.catalogService,
        projectService: projectService ?? defaultContext.projectService,
        agentWorkspaceService:
          agentWorkspaceService ?? defaultContext.agentWorkspaceService,
        promptService: promptService ?? defaultContext.promptService,
        documentService: documentService ?? defaultContext.documentService,
        vipMembershipService: vipMembershipService ?? defaultContext.vipMembershipService,
        fileSystemService: fileSystemService ?? defaultContext.fileSystemService,
        projectRuntimeLocationService:
          projectRuntimeLocationService ?? defaultContext.projectRuntimeLocationService,
        gitService: gitService ?? defaultContext.gitService,
        authService: authService ?? defaultContext.authService,
      },
    },
    children,
  );
};

export { useIDEServices };
