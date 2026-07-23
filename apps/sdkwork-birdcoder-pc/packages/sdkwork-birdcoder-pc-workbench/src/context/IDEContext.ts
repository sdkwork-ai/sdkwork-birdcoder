import React, { type ReactNode, useRef } from 'react';
import type {
  IAuthService,
  IAgentSessionService,
  ICatalogService,
  IDocumentService,
  IFileSystemService,
  IGitService,
  IProjectRuntimeLocationService,
  IProjectService,
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
  agentSessionService?: IAgentSessionService;
  catalogService?: ICatalogService;
  projectService?: IProjectService;
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
  agentSessionService,
  catalogService,
  projectService,
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
        agentSessionService: agentSessionService ?? defaultContext.agentSessionService,
        catalogService: catalogService ?? defaultContext.catalogService,
        projectService: projectService ?? defaultContext.projectService,
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
