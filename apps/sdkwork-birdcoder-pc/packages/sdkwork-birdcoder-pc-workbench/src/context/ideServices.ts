import { createContext, useContext } from 'react';
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
  IWorkspaceService,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { createLazyDefaultIdeServices, type AppIdeServices } from './lazyDefaultIdeServices.ts';

export interface IIDEContext {
  agentSessionService: IAgentSessionService;
  catalogService: ICatalogService;
  workspaceService: IWorkspaceService;
  projectService: IProjectService;
  promptService: IPromptService;
  documentService: IDocumentService;
  vipMembershipService: IVipMembershipService;
  fileSystemService: IFileSystemService;
  projectRuntimeLocationService: IProjectRuntimeLocationService;
  gitService: IGitService;
  authService: IAuthService;
}

export function createDefaultIdeContextValue(): IIDEContext {
  const defaultIdeServices: AppIdeServices = createLazyDefaultIdeServices();
  return {
    agentSessionService: defaultIdeServices.agentSessionService,
    catalogService: defaultIdeServices.catalogService,
    workspaceService: defaultIdeServices.workspaceService,
    projectService: defaultIdeServices.projectService,
    promptService: defaultIdeServices.promptService,
    documentService: defaultIdeServices.documentService,
    vipMembershipService: defaultIdeServices.vipMembershipService,
    fileSystemService: defaultIdeServices.fileSystemService,
    projectRuntimeLocationService: defaultIdeServices.projectRuntimeLocationService,
    gitService: defaultIdeServices.gitService,
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
