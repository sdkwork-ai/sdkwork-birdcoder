import { createContext, useContext } from 'react';
import type {
  BirdCoderDefaultIdeServices,
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
  IProjectService,
  IReleaseService,
  ITeamService,
  IWorkspaceService,
} from '@sdkwork/birdcoder-infrastructure';
import { createLazyDefaultIdeServices } from './lazyDefaultIdeServices.ts';

export interface IIDEContext {
  adminDeploymentService: IAdminDeploymentService;
  adminPolicyService: IAdminPolicyService;
  catalogService: ICatalogService;
  workspaceService: IWorkspaceService;
  projectService: IProjectService;
  collaborationService: ICollaborationService;
  coreReadService: ICoreReadService;
  coreWriteService: ICoreWriteService;
  auditService: IAuditService;
  deploymentService: IDeploymentService;
  documentService: IDocumentService;
  releaseService: IReleaseService;
  teamService: ITeamService;
  fileSystemService: IFileSystemService;
  authService: IAuthService;
}

export function createDefaultIdeContextValue(): IIDEContext {
  const defaultIdeServices: BirdCoderDefaultIdeServices = createLazyDefaultIdeServices();
  return {
    adminDeploymentService: defaultIdeServices.adminDeploymentService,
    adminPolicyService: defaultIdeServices.adminPolicyService,
    catalogService: defaultIdeServices.catalogService,
    workspaceService: defaultIdeServices.workspaceService,
    projectService: defaultIdeServices.projectService,
    collaborationService: defaultIdeServices.collaborationService,
    coreReadService: defaultIdeServices.coreReadService,
    coreWriteService: defaultIdeServices.coreWriteService,
    auditService: defaultIdeServices.auditService,
    deploymentService: defaultIdeServices.deploymentService,
    documentService: defaultIdeServices.documentService,
    releaseService: defaultIdeServices.releaseService,
    teamService: defaultIdeServices.teamService,
    fileSystemService: defaultIdeServices.fileSystemService,
    authService: defaultIdeServices.authService,
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
