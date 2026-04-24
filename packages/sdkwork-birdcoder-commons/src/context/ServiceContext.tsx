import React, { createContext, useContext, useRef } from 'react';
import {
  IAdminDeploymentService,
  IAdminPolicyService,
  IAuditService,
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
import { createLazyDefaultIdeServices } from './lazyDefaultIdeServices.ts';

export interface IServices {
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
  gitService: IGitService;
  promptService: IPromptService;
}

function createDefaultServicesValue(): IServices {
  const defaultIdeServices = createLazyDefaultIdeServices();
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
    gitService: defaultIdeServices.gitService,
    promptService: defaultIdeServices.promptService,
  };
}

let fallbackServicesValue: IServices | null = null;

function getFallbackServicesValue(): IServices {
  fallbackServicesValue ??= createDefaultServicesValue();
  return fallbackServicesValue;
}

const ServiceContext = createContext<IServices | null>(null);

export function ServiceProvider({ children, services }: { children: React.ReactNode, services?: IServices }) {
  const defaultServicesRef = useRef<IServices | null>(null);
  defaultServicesRef.current ??= createDefaultServicesValue();
  return (
    <ServiceContext.Provider value={services ?? defaultServicesRef.current}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useServices() {
  return useContext(ServiceContext) ?? getFallbackServicesValue();
}
