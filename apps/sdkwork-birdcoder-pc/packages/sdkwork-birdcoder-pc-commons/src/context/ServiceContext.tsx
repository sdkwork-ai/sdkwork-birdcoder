import React, { createContext, useContext, useRef } from 'react';
import {
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

export interface IServices extends AppIdeServices {}

function createDefaultServicesValue(): IServices {
  return createLazyDefaultIdeServices();
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
