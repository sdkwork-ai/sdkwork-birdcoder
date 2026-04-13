import React, { ReactNode, useState, useCallback, useRef } from 'react';
import { IChatEngine } from '@sdkwork/birdcoder-chat';
import {
  IAdminDeploymentService,
  IAdminPolicyService,
  IAuthService,
  IAuditService,
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
  IIDEContext,
  createDefaultIdeContextValue,
  useIDEServices,
} from './ideServices';
import { createChatEngineById } from '../workbench/engines';

// Source-governance marker preserved for shell-runtime contracts:
// const IDEContext = createContext<IIDEContext | null>(null);

export interface IDEProviderProps {
  children: ReactNode;
  adminDeploymentService?: IAdminDeploymentService;
  adminPolicyService?: IAdminPolicyService;
  workspaceService?: IWorkspaceService;
  projectService?: IProjectService;
  coreReadService?: ICoreReadService;
  coreWriteService?: ICoreWriteService;
  auditService?: IAuditService;
  deploymentService?: IDeploymentService;
  documentService?: IDocumentService;
  releaseService?: IReleaseService;
  teamService?: ITeamService;
  fileSystemService?: IFileSystemService;
  authService?: IAuthService;
  initialChatEngine?: IChatEngine;
}

export const IDEProvider: React.FC<IDEProviderProps> = ({
  children,
  adminDeploymentService,
  adminPolicyService,
  workspaceService,
  projectService,
  coreReadService,
  coreWriteService,
  auditService,
  deploymentService,
  documentService,
  releaseService,
  teamService,
  fileSystemService,
  authService,
  initialChatEngine,
}) => {
  const defaultContextRef = useRef<IIDEContext | null>(null);
  defaultContextRef.current ??= createDefaultIdeContextValue();
  const defaultContext = defaultContextRef.current;
  const [chatEngine, setChatEngine] = useState<IChatEngine>(initialChatEngine ?? defaultContext.chatEngine);

  const switchChatEngine = useCallback((name: string) => {
    setChatEngine(createChatEngineById(name));
  }, []);

  return (
    <IDEContext.Provider
      value={{
        adminDeploymentService: adminDeploymentService ?? defaultContext.adminDeploymentService,
        adminPolicyService: adminPolicyService ?? defaultContext.adminPolicyService,
        workspaceService: workspaceService ?? defaultContext.workspaceService,
        projectService: projectService ?? defaultContext.projectService,
        coreReadService: coreReadService ?? defaultContext.coreReadService,
        coreWriteService: coreWriteService ?? defaultContext.coreWriteService,
        auditService: auditService ?? defaultContext.auditService,
        deploymentService: deploymentService ?? defaultContext.deploymentService,
        documentService: documentService ?? defaultContext.documentService,
        releaseService: releaseService ?? defaultContext.releaseService,
        teamService: teamService ?? defaultContext.teamService,
        fileSystemService: fileSystemService ?? defaultContext.fileSystemService,
        authService: authService ?? defaultContext.authService,
        chatEngine,
        setChatEngine,
        switchChatEngine,
      }}
    >
      {children}
    </IDEContext.Provider>
  );
};
export { useIDEServices };
