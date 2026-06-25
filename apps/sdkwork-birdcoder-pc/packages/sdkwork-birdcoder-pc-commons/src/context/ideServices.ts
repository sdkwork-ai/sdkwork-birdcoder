import { createContext, useContext } from 'react';
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
import { createLazyDefaultIdeServices, type AppIdeServices } from './lazyDefaultIdeServices.ts';

export interface IIDEContext {
  catalogService: ICatalogService;
  workspaceService: IWorkspaceService;
  projectService: IProjectService;
  collaborationService: ICollaborationService;
  appRuntimeReadService: IAppRuntimeReadService;
  appRuntimeWriteService: IAppRuntimeWriteService;
  deploymentService: IDeploymentService;
  documentService: IDocumentService;
  releaseService: IReleaseService;
  teamService: ITeamService;
  vipMembershipService: IVipMembershipService;
  fileSystemService: IFileSystemService;
  gitService: IGitService;
  authService: IAuthService;
  promptService: IPromptService;
}

export function createDefaultIdeContextValue(): IIDEContext {
  const defaultIdeServices: AppIdeServices = createLazyDefaultIdeServices();
  return {
    catalogService: defaultIdeServices.catalogService,
    workspaceService: defaultIdeServices.workspaceService,
    projectService: defaultIdeServices.projectService,
    collaborationService: defaultIdeServices.collaborationService,
    appRuntimeReadService: defaultIdeServices.appRuntimeReadService,
    appRuntimeWriteService: defaultIdeServices.appRuntimeWriteService,
    deploymentService: defaultIdeServices.deploymentService,
    documentService: defaultIdeServices.documentService,
    releaseService: defaultIdeServices.releaseService,
    teamService: defaultIdeServices.teamService,
    vipMembershipService: defaultIdeServices.vipMembershipService,
    fileSystemService: defaultIdeServices.fileSystemService,
    gitService: defaultIdeServices.gitService,
    authService: defaultIdeServices.authService,
    promptService: defaultIdeServices.promptService,
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
