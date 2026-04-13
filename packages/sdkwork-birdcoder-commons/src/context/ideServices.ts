import { createContext, useContext } from 'react';
import type { IChatEngine } from '@sdkwork/birdcoder-chat';
import type {
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
  createDefaultBirdCoderIdeServices,
} from '@sdkwork/birdcoder-infrastructure';
import { createChatEngineById } from '../workbench/engines.ts';

export interface IIDEContext {
  adminDeploymentService: IAdminDeploymentService;
  adminPolicyService: IAdminPolicyService;
  workspaceService: IWorkspaceService;
  projectService: IProjectService;
  coreReadService: ICoreReadService;
  coreWriteService: ICoreWriteService;
  auditService: IAuditService;
  deploymentService: IDeploymentService;
  documentService: IDocumentService;
  releaseService: IReleaseService;
  teamService: ITeamService;
  fileSystemService: IFileSystemService;
  authService: IAuthService;
  chatEngine: IChatEngine;
  setChatEngine: (engine: IChatEngine) => void;
  switchChatEngine: (name: string) => void;
}

export function createDefaultIdeContextValue(): IIDEContext {
  const defaultIdeServices = createDefaultBirdCoderIdeServices();
  return {
    adminDeploymentService: defaultIdeServices.adminDeploymentService,
    adminPolicyService: defaultIdeServices.adminPolicyService,
    workspaceService: defaultIdeServices.workspaceService,
    projectService: defaultIdeServices.projectService,
    coreReadService: defaultIdeServices.coreReadService,
    coreWriteService: defaultIdeServices.coreWriteService,
    auditService: defaultIdeServices.auditService,
    deploymentService: defaultIdeServices.deploymentService,
    documentService: defaultIdeServices.documentService,
    releaseService: defaultIdeServices.releaseService,
    teamService: defaultIdeServices.teamService,
    fileSystemService: defaultIdeServices.fileSystemService,
    authService: defaultIdeServices.authService,
    chatEngine: createChatEngineById('codex'),
    setChatEngine: () => {},
    switchChatEngine: () => {},
  };
}

let fallbackIdeContextValue: IIDEContext | null = null;

export function getFallbackIdeContextValue(): IIDEContext {
  fallbackIdeContextValue ??= createDefaultIdeContextValue();
  return fallbackIdeContextValue;
}

export const IDEContext = createContext<IIDEContext | null>(null);

export function useIDEServices() {
  return useContext(IDEContext) ?? getFallbackIdeContextValue();
}
