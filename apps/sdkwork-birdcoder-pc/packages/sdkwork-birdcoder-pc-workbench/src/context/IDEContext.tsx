import React, { ReactNode, useRef } from 'react';
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
  IIDEContext,
  createDefaultIdeContextValue,
  useIDEServices,
} from './ideServices.ts';

// Source-governance marker preserved for shell-runtime contracts:
// const IDEContext = createContext<IIDEContext | null>(null);

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

export const IDEProvider: React.FC<IDEProviderProps> = ({
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
}) => {
  const defaultContextRef = useRef<IIDEContext | null>(null);
  defaultContextRef.current ??= createDefaultIdeContextValue();
  const defaultContext = defaultContextRef.current;

  return (
    <IDEContext.Provider
      value={{
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
      }}
    >
      {children}
    </IDEContext.Provider>
  );
};
export { useIDEServices };
